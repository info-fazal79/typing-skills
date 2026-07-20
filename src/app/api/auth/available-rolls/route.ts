import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const batchName = searchParams.get('batchName');

    if (!batchName) {
      return NextResponse.json({ error: 'batchName is required' }, { status: 400 });
    }

    // 1. Fetch metadata to get all allowed rolls for this batch
    const { data: meta } = await supabase
      .from('metadata')
      .select('roll_numbers_json')
      .eq('id', 'selectors')
      .single();

    let allRolls: string[] = [];
    if (meta?.roll_numbers_json?.[batchName]) {
      allRolls = meta.roll_numbers_json[batchName];
    }

    // 2. Query users to find claimed rolls for this batch
    const { data: usersSnap } = await supabase
      .from('users')
      .select('roll_number')
      .eq('role', 'STUDENT')
      .eq('batch_name', batchName);

    const claimedRolls = new Set<string>();
    (usersSnap || []).forEach(u => {
      if (u.roll_number) claimedRolls.add(u.roll_number);
    });

    // 3. Filter out claimed rolls
    const availableRolls = allRolls.filter(roll => !claimedRolls.has(roll));

    return NextResponse.json({ availableRolls });
  } catch (error) {
    console.error('Failed to fetch available rolls:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
