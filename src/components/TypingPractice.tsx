'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTypingEngine } from '@/hooks/useTypingEngine';
import { generatePracticeText } from '@/utils/wordLists';
import { RotateCcw, Volume2, VolumeX, Sparkles, Trophy } from 'lucide-react';

interface TypingPracticeProps {
  onSessionComplete?: (data: {
    wpm: number;
    accuracy: number;
    duration: number;
    language: string;
    mode: string;
  }) => void;
  initialText?: string;
  isTask?: boolean;
}

// ── Persistent AudioContext (created once, reused on every keystroke) ─────────
let _audioCtx: AudioContext | null = null;
function getAudioCtx(): AudioContext | null {
  try {
    if (!_audioCtx || _audioCtx.state === 'closed') {
      _audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (_audioCtx.state === 'suspended') {
      _audioCtx.resume();
    }
    return _audioCtx;
  } catch {
    return null;
  }
}

function playClick(isCorrect: boolean) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    if (isCorrect) {
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.type = 'square';
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.04);
    } else {
      osc.frequency.setValueAtTime(200, ctx.currentTime);
      osc.type = 'sawtooth';
      gain.gain.setValueAtTime(0.07, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.08);
    }
  } catch { /* silently ignore */ }
}

// ─────────────────────────────────────────────────────────────────────────────

