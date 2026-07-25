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

    const formatted = (targets || []).map((t) => ({
      id: `${t.batch_name}_${t.typing_type || 'English'}`,
      batchName: t.batch_name,
      typingType: t.typing_type || 'English',
      dailyTargetMinutes: t.daily_target_minutes,
      pointsDeduction: t.points_deduction,
    }));

    return NextResponse.json({ targets: formatted });
  } catch (error) {
    console.error('Fetch targets error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Upsert target configuration for a batch and typing type
export async function POST(req: NextRequest) {
  try {
    const admin = await getUserFromRequest(req);
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    // Support both payload variations (batchId/batchName, penaltyPoints/pointsDeduction)
    const batchName = body.batchId || body.batchName;
    const typingType = body.typingType || 'English';
    const dailyTargetMinutes = body.dailyTargetMinutes;
    const pointsDeduction = body.penaltyPoints !== undefined ? body.penaltyPoints : body.pointsDeduction;

    if (!batchName || typingType === undefined || dailyTargetMinutes === undefined || pointsDeduction === undefined) {
      return NextResponse.json(
        { error: 'Missing batchId/batchName, typingType, dailyTargetMinutes, or penaltyPoints/pointsDeduction' },
        { status: 400 }
      );
    }

    const trimmedBatch = batchName.trim();
    const formattedType = typingType.trim();

    const { error: upsertErr } = await supabase.from('batch_targets').upsert({
      batch_name: trimmedBatch,
      typing_type: formattedType,
      daily_target_minutes: parseInt(dailyTargetMinutes),
      points_deduction: parseInt(pointsDeduction),
    }, { onConflict: 'batch_name,typing_type' });

    if (upsertErr) throw upsertErr;

    return NextResponse.json({
      message: 'Batch target configuration updated successfully',
      target: { batchName: trimmedBatch, typingType: formattedType, dailyTargetMinutes, pointsDeduction },
    });
  } catch (error) {
    console.error('Upsert target error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

