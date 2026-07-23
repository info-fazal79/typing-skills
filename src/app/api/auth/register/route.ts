import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { checkRateLimit } from '@/lib/rateLimit';
import bcrypt from 'bcryptjs';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    if (!checkRateLimit(req, 'register', 10, 15 * 60 * 1000)) {
      return NextResponse.json(
        { error: 'Too many registration attempts. Please try again in a few minutes.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { name, email, password, registrationType, courseName, batchName, rollNumber } = body;

    if (!name || !email || !password || !registrationType) {
      return NextResponse.json(
        { error: 'Name, email, password, and registration type are required' },
        { status: 400 }
      );
    }

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    const emailLower = email.toLowerCase().trim();

    // Check if email exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', emailLower)
      .limit(1);

    if (existing && existing.length > 0) {
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

      // Verify the submitted roll number is actually on the admin's approved
      // list for this batch. The register form's dropdown already only
      // offers approved, unclaimed rolls — but that's UX only; a request
      // built directly (bypassing the dropdown) could otherwise submit any
      // string here.
      const { data: meta } = await supabase
        .from('metadata')
        .select('roll_numbers_json')
        .eq('id', 'selectors')
        .single();

      const approvedRolls: string[] = meta?.roll_numbers_json?.[batchName.trim()] ?? [];
      if (!approvedRolls.includes(rollNumber.trim())) {
        return NextResponse.json(
          { error: `Roll number ${rollNumber} is not on the approved list for ${batchName}. Contact your admin if this looks wrong.` },
          { status: 400 }
        );
      }

      // Verify Roll Number is not already registered in the same batch
      const { data: existingRoll } = await supabase
        .from('users')
        .select('id')
        .eq('batch_name', batchName.trim())
        .eq('roll_number', rollNumber.trim())
        .limit(1);

      if (existingRoll && existingRoll.length > 0) {
        return NextResponse.json(
          { error: `Roll number ${rollNumber} is already registered in ${batchName}` },
          { status: 400 }
        );
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = crypto.randomUUID();
    const now = new Date().toISOString();

    // ── Generate unique slug from name ───────────────────────────────────────
    const generateSlugBase = (n: string) =>
      n.toLowerCase().trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '') || 'user';

    const baseSlug = generateSlugBase(name.trim());
    let slug = baseSlug;

    // Check if slug is taken
    const { data: existingSlug } = await supabase
      .from('users').select('id').eq('slug', slug).limit(1);

    if (existingSlug && existingSlug.length > 0) {
      // Try with roll number first (for students)
      if (rollNumber) {
        slug = `${baseSlug}-${String(rollNumber).toLowerCase().replace(/\s+/g, '-')}`;
        const { data: existingSlug2 } = await supabase
          .from('users').select('id').eq('slug', slug).limit(1);
        if (existingSlug2 && existingSlug2.length > 0) {
          slug = `${baseSlug}-${Math.floor(100 + Math.random() * 900)}`;
        }
      } else {
        slug = `${baseSlug}-${Math.floor(100 + Math.random() * 900)}`;
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    let userData: any /* eslint-disable-line @typescript-eslint/no-explicit-any */ = {
      id: userId,
      name: name.trim(),
      email: emailLower,
      password_hash: passwordHash,
      slug,
      created_at: now,
      updated_at: now,
    };

    if (registrationType === 'STUDENT') {
      userData = {
        ...userData,
        role: 'STUDENT',
        status: 'PENDING',
        course_name: courseName.trim(),
        batch_name: batchName.trim(),
        roll_number: rollNumber.trim(),
        points: 0,
        last_penalty_check: now,
      };
    } else {
      userData = {
        ...userData,
        role: 'USER',
        status: 'APPROVED',
        points: 0,
      };
    }

    const { error: insertErr } = await supabase.from('users').insert(userData);
    if (insertErr) {
      // Postgres unique_violation — the pre-checks above already caught the
      // common case, but a second registration for the same email or
      // batch+roll can still land in the tiny window between that check and
      // this insert. The DB constraint is the real guard; this just keeps
      // the error message friendly instead of falling through to a generic
      // 500 when the race actually happens.
      if (insertErr.code === '23505') {
        return NextResponse.json(
          { error: 'That email or roll number was just registered by someone else. Please check your details and try again.' },
          { status: 409 }
        );
      }
      throw insertErr;
    }

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
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error during registration' },
      { status: 500 }
    );
  }
}
