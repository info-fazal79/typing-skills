'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTypingEngine } from '@/hooks/useTypingEngine';
import { generatePracticeText } from '@/utils/wordLists';
import { RotateCcw, Volume2, VolumeX, Sparkles, Trophy } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Pre-loaded audio buffers for zero-latency playback
// ─────────────────────────────────────────────────────────────────────────────
let _audioCtx: AudioContext | null = null;
let _correctBuffer: AudioBuffer | null = null;
let _incorrectBuffer: AudioBuffer | null = null;

function getAudioCtx(): AudioContext | null {
  try {
    if (!_audioCtx || _audioCtx.state === 'closed') {
      _audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      _correctBuffer = null;
      _incorrectBuffer = null;
    }
    if (_audioCtx.state === 'suspended') _audioCtx.resume();
    return _audioCtx;
  } catch {
    return null;
  }
}

/** Build a tiny PCM buffer in memory — no file loading needed. */
function buildBuffer(
  ctx: AudioContext,
  freq: number,
  durationSec: number,
  waveShape: 'sine' | 'square' | 'sawtooth',
  volume: number
): AudioBuffer {
  const len = Math.ceil(ctx.sampleRate * durationSec);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / ctx.sampleRate;
    const env = Math.pow(1 - t / durationSec, 2); // quadratic decay
    let sample = 0;
    if (waveShape === 'sine')     sample = Math.sin(2 * Math.PI * freq * t);
    else if (waveShape === 'square')   sample = Math.sign(Math.sin(2 * Math.PI * freq * t));
    else if (waveShape === 'sawtooth') sample = 2 * (t * freq - Math.floor(t * freq + 0.5));
    data[i] = sample * env * volume;
  }
  return buf;
}

function ensureBuffers() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  if (!_correctBuffer)   _correctBuffer   = buildBuffer(ctx, 900,  0.05, 'square',   0.06);
  if (!_incorrectBuffer) _incorrectBuffer = buildBuffer(ctx, 220,  0.08, 'sawtooth', 0.08);
}

function playClick(isCorrect: boolean) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  ensureBuffers();
  const buf = isCorrect ? _correctBuffer : _incorrectBuffer;
  if (!buf) return;
  try {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(ctx.currentTime); // zero scheduling overhead
  } catch { /* ignore */ }
}

