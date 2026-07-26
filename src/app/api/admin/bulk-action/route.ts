import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getUserFromRequest } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const admin = await getUserFromRequest(req);
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 401 });
    }

    const { userIds, action } = await req.json();

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ error: 'No users selected.' }, { status: 400 });
    }

    if (action !== 'APPROVE' && action !== 'REJECT') {
      return NextResponse.json({ error: 'Invalid action type.' }, { status: 400 });
    }

    // The admin UI only ever sends PENDING, non-admin user ids here (the
    // bulk action bar lives on the Pending Approvals tab), but that's a
    // client-side assumption, not a server-enforced one — unlike the
    // single-user PUT/DELETE routes in admin/students/route.ts, which both
    // explicitly reject admin targets. Without this, a crafted request
    // against this endpoint could approve/delete arbitrary accounts,
    // including other admins or already-active students (permanently
    // losing their practice/task history on REJECT).
    const { data: targets, error: targetsErr } = await supabase
      .from('users')
      .select('id, role, status')
      .in('id', userIds);
    if (targetsErr) throw targetsErr;

    const foundIds = new Set((targets || []).map((t) => t.id));
    const missingIds = userIds.filter((id: string) => !foundIds.has(id));
    if (missingIds.length > 0) {
      return NextResponse.json({ error: 'One or more selected users were not found.' }, { status: 404 });
    }

    const adminTargets = (targets || []).filter((t) => t.role === 'ADMIN');
    if (adminTargets.length > 0) {
      return NextResponse.json({ error: 'Cannot approve or reject admin accounts.' }, { status: 403 });
    }

    if (action === 'REJECT') {
      const nonPending = (targets || []).filter((t) => t.status !== 'PENDING');
      if (nonPending.length > 0) {
        return NextResponse.json(
          { error: 'Bulk reject only applies to pending registrations — one or more selected users are already approved.' },
          { status: 400 }
        );
      }
    }

    if (action === 'APPROVE') {
      const { error } = await supabase
        .from('users')
        .update({ status: 'APPROVED', updated_at: new Date().toISOString() })
        .in('id', userIds);
      if (error) throw error;
    } else {
      // Clean up dependent rows first, consistent with the single-user
      // delete path in admin/students/route.ts — avoids orphaned data (or
      // an FK-violation aborting the whole batch) if the DB has no ON
      // DELETE CASCADE set up for these foreign keys. Bulk-reject only
      // targets PENDING users (enforced above), who can't have practice/task
      // rows yet, but this keeps the two delete paths in sync regardless.
      await supabase.from('practice_sessions').delete().in('user_id', userIds);
      await supabase.from('task_submissions').delete().in('user_id', userIds);

      const { error } = await supabase
        .from('users')
        .delete()
        .in('id', userIds);
      if (error) throw error;
    }

    return NextResponse.json({
      message: `Successfully ${action === 'APPROVE' ? 'approved' : 'rejected (and deleted)'} ${userIds.length} user(s).`,
    });
  } catch (error) {
    console.error('Bulk action error:', error);
    return NextResponse.json(
      { error: 'Internal server error during bulk action.' },
      { status: 500 }
    );
  }
}
