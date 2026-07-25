// Normalizes text before it's used for typing-test comparison.
//
// This matters most for Bangla. Some Bangla Unicode keyboards -- including
// Bijoy Unicode -- can emit certain letters as a single precomposed
// codepoint (e.g. U+09DC "RRA"), while Unicode's own canonical NFC form for
// that same letter is actually the decomposed base-consonant + nukta
// sequence (Bengali RRA/RHA/YYA are "composition exclusions": they have a
// canonical decomposition, but NFC does not recompose them). Without this,
// a target string stored in decomposed form (the correct NFC form) would
// never match a precomposed keystroke that looks and reads identically,
// and the practice text's own consonant list already stores these letters
// decomposed -- so it never matched precomposed input.
//
// It also strips zero-width joiners/non-joiners (U+200B/C/D), which some
// Bangla input methods insert around conjuncts (juktakkhor) to control
// ligature rendering. They're invisible and don't represent a keystroke a
// typing-test user can see as "correct" or "incorrect", so comparing on
// them at all only produces false mismatches on visually-identical
// conjuncts. Built from numeric char codes rather than a regex literal so
// the file never has to carry these invisible characters as raw bytes.
const ZERO_WIDTH_CHARS = [0x200b, 0x200c, 0x200d].map((code) => String.fromCharCode(code));

export function normalizeTypingText(text: string): string {
  let result = text.normalize('NFC');
  for (const ch of ZERO_WIDTH_CHARS) {
    result = result.split(ch).join('');
  }
  return result;
}
