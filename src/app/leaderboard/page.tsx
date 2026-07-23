'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Trophy, Award, Users, Crown, ChevronDown } from 'lucide-react';

export default function LeaderboardPage() {
  const [data, setData] = useState<any /* eslint-disable-line @typescript-eslint/no-explicit-any */>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'general' | 'batch'>('general');
  const [limit, setLimit] = useState<number>(20);

  // Batch filter state
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedBatch, setSelectedBatch] = useState('');
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchData, setBatchData] = useState<any[] /* eslint-disable-line @typescript-eslint/no-explicit-any */>([]);

  // ── Initial fetch ─────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const res = await fetch('/api/leaderboard');
        const json = await res.json();
        setData(json);

        // Auto-select the user's batch if they're a student
        if (json.selectedBatch) {
          setSelectedBatch(json.selectedBatch);
          setBatchData(json.batch ?? []);

          // Derive the course from coursesMap
          const coursesMap: Record<string, string[]> = json.coursesMap ?? {};
          for (const [course, batches] of Object.entries(coursesMap)) {
            if ((batches as string[]).includes(json.selectedBatch)) {
              setSelectedCourse(course);
              break;
            }
          }
        }
      } catch (e) {
        console.error('Leaderboard fetch failed', e);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  // ── Fetch batch leaderboard when filters change ───────────────────────────
  useEffect(() => {
    if (!selectedBatch) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBatchData([]);
      return;
    }
    const fetchBatch = async () => {
      setBatchLoading(true);
      try {
        const res = await fetch(
          `/api/leaderboard?batch=${encodeURIComponent(selectedBatch)}&course=${encodeURIComponent(selectedCourse)}`
        );
        const json = await res.json();
        setBatchData(json.batch ?? []);
      } catch {
        setBatchData([]);
      } finally {
        setBatchLoading(false);
      }
    };
    fetchBatch();
  }, [selectedBatch, selectedCourse]);

  // ── Rank badge ────────────────────────────────────────────────────────────
  const renderRankBadge = (rank: number) => {
    if (rank === 1)
      return (
        <div className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/25">
          <Crown size={13} className="animate-bounce" />
        </div>
      );
    if (rank === 2)
      return (
        <div className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-neutral-300/10 text-neutral-300 border border-neutral-300/25 text-xs font-bold font-mono">
          2
        </div>
      );
    if (rank === 3)
      return (
        <div className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-800/10 text-amber-700 border border-amber-800/25 text-xs font-bold font-mono">
          3
        </div>
      );
    return <span className="font-mono text-xs font-semibold text-neutral-500">{rank}</span>;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center gap-3">
          <div className="animate-spin rounded-full h-7 w-7 border-t-2 border-amber-400 border-r-2 border-transparent" />
          <span className="text-neutral-500 text-sm font-medium">Loading leaderboards…</span>
        </div>
      </div>
    );
  }

  const coursesMap: Record<string, string[]> = data?.coursesMap ?? {};
  const courseList = Object.keys(coursesMap);
  const batchList = selectedCourse ? (coursesMap[selectedCourse] ?? []) : [];
  const generalList: any /* eslint-disable-line @typescript-eslint/no-explicit-any */[] = data?.general ?? [];

  const listToRender = (activeTab === 'general' ? generalList : batchData).slice(0, limit);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-10 flex flex-col gap-6 select-none">

        {/* ── Hero ── */}
        <section className="text-center flex flex-col items-center gap-2 mb-2">
          <div className="bg-amber-500/10 text-amber-400 p-3 rounded-full border border-amber-500/20 mb-1">
            <Trophy size={30} />
          </div>
          <h1 className="text-3xl font-black text-neutral-100 tracking-tight">Institute Leaderboards</h1>
          <p className="text-neutral-400 text-xs sm:text-sm">Rankings across all users and batches of the institute.</p>
        </section>

        {/* ── Tabs + Filters ── */}
        <section className="flex flex-col gap-3 bg-neutral-900/30 p-3 rounded-2xl border border-neutral-800">
          {/* Tab buttons */}
          <div className="flex bg-neutral-950 p-1 rounded-xl gap-1">
            <button
              onClick={() => setActiveTab('general')}
              className={`flex-1 px-4 py-2.5 rounded-lg font-semibold text-xs transition-all flex items-center justify-center gap-2 ${
                activeTab === 'general'
                  ? 'bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/20'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Award size={14} /> General Leaderboard
            </button>
            <button
              onClick={() => setActiveTab('batch')}
              className={`flex-1 px-4 py-2.5 rounded-lg font-semibold text-xs transition-all flex items-center justify-center gap-2 ${
                activeTab === 'batch'
                  ? 'bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/20'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Users size={14} /> Batch Leaderboard
            </button>
          </div>

          {/* Show top N */}
          <div className="flex items-center gap-2 pt-1">
            <span className="text-[11px] text-neutral-500 font-bold uppercase tracking-wider">Show top</span>
            <div className="flex bg-neutral-950 p-1 rounded-lg gap-1">
              {[10, 20, 50, 100].map((n) => (
                <button
                  key={n}
                  onClick={() => setLimit(n)}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                    limit === n
                      ? 'bg-amber-500 text-neutral-950'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Batch filter dropdowns (chained: Course → Batch) */}
          {activeTab === 'batch' && (
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              {/* Course dropdown */}
              <div className="relative flex-1">
                <select
                  value={selectedCourse}
                  onChange={(e) => {
                    setSelectedCourse(e.target.value);
                    setSelectedBatch('');
                    setBatchData([]);
                  }}
                  className="w-full appearance-none bg-neutral-950 border border-neutral-800 text-neutral-200 rounded-xl py-2.5 pl-3 pr-8 text-xs font-semibold focus:outline-none focus:border-amber-500/40 transition-colors"
                >
                  <option value="">— Select Course —</option>
                  {courseList.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" />
              </div>

              {/* Batch dropdown */}
              <div className="relative flex-1">
                <select
                  value={selectedBatch}
                  disabled={!selectedCourse}
                  onChange={(e) => setSelectedBatch(e.target.value)}
                  className="w-full appearance-none bg-neutral-950 border border-neutral-800 text-neutral-200 rounded-xl py-2.5 pl-3 pr-8 text-xs font-semibold focus:outline-none focus:border-amber-500/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <option value="">— Select Batch —</option>
                  {batchList.map((b: string) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" />
              </div>
            </div>
          )}
        </section>

        {/* ── Rankings table ── */}
        <section className="bg-neutral-900/10 border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
          {activeTab === 'batch' && !selectedBatch ? (
            <div className="p-14 text-center text-sm text-neutral-500 font-medium">
              Select a course and batch above to view the batch standings.
            </div>
          ) : activeTab === 'batch' && batchLoading ? (
            <div className="p-14 text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-amber-400 border-r-2 border-transparent mx-auto" />
            </div>
          ) : listToRender.length === 0 ? (
            <div className="p-14 text-center text-sm text-neutral-500 font-medium">
              {activeTab === 'general'
                ? 'No approved general users found yet.'
                : 'No approved students found in this batch yet.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-neutral-800/80 bg-neutral-950/20 text-[11px] text-neutral-500 uppercase tracking-widest font-bold">
                    <th className="py-4 px-5 text-center w-14">Rank</th>
                    <th className="py-4 px-5">Name</th>
                    {activeTab === 'batch' ? (
                      <>
                        <th className="py-4 px-5">Course</th>
                        <th className="py-4 px-5">Batch</th>
                        <th className="py-4 px-5">Roll</th>
                      </>
                    ) : (
                      <>
                        <th className="py-4 px-5">Type</th>
                        <th className="py-4 px-5">Course</th>
                        <th className="py-4 px-5">Batch</th>
                      </>
                    )}
                    <th className="py-4 px-5 text-right">Best WPM</th>
                    <th className="py-4 px-5 text-right pr-7">Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-900/60 text-xs">
                  {listToRender.map((entry: any /* eslint-disable-line @typescript-eslint/no-explicit-any */, idx: number) => (
                    <tr
                      key={entry.id}
                      className={`hover:bg-neutral-900/30 transition-colors ${idx < 3 ? 'bg-amber-500/[0.02]' : ''}`}
                    >
                      <td className="py-4 px-5 text-center">{renderRankBadge(idx + 1)}</td>
                      <td className="py-4 px-5 font-bold text-neutral-200">
                        <Link
                          href={`/profile/${entry.slug ?? entry.id}`}
                          className="hover:text-amber-400 transition-colors hover:underline underline-offset-2"
                        >
                          {entry.name}
                        </Link>
                      </td>
                      {activeTab === 'batch' ? (
                        <>
                          <td className="py-4 px-5 text-neutral-400">{entry.courseName || '—'}</td>
                          <td className="py-4 px-5">
                            <span className="bg-neutral-950 px-2 py-0.5 rounded border border-neutral-900 font-mono text-[11px] font-semibold text-neutral-300">
                              {entry.batchName || '—'}
                            </span>
                          </td>
                          <td className="py-4 px-5 font-mono text-neutral-400 text-[11px]">{entry.rollNumber || '—'}</td>
                        </>
                      ) : (
                        <>
                          <td className="py-4 px-5">
                            {entry.role === 'STUDENT' ? (
                              <span className="bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2 py-0.5 rounded text-[11px] font-semibold tracking-wide">
                                Student
                              </span>
                            ) : (
                              <span className="bg-neutral-800/50 text-neutral-400 border border-neutral-700/50 px-2 py-0.5 rounded text-[11px] font-semibold tracking-wide">
                                General
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-5 text-neutral-400">{entry.role === 'STUDENT' ? (entry.courseName || '—') : '—'}</td>
                          <td className="py-4 px-5">
                            {entry.role === 'STUDENT' && entry.batchName ? (
                              <span className="bg-neutral-950 px-2 py-0.5 rounded border border-neutral-900 font-mono text-[11px] font-semibold text-neutral-300">
                                {entry.batchName}
                              </span>
                            ) : (
                              <span className="text-neutral-500">—</span>
                            )}
                          </td>
                        </>
                      )}
                      <td className="py-4 px-5 text-right font-mono font-bold text-sky-400">{entry.bestWpm} <span className="text-[11px] text-neutral-500">wpm</span></td>
                      <td className="py-4 px-5 text-right pr-7 font-bold font-mono text-amber-400">
                        {entry.points} <span className="text-[11px] text-neutral-500 font-semibold uppercase">pts</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

      </main>
    </div>
  );
}
