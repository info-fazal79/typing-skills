'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Mail, CheckCircle2 } from 'lucide-react';
import { Logo } from '@/components/Logo';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong');
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col justify-center items-center p-4">
      <div className="mb-8">
        <Logo size="large" />
      </div>

      <div className="w-full max-w-md bg-surface/50 border border-neutral-800 p-8 rounded-2xl backdrop-blur-md shadow-2xl">
        {submitted ? (
          <div className="flex flex-col items-center text-center gap-4">
            <div className="bg-emerald-500/10 text-emerald-400 p-4 rounded-full border border-emerald-500/25">
              <CheckCircle2 size={40} />
            </div>
            <h2 className="text-xl font-bold text-neutral-100">Check your email</h2>
            <p className="text-sm text-neutral-400 leading-relaxed">
              If an account with that email exists, we&apos;ve sent a link to reset your password. It expires in 1 hour.
            </p>
            <Link href="/login" className="text-brand-500 hover:underline text-sm mt-2">
              Back to Log In
            </Link>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-bold text-neutral-100 mb-1">Forgot Password</h2>
            <p className="text-xs text-neutral-400 mb-6">
              Enter your account email and we&apos;ll send you a link to reset your password.
            </p>

            {error && (
              <div className="mb-6 p-4 rounded-xl bg-red-950/30 border border-red-900/50 text-red-400 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-neutral-400 text-xs font-semibold uppercase tracking-wider">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" size={18} />
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-background border border-neutral-800 text-neutral-100 placeholder-neutral-700 focus:outline-hidden focus:border-brand-500/50 transition-colors text-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-brand-500 hover:bg-brand-400 disabled:bg-neutral-800 text-neutral-950 disabled:text-neutral-500 font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-brand-500/10 active:scale-95 mt-2"
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
                {!loading && <ArrowRight size={16} />}
              </button>
            </form>

            <p className="mt-8 text-neutral-500 text-xs text-center">
              Remembered your password?{' '}
              <Link href="/login" className="text-brand-500 hover:underline">
                Log In
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