export function TypingPractice({ onSessionComplete, initialText, isTask = false }: TypingPracticeProps) {
  const [language, setLanguage] = useState<string>('english');
  const [mode, setMode] = useState<string>('standard');
  const [duration, setDuration] = useState<number>(30);
  const [text, setText] = useState<string>('');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [isFocused, setIsFocused] = useState<boolean>(true);
  const [saveStatus, setSaveStatus] = useState<string>('');
  const [isCustomDuration, setIsCustomDuration] = useState<boolean>(false);
  const [customDurationInput, setCustomDurationInput] = useState<string>('');

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const charsRef = useRef<(HTMLSpanElement | null)[]>([]);
  const [caretPos, setCaretPos] = useState({ x: 0, y: 0, height: 28, opacity: 0 });
  const soundEnabledRef = useRef(soundEnabled);
  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);

  // ── Generate initial text ─────────────────────────────────────────────────
  useEffect(() => {
    if (initialText) {
      setText(initialText);
    } else {
      setText(generatePracticeText(language, mode, 60));
    }
  }, [language, mode, initialText]);

  const {
    typedText,
    isStarted,
    isCompleted,
    timeLeft,
    wpm,
    accuracy,
    timeElapsed,
    handleInputChange,
    resetEngine,
  } = useTypingEngine(text, duration);

  // ── Infinite word appending ───────────────────────────────────────────────
  // When the user is within 15 words of the end, silently append more words.
  useEffect(() => {
    if (!initialText && isStarted && !isCompleted) {
      const charsRemaining = text.length - typedText.length;
      // Approx 5 chars per word × 15 words = 75 chars threshold
      if (charsRemaining < 75) {
        const extra = generatePracticeText(language, mode, 40);
        setText((prev) => prev + ' ' + extra);
      }
    }
  }, [typedText, text, isStarted, isCompleted, language, mode, initialText]);

  // ── Focus on mount / text change ────────────────────────────────────────
  useEffect(() => {
    if (inputRef.current && isFocused) {
      inputRef.current.focus();
    }
  }, [isFocused, text]);

  // ── Caret position ────────────────────────────────────────────────────────
  useEffect(() => {
    const activeIndex = typedText.length;
    const activeSpan = charsRef.current[activeIndex];
    if (activeSpan) {
      setCaretPos({
        x: activeSpan.offsetLeft,
        y: activeSpan.offsetTop,
        height: activeSpan.offsetHeight,
        opacity: isFocused && !isCompleted ? 1 : 0,
      });
    }
  }, [typedText, text, isFocused, isCompleted]);

  // ── Reset ─────────────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    resetEngine(duration);
    if (!initialText) {
      setText(generatePracticeText(language, mode, 60));
    }
    setSaveStatus('');
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  }, [duration, language, mode, initialText, resetEngine]);

  // ── Esc key listener ──────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleReset();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleReset]);

  // ── Sound on keystroke ────────────────────────────────────────────────────
  const lastLengthRef = useRef(0);
  useEffect(() => {
    if (typedText.length > lastLengthRef.current && soundEnabledRef.current) {
      const charIndex = typedText.length - 1;
      const isCorrect = typedText[charIndex] === text[charIndex];
      playClick(isCorrect);
    }
    lastLengthRef.current = typedText.length;
  }, [typedText, text]);

  // ── Session complete callback ─────────────────────────────────────────────
  const hasTriggeredComplete = useRef(false);
  useEffect(() => {
    if (isCompleted && !hasTriggeredComplete.current) {
      hasTriggeredComplete.current = true;
      if (onSessionComplete) {
        onSessionComplete({ wpm, accuracy, duration: timeElapsed, language, mode });
      }
    }
    if (!isCompleted) {
      hasTriggeredComplete.current = false;
    }
  }, [isCompleted, wpm, accuracy, timeElapsed, language, mode, onSessionComplete]);

  // ── Render characters ─────────────────────────────────────────────────────
  const renderCharacters = () => {
    return text.split('').map((char, index) => {
      let colorClass = 'text-neutral-500'; // untyped

      if (index < typedText.length) {
        if (typedText[index] === char) {
          colorClass = 'text-neutral-200'; // correct
        } else {
          colorClass = 'text-red-500 bg-red-950/30 rounded-sm'; // incorrect
        }
      }

      return (
        <span
          key={index}
          ref={(el) => { charsRef.current[index] = el; }}
          className={`font-mono text-xl sm:text-2xl transition-all duration-75 ${colorClass}`}
        >
          {char}
        </span>
      );
    });
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-6 select-none">
      <style>{`
        @keyframes caretBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>

      {/* Mode & Config Selector — hidden while test is running or for tasks */}
      {!isTask && !isStarted && !isCompleted && (
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 text-sm">
          {/* Language */}
          <div className="flex gap-2 bg-neutral-950 p-1 rounded-lg">
            <button
              onClick={() => { setLanguage('english'); setMode('standard'); }}
              className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
                language === 'english'
                  ? 'bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/25'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              English
            </button>
            <button
              onClick={() => { setLanguage('bangla'); setMode('mixed'); }}
              className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
                language === 'bangla'
                  ? 'bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/25'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              বাংলা (Bangla)
            </button>
          </div>

          {/* Mode */}
          <div className="flex flex-wrap gap-1 bg-neutral-950 p-1 rounded-lg">
            {language === 'english' ? (
              <>
                {['standard', 'punctuation', 'numbers'].map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`px-3 py-1.5 rounded-md capitalize font-medium transition-all ${
                      mode === m
                        ? 'bg-neutral-800 text-amber-400'
                        : 'text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </>
            ) : (
              <>
                {[
                  { id: 'mixed', label: 'Mixed' },
                  { id: 'vowels', label: 'Vowels (স্বরবর্ণ)' },
                  { id: 'consonants', label: 'Consonants (ব্যঞ্জনবর্ণ)' },
                  { id: 'modifiers', label: 'Modifiers (কার-চিহ্ন)' },
                  { id: 'conjuncts', label: 'Conjuncts (যুক্তবর্ণ)' },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMode(m.id)}
                    className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                      mode === m.id
                        ? 'bg-neutral-800 text-amber-400'
                        : 'text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </>
            )}
          </div>

          {/* Duration */}
          <div className="flex gap-1 bg-neutral-950 p-1 rounded-lg items-center">
            {[15, 30, 60].map((t) => (
              <button
                key={t}
                onClick={() => {
                  setDuration(t);
                  setIsCustomDuration(false);
                  resetEngine(t);
                }}
                className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                  duration === t && !isCustomDuration
                    ? 'bg-neutral-800 text-amber-400'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {t}s
              </button>
            ))}

            {isCustomDuration ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const val = parseInt(customDurationInput);
                  if (val > 0) { setDuration(val); resetEngine(val); }
                }}
                className="flex items-center ml-1"
              >
                <input
                  type="number"
                  min="1"
                  max="3600"
                  autoFocus
                  value={customDurationInput}
                  onChange={(e) => setCustomDurationInput(e.target.value)}
                  onBlur={() => {
                    const val = parseInt(customDurationInput);
                    if (val > 0) { setDuration(val); resetEngine(val); }
                  }}
                  className="w-16 px-2 py-1 bg-neutral-900 border border-amber-500/50 text-amber-400 rounded focus:outline-hidden text-sm"
                  placeholder="sec"
                />
              </form>
            ) : (
              <button
                onClick={() => {
                  setIsCustomDuration(true);
                  if (![15, 30, 60].includes(duration)) {
                    setCustomDurationInput(duration.toString());
                  }
                }}
                className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                  ![15, 30, 60].includes(duration)
                    ? 'bg-neutral-800 text-amber-400'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {![15, 30, 60].includes(duration) ? `${duration}s` : 'Custom'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Typing Area */}
      {!isCompleted ? (
        <div
          onClick={() => inputRef.current?.focus()}
          className={`relative p-8 rounded-2xl border transition-all duration-300 bg-neutral-900/40 min-h-[220px] flex items-center cursor-text ${
            isFocused
              ? 'border-neutral-800 ring-1 ring-amber-500/20'
              : 'border-neutral-800 hover:border-neutral-700 opacity-60'
          }`}
        >
          {/* Live stats */}
          <div className="absolute top-4 left-6 right-6 flex items-center justify-between text-neutral-400 text-xs tracking-wider uppercase font-semibold">
            <div className="flex items-center gap-4">
              <span>Time: <strong className="text-amber-400 font-mono text-base">{timeLeft}s</strong></span>
              <span>WPM: <strong className="text-neutral-200 font-mono text-base">{wpm}</strong></span>
              <span>Accuracy: <strong className="text-neutral-200 font-mono text-base">{accuracy}%</strong></span>
            </div>

            <div className="flex items-center gap-3">
              {/* Sound toggle */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  // Resume AudioContext on user gesture
                  if (!soundEnabled) getAudioCtx();
                  setSoundEnabled(!soundEnabled);
                }}
                className={`p-1 rounded transition-colors ${soundEnabled ? 'text-amber-400' : 'text-neutral-400 hover:text-amber-400'}`}
                title={soundEnabled ? 'Disable Key Sound' : 'Enable Key Sound'}
              >
                {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              </button>
              {/* Reset button */}
              <button
                onClick={(e) => { e.stopPropagation(); handleReset(); }}
                className="hover:text-amber-400 p-1 rounded transition-colors"
                title="Restart (Esc)"
              >
                <RotateCcw size={16} />
              </button>
            </div>
          </div>

          {/* Words area */}
          <div
            ref={containerRef}
            className="w-full mt-6 select-text tracking-wide leading-relaxed break-words whitespace-pre-wrap max-h-[160px] overflow-y-auto pr-2 relative"
          >
            {/* Caret */}
            <div
              className="absolute bg-amber-400 rounded-full transition-all duration-75 ease-out z-10 pointer-events-none"
              style={{
                left: 0,
                top: 0,
                width: '2px',
                height: `${caretPos.height}px`,
                transform: `translate(${caretPos.x}px, ${caretPos.y}px)`,
                opacity: caretPos.opacity,
                animation: caretPos.opacity ? 'caretBlink 1s step-end infinite' : 'none',
              }}
            />
            {renderCharacters()}
          </div>

          {/* Focus overlay */}
          {!isFocused && (
            <div className="absolute inset-0 bg-neutral-950/85 rounded-2xl flex flex-col items-center justify-center gap-2 backdrop-blur-xs transition-all animate-pulse">
              <Sparkles size={28} className="text-amber-400" />
              <p className="text-neutral-300 font-semibold text-sm">Click here to focus &amp; start typing</p>
              <p className="text-neutral-500 text-xs">The clock starts automatically when you type</p>
            </div>
          )}

          {/* Hidden textarea */}
          <textarea
            ref={inputRef}
            value={typedText}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            className="absolute top-0 left-0 w-0 h-0 opacity-0 pointer-events-none"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
          />
        </div>
      ) : (
        /* Results */
        <div className="p-8 rounded-2xl border border-neutral-800 bg-neutral-900/60 flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-3 border-b border-neutral-800 pb-4">
            <Trophy className="text-amber-400" size={28} />
            <h2 className="text-xl font-bold text-neutral-100">Practice Completed!</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-neutral-950/40 border border-neutral-800 p-4 rounded-xl flex flex-col justify-center">
              <span className="text-neutral-500 text-xs font-medium uppercase tracking-wider">Speed</span>
              <span className="text-amber-400 font-bold text-3xl sm:text-4xl font-mono">{wpm} <span className="text-sm font-semibold text-neutral-400">WPM</span></span>
            </div>
            <div className="bg-neutral-950/40 border border-neutral-800 p-4 rounded-xl flex flex-col justify-center">
              <span className="text-neutral-500 text-xs font-medium uppercase tracking-wider">Accuracy</span>
              <span className="text-neutral-200 font-bold text-3xl sm:text-4xl font-mono">{accuracy}%</span>
            </div>
            <div className="bg-neutral-950/40 border border-neutral-800 p-4 rounded-xl flex flex-col justify-center">
              <span className="text-neutral-500 text-xs font-medium uppercase tracking-wider">Time Spent</span>
              <span className="text-neutral-200 font-bold text-3xl sm:text-4xl font-mono">{timeElapsed}s</span>
            </div>
            <div className="bg-neutral-950/40 border border-neutral-800 p-4 rounded-xl flex flex-col justify-center">
              <span className="text-neutral-500 text-xs font-medium uppercase tracking-wider">Language / Mode</span>
              <span className="text-neutral-300 font-semibold text-sm capitalize truncate mt-1">
                {language} - {mode}
              </span>
            </div>
          </div>

          {saveStatus && (
            <div className={`p-3 rounded-lg text-sm font-medium ${
              saveStatus.includes('success') || saveStatus.includes('saved')
                ? 'bg-emerald-950/30 border border-emerald-800/50 text-emerald-400'
                : 'bg-amber-950/30 border border-amber-800/50 text-amber-400'
            }`}>
              {saveStatus}
            </div>
          )}

          <div className="flex gap-4">
            <button
              onClick={handleReset}
              className="flex items-center justify-center gap-2 bg-amber-500 text-neutral-950 hover:bg-amber-400 px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-amber-500/20 active:scale-95"
            >
              <RotateCcw size={18} />
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Footer hints */}
      <div className="flex justify-between text-neutral-500 text-xs px-2 select-none">
        <span>Press <kbd className="bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded font-mono border border-neutral-700">Esc</kbd> or click the reset icon to quickly restart.</span>
        <span>Keyboard Layout: <strong className="text-neutral-400">System IME (Avro/Bijoy supported)</strong></span>
      </div>
    </div>
  );
}
