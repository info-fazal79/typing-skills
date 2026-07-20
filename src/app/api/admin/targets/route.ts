import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getUserFromRequest } from '@/lib/auth';

// GET: Fetch all batch targets
export async function GET(req: NextRequest) {
  try {
    const admin = await getUserFromRequest(req);
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: targets, error } = await supabase
      .from('batch_targets')
      .select('*')
      .order('batch_name', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ targets: targets || [] });
  } catch (error) {
    console.error('Fetch targets error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Upsert target configuration for a batch
export async function POST(req: NextRequest) {
  try {
    const admin = await getUserFromRequest(req);
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { batchName, dailyTargetMinutes, pointsDeduction } = body;

    if (!batchName || dailyTargetMinutes === undefined || pointsDeduction === undefined) {
      return NextResponse.json(
        { error: 'Missing batchName, dailyTargetMinutes, or pointsDeduction' },
        { status: 400 }
      );
    }

    const trimmedBatch = batchName.trim();

    const { error: upsertErr } = await supabase.from('batch_targets').upsert({
      batch_name: trimmedBatch,
      daily_target_minutes: parseInt(dailyTargetMinutes),
      points_deduction: parseInt(pointsDeduction),
    });

    if (upsertErr) throw upsertErr;

    return NextResponse.json({
      message: 'Batch target configuration updated successfully',
      target: { batchName: trimmedBatch, dailyTargetMinutes, pointsDeduction },
    });
  } catch (error) {
    console.error('Upsert target error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
