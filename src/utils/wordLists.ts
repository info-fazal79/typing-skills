export const englishWords = [
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you',
  'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one',
  'all', 'would', 'there', 'their', 'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me', 'when',
  'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take', 'people', 'into', 'year', 'your', 'good', 'some',
  'could', 'them', 'see', 'other', 'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also', 'back',
  'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want', 'because', 'any', 'these',
  'give', 'day', 'most', 'us'
];

export const englishPunctuationSymbols = ['.', ',', '?', '!', ';', ':', '-', '"', "'"];

// Generates a single alphanumeric token like "b109", "he3a", "D3" — the
// Numbers category is priced well above Standard specifically because it's
// meant to mix letters and digits within one token (per the point-system
// spec), not alternate between whole plain words and whole plain numbers.
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';

function randomAlphaNumericToken(): string {
  const letterCount = 1 + Math.floor(Math.random() * 3); // 1-3 letters
  const digitCount = 1 + Math.floor(Math.random() * 3); // 1-3 digits

  let letterPart = '';
  for (let i = 0; i < letterCount; i++) {
    letterPart += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  if (Math.random() > 0.7) {
    letterPart = letterPart.charAt(0).toUpperCase() + letterPart.slice(1);
  }

  let digitPart = '';
  for (let i = 0; i < digitCount; i++) {
    digitPart += Math.floor(Math.random() * 10);
  }

  return Math.random() > 0.5 ? `${letterPart}${digitPart}` : `${digitPart}${letterPart}`;
}

// ── Bangla script content ───────────────────────────────────────────────────
// Vowels/Consonants/Modifiers are meant to isolate one linguistic unit at a
// time (per the point-system spec: "Individual vowel characters", "Individual
// consonant characters", "Bengali vowel signs/modifiers") — not whole common
// words, which is what these three previously contained.

// The 11 standard Bangla vowel letters (স্বরবর্ণ).
export const banglaVowels = ['অ', 'আ', 'ই', 'ঈ', 'উ', 'ঊ', 'ঋ', 'এ', 'ঐ', 'ও', 'ঔ'];

// The standard Bangla consonant letters (ব্যঞ্জনবর্ণ), including the nukta forms.
export const banglaConsonants = [
  'ক', 'খ', 'গ', 'ঘ', 'ঙ', 'চ', 'ছ', 'জ', 'ঝ', 'ঞ',
  'ট', 'ঠ', 'ড', 'ঢ', 'ণ', 'ত', 'থ', 'দ', 'ধ', 'ন',
  'প', 'ফ', 'ব', 'ভ', 'ম', 'য', 'র', 'ল', 'শ', 'ষ',
  'স', 'হ', 'ড়', 'ঢ়', 'য়',
];

// Vowel signs (কার-চিহ্ন) only exist attached to a base consonant — a bare kar
// sign can't be typed on its own — so this generates every base-consonant +
// kar-sign combination (e.g. ক + া = কা) rather than hardcoding a small,
// error-prone list by hand.
const KAR_SIGNS = ['া', 'ি', 'ী', 'ু', 'ূ', 'ৃ', 'ে', 'ৈ', 'ো', 'ৌ'];
const MODIFIER_BASE_CONSONANTS = [
  'ক', 'খ', 'গ', 'চ', 'জ', 'ট', 'ণ', 'ত', 'দ', 'ন',
  'প', 'ব', 'ম', 'য', 'র', 'ল', 'শ', 'স', 'হ',
];
export const banglaModifiers = MODIFIER_BASE_CONSONANTS.flatMap((consonant) =>
  KAR_SIGNS.map((kar) => consonant + kar)
);

export const banglaConjuncts = [
  'শিক্ষা', 'জ্ঞান', 'বিজ্ঞান', 'ইচ্ছা', 'কষ্ট', 'স্পষ্ট', 'উত্তপ্ত', 'বন্ধু', 'অন্ধকার', 'কল্পনা',
  'সম্পর্ক', 'অনুষ্ঠান', 'বৃষ্টি', 'পরীক্ষা', 'উজ্জ্বল', 'যুক্ত', 'অক্ষর', 'পদ্ধতি', 'উত্তরণ', 'প্রকৃতি',
  'প্রশ্ন', 'উত্তর', 'ক্লাস', 'স্কুল', 'চেষ্টা', 'বিশ্বাস', 'দক্ষতা', 'তীক্ষ্ণ', 'সন্তুষ্ট', 'গ্রাহক',
  'গ্রন্থ', 'বিদ্ধ', 'রক্ত', 'ভক্ত', 'শক্তি', 'মুক্তি', 'শান্তি', 'কান্ত', 'প্রান্ত', 'শ্রদ্ধা'
];

export const banglaMixed = [
  'আমাদের', 'সোনার', 'বাংলা', 'আমি', 'তোমায়', 'ভালোবাসি', 'চিরদিন', 'তোমার', 'আকাশ', 'বাতাস',
  'প্রাণে', 'বাজায়', 'বাঁশি', 'সোনার', 'দেশ', 'ঢাকা', 'ভাষা', 'সবুজ', 'সুন্দর', 'মানুষ', 'পৃথিবী',
  'শিক্ষা', 'কাজ', 'জীবন', 'সুখ', 'শান্তি', 'ধন্যবাদ', 'স্বাগতম', 'বিদ্যালয়', 'শিক্ষক', 'ছাত্র',
  'অধ্যয়ন', 'সময়', 'নিয়ম', 'মূল্য', 'সফলতা', 'চেষ্টা', 'কঠোর', 'পরিশ্রম', 'ভবিষ্যৎ', 'স্বপ্ন',
  'বাস্তব', 'সমাজ', 'দেশপ্রেম', 'সংস্কৃতি', 'ইতিহাস', 'ঐতিহ্য', 'উন্নয়ন', 'প্রগতি', 'জ্ঞানবান'
];

export function generatePracticeText(language: string, mode: string, wordCount: number = 25): string {
  const words: string[] = [];

  if (language.toUpperCase() === 'ENGLISH') {
    if (mode === 'numbers') {
      for (let i = 0; i < wordCount; i++) {
        words.push(randomAlphaNumericToken());
      }
    } else if (mode === 'punctuation') {
      for (let i = 0; i < wordCount; i++) {
        let word = englishWords[Math.floor(Math.random() * englishWords.length)];

        // 15% chance to capitalize word
        if (Math.random() > 0.85) {
          word = word.charAt(0).toUpperCase() + word.slice(1);
        }

        // 20% chance to append punctuation
        if (Math.random() > 0.80) {
          const symbol = englishPunctuationSymbols[Math.floor(Math.random() * englishPunctuationSymbols.length)];
          if (symbol === '"' || symbol === "'") {
            word = `${symbol}${word}${symbol}`;
          } else {
            word = `${word}${symbol}`;
          }
        }
        words.push(word);
      }
    } else {
      // standard mode
      for (let i = 0; i < wordCount; i++) {
        const randWord = englishWords[Math.floor(Math.random() * englishWords.length)];
        words.push(randWord);
      }
    }
  } else {
    // BANGLA
    let pool = banglaMixed;
    if (mode === 'vowels') {
      pool = banglaVowels;
    } else if (mode === 'consonants') {
      pool = banglaConsonants;
    } else if (mode === 'modifiers') {
      pool = banglaModifiers;
    } else if (mode === 'conjuncts') {
      pool = banglaConjuncts;
    }

    for (let i = 0; i < wordCount; i++) {
      const randWord = pool[Math.floor(Math.random() * pool.length)];
      words.push(randWord);
    }
  }

  return words.join(' ');
}
