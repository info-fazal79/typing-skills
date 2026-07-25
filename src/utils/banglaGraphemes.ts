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

export function segmentBanglaClusters(text: string): string[] {
  return text.match(AKSHARA_RE) ?? [];
}
