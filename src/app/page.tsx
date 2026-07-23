'use client';

import React, { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { TypingPractice } from '@/components/TypingPractice';
import { Sparkles, Languages, Star, BookOpen, Trophy } from 'lucide-react';

export default function LandingPage() {
  const [saveStatus, setSaveStatus] = useState<string>('');

  const handleSessionComplete = async (data: {
    wpm: number;
    accuracy: number;
    duration: number;
    language: string;
    mode: string;
  }) => {
    setSaveStatus('Saving your results...');
    try {
      const res = await fetch('/api/practice/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (res.ok) {
        setSaveStatus(`Session saved! Earned +${result.pointsEarned} points. Total points: ${result.newPointsTotal}`);
      } else {
        if (res.status === 401) {
          setSaveStatus('Practice completed! Log in to save results and earn points.');
        } else if (res.status === 403) {
          setSaveStatus('Account pending admin approval. Stats are not recorded.');
        } else {
          setSaveStatus(result.error || 'Failed to save session stats.');
        }
      }
    } catch {
      setSaveStatus('Error saving session stats.');
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <Navbar />

      {/* Hero Header */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-12 flex flex-col gap-10">
        <section className="text-center flex flex-col items-center gap-3">
          <div className="inline-flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 px-3 py-1 rounded-full text-xs font-semibold text-amber-400">
            <Sparkles size={12} />
            Educational Typing Platform
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-neutral-100">
            Elevate Your Typing Speed
          </h1>
          <p className="text-neutral-400 max-w-xl text-sm sm:text-base leading-relaxed">
            Practice typing in both <strong className="text-neutral-200">English</strong> and{' '}
            <strong className="text-neutral-200">বাংলা (Bangla)</strong>. 
            Earn points, complete batch assignments, and climb the institute leaderboards.
          </p>
        </section>

        {/* Typing Game Container */}
        <section className="bg-surface/20 border border-neutral-800/60 p-6 sm:p-8 rounded-3xl shadow-xl">
          <TypingPractice onSessionComplete={handleSessionComplete} />
          
          {saveStatus && (
            <div className="mt-4 p-3.5 rounded-xl text-xs font-semibold text-center bg-neutral-950 border border-neutral-800 flex items-center justify-center gap-2 max-w-xl mx-auto text-amber-400">
              <BookOpen size={14} className="text-amber-500 animate-pulse" />
              {saveStatus}
            </div>
          )}
        </section>

        {/* Informational Cards */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          <div className="bg-surface/30 border border-neutral-800/50 p-6 rounded-2xl flex flex-col gap-3">
            <div className="text-amber-500 bg-amber-500/10 p-2.5 rounded-lg w-max border border-amber-500/20">
              <Languages size={20} />
            </div>
            <h3 className="text-base font-bold text-neutral-100">Dual-Language Support</h3>
            <p className="text-neutral-400 text-xs leading-relaxed">
              Toggle instantly between English modes (Standard, Punctuation, Numbers) and Bangla modes (Vowels, Consonants, Modifiers, Conjuncts, Mixed).
            </p>
          </div>

          <div className="bg-surface/30 border border-neutral-800/50 p-6 rounded-2xl flex flex-col gap-3">
            <div className="text-amber-500 bg-amber-500/10 p-2.5 rounded-lg w-max border border-amber-500/20">
              <Star size={20} />
            </div>
            <h3 className="text-base font-bold text-neutral-100">Gamified Tracking</h3>
            <p className="text-neutral-400 text-xs leading-relaxed">
              Gain points for accurate sessions. Meet your batch targets to maintain your points, but watch out: daily inactivity drops your points!
            </p>
          </div>

          <div className="bg-surface/30 border border-neutral-800/50 p-6 rounded-2xl flex flex-col gap-3">
            <div className="text-amber-500 bg-amber-500/10 p-2.5 rounded-lg w-max border border-amber-500/20">
              <Trophy size={20} />
            </div>
            <h3 className="text-base font-bold text-neutral-100">Batch Competitions</h3>
            <p className="text-neutral-400 text-xs leading-relaxed">
              Compare your progress inside your specific batch or check out the Overall leaderboard to see the top typists across the entire institute.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-neutral-900 py-6 text-center text-neutral-600 text-[11px] mt-12 bg-neutral-950/20">
        &copy; {new Date().getFullYear()} Typing Institute. developed by{' '}
        <a 
          href="https://www.muhammadfazal.com" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="underline hover:text-neutral-400 transition-colors"
        >
          Muhammad Fazal
        </a>
      </footer>
    </div>
  );
}
