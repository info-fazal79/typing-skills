'use client';

import React, { useEffect, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { TypingPractice } from '@/components/TypingPractice';
import {
  Award, BookOpen, Clock, Calendar, CheckCircle2, AlertCircle, Play,
  ArrowLeft, TrendingUp, BarChart3, Zap, Target, Hash,
  TrendingDown, Minus, Star
} from 'lucide-react';

export default function DashboardPage() {
  const [data, setData] = useState<any /* eslint-disable-line @typescript-eslint/no-explicit-any */>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTask, setActiveTask] = useState<any /* eslint-disable-line @typescript-eslint/no-explicit-any */>(null);
  const [taskSubmitStatus, setTaskSubmitStatus] = useState<string>('');
  const [taskSubmitError, setTaskSubmitError] = useState<string>('');

  const fetchDashboardData = async () => {
    try {
      const res = await fetch('/api/student/dashboard');
      if (!res.ok) throw new Error('Failed to load dashboard data');
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line
    fetchDashboardData();
  }, []);

  const handleTaskSessionComplete = async (sessionStats: {
    wpm: number; accuracy: number; duration: number;
  }) => {
    if (!activeTask) return;
    setTaskSubmitStatus('Submitting task response...');
    setTaskSubmitError('');
    try {
      const res = await fetch('/api/tasks/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: activeTask.id,
          wpm: sessionStats.wpm,
          accuracy: sessionStats.accuracy,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setTaskSubmitStatus(json.message);
        fetchDashboardData();
      } else {
        setTaskSubmitStatus('');
        setTaskSubmitError(json.error || 'Failed to submit task.');
      }
    } catch {
      setTaskSubmitStatus('');
      setTaskSubmitError('Network error submitting task.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#111215] text-[#d1d0c5] flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center gap-3">
          <div className="animate-spin rounded-full h-7 w-7 border-t-2 border-amber-400 border-r-2 border-transparent" />
          <span className="text-neutral-500 text-sm font-medium">Loading your dashboard…</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#111215] text-[#d1d0c5] flex flex-col">
        <Navbar />
        <div className="flex-1 max-w-lg mx-auto flex flex-col items-center justify-center gap-4 text-center px-4">
          <AlertCircle size={48} className="text-red-500" />
          <h2 className="text-2xl font-bold text-neutral-100">Failed to Load Dashboard</h2>
          <p className="text-neutral-400 text-sm">{error || 'An unexpected error occurred.'}</p>
          <button onClick={() => window.location.reload()} className="bg-amber-500 text-neutral-950 font-bold px-4 py-2 rounded-lg">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { user, targets, tasks, analytics } = data;

  // ── Pending approval screen ───────────────────────────────────────────────
  if (user?.status === 'PENDING') {
    return (
      <div className="min-h-screen bg-[#111215] text-[#d1d0c5] flex flex-col">
        <Navbar />
        <div className="flex-1 max-w-xl mx-auto flex flex-col items-center justify-center text-center p-6 gap-6">
          <div className="bg-amber-500/10 text-amber-500 p-4 rounded-full border border-amber-500/20 animate-pulse">
            <Clock size={48} />
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-extrabold text-neutral-100">Pending Approval</h1>
            <p className="text-neutral-400 text-sm">
              Logged in as <strong className="text-neutral-300">{user.name}</strong>
            </p>
          </div>
          <div className="bg-[#1d1e22]/50 border border-neutral-800 p-6 rounded-2xl text-xs leading-relaxed max-w-md text-neutral-400">
            {user.courseName && (
              <ul className="flex flex-col gap-1 text-left list-disc list-inside">
                <li>Course: <strong className="text-neutral-300">{user.courseName}</strong></li>
                <li>Batch: <strong className="text-neutral-300">{user.batchName}</strong></li>
                <li>Roll: <strong className="text-neutral-300">{user.rollNumber}</strong></li>
              </ul>
            )}
          </div>
          <p className="text-neutral-400 text-sm max-w-md">
            Please wait for an administrator to approve your account. Once approved, you&apos;ll get full access.
          </p>
        </div>
      </div>
    );
  }

  // ── Task practice mode ────────────────────────────────────────────────────
  if (activeTask) {
    return (
      <div className="min-h-screen bg-[#111215] text-[#d1d0c5] flex flex-col">
        <Navbar />
        <div className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-12 flex flex-col gap-6">
          <button
            onClick={() => { setActiveTask(null); setTaskSubmitStatus(''); setTaskSubmitError(''); }}
            className="flex items-center gap-1.5 text-neutral-500 hover:text-neutral-300 text-xs font-semibold self-start"
          >
            <ArrowLeft size={16} /> Back to Dashboard
          </button>
          <div className="bg-[#1d1e22]/40 border border-neutral-800 p-6 rounded-2xl flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-neutral-800 pb-3">
              <div>
                <span className="text-[10px] bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Task Assignment</span>
                <h2 className="text-lg font-bold text-neutral-100 mt-1">{activeTask.title}</h2>
              </div>
              <div className="flex flex-wrap gap-4 text-xs font-semibold text-neutral-400">
                <span>Language: <strong className="text-neutral-200 capitalize">{activeTask.language?.toLowerCase()}</strong></span>
                <span>Target Speed: <strong className="text-amber-400 font-mono">{activeTask.targetWpm} WPM</strong></span>
                <span>Target Accuracy: <strong className="text-amber-400 font-mono">{activeTask.targetAccuracy}%</strong></span>
              </div>
            </div>
            <TypingPractice initialText={activeTask.textContent} isTask={true} onSessionComplete={handleTaskSessionComplete} />
            {taskSubmitStatus && (
              <div className="mt-4 p-4 rounded-xl bg-emerald-950/30 border border-emerald-900/50 text-emerald-400 text-sm font-semibold flex items-center gap-2">
                <CheckCircle2 size={16} /> {taskSubmitStatus}
              </div>
            )}
            {taskSubmitError && (
              <div className="mt-4 p-4 rounded-xl bg-red-950/30 border border-red-900/50 text-red-400 text-sm font-semibold flex items-center gap-2">
                <AlertCircle size={16} /> {taskSubmitError}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── SVG WPM line chart ───────────────────────────────────────────────────
  const renderWpmChart = () => {
    const sessions = analytics.sessions || [];
    if (sessions.length < 2) {
      return (
        <div className="h-44 flex items-center justify-center text-xs text-neutral-500">
          Complete at least 2 typing sessions to see your trend.
        </div>
      );
    }
    const width = 450; const height = 160; const padding = 28;
    const maxWpm = Math.max(...sessions.map((s: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => s.wpm), 60);
    const minWpm = Math.min(...sessions.map((s: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => s.wpm), 10);
    const wpmRange = maxWpm - minWpm || 1;
    const points = sessions.map((s: any /* eslint-disable-line @typescript-eslint/no-explicit-any */, idx: number) => ({
      x: padding + (idx / (sessions.length - 1)) * (width - padding * 2),
      y: height - padding - ((s.wpm - minWpm) / wpmRange) * (height - padding * 2),
      ...s,
    }));
    const pathData = points.reduce((acc: string, p: any /* eslint-disable-line @typescript-eslint/no-explicit-any */, idx: number) =>
      idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`, '');
    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
        {[0, 0.5, 1].map((ratio) => {
          const y = padding + ratio * (height - padding * 2);
          return (
            <g key={ratio} className="opacity-20">
              <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#646669" strokeWidth="1" strokeDasharray="3 3" />
              <text x={padding - 5} y={y + 4} fill="#d1d0c5" fontSize="8" textAnchor="end" fontFamily="monospace">
                {Math.round(maxWpm - ratio * wpmRange)}
              </text>
            </g>
          );
        })}
        <path d={pathData} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p: any /* eslint-disable-line @typescript-eslint/no-explicit-any */, idx: number) => (
          <circle key={idx} cx={p.x} cy={p.y} r="3.5" fill="#111215" stroke="#f59e0b" strokeWidth="2">
            <title>{`${p.wpm} WPM — ${p.accuracy}% Acc`}</title>
          </circle>
        ))}
      </svg>
    );
  };

  // ── Performance trend badge ───────────────────────────────────────────────
  const trendConfig: Record<string, { icon: React.ReactNode; label: string; color: string; bg: string }> = {
    improving: { icon: <TrendingUp size={16} />, label: 'Your speed is improving! Keep it up 🚀', color: 'text-emerald-400', bg: 'bg-emerald-950/30 border-emerald-900/50' },
    stable: { icon: <Minus size={16} />, label: 'Performance is steady. Push for a new record!', color: 'text-amber-400', bg: 'bg-amber-950/30 border-amber-900/50' },
    declining: { icon: <TrendingDown size={16} />, label: 'A slight dip — more practice will bring you back!', color: 'text-red-400', bg: 'bg-red-950/30 border-red-900/50' },
    new: { icon: <Star size={16} />, label: 'Welcome! Start typing to track your progress.', color: 'text-sky-400', bg: 'bg-sky-950/30 border-sky-900/50' },
  };
  const trend = trendConfig[analytics.performanceTrend ?? 'new'];

  return (
    <div className="min-h-screen bg-[#111215] text-[#d1d0c5] flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6 select-none">

        {/* ── Profile header ── */}
        <section className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-neutral-800/60 pb-6">
          <div>
            <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">
              {user?.role === 'STUDENT' ? 'Student Profile' : 'General Profile'}
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-neutral-100 mt-0.5">{user?.name}</h1>
            {user?.role === 'STUDENT' && (
              <p className="text-xs text-neutral-500 mt-1 flex flex-wrap gap-x-3">
                <span>Course: <strong className="text-neutral-300">{user.courseName || 'N/A'}</strong></span>
                <span>Batch: <strong className="text-neutral-300">{user.batchName || 'N/A'}</strong></span>
                <span>Roll: <strong className="text-neutral-300">{user.rollNumber || 'N/A'}</strong></span>
              </p>
            )}
            {user?.role === 'USER' && (
              <p className="text-xs text-neutral-500 mt-1 flex flex-wrap gap-x-3">
                <span>Account Type: <strong className="text-neutral-300">General User</strong></span>
                <span>Mode: <strong className="text-neutral-300">Self Practice</strong></span>
              </p>
            )}
          </div>
          {user?.role === 'STUDENT' && (
            <div className="flex items-center gap-2 bg-neutral-950 px-4 py-2.5 rounded-xl border border-neutral-800">
              <Award className="text-amber-500" size={22} />
              <div className="flex flex-col">
                <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">Total Score</span>
                <span className="font-mono text-base font-bold text-neutral-200">{user.points} pts</span>
              </div>
            </div>
          )}
        </section>

        {/* ── Stat Cards ── */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Tests Taken', value: analytics.totalTests, icon: <Hash size={18} />, suffix: '' },
            { label: 'Best WPM', value: analytics.bestWpm, icon: <Zap size={18} />, suffix: ' wpm' },
            { label: 'Average WPM', value: analytics.avgWpm, icon: <TrendingUp size={18} />, suffix: ' wpm' },
            { label: 'Avg Accuracy', value: analytics.avgAccuracy, icon: <Target size={18} />, suffix: '%' },
          ].map(({ label, value, icon, suffix }) => (
            <div key={label} className="p-5 rounded-2xl border border-neutral-800 bg-[#1d1e22]/20 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">{label}</span>
                <span className="text-amber-500/70">{icon}</span>
              </div>
              <p className="font-mono text-3xl font-black text-neutral-100 leading-none">
                {value}<span className="text-sm text-neutral-500 font-semibold">{suffix}</span>
              </p>
            </div>
          ))}
        </section>

        {/* ── Performance trend + Daily goal ── */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Trend */}
          <div className={`md:col-span-2 p-4 rounded-2xl border flex items-center gap-3 ${trend.bg}`}>
            <span className={trend.color}>{trend.icon}</span>
            <p className={`text-sm font-semibold ${trend.color}`}>{trend.label}</p>
          </div>

          {/* Daily goal (students only) */}
          {user?.role === 'STUDENT' ? (
            <div className="p-5 rounded-2xl border border-neutral-800 bg-[#1d1e22]/20 flex flex-col justify-between gap-3">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Daily Goal</span>
                  <h3 className="text-base font-bold text-neutral-100 mt-0.5">
                    {targets.todayMinutesPracticed} / {targets.targetMinutes} mins
                  </h3>
                </div>
                <div className="p-2 bg-neutral-950 rounded-lg text-amber-500 border border-neutral-800">
                  <Clock size={16} />
                </div>
              </div>
              <div>
                <div className="w-full bg-neutral-950 h-2.5 rounded-full overflow-hidden border border-neutral-800">
                  <div
                    className="bg-amber-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${targets.percentComplete}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-bold text-neutral-500 uppercase tracking-wider mt-1.5">
                  <span>{targets.percentComplete}% completed</span>
                  <span>Penalty: −{targets.pointsDeduction} pts/day</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-5 rounded-2xl border border-neutral-800 bg-[#1d1e22]/20 flex flex-col justify-center items-center gap-1 text-center">
              <Clock size={20} className="text-amber-500/60" />
              <p className="text-xs text-neutral-500 font-semibold">Practice any time — no daily target for general users.</p>
            </div>
          )}
        </section>

        {/* ── Charts ── */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 rounded-2xl border border-neutral-800 bg-[#1d1e22]/20 flex flex-col gap-3">
            <div className="flex items-center gap-2 border-b border-neutral-800 pb-2">
              <TrendingUp className="text-amber-500" size={16} />
              <h3 className="text-sm font-bold text-neutral-200">WPM Trend</h3>
            </div>
            {renderWpmChart()}
            <p className="text-[10px] text-neutral-500 text-center uppercase tracking-wider font-semibold">Last 15 sessions</p>
          </div>

          <div className="p-5 rounded-2xl border border-neutral-800 bg-[#1d1e22]/20 flex flex-col gap-3">
            <div className="flex items-center gap-2 border-b border-neutral-800 pb-2">
              <BarChart3 className="text-amber-500" size={16} />
              <h3 className="text-sm font-bold text-neutral-200">Daily Practice (Mins)</h3>
            </div>
            <div className="flex items-end justify-between gap-1.5 h-32 px-1">
              {analytics.dailyPractice.map((d: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => {
                const maxMins = Math.max(...analytics.dailyPractice.map((x: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => x.minutes), 1);
                const pct = Math.max(4, (d.minutes / maxMins) * 100);
                return (
                  <div key={d.dayName} className="flex flex-col items-center gap-1 flex-1">
                    <span className="text-[9px] font-mono text-neutral-500">{d.minutes > 0 ? d.minutes : ''}</span>
                    <div
                      className="w-full bg-amber-500/70 rounded-t transition-all duration-500"
                      style={{ height: `${pct}%` }}
                      title={`${d.minutes} min`}
                    />
                    <span className="text-[9px] font-bold text-neutral-500 uppercase">{d.dayName}</span>
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-neutral-500 text-center uppercase tracking-wider font-semibold">Last 7 days</p>
          </div>
        </section>

        {/* ── Recent Practice History ── */}
        <section className="p-5 rounded-2xl border border-neutral-800 bg-[#1d1e22]/10 flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-neutral-800 pb-3">
            <Clock className="text-amber-500" size={18} />
            <h2 className="text-base font-bold text-neutral-100">Recent Practice History</h2>
          </div>

          {analytics.recentSessions.length === 0 ? (
            <div className="py-10 text-center text-sm text-neutral-500">
              No practice sessions yet. Head to the homepage to start typing!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="text-[10px] text-neutral-500 uppercase tracking-widest border-b border-neutral-800/80">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Time</th>
                    <th className="py-2.5 px-3 text-right">WPM</th>
                    <th className="py-2.5 px-3 text-right">Accuracy</th>
                    <th className="py-2.5 px-3 text-right">Duration</th>
                    <th className="py-2.5 px-3">Language</th>
                    <th className="py-2.5 px-3">Mode</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-900/50">
                  {analytics.recentSessions.map((s: any /* eslint-disable-line @typescript-eslint/no-explicit-any */, idx: number) => {
                    // Format date/time in the browser's local timezone
                    const dt = s.createdAtISO ? new Date(s.createdAtISO) : null;
                    const dateStr = dt
                      ? dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                      : 'N/A';
                    const timeStr = dt
                      ? dt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
                      : 'N/A';
                    return (
                    <tr key={s.id ?? idx} className="hover:bg-neutral-900/30 transition-colors">
                      <td className="py-3 px-3 text-neutral-400">{dateStr}</td>
                      <td className="py-3 px-3 text-neutral-500">{timeStr}</td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-amber-400">{s.wpm}</td>
                      <td className="py-3 px-3 text-right font-mono text-neutral-300">{s.accuracy}%</td>
                      <td className="py-3 px-3 text-right text-neutral-400">{s.duration}s</td>
                      <td className="py-3 px-3 text-neutral-400 capitalize">{s.language}</td>
                      <td className="py-3 px-3">
                        <span className="bg-neutral-900 px-2 py-0.5 rounded text-[10px] font-semibold text-neutral-400 border border-neutral-800">
                          {s.mode}
                        </span>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Task Assignments (Students only) ── */}
        {user?.role === 'STUDENT' && (
          <section className="p-5 rounded-2xl border border-neutral-800 bg-[#1d1e22]/10 flex flex-col gap-4">
            <div className="flex items-center gap-2 border-b border-neutral-800 pb-3">
              <BookOpen className="text-amber-500" size={18} />
              <h2 className="text-base font-bold text-neutral-100">Batch Typing Assignments</h2>
            </div>
            {tasks.length === 0 ? (
              <div className="py-8 text-center text-sm text-neutral-500">No tasks currently assigned to your batch.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tasks.map((task: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => (
                  <div
                    key={task.id}
                    className={`p-4 rounded-xl border flex flex-col justify-between gap-4 transition-colors ${
                      task.status === 'COMPLETED'
                        ? 'border-emerald-800/40 bg-emerald-950/5'
                        : task.status === 'MISSED'
                        ? 'border-red-900/40 bg-red-950/5'
                        : 'border-neutral-800 bg-neutral-950/40 hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <h4 className="text-sm font-bold text-neutral-200">{task.title}</h4>
                        <p className="text-[11px] text-neutral-500 mt-0.5 leading-relaxed truncate max-w-xs">{task.textContent}</p>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider shrink-0 ${
                        task.status === 'COMPLETED'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : task.status === 'MISSED'
                          ? 'bg-red-500/10 text-red-400'
                          : 'bg-amber-500/10 text-amber-400'
                      }`}>
                        {task.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs border-t border-neutral-800/50 pt-3">
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-neutral-500">
                        <span>Target: <strong className="text-neutral-300 font-mono">{task.targetWpm}W / {task.targetAccuracy}%</strong></span>
                        <span>Pts: <strong className="text-neutral-300 font-mono">+{task.pointsAwardable}</strong></span>
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          <strong className="text-neutral-300">{new Date(task.deadline).toLocaleDateString()}</strong>
                        </span>
                      </div>
                      {task.status === 'COMPLETED' ? (
                        <div className="text-[11px] text-emerald-400 font-medium">
                          {Math.round(task.submission?.wpm ?? 0)} WPM / {Math.round(task.submission?.accuracy ?? 0)}%
                        </div>
                      ) : (
                        <button
                          onClick={() => { setActiveTask(task); setTaskSubmitStatus(''); setTaskSubmitError(''); }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 ${
                            task.status === 'MISSED'
                              ? 'bg-red-950 text-red-400 hover:bg-red-900/30'
                              : 'bg-amber-500 text-neutral-950 hover:bg-amber-400'
                          }`}
                        >
                          <Play size={12} />
                          {task.status === 'MISSED' ? 'Late Attempt (0 pts)' : 'Start Task'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

      </main>
    </div>
  );
}
