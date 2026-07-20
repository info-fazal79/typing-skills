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

    let query = supabase
      .from('users')
      .select('*')
      .eq('role', 'STUDENT');

    if (status) query = query.eq('status', status);
    if (batch) query = query.eq('batch_name', batch);

    const { data: snap, error } = await query;
    if (error) throw error;

    let students = (snap || []).map((d) => ({
      id: d.id,
      name: d.name,
      email: d.email,
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
  } catch (error: any) {
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

    const updateData: Record<string, any> = {
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
  } catch (error: any) {
    console.error('Update student status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
