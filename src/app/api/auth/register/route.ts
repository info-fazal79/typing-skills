import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, password, registrationType, courseName, batchName, rollNumber } = body;

    if (!name || !email || !password || !registrationType) {
      return NextResponse.json(
        { error: 'Name, email, password, and registration type are required' },
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

    // Additional validation for Student Registration
    if (registrationType === 'STUDENT') {
      if (!courseName || !batchName || !rollNumber) {
        return NextResponse.json(
          { error: 'Course, Batch, and Roll Number are required for Student Registration' },
          { status: 400 }
        );
      }

      // Verify Roll Number is not already registered in the same batch
      const existingRoll = await db
        .collection('users')
        .where('batchName', '==', batchName.trim())
        .where('rollNumber', '==', rollNumber.trim())
        .limit(1)
        .get();

      if (!existingRoll.empty) {
        return NextResponse.json(
          { error: `Roll number ${rollNumber} is already registered in ${batchName}` },
          { status: 400 }
        );
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = crypto.randomUUID();
    const now = new Date();

    let userData: any = {
      name: name.trim(),
      email: emailLower,
      passwordHash,
      createdAt: now,
      updatedAt: now,
    };

    if (registrationType === 'STUDENT') {
      userData = {
        ...userData,
        role: 'STUDENT',
        status: 'PENDING',
        courseName: courseName.trim(),
        batchName: batchName.trim(),
        rollNumber: rollNumber.trim(),
        points: 0,
        lastPenaltyCheck: now,
      };
    } else {
      userData = {
        ...userData,
        role: 'USER',
        status: 'APPROVED',
        points: 0, // General users can also have points
      };
    }

    await db.collection('users').doc(userId).set(userData);

    return NextResponse.json(
      {
        message: registrationType === 'STUDENT' 
          ? 'Registration successful. Pending admin approval.' 
          : 'Registration successful. You can now log in.',
        user: {
          id: userId,
          name: userData.name,
          email: userData.email,
          status: userData.status,
          role: userData.role,
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