// ─────────────────────────────────────────────────────────────────────────────

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

  // ── Refs ─────────────────────────────────────────────────────────────────
  const inputRef    = useRef<HTMLTextAreaElement>(null);
  const innerRef    = useRef<HTMLDivElement>(null);       // sliding text wrapper
  const charsRef    = useRef<(HTMLSpanElement | null)[]>([]);
  const soundRef    = useRef(soundEnabled);
  useEffect(() => { soundRef.current = soundEnabled; }, [soundEnabled]);

  // ── Caret state (absolute inside innerRef) ────────────────────────────────
  const [caretX, setCaretX]     = useState(0);
  const [caretY, setCaretY]     = useState(0);
  const [caretH, setCaretH]     = useState(32);
  const [caretVis, setCaretVis] = useState(false);

  // ── Scroll-translation state (px to slide innerRef upward) ───────────────
  const [translateY, setTranslateY]     = useState(0);
  const [animateScroll, setAnimateScroll] = useState(false);

  // ── Generate text ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (initialText) {
      setText(initialText);
    } else {
      setText(generatePracticeText(language, mode, 80));
    }
  }, [language, mode, initialText]);

  const {
    typedText, isStarted, isCompleted,
    timeLeft, wpm, accuracy, timeElapsed,
    handleInputChange, resetEngine,
  } = useTypingEngine(text, duration);

  // ── Infinite word appending ───────────────────────────────────────────────
  useEffect(() => {
    if (!initialText && isStarted && !isCompleted) {
      if (text.length - typedText.length < 100) {
        const extra = generatePracticeText(language, mode, 50);
        setText((prev) => prev + ' ' + extra);
      }
    }
  }, [typedText, text, isStarted, isCompleted, language, mode, initialText]);

  // ── Caret + line-scroll tracking ──────────────────────────────────────────
  useEffect(() => {
    const activeIndex = typedText.length;
    const span = charsRef.current[activeIndex];
    if (!span || !innerRef.current) return;

    // Coords relative to the sliding inner div
    const x = span.offsetLeft;
    const y = span.offsetTop;
    const h = span.offsetHeight || 32;

    setCaretX(x);
    setCaretY(y);
    setCaretH(h);
    setCaretVis(isFocused && !isCompleted);

    // Slide up so the active row is always in the 2nd visible row (Typing Master style).
    // translateY = max(0, rowTop - 1 lineHeight)
    const newTY = Math.max(0, y - h);
    if (newTY !== translateY) {
      setAnimateScroll(true);
      setTranslateY(newTY);
    }
  }, [typedText, text, isFocused, isCompleted]);

  // ── Focus ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (inputRef.current && isFocused) inputRef.current.focus();
  }, [isFocused, text]);

  // ── Reset — instant scroll snap, then re-enable animation ─────────────────
  const handleReset = useCallback(() => {
    // Snap scroll instantly (no animation) before new text renders
    setAnimateScroll(false);
    setTranslateY(0);
    setCaretVis(false);

    resetEngine(duration);
    if (!initialText) {
      setText(generatePracticeText(language, mode, 80));
    }
    setSaveStatus('');

    setTimeout(() => {
      charsRef.current = [];
      inputRef.current?.focus();
    }, 30);
  }, [duration, language, mode, initialText, resetEngine]);

  // ── Esc ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); handleReset(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleReset]);

  // ── Sound ─────────────────────────────────────────────────────────────────
  const lastLenRef = useRef(0);
  useEffect(() => {
    if (typedText.length > lastLenRef.current && soundRef.current) {
      const i = typedText.length - 1;
      playClick(typedText[i] === text[i]);
    }
    lastLenRef.current = typedText.length;
  }, [typedText, text]);

  // ── Session complete ───────────────────────────────────────────────────────
  const completedRef = useRef(false);
  useEffect(() => {
    if (isCompleted && !completedRef.current) {
      completedRef.current = true;
      onSessionComplete?.({ wpm, accuracy, duration: timeElapsed, language, mode });
    }
    if (!isCompleted) completedRef.current = false;
  }, [isCompleted, wpm, accuracy, timeElapsed, language, mode, onSessionComplete]);

  // ── Render chars ──────────────────────────────────────────────────────────
  const renderCharacters = () =>
    text.split('').map((char, i) => {
      let cls = 'text-neutral-500';
      if (i < typedText.length) {
        cls = typedText[i] === char
          ? 'text-neutral-200'
          : 'text-red-400 bg-red-950/40 rounded-sm';
      }
      return (
        <span
          key={i}
          ref={(el) => { charsRef.current[i] = el; }}
          className={`font-mono text-xl sm:text-2xl leading-[2.2rem] ${cls}`}
        >
          {char}
        </span>
      );
    });

  // Outer container height = exactly 3 lines × line-height (2.2rem each = 6.6rem)
  const THREE_LINES = '6.6rem';

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-6 select-none">
      <style>{`
        @keyframes caretBlink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
      `}</style>

      {/* ── Config bar ── */}
      {!isTask && !isStarted && !isCompleted && (
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 text-sm">
          {/* Language */}
          <div className="flex gap-2 bg-neutral-950 p-1 rounded-lg">
            {[
              { id: 'english', label: 'English',        defaultMode: 'standard' },
              { id: 'bangla',  label: 'বাংলা (Bangla)', defaultMode: 'mixed'    },
            ].map(({ id, label, defaultMode }) => (
              <button
                key={id}
                onClick={() => { setLanguage(id); setMode(defaultMode); }}
                className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
                  language === id
                    ? 'bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/25'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Mode */}
          <div className="flex flex-wrap gap-1 bg-neutral-950 p-1 rounded-lg">
            {(language === 'english'
              ? [{ id: 'standard', label: 'Standard' }, { id: 'punctuation', label: 'Punctuation' }, { id: 'numbers', label: 'Numbers' }]
              : [
                  { id: 'mixed',      label: 'Mixed' },
                  { id: 'vowels',     label: 'Vowels (স্বরবর্ণ)' },
                  { id: 'consonants', label: 'Consonants (ব্যঞ্জনবর্ণ)' },
                  { id: 'modifiers',  label: 'Modifiers (কার-চিহ্ন)' },
                  { id: 'conjuncts',  label: 'Conjuncts (যুক্তবর্ণ)' },
                ]
            ).map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setMode(id)}
                className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                  mode === id
                    ? 'bg-neutral-800 text-amber-400'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Duration */}
          <div className="flex gap-1 bg-neutral-950 p-1 rounded-lg items-center">
            {[15, 30, 60].map((t) => (
              <button
                key={t}
                onClick={() => { setDuration(t); setIsCustomDuration(false); resetEngine(t); }}
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
                  type="number" min="1" max="3600" autoFocus
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
                  if (![15, 30, 60].includes(duration)) setCustomDurationInput(duration.toString());
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

      {/* ── Typing area ── */}
      {!isCompleted ? (
        <div
          onClick={() => inputRef.current?.focus()}
          className={`relative px-8 pt-14 pb-6 rounded-2xl border transition-all duration-300 bg-neutral-900/40 cursor-text ${
            isFocused
              ? 'border-neutral-800 ring-1 ring-amber-500/20'
              : 'border-neutral-800 hover:border-neutral-700 opacity-60'
          }`}
        >
          {/* Live stats bar */}
          <div className="absolute top-4 left-6 right-6 flex items-center justify-between text-neutral-400 text-xs tracking-wider uppercase font-semibold">
            <div className="flex items-center gap-4">
              <span>Time: <strong className="text-amber-400 font-mono text-base">{timeLeft}s</strong></span>
              <span>WPM: <strong className="text-neutral-200 font-mono text-base">{wpm}</strong></span>
              <span>Accuracy: <strong className="text-neutral-200 font-mono text-base">{accuracy}%</strong></span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (!soundEnabled) { getAudioCtx(); ensureBuffers(); }
                  setSoundEnabled((s) => !s);
                }}
                className={`p-1 rounded transition-colors ${soundEnabled ? 'text-amber-400' : 'text-neutral-400 hover:text-amber-400'}`}
                title={soundEnabled ? 'Mute key sounds' : 'Enable key sounds'}
              >
                {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleReset(); }}
                className="hover:text-amber-400 p-1 rounded transition-colors"
                title="Restart (Esc)"
              >
                <RotateCcw size={16} />
              </button>
            </div>
          </div>

          {/* ── Fixed 3-line viewport — overflow hidden ── */}
          <div
            style={{ height: THREE_LINES, overflow: 'hidden', position: 'relative' }}
          >
            {/* Sliding text container */}
            <div
              ref={innerRef}
              style={{
                transform: `translateY(-${translateY}px)`,
                transition: animateScroll ? 'transform 0.22s cubic-bezier(0.4,0,0.2,1)' : 'none',
                position: 'relative',
                willChange: 'transform',
              }}
              className="tracking-wide break-words whitespace-pre-wrap"
            >
              {/* ── Ultra-smooth caret — CSS transitions on left/top ── */}
              <div
                style={{
                  position: 'absolute',
                  left: `${caretX}px`,
                  top: `${caretY}px`,
                  width: '2.5px',
                  height: `${caretH}px`,
                  background: '#f59e0b',
                  borderRadius: '2px',
                  // GPU-composited smooth glide between characters
                  transition: 'left 0.07s ease-out, top 0.07s ease-out, opacity 0.1s',
                  opacity: caretVis ? 1 : 0,
                  animation: caretVis ? 'caretBlink 1.1s step-end infinite' : 'none',
                  zIndex: 10,
                  pointerEvents: 'none',
                }}
              />
              {renderCharacters()}
            </div>
          </div>

          {/* Focus overlay */}
          {!isFocused && (
            <div className="absolute inset-0 bg-neutral-950/85 rounded-2xl flex flex-col items-center justify-center gap-2 backdrop-blur-sm transition-all animate-pulse">
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
        /* ── Results ── */
        <div className="p-8 rounded-2xl border border-neutral-800 bg-neutral-900/60 flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-3 border-b border-neutral-800 pb-4">
            <Trophy className="text-amber-400" size={28} />
            <h2 className="text-xl font-bold text-neutral-100">Practice Completed!</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Speed',         value: <>{wpm} <span className="text-sm font-semibold text-neutral-400">WPM</span></>,  cls: 'text-amber-400' },
              { label: 'Accuracy',      value: `${accuracy}%`,  cls: 'text-neutral-200' },
              { label: 'Time Spent',    value: `${timeElapsed}s`, cls: 'text-neutral-200' },
              { label: 'Language/Mode', value: `${language} – ${mode}`, cls: 'text-neutral-300 text-sm font-semibold capitalize' },
            ].map(({ label, value, cls }) => (
              <div key={label} className="bg-neutral-950/40 border border-neutral-800 p-4 rounded-xl flex flex-col justify-center">
                <span className="text-neutral-500 text-xs font-medium uppercase tracking-wider">{label}</span>
                <span className={`font-bold text-3xl sm:text-4xl font-mono mt-1 ${cls}`}>{value}</span>
              </div>
            ))}
          </div>

          {saveStatus && (
            <div className={`p-3 rounded-lg text-sm font-medium ${
              saveStatus.includes('saved') || saveStatus.includes('success')
                ? 'bg-emerald-950/30 border border-emerald-800/50 text-emerald-400'
                : 'bg-amber-950/30 border border-amber-800/50 text-amber-400'
            }`}>
              {saveStatus}
            </div>
          )}

          <button
            onClick={handleReset}
            className="flex items-center gap-2 w-max bg-amber-500 text-neutral-950 hover:bg-amber-400 px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-amber-500/20 active:scale-95"
          >
            <RotateCcw size={18} />
            Try Again
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="flex justify-between text-neutral-500 text-xs px-2 select-none">
        <span>Press <kbd className="bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded font-mono border border-neutral-700">Esc</kbd> or the reset icon to restart.</span>
        <span>Keyboard Layout: <strong className="text-neutral-400">System IME (Avro/Bijoy supported)</strong></span>
      </div>
    </div>
  );
}
