'use client';

import React, { useEffect, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { TypingPractice } from '@/components/TypingPractice';
import { 
  Award, BookOpen, Clock, Calendar, CheckCircle2, AlertCircle, Play, 
  Sparkles, ArrowLeft, Trophy, BarChart3, TrendingUp 
} from 'lucide-react';
import Link from 'next/link';
export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Active task state
  const [activeTask, setActiveTask] = useState<any>(null);
  const [taskSubmitStatus, setTaskSubmitStatus] = useState<string>('');
  const [taskSubmitError, setTaskSubmitError] = useState<string>('');

  const fetchDashboardData = async () => {
    try {
      const res = await fetch('/api/student/dashboard');
      if (!res.ok) {
        throw new Error('Failed to load dashboard data');
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleTaskSessionComplete = async (sessionStats: {
    wpm: number;
    accuracy: number;
    duration: number;
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
        // Refresh dashboard data
        fetchDashboardData();
      } else {
        setTaskSubmitStatus('');
        setTaskSubmitError(json.error || 'Failed to submit task.');
      }
    } catch (e) {
      setTaskSubmitStatus('');
      setTaskSubmitError('Network error submitting task.');
    }
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

  // Handle Pending Approvals view
  if (user.status === 'PENDING') {
    return (
      <div className="min-h-screen bg-[#111215] text-[#d1d0c5] flex flex-col font-sans">
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
            <p className="mb-3">
              Your profile details:
            </p>
            <ul className="flex flex-col gap-1 text-left list-disc list-inside">
              <li>Course: <strong className="text-neutral-300">{user.courseName}</strong></li>
              <li>Batch: <strong className="text-neutral-300">{user.batchName}</strong></li>
              <li>Roll: <strong className="text-neutral-300">{user.rollNumber}</strong></li>
            </ul>
          </div>
          <p className="text-neutral-400 text-sm max-w-md">
            Please wait for an administrator to approve your account. Once approved, you'll be granted full access to the dashboards, leaderboards, and assignments.
          </p>
        </div>
      </div>
    );
  }

  // Handle Task Practice Mode
  if (activeTask) {
    return (
      <div className="min-h-screen bg-[#111215] text-[#d1d0c5] flex flex-col font-sans">
        <Navbar />
        <div className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-12 flex flex-col gap-6">
          <button 
            onClick={() => {
              setActiveTask(null);
              setTaskSubmitStatus('');
              setTaskSubmitError('');
            }}
            className="flex items-center gap-1.5 text-neutral-500 hover:text-neutral-300 text-xs font-semibold self-start"
          >
            <ArrowLeft size={16} />
            Back to Dashboard
          </button>

          <div className="bg-[#1d1e22]/40 border border-neutral-800 p-6 rounded-2xl flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-neutral-800 pb-3">
              <div>
                <span className="text-[10px] bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                  Task Assignment
                </span>
                <h2 className="text-lg font-bold text-neutral-100 mt-1">{activeTask.title}</h2>
              </div>
              <div className="flex flex-wrap gap-4 text-xs font-semibold text-neutral-400">
                <span>Language: <strong className="text-neutral-200 capitalize">{activeTask.language.toLowerCase()}</strong></span>
                <span>Target Speed: <strong className="text-amber-400 font-mono">{activeTask.targetWpm} WPM</strong></span>
                <span>Target Accuracy: <strong className="text-amber-400 font-mono">{activeTask.targetAccuracy}%</strong></span>
              </div>
            </div>

            <TypingPractice 
              initialText={activeTask.textContent} 
              isTask={true}
              onSessionComplete={handleTaskSessionComplete}
            />

            {taskSubmitStatus && (
              <div className="mt-4 p-4 rounded-xl bg-emerald-950/30 border border-emerald-900/50 text-emerald-400 text-sm font-semibold flex items-center gap-2">
                <CheckCircle2 size={16} />
                {taskSubmitStatus}
              </div>
            )}

            {taskSubmitError && (
              <div className="mt-4 p-4 rounded-xl bg-red-950/30 border border-red-900/50 text-red-400 text-sm font-semibold flex items-center gap-2">
                <AlertCircle size={16} />
                {taskSubmitError}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Draw Custom SVG line chart (Recent Sessions WPM)
  const renderWpmHistoryChart = () => {
    const sessions = analytics.sessions || [];
    if (sessions.length < 2) {
      return (
        <div className="h-44 flex items-center justify-center text-xs text-neutral-500">
          Not enough typing sessions to draw chart. Complete standard practices first.
        </div>
      );
    }

    const width = 450;
    const height = 180;
    const padding = 25;

    const maxWpm = Math.max(...sessions.map((s: any) => s.wpm), 60);
    const minWpm = Math.min(...sessions.map((s: any) => s.wpm), 10);
    const wpmRange = maxWpm - minWpm || 1;

    const points = sessions.map((s: any, idx: number) => {
      const x = padding + (idx / (sessions.length - 1)) * (width - padding * 2);
      const y = height - padding - ((s.wpm - minWpm) / wpmRange) * (height - padding * 2);
      return { x, y, ...s };
    });

    const pathData = points.reduce((acc: string, p: any, idx: number) => {
      return idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
    }, '');

    return (
      <div className="relative w-full overflow-hidden">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
          {/* Y Axis Gridlines */}
          {[0, 0.5, 1].map((ratio) => {
            const y = padding + ratio * (height - padding * 2);
            const wpmLabel = Math.round(maxWpm - ratio * wpmRange);
            return (
              <g key={ratio} className="opacity-20">
                <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#646669" strokeWidth="1" strokeDasharray="3 3" />
                <text x={padding - 5} y={y + 4} fill="#d1d0c5" fontSize="8" textAnchor="end" fontFamily="monospace">{wpmLabel}</text>
              </g>
            );
          })}

          {/* Line Path */}
          <path d={pathData} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

          {/* Nodes */}
          {points.map((p: any, idx: number) => (
            <circle
              key={idx}
              cx={p.x}
              cy={p.y}
              r="3.5"
              fill="#111215"
              stroke="#f59e0b"
              strokeWidth="2"
              className="hover:r-5 transition-all cursor-pointer"
            >
              <title>{`${p.wpm} WPM - ${p.accuracy}% Acc (${p.date})`}</title>
            </circle>
          ))}
        </svg>
      </div>
    );
  };

  // Draw Custom SVG bar chart (Daily Practice Minutes)
  const renderDailyPracticeChart = () => {
    const dailyHistory = analytics.dailyPractice || [];
    const width = 450;
    const height = 180;
    const padding = 25;

    const maxMins = Math.max(...dailyHistory.map((d: any) => d.minutes), 5);

    return (
      <div className="relative w-full overflow-hidden">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
          {/* Grid lines */}
          {[0, 0.5, 1].map((ratio) => {
            const y = padding + ratio * (height - padding * 2);
            const val = Math.round(maxMins - ratio * maxMins);
            return (
              <g key={ratio} className="opacity-20">
                <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#646669" strokeWidth="1" />
                <text x={padding - 5} y={y + 4} fill="#d1d0c5" fontSize="8" textAnchor="end" fontFamily="monospace">{val}m</text>
              </g>
            );
          })}

          {/* Bars */}
          {dailyHistory.map((d: any, idx: number) => {
            const barWidth = 30;
            const x = padding + (idx / (dailyHistory.length - 1)) * (width - padding * 3) + 10;
            const barHeight = (d.minutes / maxMins) * (height - padding * 2);
            const y = height - padding - barHeight;

            return (
              <g key={idx}>
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={Math.max(2, barHeight)}
                  rx="3"
                  fill="#f59e0b"
                  className="opacity-75 hover:opacity-100 transition-opacity"
                >
                  <title>{`${d.minutes} minutes`}</title>
                </rect>
                <text x={x + barWidth / 2} y={height - padding + 12} fill="#646669" fontSize="8" textAnchor="middle" fontWeight="bold">
                  {d.dayName}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#111215] text-[#d1d0c5] flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6 select-none">
        
        {/* Top Profile Summary Card */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 p-6 rounded-2xl border border-neutral-800 bg-[#1d1e22]/20 flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold text-amber-500 uppercase tracking-widest">
                {user.role === 'STUDENT' ? 'Student Profile' : 'General Practice Profile'}
              </span>
              <h1 className="text-2xl font-black text-neutral-100 leading-tight">{user.name}</h1>
              {user.role === 'STUDENT' && (
                <p className="text-xs text-neutral-500 mt-1">
                  Course: <strong className="text-neutral-300 font-medium">{user.courseName || 'N/A'}</strong> | 
                  Batch: <strong className="text-neutral-300 font-medium">{user.batchName || 'N/A'}</strong> | 
                  Roll: <strong className="text-neutral-300 font-medium">{user.rollNumber || 'N/A'}</strong>
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <div className="bg-neutral-950 px-4 py-2.5 rounded-xl border border-neutral-800 flex items-center gap-2">
                <Award className="text-amber-500" size={24} />
                <div className="flex flex-col">
                  <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">Total Score</span>
                  <span className="font-mono text-base font-bold text-neutral-200">{user.points} pts</span>
                </div>
              </div>
            </div>
          </div>

          {/* Daily practice meter */}
          <div className="p-6 rounded-2xl border border-neutral-800 bg-[#1d1e22]/20 flex flex-col justify-between gap-4">
            <div className="flex justify-between items-start">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Daily Goal</span>
                <h3 className="text-base font-bold text-neutral-100">{targets.todayMinutesPracticed} / {targets.targetMinutes} mins</h3>
              </div>
              <div className="p-2 bg-neutral-950 rounded-lg text-amber-500 border border-neutral-800">
                <Clock size={18} />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="w-full bg-neutral-950 h-3 rounded-full overflow-hidden border border-neutral-800">
                <div 
                  className="bg-amber-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${targets.percentComplete}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                <span>{targets.percentComplete}% completed</span>
                <span>Penalty: -{targets.pointsDeduction} pts/day</span>
              </div>
            </div>
          </div>
        </section>

        {/* Assigned Tasks Grid */}
        <section className="p-6 rounded-2xl border border-neutral-800 bg-[#1d1e22]/10 flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-neutral-800 pb-3">
            <BookOpen className="text-amber-500" size={20} />
            <h2 className="text-lg font-bold text-neutral-100">Batch Typing Assignments</h2>
          </div>

          {tasks.length === 0 ? (
            <div className="p-8 text-center text-sm text-neutral-500">
              No tasks currently assigned to your batch. Good job!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tasks.map((task: any) => (
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
                      <p className="text-[11px] text-neutral-500 mt-0.5 leading-relaxed truncate max-w-xs sm:max-w-md">
                        Text: {task.textContent}
                      </p>
                    </div>

                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
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
                      <span>Points: <strong className="text-neutral-300 font-mono">+{task.pointsAwardable}</strong></span>
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        Deadline: <strong className="text-neutral-300">{new Date(task.deadline).toLocaleDateString()}</strong>
                      </span>
                    </div>

                    {task.status === 'COMPLETED' ? (
                      <div className="text-[11px] text-emerald-400 font-medium">
                        Completed at: {task.submission ? Math.round(task.submission.wpm) : 0} WPM / {task.submission ? Math.round(task.submission.accuracy) : 0}% Acc
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setActiveTask(task);
                          setTaskSubmitStatus('');
                          setTaskSubmitError('');
                        }}
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

        {/* Charts & Analytics */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Chart 1 */}
          <div className="p-6 rounded-2xl border border-neutral-800 bg-[#1d1e22]/20 flex flex-col gap-4">
            <div className="flex items-center gap-2 border-b border-neutral-800 pb-2">
              <TrendingUp className="text-amber-500" size={18} />
              <h3 className="text-sm font-bold text-neutral-200">Typing Speed Trend (WPM)</h3>
            </div>
            {renderWpmHistoryChart()}
            <p className="text-[10px] text-neutral-500 text-center uppercase tracking-wider font-semibold">
              Live trend of speed across your last 15 practice sessions
            </p>
          </div>

          {/* Chart 2 */}
          <div className="p-6 rounded-2xl border border-neutral-800 bg-[#1d1e22]/20 flex flex-col gap-4">
            <div className="flex items-center gap-2 border-b border-neutral-800 pb-2">
              <BarChart3 className="text-amber-500" size={18} />
              <h3 className="text-sm font-bold text-neutral-200">Daily Practice Duration (Mins)</h3>
            </div>
            {renderDailyPracticeChart()}
            <p className="text-[10px] text-neutral-500 text-center uppercase tracking-wider font-semibold">
              Total practice minutes completed over the last 7 calendar days
            </p>
          </div>
        </section>

      </main>
    </div>
  );
}
