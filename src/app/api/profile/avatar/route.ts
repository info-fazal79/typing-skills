import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getUserFromRequest } from '@/lib/auth';

const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('avatar');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No image file provided' }, { status: 400 });
    }

    // The client always crops+re-encodes to JPEG before uploading, but this
    // endpoint is a real network boundary — validate independently of
    // whatever the client claims.
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Image must be JPEG, PNG, or WebP' }, { status: 400 });
    }

    if (file.size > MAX_AVATAR_BYTES) {
      return NextResponse.json({ error: 'Image must be under 2MB' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    // One fixed path per user — each new upload overwrites the last, so old
    // avatars don't pile up as orphaned storage objects.
    const path = `${user.id}.jpg`;

    const { error: uploadErr } = await supabase.storage
      .from('avatars')
      .upload(path, buffer, { contentType: 'image/jpeg', upsert: true });

    if (uploadErr) throw uploadErr;

    const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(path);
    // Cache-bust: the path is always the same for a given user, so without
    // this, a browser/CDN that already cached the old image would keep
    // showing it after a re-upload.
    const avatarUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`;

    const { error: updateErr } = await supabase
      .from('users')
      .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
      .eq('id', user.id);

    if (updateErr) throw updateErr;

    return NextResponse.json({ avatarUrl });
  } catch (error) {
    console.error('Avatar upload error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
