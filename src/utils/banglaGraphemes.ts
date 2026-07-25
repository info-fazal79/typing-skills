// Groups Bangla text into orthographic syllables (aksharas) instead of raw
// UTF-16 code units, so a conjunct like "ক্ষ" (consonant + hasant + consonant)
// stays one indivisible unit.
//
// This matters for rendering: the typing UI wraps each unit in its own
// <span> to color it correct/incorrect. Splitting a hasant-joined conjunct
// across span boundaries breaks the browser's complex-script shaping (the
// OpenType substitution that draws a joint borno as one glyph), so the
// conjunct renders as visibly broken/separated pieces even when the
// underlying text is correct — regardless of whether the user has typed it
// right. Grouping by akshara keeps every hasant + consonant chain inside one
// contiguous DOM text node so the browser can shape it normally.
const CONSONANT = '\\u0995-\\u09B9';
const NUKTA = '\\u09BC';
const VIRAMA = '\\u09CD';
const VOWEL_SIGN = '\\u09BE-\\u09C4\\u09C7\\u09C8\\u09CB\\u09CC';
const VOWEL_INDEP = '\\u0985-\\u0994';
const TONE_MARK = '\\u0981-\\u0983';

const CONSONANT_UNIT = `[${CONSONANT}]${NUKTA}?`;

const AKSHARA_RE = new RegExp(
  `${CONSONANT_UNIT}(?:${VIRAMA}${CONSONANT_UNIT})*${VIRAMA}?[${VOWEL_SIGN}]?[${TONE_MARK}]?` +
  `|[${VOWEL_INDEP}][${TONE_MARK}]?` +
  `|[\\s\\S]`,
  'gu'
);

// For non-Bangla text every character falls through to the plain `.`
// alternative above, producing exactly one cluster per code unit — so this
// is safe to run on any text (English included), not just Bangla.
export function segmentBanglaClusters(text: string): string[] {
  return text.match(AKSHARA_RE) ?? [];
}

// Whether the portion of a cluster typed so far matches — used both to
// color a cluster's span and to score it, so the two always agree. A typed
// slice shorter than the cluster (still mid-conjunct) only has to match the
// cluster's own prefix so far.
export function isClusterMatch(typedSlice: string, cluster: string): boolean {
  return typedSlice === cluster.slice(0, typedSlice.length);
}

export interface ClusterComparison {
  correctChars: number;
  incorrectChars: number;
}

// Scores typed input against target text cluster-by-cluster (one
// orthographic syllable in Bangla, one code unit for everything else) so a
// single wrong keystroke inside a conjunct counts the whole conjunct as
// incorrect instead of only the one code unit that differs — matching how a
// user perceives "did I type this letter right," and keeping accuracy/WPM
// numbers consistent with the same red/green coloring shown per conjunct.
export function compareClusters(typedText: string, targetText: string): ClusterComparison {
  const clusters = segmentBanglaClusters(targetText);
  let correctChars = 0;
  let incorrectChars = 0;
  let offset = 0;

  for (const cluster of clusters) {
    const start = offset;
    const end = offset + cluster.length;
    offset = end;
    if (start >= typedText.length) break;

    const typedSlice = typedText.slice(start, Math.min(end, typedText.length));
    if (isClusterMatch(typedSlice, cluster)) {
      correctChars += typedSlice.length;
    } else {
      incorrectChars += typedSlice.length;
    }
  }

  return { correctChars, incorrectChars };
}
