/**
 * Human-friendly day label for the chat day-divider.
 *
 *   Today       — same calendar day
 *   Yesterday   — previous calendar day
 *   Day before yesterday — two days back
 *   Monday/.../Sunday — same ISO week (3-6 days back)
 *   "5 March"   — same calendar year
 *   "5 March 2025" — older
 *
 * `locale` only affects which dictionary we read from; the date math
 * is the same everywhere.
 */
import type { Locale } from '../i18n';

const LABELS: Record<Locale, {
  today: string;
  yesterday: string;
  dayBefore: string;
  weekdays: string[];   // Sunday..Saturday
  months: string[];     // January..December
  // formatter: (day, monthName) => "5 March"
  shortDate: (day: number, monthIdx: number, months: string[]) => string;
  fullDate: (day: number, monthIdx: number, year: number, months: string[]) => string;
}> = {
  ru: {
    today: 'Сегодня',
    yesterday: 'Вчера',
    dayBefore: 'Позавчера',
    weekdays: ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'],
    months: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
    shortDate: (d, m, months) => `${d} ${months[m]}`,
    fullDate: (d, m, y, months) => `${d} ${months[m]} ${y}`,
  },
  en: {
    today: 'Today',
    yesterday: 'Yesterday',
    dayBefore: 'Day before yesterday',
    weekdays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    shortDate: (d, m, months) => `${months[m]} ${d}`,
    fullDate: (d, m, y, months) => `${months[m]} ${d}, ${y}`,
  },
  // Other locales fall back to en at call sites; keep the dictionary
  // English to avoid shipping unmaintained translations that look
  // worse than English.
  de: null as any, fr: null as any, es: null as any, zh: null as any,
  ja: null as any, ko: null as any, tr: null as any, uk: null as any, pt: null as any,
};

function startOfDay(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

/** Same calendar day in local time. */
export function isSameDay(a: Date, b: Date): boolean {
  return startOfDay(a) === startOfDay(b);
}

export function dayLabel(date: Date, locale: Locale): string {
  const dict = LABELS[locale] ?? LABELS.en;
  const now = new Date();
  const today = startOfDay(now);
  const that = startOfDay(date);
  const dayDiff = Math.round((today - that) / 86_400_000);

  if (dayDiff === 0) return dict.today;
  if (dayDiff === 1) return dict.yesterday;
  if (dayDiff === 2) return dict.dayBefore;
  if (dayDiff > 2 && dayDiff < 7) return dict.weekdays[date.getDay()];

  const sameYear = date.getFullYear() === now.getFullYear();
  return sameYear
    ? dict.shortDate(date.getDate(), date.getMonth(), dict.months)
    : dict.fullDate(date.getDate(), date.getMonth(), date.getFullYear(), dict.months);
}
