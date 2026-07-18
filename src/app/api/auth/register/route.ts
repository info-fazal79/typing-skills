import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, password, courseName, batchName, rollNumber } = body;

    // Validation
    if (!name || !email || !password || !courseName || !batchName || !rollNumber) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    const emailLower = email.toLowerCase().trim();

    // Check if email exists
    const existingUser = await prisma.user.findUnique({
      where: { email: emailLower },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email is already registered' },
        { status: 400 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user in PENDING state
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: emailLower,
        passwordHash,
        role: 'STUDENT',
        courseName: courseName.trim(),
        batchName: batchName.trim(),
        rollNumber: rollNumber.trim(),
        status: 'PENDING',
        points: 0,
      },
    });

    return NextResponse.json(
      {
        message: 'Registration successful. Pending admin approval.',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          status: user.status,
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
