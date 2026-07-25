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
    // Support all payload variations (batchId/batchName, dailyTarget/dailyTargetMinutes, penaltyPoints/pointsDeduction)
    const batchName = body.batchId || body.batchName;
    const typingType = body.typingType || 'English';
    const rawDailyTarget = body.dailyTarget !== undefined ? body.dailyTarget : body.dailyTargetMinutes;
    const rawPenaltyPoints = body.penaltyPoints !== undefined ? body.penaltyPoints : body.pointsDeduction;

    if (!batchName || typingType === undefined || rawDailyTarget === undefined || rawPenaltyPoints === undefined) {
      return NextResponse.json(
        { error: 'Missing batchId/batchName, typingType, dailyTarget/dailyTargetMinutes, or penaltyPoints/pointsDeduction' },
        { status: 400 }
      );
    }

    const dailyTargetMinutes = parseInt(String(rawDailyTarget), 10);
    const pointsDeduction = parseInt(String(rawPenaltyPoints), 10);

    if (isNaN(dailyTargetMinutes) || isNaN(pointsDeduction)) {
      return NextResponse.json(
        { error: 'dailyTarget/dailyTargetMinutes and penaltyPoints/pointsDeduction must be valid numbers' },
        { status: 400 }
      );
    }

    // A negative pointsDeduction would flip apply_penalty_deduction into
    // awarding points to inactive students instead of penalizing them, and
    // a target above 1440 (a full day) or a wildly large deduction is
    // certainly a typo, not an intended value — reject both server-side
    // rather than trusting the admin UI's own validation.
    if (dailyTargetMinutes < 1 || dailyTargetMinutes > 1440) {
      return NextResponse.json(
        { error: 'dailyTarget/dailyTargetMinutes must be between 1 and 1440' },
        { status: 400 }
      );
    }
    if (pointsDeduction < 0 || pointsDeduction > 1000) {
      return NextResponse.json(
        { error: 'penaltyPoints/pointsDeduction must be between 0 and 1000' },
        { status: 400 }
      );
    }

    const trimmedBatch = batchName.trim();
    const formattedType = typingType.trim();

    const { error: upsertErr } = await supabase.from('batch_targets').upsert({
      batch_name: trimmedBatch,
      typing_type: formattedType,
      daily_target_minutes: dailyTargetMinutes,
      points_deduction: pointsDeduction,
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

