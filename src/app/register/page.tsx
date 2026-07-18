'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sparkles, ArrowRight, User, Mail, Lock, BookOpen, Layers, Hash, CheckCircle2 } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [courseName, setCourseName] = useState('');
  const [batchName, setBatchName] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password,
          courseName,
          batchName,
          rollNumber,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <main className="min-h-screen bg-[#111215] text-[#d1d0c5] flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-md bg-[#1d1e22]/50 border border-neutral-800 p-8 rounded-2xl text-center flex flex-col items-center gap-6 shadow-2xl">
          <div className="bg-emerald-500/10 text-emerald-400 p-4 rounded-full border border-emerald-500/25">
            <CheckCircle2 size={48} />
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-bold text-neutral-100">Registration Submitted</h2>
            <p className="text-sm text-neutral-400">
              Thank you for registering, <strong className="text-neutral-200">{name}</strong>!
            </p>
          </div>
          <p className="text-neutral-400 text-sm leading-relaxed">
            Your account is currently <span className="text-amber-500 font-semibold">Pending Admin Approval</span>. 
            Once an administrator approves your account, you will be able to log in, access the typing practice modules, view the leaderboards, and complete batch assignments.
          </p>
          <Link
            href="/login"
            className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-amber-500/10"
          >
            Go to Login
            <ArrowRight size={16} />
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#111215] text-[#d1d0c5] flex flex-col justify-center items-center p-4 py-12">
      {/* Title */}
      <Link href="/" className="flex items-center gap-2 mb-8 group">
        <Sparkles className="text-amber-500 group-hover:rotate-12 transition-transform duration-300" size={32} />
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-amber-400 to-amber-200 bg-clip-text text-transparent">
          Typing Institute
        </h1>
      </Link>

      <div className="w-full max-w-lg bg-[#1d1e22]/50 border border-neutral-800 p-8 rounded-2xl backdrop-blur-md shadow-2xl">
        <h2 className="text-xl font-bold text-neutral-100 mb-2">Student Registration</h2>
        <p className="text-xs text-neutral-400 mb-6">Create your account and wait for administrator approval.</p>
        
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-950/30 border border-red-900/50 text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label className="text-neutral-400 text-xs font-semibold uppercase tracking-wider">Full Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" size={18} />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#111215] border border-neutral-800 text-neutral-100 placeholder-neutral-700 focus:outline-hidden focus:border-amber-500/50 transition-colors text-sm"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label className="text-neutral-400 text-xs font-semibold uppercase tracking-wider">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" size={18} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john.doe@example.com"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#111215] border border-neutral-800 text-neutral-100 placeholder-neutral-700 focus:outline-hidden focus:border-amber-500/50 transition-colors text-sm"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label className="text-neutral-400 text-xs font-semibold uppercase tracking-wider">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" size={18} />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Choose a secure password"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#111215] border border-neutral-800 text-neutral-100 placeholder-neutral-700 focus:outline-hidden focus:border-amber-500/50 transition-colors text-sm"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-neutral-400 text-xs font-semibold uppercase tracking-wider">Course Name</label>
            <div className="relative">
              <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" size={18} />
              <input
                type="text"
                required
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                placeholder="e.g. Web Dev"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#111215] border border-neutral-800 text-neutral-100 placeholder-neutral-700 focus:outline-hidden focus:border-amber-500/50 transition-colors text-sm"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-neutral-400 text-xs font-semibold uppercase tracking-wider">Batch Name</label>
            <div className="relative">
              <Layers className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" size={18} />
              <input
                type="text"
                required
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                placeholder="e.g. Batch-2026-A"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#111215] border border-neutral-800 text-neutral-100 placeholder-neutral-700 focus:outline-hidden focus:border-amber-500/50 transition-colors text-sm"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label className="text-neutral-400 text-xs font-semibold uppercase tracking-wider">Roll Number</label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" size={18} />
              <input
                type="text"
                required
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value)}
                placeholder="e.g. IT-1025"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#111215] border border-neutral-800 text-neutral-100 placeholder-neutral-700 focus:outline-hidden focus:border-amber-500/50 transition-colors text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="sm:col-span-2 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:bg-neutral-800 text-neutral-950 disabled:text-neutral-500 font-bold py-3.5 px-4 rounded-xl transition-all shadow-lg shadow-amber-500/10 active:scale-98 mt-2"
          >
            {loading ? 'Submitting Registration...' : 'Register'}
            {!loading && <ArrowRight size={16} />}
          </button>
        </form>

        <p className="mt-8 text-neutral-500 text-xs text-center">
          Already have an account?{' '}
          <Link href="/login" className="text-amber-500 hover:underline">
            Log In
          </Link>
        </p>
      </div>
    </main>
  );
}
