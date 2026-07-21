'use client';

import React, { useEffect, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import Link from 'next/link';
import {
  Trophy, Zap, Target, Clock, BookOpen,
  ArrowLeft, User, GraduationCap, Users, Hash
} from 'lucide-react';

interface ProfileData {
  profile: {
    id: string;
    name: string;
    role: string;
    courseName: string | null;
    batchName: string | null;
    rollNumber: string | null;
    points: number;
    joinedAt: string;
  };
  analytics: {
    totalTests: number;
    bestWpm: number;
    avgWpm: number;
    avgAccuracy: number;
    totalMinutes: number;
  };
  recentSessions: {
    id: string;
    wpm: number;
    accuracy: number;
    duration: number;
    language: string;
    mode: string;
    createdAt: string;
  }[];
}

export default function ProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [resolvedSlug, setResolvedSlug] = useState<string>('');

  useEffect(() => {
    params.then(p => setResolvedSlug(p.slug));
  }, [params]);

  useEffect(() => {
    if (!resolvedSlug) return;
    const fetchProfile = async () => {
      try {
        const res = await fetch(`/api/profile/${resolvedSlug}`);
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        const json = await res.json();
        setData(json);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [resolvedSlug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#111215] text-[#d1d0c5] flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center gap-3">
          <div className="animate-spin rounded-full h-7 w-7 border-t-2 border-amber-400 border-r-2 border-transparent" />
          <span className="text-neutral-500 text-sm font-medium">Loading profile…</span>
        </div>
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen bg-[#111215] text-[#d1d0c5] flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-4">
          <div className="text-6xl font-black text-neutral-700">404</div>
          <p className="text-neutral-400 text-sm">This profile doesn&apos;t exist or is not approved yet.</p>
          <Link href="/leaderboard" className="text-amber-400 text-xs font-semibold hover:underline flex items-center gap-1">
            <ArrowLeft size={12} /> Back to Leaderboard
          </Link>
        </div>
      </div>
    );
  }

  const { profile, analytics, recentSessions } = data;
  const isStudent = profile.role === 'STUDENT';
  const joinYear = new Date(profile.joinedAt).getFullYear();

  const statCards = [
    { icon: <Zap size={18} className="text-sky-400" />, label: 'Best WPM', value: analytics.bestWpm, unit: 'wpm', color: 'sky' },
    { icon: <Target size={18} className="text-emerald-400" />, label: 'Avg Accuracy', value: `${analytics.avgAccuracy}%`, unit: '', color: 'emerald' },
    { icon: <Trophy size={18} className="text-amber-400" />, label: 'Total Points', value: analytics.totalTests > 0 ? profile.points : 0, unit: 'pts', color: 'amber' },
    { icon: <Clock size={18} className="text-violet-400" />, label: 'Practice Time', value: analytics.totalMinutes, unit: 'min', color: 'violet' },
    { icon: <BookOpen size={18} className="text-rose-400" />, label: 'Total Sessions', value: analytics.totalTests, unit: 'tests', color: 'rose' },
    { icon: <Zap size={18} className="text-neutral-400" />, label: 'Avg WPM', value: analytics.avgWpm, unit: 'wpm', color: 'neutral' },
  ];

  const colorMap: Record<string, string> = {
    sky: 'bg-sky-500/10 border-sky-500/20 text-sky-400',
    emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    amber: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
    violet: 'bg-violet-500/10 border-violet-500/20 text-violet-400',
    rose: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
    neutral: 'bg-neutral-800/50 border-neutral-700/50 text-neutral-300',
  };

  return (
    <div className="min-h-screen bg-[#111215] text-[#d1d0c5] flex flex-col font-sans">
      <Navbar />

      {/* Match leaderboard's max-w-5xl width */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-10 flex flex-col gap-6">

        {/* Back link */}
        <Link
          href="/leaderboard"
          className="flex items-center gap-1.5 text-neutral-500 hover:text-amber-400 text-xs font-semibold transition-colors w-max"
        >
          <ArrowLeft size={13} /> Back to Leaderboard
        </Link>

        {/* ── Profile Hero ── */}
        <section className="bg-neutral-900/30 border border-neutral-800 rounded-2xl p-6 flex flex-col sm:flex-row gap-5 items-start sm:items-center">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/30 to-amber-600/10 border border-amber-500/20 flex items-center justify-center shrink-0">
            <span className="text-2xl font-black text-amber-400">
              {profile.name.charAt(0).toUpperCase()}
            </span>
          </div>

          {/* Info */}
          <div className="flex flex-col gap-2 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-black text-neutral-100">{profile.name}</h1>
              <span className={`text-[10px] px-2 py-0.5 rounded font-bold tracking-wider border ${
                isStudent
                  ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                  : 'bg-neutral-800/50 text-neutral-400 border-neutral-700/50'
              }`}>
                {isStudent ? 'Student' : 'General'}
              </span>
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-neutral-400">
              {isStudent && profile.courseName && (
                <span className="flex items-center gap-1">
                  <GraduationCap size={11} className="text-neutral-500" />
                  {profile.courseName}
                </span>
              )}
              {isStudent && profile.batchName && (
                <span className="flex items-center gap-1">
                  <Users size={11} className="text-neutral-500" />
                  {profile.batchName}
                </span>
              )}
              {isStudent && profile.rollNumber && (
                <span className="flex items-center gap-1 font-mono">
                  <Hash size={11} className="text-neutral-500" />
                  {profile.rollNumber}
                </span>
              )}
              <span className="flex items-center gap-1">
                <User size={11} className="text-neutral-500" />
                Joined {joinYear}
              </span>
            </div>
          </div>

          {/* Points badge */}
          <div className="flex flex-col items-center bg-amber-500/10 border border-amber-500/20 rounded-xl px-5 py-3">
            <span className="text-2xl font-black text-amber-400 font-mono">{profile.points}</span>
            <span className="text-[10px] text-amber-500/70 font-bold uppercase tracking-wider">Points</span>
          </div>
        </section>

        {/* ── Stat Cards ── */}
        <section className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {statCards.map((card) => (
            <div
              key={card.label}
              className={`border rounded-xl p-4 flex flex-col gap-2 ${colorMap[card.color]}`}
            >
              <div className="flex items-center gap-2 opacity-80">
                {card.icon}
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">{card.label}</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black font-mono">{card.value}</span>
                {card.unit && <span className="text-[11px] font-semibold opacity-50">{card.unit}</span>}
              </div>
            </div>
          ))}
        </section>

        {/* ── Recent Sessions ── */}
        <section className="bg-neutral-900/10 border border-neutral-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-neutral-800 flex items-center gap-2">
            <BookOpen size={14} className="text-amber-500" />
            <h2 className="text-xs font-bold text-neutral-200 uppercase tracking-wider">Recent Typing Sessions</h2>
            <span className="ml-auto text-[10px] text-neutral-500 font-mono">last {recentSessions.length} sessions</span>
          </div>

          {recentSessions.length === 0 ? (
            <div className="p-12 text-center text-sm text-neutral-500">
              No practice sessions recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold border-b border-neutral-800/60 bg-neutral-950/10">
                    <th className="py-3 px-5">Date</th>
                    <th className="py-3 px-5">Language / Mode</th>
                    <th className="py-3 px-5 text-right">WPM</th>
                    <th className="py-3 px-5 text-right">Accuracy</th>
                    <th className="py-3 px-5 text-right">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-900/50">
                  {recentSessions.map((s) => {
                    const date = new Date(s.createdAt);
                    const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                    const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
                    const durationMins = Math.floor(s.duration / 60);
                    const durationSecs = s.duration % 60;
                    const durationStr = durationMins > 0 ? `${durationMins}m ${durationSecs}s` : `${durationSecs}s`;
                    return (
                      <tr key={s.id} className="hover:bg-neutral-900/20 transition-colors">
                        <td className="py-3 px-5">
                          <div className="font-medium text-neutral-200">{dateStr}</div>
                          <div className="text-[10px] text-neutral-500 font-mono">{timeStr}</div>
                        </td>
                        <td className="py-3 px-5">
                          <span className="text-neutral-300 font-semibold">{s.language}</span>
                          <span className="text-neutral-600 mx-1">/</span>
                          <span className="text-neutral-500">{s.mode}</span>
                        </td>
                        <td className="py-3 px-5 text-right font-bold font-mono text-sky-400">
                          {s.wpm} <span className="text-[10px] text-neutral-500">wpm</span>
                        </td>
                        <td className="py-3 px-5 text-right font-mono text-emerald-400">
                          {s.accuracy}<span className="text-neutral-500">%</span>
                        </td>
                        <td className="py-3 px-5 text-right font-mono text-neutral-400">{durationStr}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
