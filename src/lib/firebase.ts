import type { App } from 'firebase-admin/app';
import type { Firestore } from 'firebase-admin/firestore';

let _app: App | null = null;
let _db: Firestore | null = null;

function getApp(): App {
  if (!_app) {
    // Dynamic imports to avoid module-level initialization during build
    const { initializeApp, getApps, cert } = require('firebase-admin/app');
    const fs = require('fs');
    const path = require('path');

    if (!getApps().length) {
      let parsedServiceAccount: any = null;

      // 1. Try to load from local file first (for cPanel / local dev)
      try {
        const keyPath = path.join(process.cwd(), 'firebase-key.json');
        if (fs.existsSync(keyPath)) {
          const fileContent = fs.readFileSync(keyPath, 'utf8');
          parsedServiceAccount = JSON.parse(fileContent);
          console.log('Firebase initialized using local firebase-key.json');
        }
      } catch (err) {
        console.warn('Could not read firebase-key.json, falling back to ENV...', err);
      }

      // 2. Fallback to Environment Variable (for Vercel)
      if (!parsedServiceAccount) {
        const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
        if (!serviceAccountEnv) {
          throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is not set and firebase-key.json is missing.');
        }
        try {
          parsedServiceAccount = JSON.parse(serviceAccountEnv);
          console.log('Firebase initialized using FIREBASE_SERVICE_ACCOUNT env var');
        } catch (err) {
          throw new Error('Failed to parse FIREBASE_SERVICE_ACCOUNT env var as JSON. Check your environment variables.');
        }
      }

      if (parsedServiceAccount.private_key) {
        // Vercel sometimes escapes newlines in env variables
        parsedServiceAccount.private_key = parsedServiceAccount.private_key.replace(/\\n/g, '\n');
      }

      _app = initializeApp({
        credential: cert(parsedServiceAccount),
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
