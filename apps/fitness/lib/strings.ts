export type Locale = 'en' | 'hi' | 'gu';
export const STR = {
  goal: {
    lose: { en: 'Lose', hi: 'घटाएँ', gu: 'ઘટાડો' },
    gain: { en: 'Gain', hi: 'बढ़ाएँ', gu: 'વધારો' },
    maintain: { en: 'Maintain', hi: 'बनाए रखें', gu: 'જાળવો' },
    muscle: { en: 'Muscle', hi: 'मसल्स', gu: 'સ્નાયુ' },
    growth: { en: 'Growth (teen)', hi: 'बढ़त (किशोर)', gu: 'વૃદ્ધિ (કિશોર)' },
  },
  cond: {
    diabetes: { en: 'DIABETES', hi: 'डायबिटीज़', gu: 'ડાયાબિટીસ' },
    bp: { en: 'BP', hi: 'बीपी', gu: 'બીપી' },
    thyroid: { en: 'THYROID', hi: 'थायरॉइड', gu: 'થાઇરોઇડ' },
    pcos: { en: 'PCOS', hi: 'PCOS', gu: 'PCOS' },
  },
  today: {
    weight: { en: 'Weight', hi: 'वजन', gu: 'વજન' },
    water: { en: 'Water', hi: 'पानी', gu: 'પાણી' },
    food: { en: 'Food', hi: 'खाना', gu: 'ખાણું' },
    waterWalk: { en: 'Water + Walk', hi: 'पानी + पैदल', gu: 'પાણી + ચાલવું' },
    workout: { en: 'Workout', hi: 'व्यायाम', gu: 'વ્યાયામ' },
    save: { en: 'Save Today', hi: 'आज सेव करें', gu: 'આજે સેવ કરો' },
    saved: { en: 'Shabash! Saved ✓', hi: 'शाबाश! सेव ✓', gu: 'શાબાશ! સેવ ✓' },
    progress: { en: 'View progress →', hi: 'प्रगति देखें →', gu: 'પ્રગતિ જુઓ →' },
  },
  quiz: {
    goalTitle: { en: 'Goal (लक्ष्य)', hi: 'लक्ष्य चुनें', gu: 'લક્ષ્ય પસંદ કરો' },
    next: { en: 'Next', hi: 'आगे', gu: 'આગળ' },
    back: { en: 'Back', hi: 'पीछे', gu: 'પાછળ' },
    start: { en: 'Start Today →', hi: 'आज शुरू करें →', gu: 'આજે શરૂ કરો →' },
  },
} as const;
export function t(locale: string, section: keyof typeof STR, key: string): string {
  const l = (locale === 'hi' || locale === 'gu' ? locale : 'en') as Locale;
  const s = (STR[section] as Record<string, Record<Locale, string>>)[key];
  return s ? s[l] : key;
}
