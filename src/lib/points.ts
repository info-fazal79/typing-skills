// Practice-session point calculation.
//
// Baselines (duration=60s, accuracy=90%, benchmark WPM) map to the category's
// base points below. Performance is scaled linearly off those baselines, so a
// 30s session at benchmark pace earns half the points of a 60s one, and a
// custom 120s session earns double — this is what "time priority" scaling
// means. Accuracy above/below 90% likewise scales the award up/down, and
// harder categories (and Bangla vs English) carry a higher base.
const ENGLISH_BENCHMARK_WPM = 25;
const BANGLA_BENCHMARK_WPM = 15;
const BENCHMARK_ACCURACY = 90;
const BENCHMARK_DURATION_SECONDS = 60;

const CATEGORY_BASE_POINTS: Record<string, Record<string, number>> = {
  english: {
    standard: 30,
    punctuation: 50,
    numbers: 100,
  },
  bangla: {
    vowels: 60,
    consonants: 60,
    modifiers: 60,
    conjuncts: 100,
    mixed: 100,
  },
};

export function calculatePoints(
  language: string,
  mode: string,
  wpm: number,
  accuracy: number,
  duration: number
): number {
  const lang = language.toLowerCase() === 'bangla' ? 'bangla' : 'english';
  const categoryBase = CATEGORY_BASE_POINTS[lang][mode.toLowerCase()] ?? CATEGORY_BASE_POINTS.english.standard;
  const benchmarkWpm = lang === 'bangla' ? BANGLA_BENCHMARK_WPM : ENGLISH_BENCHMARK_WPM;

  const wpmFactor = wpm / benchmarkWpm;
  const accuracyFactor = accuracy / BENCHMARK_ACCURACY;
  const durationFactor = duration / BENCHMARK_DURATION_SECONDS;

  return Math.max(0, Math.round(categoryBase * wpmFactor * accuracyFactor * durationFactor));
}
