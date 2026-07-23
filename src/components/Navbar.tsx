'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Trophy, LayoutDashboard, LogOut, Award, LogIn } from 'lucide-react';
import { Avatar } from './Avatar';
import { Logo } from './Logo';

interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  points: number;
  rollNumber?: string;
  courseName?: string;
  batchName?: string;
  avatarUrl?: string | null;
}

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch user data on mount/pathname change
  useEffect(() => {
    async function fetchMe() {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    fetchMe();
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (e) {
      console.error('Logout error:', e);
    }
  };

  // Now rendered once in the root layout (see layout.tsx) instead of once
  // per page, so it has to opt itself out on the standalone, distraction-free
  // auth screens that were never designed to sit under a top nav.
  const isAuthPage = ['/login', '/register', '/forgot-password', '/reset-password'].includes(pathname);
  if (isAuthPage) return null;

  if (loading) {
    return (
      <header className="w-full border-b border-neutral-800 bg-background/80 backdrop-blur-md h-16 flex items-center justify-between px-6 sticky top-0 z-40">
        <div className="h-6 w-32 bg-neutral-800 animate-pulse rounded-md"></div>
        <div className="h-8 w-24 bg-neutral-800 animate-pulse rounded-md"></div>
      </header>
    );
  }

  return (
    <header className="w-full border-b border-neutral-950 bg-background/75 backdrop-blur-md sticky top-0 z-40 transition-all select-none">
      <div className="max-w-6xl mx-auto h-16 flex items-center justify-between px-4 sm:px-6">
        {/* Left Side Logo */}
        <Logo />

        {/* Center / Navigation Links */}
        <nav className="hidden sm:flex items-center gap-1">
          <Link
            href="/"
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              pathname === '/' 
                ? 'bg-neutral-900 text-brand-400' 
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-950'
            }`}
          >
            Practice
          </Link>
          
          {user && (user.role === 'STUDENT' || user.role === 'USER') && (
            <>
              <Link
                href="/dashboard"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  pathname === '/dashboard' 
                    ? 'bg-neutral-900 text-brand-400' 
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-950'
                }`}
              >
                Dashboard
              </Link>
              <Link
                href="/leaderboard"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  pathname === '/leaderboard' 
                    ? 'bg-neutral-900 text-brand-400' 
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-950'
                }`}
              >
                Leaderboards
              </Link>
            </>
          )}

          {user && user.role === 'ADMIN' && (
            <Link
              href="/admin"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                pathname.startsWith('/admin') 
                  ? 'bg-brand-500/10 text-brand-400' 
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-950'
              }`}
            >
              Admin Control
            </Link>
          )}
        </nav>

        {/* Right Side Controls */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3 sm:gap-4">
              {/* Point Badge (Unconditional for logged-in users) */}
              <div className="flex items-center gap-1.5 bg-neutral-950 px-2.5 py-1 rounded-full border border-neutral-800" title="Your total points">
                <Award size={14} className="text-brand-500" />
                <span className="font-mono text-xs font-bold text-neutral-300">{user.points ?? 0} pts</span>
              </div>

              {/* User Label + Avatar */}
              <div className="hidden md:flex items-center gap-2">
                <div className="flex flex-col text-right">
                  <span className="text-xs font-bold text-neutral-200 leading-none">{user.name}</span>
                  {user.role === 'ADMIN' && (
                    <span className="text-[11px] text-brand-500/80 uppercase tracking-wider font-semibold mt-0.5">Administrator</span>
                  )}
                </div>
                <Avatar src={user.avatarUrl} name={user.name} size={30} />
              </div>

              {/* Mobile quick links */}
              {(user.role === 'STUDENT' || user.role === 'USER') && (
                <div className="flex sm:hidden gap-1">
                  <Link href="/dashboard" className="p-1.5 rounded-lg text-neutral-400 hover:text-brand-400 hover:bg-neutral-900" title="Dashboard">
                    <LayoutDashboard size={18} />
                  </Link>
                  <Link href="/leaderboard" className="p-1.5 rounded-lg text-neutral-400 hover:text-brand-400 hover:bg-neutral-900" title="Leaderboard">
                    <Trophy size={18} />
                  </Link>
                </div>
              )}

              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-neutral-950 transition-all text-xs font-semibold"
                title="Log Out"
              >
                <LogOut size={14} />
                <span className="hidden sm:inline">Log Out</span>
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Link
                href="/login"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-neutral-300 hover:text-brand-400 hover:bg-neutral-950 transition-all text-xs font-bold"
              >
                <LogIn size={14} />
                Log In
              </Link>
              <Link
                href="/register"
                className="bg-brand-500 text-neutral-950 hover:bg-brand-400 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-md shadow-brand-500/10"
              >
                Register
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
