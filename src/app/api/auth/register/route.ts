import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, password, courseName, batchName, rollNumber } = body;

    if (!name || !email || !password || !courseName || !batchName || !rollNumber) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    const emailLower = email.toLowerCase().trim();

    // Check if email exists
    const existing = await db
      .collection('users')
      .where('email', '==', emailLower)
      .limit(1)
      .get();

    if (!existing.empty) {
      return NextResponse.json(
        { error: 'Email is already registered' },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = crypto.randomUUID();
    const now = new Date();

    const userData = {
      name: name.trim(),
      email: emailLower,
      passwordHash,
      role: 'STUDENT',
      courseName: courseName.trim(),
      batchName: batchName.trim(),
      rollNumber: rollNumber.trim(),
      status: 'PENDING',
      points: 0,
      lastPenaltyCheck: now,
      createdAt: now,
      updatedAt: now,
    };

    await db.collection('users').doc(userId).set(userData);

    return NextResponse.json(
      {
        message: 'Registration successful. Pending admin approval.',
        user: {
          id: userId,
          name: userData.name,
          email: userData.email,
          status: userData.status,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error during registration' },
      { status: 500 }
    );
  }
}
