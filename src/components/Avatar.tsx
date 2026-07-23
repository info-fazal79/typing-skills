'use client';

import React from 'react';

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

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        className={`rounded-full object-cover shrink-0 border border-neutral-800 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={`rounded-full bg-gradient-to-br from-amber-500/30 to-amber-600/10 border border-amber-500/20 flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <span className="font-black text-amber-400" style={{ fontSize: size * 0.42 }}>
        {initial}
      </span>
    </div>
  );
}
