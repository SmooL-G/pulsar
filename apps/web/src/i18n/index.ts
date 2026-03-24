import { create } from 'zustand';
import { ru } from './ru';
import { en } from './en';
import { de } from './de';
import { fr } from './fr';
import { es } from './es';
import { zh } from './zh';
import { ja } from './ja';
import { ko } from './ko';
import { tr } from './tr';
import { uk } from './uk';
import { pt } from './pt';

export type Locale = 'ru' | 'en' | 'de' | 'fr' | 'es' | 'zh' | 'ja' | 'ko' | 'tr' | 'uk' | 'pt';
type TranslationKey = keyof typeof en;

const translations: Record<Locale, Record<string, string>> = {
  ru, en, de, fr, es, zh, ja, ko, tr, uk, pt,
};

interface I18nState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
}

const getInitialLocale = (): Locale => {
  const saved = localStorage.getItem('locale') as Locale;
  if (saved && translations[saved]) return saved;
  const browserLang = navigator.language.slice(0, 2) as Locale;
  if (translations[browserLang]) return browserLang;
  return 'en';
};

export const useI18n = create<I18nState>((set, get) => ({
  locale: getInitialLocale(),

  setLocale: (locale: Locale) => {
    localStorage.setItem('locale', locale);
    set({ locale });
  },

  t: (key: TranslationKey) => {
    const { locale } = get();
    return translations[locale]?.[key] || translations['en'][key] || key;
  },
}));

export type { TranslationKey };
