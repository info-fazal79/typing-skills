import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getUserFromRequest } from '@/lib/auth';

// GET: Fetch user directory with optional filters
export async function GET(req: NextRequest) {
  try {
    const admin = await getUserFromRequest(req);
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const course = searchParams.get('course');
    const batch = searchParams.get('batch');
    const roll = searchParams.get('roll');
    // 'STUDENT' | 'USER' | 'ALL' (default) — General accounts were previously
    // invisible here entirely (hardcoded to STUDENT only), so admins had no
    // way to see or manage them.
    const role = searchParams.get('role') || 'ALL';

    let query = supabase
      .from('users')
      .select('*')
      .neq('role', 'ADMIN');

    if (role === 'STUDENT' || role === 'USER') query = query.eq('role', role);
    if (status) query = query.eq('status', status);
    if (batch) query = query.eq('batch_name', batch);

    const { data: snap, error } = await query;
    if (error) throw error;

    let students = (snap || []).map((d) => ({
      id: d.id,
      name: d.name,
      email: d.email,
      role: d.role,
      courseName: d.course_name,
      batchName: d.batch_name,
      rollNumber: d.roll_number,
      status: d.status,
      points: d.points ?? 0,
      createdAt: new Date(d.created_at),
    }));

    // Client-side filtering for contains-style filters
    if (course) {
      students = students.filter((s) => s.courseName?.toLowerCase().includes(course.toLowerCase()));
    }
    if (roll) {
      students = students.filter((s) => s.rollNumber?.toLowerCase().includes(roll.toLowerCase()));
    }

    // Sort: PENDING first, then by createdAt desc
    students.sort((a, b) => {
      if (a.status === 'PENDING' && b.status !== 'PENDING') return -1;
      if (a.status !== 'PENDING' && b.status === 'PENDING') return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return NextResponse.json({ students });
  } catch (error) {
    console.error('Fetch students error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT: Update student status (Approve, Reject, Suspend, Unsuspend)
export async function PUT(req: NextRequest) {
  try {
    const admin = await getUserFromRequest(req);
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { studentId, status } = body;

    if (!studentId || !status) {
      return NextResponse.json({ error: 'Missing studentId or status' }, { status: 400 });
    }

    if (!['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
    }

    const { data: target } = await supabase.from('users').select('role').eq('id', studentId).single();
    if (target?.role === 'ADMIN') {
      return NextResponse.json({ error: 'Cannot change status of an admin account' }, { status: 403 });
    }

    const updateData: Record<string, any /* eslint-disable-line @typescript-eslint/no-explicit-any */> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'APPROVED') {
      updateData.last_penalty_check = new Date().toISOString();
    }

    const { data: updated, error: updateErr } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', studentId)
      .select('id, name, email, status')
      .single();

    if (updateErr) throw updateErr;

    return NextResponse.json({
      message: `Student status successfully updated to ${status}`,
      student: updated,
    });
  } catch (error) {
    console.error('Update student status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Permanently remove a user account and their data (any status, not just pending)
export async function DELETE(req: NextRequest) {
  try {
    const admin = await getUserFromRequest(req);
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    if (userId === admin.id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 403 });
    }

    const { data: target } = await supabase.from('users').select('id, role, name').eq('id', userId).single();
    if (!target) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    if (target.role === 'ADMIN') {
      return NextResponse.json({ error: 'Cannot delete an admin account' }, { status: 403 });
    }

    // Clean up dependent rows first in case the DB has no ON DELETE CASCADE
    // set up for these foreign keys — avoids orphaned data or an FK violation
    // aborting the user deletion.
    await supabase.from('practice_sessions').delete().eq('user_id', userId);
    await supabase.from('task_submissions').delete().eq('user_id', userId);

    const { error: deleteErr } = await supabase.from('users').delete().eq('id', userId);
    if (deleteErr) throw deleteErr;

    return NextResponse.json({ message: `${target.name}'s account was permanently deleted.` });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
