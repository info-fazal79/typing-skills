import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { db } from './firebase';

const JWT_SECRET = process.env.JWT_SECRET || 'typing_institute_secret_key_987654321';

export interface TokenPayload {
  userId: string;
  role: string;
  email: string;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch (error) {
    return null;
  }
}

export async function getUserFromRequest(req: NextRequest) {
  const tokenCookie = req.cookies.get('token');
  if (!tokenCookie) return null;

  const payload = verifyToken(tokenCookie.value);
  if (!payload) return null;

  try {
    const userDoc = await db.collection('users').doc(payload.userId).get();
    if (!userDoc.exists) return null;

    const data = userDoc.data()!;
    return {
      id: userDoc.id,
      name: data.name,
      email: data.email,
      role: data.role,
      courseName: data.courseName ?? null,
      batchName: data.batchName ?? null,
      rollNumber: data.rollNumber ?? null,
      status: data.status,
      points: data.points ?? 0,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
    };
  } catch (e) {
    return null;
  }
}
