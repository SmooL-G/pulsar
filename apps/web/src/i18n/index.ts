import { create } from 'zustand';
import { ru } from './ru';
import { en } from './en';

type Locale = 'ru' | 'en';
type TranslationKey = keyof typeof ru;

const translations: Record<Locale, Record<string, string>> = { ru, en };

interface I18nState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
}

const getInitialLocale = (): Locale => {
  const saved = localStorage.getItem('locale') as Locale;
  if (saved && translations[saved]) return saved;
  const browserLang = navigator.language.slice(0, 2);
  return browserLang === 'ru' ? 'ru' : 'en';
};

export const useI18n = create<I18nState>((set, get) => ({
  locale: getInitialLocale(),

  setLocale: (locale: Locale) => {
    localStorage.setItem('locale', locale);
    set({ locale });
  },

  t: (key: TranslationKey) => {
    const { locale } = get();
    return translations[locale][key] || translations['en'][key] || key;
  },
}));

export type { Locale, TranslationKey };
