import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { signToken } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';
import bcrypt from 'bcryptjs';

// A syntactically real bcrypt hash (of a placeholder, never a real password)
// to compare against when no user is found — computed once at module load,
// not per-request. Without this, an unregistered email returned instantly
// while a registered one with a wrong password paid bcrypt's ~100ms compare
// cost, making the response time itself distinguish "this email exists"
// from "it doesn't," despite the identical error message.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password-timing-safety-placeholder', 10);

export async function POST(req: NextRequest) {
  try {
    if (!checkRateLimit(req, 'login', 10, 15 * 60 * 1000)) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again in a few minutes.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const emailLower = email.toLowerCase().trim();

    // Find user by email
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', emailLower)
      .single();

    // Always run a bcrypt compare, even when the user doesn't exist, so the
    // response time doesn't itself reveal whether the email is registered.
    const isPasswordValid = user
      ? await bcrypt.compare(password, user.password_hash)
      : await bcrypt.compare(password, DUMMY_HASH);

    if (error || !user || !isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    if (user.status === 'REJECTED') {
      return NextResponse.json(
        { error: 'Your registration request was rejected by an administrator.' },
        { status: 403 }
      );
    }

    if (user.status === 'SUSPENDED') {
      return NextResponse.json(
        { error: 'Your account has been suspended by an administrator.' },
        { status: 403 }
      );
    }

    const token = signToken({
      userId: user.id,
      role: user.role,
      email: user.email,
    });

    const response = NextResponse.json({
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        courseName: user.course_name,
        batchName: user.batch_name,
        rollNumber: user.roll_number,
        points: user.points,
        avatarUrl: user.avatar_url ?? null,
      },
    });

    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error during login' },
      { status: 500 }
    );
  }
}
