'use client';

import React from 'react';
import Link from 'next/link';

interface LogoProps {
  size?: 'default' | 'large';
}

// A real wordmark — solid monogram box + plain bold type — instead of a
// generic sparkle icon and gradient-clipped text. The monogram echoes the
// generated favicon (src/app/icon.tsx: bold "T" on a dark ground), so the
// browser tab and the in-app mark are the same identity.
export function Logo({ size = 'default' }: LogoProps) {
  const isLarge = size === 'large';
  return (
    <Link href="/" className="flex items-center gap-2.5 group w-max">
      <div
        className={`rounded-md bg-brand-500 text-neutral-950 flex items-center justify-center font-black shrink-0 transition-transform group-hover:scale-105 ${
          isLarge ? 'w-10 h-10 text-lg' : 'w-8 h-8 text-base'
        }`}
      >
        T
      </div>
      <span className={`font-bold tracking-tight text-neutral-100 ${isLarge ? 'text-2xl' : 'text-lg'}`}>
        Typing Institute
      </span>
    </Link>
  );
}
