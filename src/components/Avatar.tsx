'use client';

import React, { useState } from 'react';

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: number;
  className?: string;
}

// Single source of truth for "how do we show a person" across the app —
// photo when one exists, the same initial-letter treatment as before when
// it doesn't, so callers never have to branch on this themselves.
export function Avatar({ src, name, size = 40, className = '' }: AvatarProps) {
  const initial = (name || '?').charAt(0).toUpperCase();

  // A stored avatarUrl can go stale (storage object deleted/renamed) and
  // render as a broken image forever otherwise — fall back to the initials
  // placeholder instead. Reset whenever `src` itself changes (tracked
  // during render, not an effect) so a new, working URL gets a fresh
  // chance to load instead of staying stuck on the old failure.
  const [failed, setFailed] = useState(false);
  const [trackedSrc, setTrackedSrc] = useState(src);
  if (src !== trackedSrc) {
    setTrackedSrc(src);
    setFailed(false);
  }

  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        onError={() => setFailed(true)}
        className={`rounded-full object-cover shrink-0 border border-neutral-800 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={`rounded-full bg-gradient-to-br from-brand-500/30 to-brand-600/10 border border-brand-500/20 flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <span className="font-black text-brand-400" style={{ fontSize: size * 0.42 }}>
        {initial}
      </span>
    </div>
  );
}
