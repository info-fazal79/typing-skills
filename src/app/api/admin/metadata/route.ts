import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getUserFromRequest } from '@/lib/auth';

// GET: Fetch metadata selectors (Courses, Batches, Roll Numbers). Left
// unauthenticated on purpose — the public register form needs the course
// list before a user has any session. But roll_numbers_json is the full
// roster of every valid roll number for every batch; the register form
// never actually reads it (its roll dropdown is populated separately by the
// already-filtered /api/auth/available-rolls), so it's only returned here
// for the authenticated admin metadata editor, not to anonymous callers.
export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    const isAdmin = user?.role === 'ADMIN';

    const { data, error } = await supabase
      .from('metadata')
      .select('courses_json, roll_numbers_json')
      .eq('id', 'selectors')
      .single();

    if (error || !data) {
      return NextResponse.json({ courses: {}, rollNumbersByBatch: {} });
    }

    return NextResponse.json({
      courses: data.courses_json ?? {},
      rollNumbersByBatch: isAdmin ? (data.roll_numbers_json ?? {}) : {},
    });
  } catch (error) {
    console.error('Failed to fetch metadata:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Update metadata selectors (Admin only)
export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await req.json();

    if (typeof data !== 'object' || !data.courses || !data.rollNumbersByBatch) {
      return NextResponse.json({ error: 'Invalid data format' }, { status: 400 });
    }

    const { error: upsertErr } = await supabase.from('metadata').upsert({
      id: 'selectors',
      courses_json: data.courses,
      roll_numbers_json: data.rollNumbersByBatch,
    });

    if (upsertErr) throw upsertErr;

    return NextResponse.json({ message: 'Metadata updated successfully', data });
  } catch (error) {
    console.error('Failed to update metadata:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
