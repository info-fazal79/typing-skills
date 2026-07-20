import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { supabase } from './supabase';

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
  } catch {
    return null;
  }
}

export async function getUserFromRequest(req: NextRequest) {
  const tokenCookie = req.cookies.get('token');
  if (!tokenCookie) return null;

  const payload = verifyToken(tokenCookie.value);
  if (!payload) return null;

  try {
    const { data: userDoc, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', payload.userId)
      .single();

    if (error || !userDoc) return null;

    return {
      id: userDoc.id,
      name: userDoc.name,
      email: userDoc.email,
      role: userDoc.role,
      courseName: userDoc.course_name,
      batchName: userDoc.batch_name,
      rollNumber: userDoc.roll_number,
      status: userDoc.status,
      points: userDoc.points,
      createdAt: new Date(userDoc.created_at),
    };
  } catch {
    return null;
  }
}
