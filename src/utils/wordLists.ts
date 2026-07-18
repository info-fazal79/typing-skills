export const englishWords = [
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you',
  'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one',
  'all', 'would', 'there', 'their', 'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me', 'when',
  'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take', 'people', 'into', 'year', 'your', 'good', 'some',
  'could', 'them', 'see', 'other', 'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also', 'back',
  'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want', 'because', 'any', 'these',
  'give', 'day', 'most', 'us'
];

export const englishNumbers = [
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '100', '2026', '50', '25', '12', '99', '500', '1000'
];

export const englishPunctuationSymbols = ['.', ',', '?', '!', ';', ':', '-', '"', "'"];

// Bangla word lists
export const banglaVowels = [
  'ওই', 'আই', 'আউ', 'উই', 'ও', 'ঐ', 'ঔ', 'আও', 'ইউ', 'অ্যাঁ', 'উয়া', 'আইউ', 'ওআ', 'আআ', 'ইই'
];

export const banglaConsonants = [
  'কর', 'বল', 'চল', 'কলম', 'ভর', 'পথ', 'বন', 'দশ', 'নখ', 'ফল', 'জল', 'মদ', 'ঘর', 'খল', 'চড়',
  'ধড়', 'নল', 'বই', 'মই', 'ভয়', 'জয়', 'লয়', 'খড়', 'দল', 'জগ', 'কম', 'গম', 'ঢক', 'বকবক', 'কলকল'
];

export const banglaModifiers = [
  'বাবা', 'মা', 'তুমি', 'আমি', 'গান', 'পাখি', 'নদী', 'ফুল', 'সূর্য', 'মেয়ে', 'ছেলে', 'লেখা',
  'পড়া', 'খেলনা', 'বাগান', 'আকাশ', 'বাতাস', 'মাটি', 'পানি', 'ছবি', 'খাতা', 'ছুটি', 'বিড়াল', 'কুকুর',
  'ভাত', 'ডাল', 'মাছ', 'সকাল', 'দুপুর', 'বিকাল', 'রাত', 'তারা', 'চাঁদ', 'আলো', 'ছায়া', 'গাছ'
];

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
        // 50% chance of a number, 50% chance of standard word
        if (Math.random() > 0.5) {
          const randNum = englishNumbers[Math.floor(Math.random() * englishNumbers.length)];
          words.push(randNum);
        } else {
          const randWord = englishWords[Math.floor(Math.random() * englishWords.length)];
          words.push(randWord);
        }
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
