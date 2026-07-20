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

    if (action === 'APPROVE') {
      const { error } = await supabase
        .from('users')
        .update({ status: 'APPROVED', updated_at: new Date().toISOString() })
        .in('id', userIds);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('users')
        .delete()
        .in('id', userIds);
      if (error) throw error;
    }

    return NextResponse.json({
      message: `Successfully ${action === 'APPROVE' ? 'approved' : 'rejected (and deleted)'} ${userIds.length} user(s).`,
    });
  } catch (error: any) {
    console.error('Bulk action error:', error);
    return NextResponse.json(
      { error: 'Internal server error during bulk action.' },
      { status: 500 }
    );
  }
}
