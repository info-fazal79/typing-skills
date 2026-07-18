'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Sparkles, Trophy, LayoutDashboard, LogOut, ShieldAlert, Award, LogIn } from 'lucide-react';

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
      } catch (e) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    fetchMe();
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout');
      router.push('/login');
      router.refresh();
    } catch (e) {
      console.error('Logout error:', e);
    }
  };

  if (loading) {
    return (
      <header className="w-full border-b border-neutral-800 bg-[#111215]/80 backdrop-blur-md h-16 flex items-center justify-between px-6 sticky top-0 z-40">
        <div className="h-6 w-32 bg-neutral-800 animate-pulse rounded-md"></div>
        <div className="h-8 w-24 bg-neutral-800 animate-pulse rounded-md"></div>
      </header>
    );
  }

  return (
    <header className="w-full border-b border-neutral-950 bg-[#111215]/75 backdrop-blur-md sticky top-0 z-40 transition-all select-none">
      <div className="max-w-6xl mx-auto h-16 flex items-center justify-between px-4 sm:px-6">
        {/* Left Side Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <Sparkles className="text-amber-500 group-hover:rotate-12 transition-transform duration-300" size={20} />
          <span className="font-extrabold tracking-tight bg-gradient-to-r from-amber-400 to-amber-200 bg-clip-text text-transparent sm:text-lg">
            Typing Institute
          </span>
        </Link>

        {/* Center / Navigation Links */}
        <nav className="hidden sm:flex items-center gap-1">
          <Link
            href="/"
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              pathname === '/' 
                ? 'bg-neutral-900 text-amber-400' 
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
                    ? 'bg-neutral-900 text-amber-400' 
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-950'
                }`}
              >
                Dashboard
              </Link>
              <Link
                href="/leaderboard"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  pathname === '/leaderboard' 
                    ? 'bg-neutral-900 text-amber-400' 
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
                  ? 'bg-amber-500/10 text-amber-400' 
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
              {/* Point Badge (Student only) */}
              {user.role === 'STUDENT' && (
                <div className="flex items-center gap-1.5 bg-neutral-950 px-2.5 py-1 rounded-full border border-neutral-800" title="Your total points">
                  <Award size={14} className="text-amber-500" />
                  <span className="font-mono text-xs font-bold text-neutral-300">{user.points} pts</span>
                </div>
              )}

              {/* User Dropdown / Label */}
              <div className="hidden md:flex flex-col text-right">
                <span className="text-xs font-bold text-neutral-200 leading-none">{user.name}</span>
                {user.role === 'ADMIN' && (
                  <span className="text-[10px] text-amber-500/80 uppercase tracking-wider font-semibold mt-0.5">Administrator</span>
                )}
              </div>

              {/* Mobile quick links */}
              {(user.role === 'STUDENT' || user.role === 'USER') && (
                <div className="flex sm:hidden gap-1">
                  <Link href="/dashboard" className="p-1.5 rounded-lg text-neutral-400 hover:text-amber-400 hover:bg-neutral-900" title="Dashboard">
                    <LayoutDashboard size={18} />
                  </Link>
                  <Link href="/leaderboard" className="p-1.5 rounded-lg text-neutral-400 hover:text-amber-400 hover:bg-neutral-900" title="Leaderboard">
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
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-neutral-300 hover:text-amber-400 hover:bg-neutral-950 transition-all text-xs font-bold"
              >
                <LogIn size={14} />
                Log In
              </Link>
              <Link
                href="/register"
                className="bg-amber-500 text-neutral-950 hover:bg-amber-400 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-md shadow-amber-500/10"
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
