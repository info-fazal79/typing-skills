import { useState, useEffect, useRef, useCallback } from 'react';

interface TypingStats {
  wpm: number;
  accuracy: number;
  elapsedTime: number;
  correctChars: number;
  incorrectChars: number;
}

export function useTypingEngine(targetText: string, durationLimitSeconds: number = 30) {
  const [typedText, setTypedText] = useState('');
  const [isStarted, setIsStarted] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(durationLimitSeconds);
  const [totalAttempts, setTotalAttempts] = useState(0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Reset engine
  const resetEngine = useCallback((newDuration?: number) => {
    setTypedText('');
    setIsStarted(false);
    setIsCompleted(false);
    setTimeLeft(newDuration ?? durationLimitSeconds);
    setTotalAttempts(0);
    startTimeRef.current = null;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [durationLimitSeconds]);

  // Handle typing input changes
  const handleInputChange = useCallback((value: string) => {
    if (isCompleted) return;

    // Start timer on first keystroke
    if (!isStarted && value.length > 0) {
      setIsStarted(true);
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setIsCompleted(true);
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    // Track total non-backspace attempts
    if (value.length > typedText.length) {
      setTotalAttempts((prev) => prev + (value.length - typedText.length));
    }

    // Stop if user reaches the end of the target text
    if (value.length >= targetText.length) {
      setTypedText(value.substring(0, targetText.length));
      setIsCompleted(true);
      if (timerRef.current) clearInterval(timerRef.current);
    } else {
      setTypedText(value);
    }
  }, [isStarted, isCompleted, typedText, targetText]);

  // Sync timeLeft if durationLimitSeconds changes before starting
  useEffect(() => {
    if (!isStarted && !isCompleted) {
      setTimeLeft(durationLimitSeconds);
    }
  }, [durationLimitSeconds, isStarted, isCompleted]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Compute stats
  let correctChars = 0;
  let incorrectChars = 0;

  for (let i = 0; i < typedText.length; i++) {
    if (typedText[i] === targetText[i]) {
      correctChars++;
    } else {
      incorrectChars++;
    }
  }

  const timeElapsed = startTimeRef.current
    ? (Date.now() - startTimeRef.current) / 1000
    : 0;

  const effectiveTime = timeElapsed > 0 ? timeElapsed : 0.001; // Avoid divide by zero
  
  // Speed in Words Per Minute: standard word is 5 characters (including spaces)
  const rawWpm = (correctChars / 5) / (effectiveTime / 60);
  const wpm = Math.max(0, Math.round(rawWpm));

  // Accuracy: correct characters / total keypress attempts
  const accuracy = totalAttempts > 0 
    ? Math.min(100, Math.round((correctChars / totalAttempts) * 100))
    : 100;

  return {
    typedText,
    isStarted,
    isCompleted,
    timeLeft,
    totalAttempts,
    correctChars,
    incorrectChars,
    wpm,
    accuracy,
    timeElapsed: Math.round(effectiveTime),
    handleInputChange,
    resetEngine,
  };
}
