'use client';

import React, { useEffect, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { Trophy, Award, Search, Users, ChevronRight, Crown } from 'lucide-react';

export default function LeaderboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overall' | 'batch'>('overall');
  const [selectedBatch, setSelectedBatch] = useState<string>('');
  const [error, setError] = useState('');

  const fetchLeaderboard = async (batchName?: string) => {
    try {
      const url = batchName 
        ? `/api/leaderboard?batch=${encodeURIComponent(batchName)}`
        : '/api/leaderboard';
      
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error('Failed to load leaderboard data');
      }
      const json = await res.json();
      setData(json);
      
      if (!batchName && json.selectedBatch) {
        setSelectedBatch(json.selectedBatch);
        if (json.selectedBatch) {
          setActiveTab('batch');
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const handleBatchChange = (batch: string) => {
    setSelectedBatch(batch);
    fetchLeaderboard(batch);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#111215] text-[#d1d0c5] flex flex-col font-sans">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-amber-400 border-r-2 border-transparent"></div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#111215] text-[#d1d0c5] flex flex-col font-sans">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-4">
          <Trophy size={48} className="text-red-500" />
          <h2 className="text-2xl font-bold text-neutral-100 font-sans">Failed to Load Leaderboards</h2>
          <p className="text-neutral-400 text-sm">{error || 'An unexpected error occurred.'}</p>
          <button onClick={() => window.location.reload()} className="bg-amber-500 text-neutral-950 font-bold px-4 py-2 rounded-lg">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { overall, batch, batches } = data;
  const listToRender = activeTab === 'overall' ? overall : batch;

  const renderRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/25">
          <Crown size={12} className="animate-bounce" />
        </div>
      );
    }
    if (rank === 2) {
      return (
        <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-neutral-300/10 text-neutral-300 border border-neutral-300/25 text-xs font-bold font-mono">
          2
        </div>
      );
    }
    if (rank === 3) {
      return (
        <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-800/10 text-amber-700 border border-amber-800/25 text-xs font-bold font-mono">
          3
        </div>
      );
    }
    return <span className="font-mono text-xs font-semibold text-neutral-500">{rank}</span>;
  };

  return (
    <div className="min-h-screen bg-[#111215] text-[#d1d0c5] flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-12 flex flex-col gap-6 select-none">
        
        {/* Title */}
        <section className="text-center flex flex-col items-center gap-2 mb-4">
          <div className="bg-amber-500/10 text-amber-400 p-3 rounded-full border border-amber-500/20 mb-2">
            <Trophy size={32} />
          </div>
          <h1 className="text-3xl font-extrabold text-neutral-100 font-sans tracking-tight">Institute Leaderboards</h1>
          <p className="text-neutral-400 text-xs sm:text-sm">Compare speeds, progress, and points of students across the institute.</p>
        </section>

        {/* Tab Controls & Filters */}
        <section className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-neutral-900/40 p-3 rounded-2xl border border-neutral-800 text-sm">
          {/* Tab buttons */}
          <div className="flex bg-neutral-950 p-1 rounded-lg w-full sm:w-max">
            <button
              onClick={() => setActiveTab('overall')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-md font-semibold text-xs transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'overall'
                  ? 'bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/20'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Award size={14} />
              Overall Standings
            </button>
            <button
              onClick={() => setActiveTab('batch')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-md font-semibold text-xs transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'batch'
                  ? 'bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/20'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Users size={14} />
              Batch-wise Standings
            </button>
          </div>

          {/* Batch Selector Filter (only when batch tab is active) */}
          {activeTab === 'batch' && (
            <div className="flex items-center gap-2 w-full sm:w-max">
              <span className="text-neutral-500 text-xs font-semibold uppercase tracking-wider hidden md:inline">Select Batch:</span>
              <select
                value={selectedBatch}
                onChange={(e) => handleBatchChange(e.target.value)}
                className="w-full sm:w-48 bg-neutral-950 border border-neutral-800 text-neutral-200 rounded-lg py-2 px-3 focus:outline-hidden focus:border-amber-500/40 text-xs font-semibold"
              >
                <option value="">-- Choose Batch --</option>
                {batches.map((b: string) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
          )}
        </section>

        {/* Standings Table Card */}
        <section className="bg-neutral-900/10 border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
          {listToRender.length === 0 ? (
            <div className="p-12 text-center text-sm text-neutral-500 font-medium">
              {activeTab === 'batch' && !selectedBatch 
                ? 'Please select a batch from the filter dropdown above to view standings.'
                : 'No approved students found on the leaderboard yet.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-neutral-800/80 bg-neutral-950/20 text-[10px] text-neutral-500 uppercase tracking-widest font-bold">
                    <th className="py-4 px-6 text-center w-16">Rank</th>
                    <th className="py-4 px-6">Student Name</th>
                    <th className="py-4 px-6">Course</th>
                    <th className="py-4 px-6">Batch</th>
                    <th className="py-4 px-6">Roll Number</th>
                    <th className="py-4 px-6 text-right pr-8 w-28">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-900/60 text-xs">
                  {listToRender.map((student: any, index: number) => (
                    <tr 
                      key={student.id} 
                      className="hover:bg-neutral-900/30 transition-colors"
                    >
                      <td className="py-4 px-6 text-center">{renderRankBadge(index + 1)}</td>
                      <td className="py-4 px-6 font-bold text-neutral-200">{student.name}</td>
                      <td className="py-4 px-6 text-neutral-400">{student.courseName || 'N/A'}</td>
                      <td className="py-4 px-6 text-neutral-400">
                        <span className="bg-neutral-950 px-2 py-0.5 rounded border border-neutral-900 font-mono text-[10px] font-semibold text-neutral-300">
                          {student.batchName || 'N/A'}
                        </span>
                      </td>
                      <td className="py-4 px-6 font-mono text-neutral-400 text-[11px]">{student.rollNumber || 'N/A'}</td>
                      <td className="py-4 px-6 text-right pr-8 font-bold font-mono text-amber-400 text-sm">
                        {student.points} <span className="text-[10px] text-neutral-500 font-semibold uppercase">pts</span>
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
