import type { App } from 'firebase-admin/app';
import type { Firestore } from 'firebase-admin/firestore';

let _app: App | null = null;
let _db: Firestore | null = null;

function getApp(): App {
  if (!_app) {
    // Dynamic imports to avoid module-level initialization during build
    const { initializeApp, getApps, cert } = require('firebase-admin/app');

    if (!getApps().length) {
      const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
      if (!serviceAccount) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is not set.');
      }
      _app = initializeApp({
        credential: cert(JSON.parse(serviceAccount)),
      });
    } else {
      _app = getApps()[0];
    }
  }
  return _app!;
}

export function getDb(): Firestore {
  if (!_db) {
    const { getFirestore } = require('firebase-admin/firestore');
    _db = getFirestore(getApp());
  }
  return _db!;
}

// Convenience export — calling db triggers lazy init
export const db = new Proxy({} as Firestore, {
  get(_target, prop) {
    const firestoreDb = getDb();
    const value = (firestoreDb as any)[prop];
    return typeof value === 'function' ? value.bind(firestoreDb) : value;
  },
});
