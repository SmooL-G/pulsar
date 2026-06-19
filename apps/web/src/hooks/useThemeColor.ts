import { useEffect } from 'react';

/**
 * Theme-color presets. Each value is an array of 10 RGB triplets
 * ("R G B" space-separated) for shades 50..900. Tailwind references
 * these via CSS vars (see globals.css :root + tailwind.config.js).
 *
 * Pick by writing rgb space-separated values directly from any
 * Tailwind palette generator — keeps the rest of the app untouched.
 */

export type ThemeColorId = 'blue' | 'violet' | 'emerald' | 'amber' | 'rose';

interface Preset {
  id: ThemeColorId;
  label: string;
  swatch: string; // hex of the 500 shade for the picker UI
  shades: [string, string, string, string, string, string, string, string, string, string];
}

export const THEME_PRESETS: Preset[] = [
  {
    id: 'blue', label: 'Indigo', swatch: '#5c7cfa',
    shades: [
      '240 244 255', '219 228 255', '186 200 255', '145 167 255', '116 143 252',
      '92 124 250',  '76 110 245',  '66 99 235',   '59 91 219',   '54 79 199',
    ],
  },
  {
    id: 'violet', label: 'Violet', swatch: '#8b5cf6',
    shades: [
      '245 243 255', '237 233 254', '221 214 254', '196 181 253', '167 139 250',
      '139 92 246',  '124 58 237',  '109 40 217',  '91 33 182',   '76 29 149',
    ],
  },
  {
    id: 'emerald', label: 'Emerald', swatch: '#10b981',
    shades: [
      '236 253 245', '209 250 229', '167 243 208', '110 231 183', '52 211 153',
      '16 185 129',  '5 150 105',   '4 120 87',    '6 95 70',     '6 78 59',
    ],
  },
  {
    id: 'amber', label: 'Amber', swatch: '#f59e0b',
    shades: [
      '255 251 235', '254 243 199', '253 230 138', '252 211 77',  '251 191 36',
      '245 158 11',  '217 119 6',   '180 83 9',    '146 64 14',   '120 53 15',
    ],
  },
  {
    id: 'rose', label: 'Rose', swatch: '#f43f5e',
    shades: [
      '255 241 242', '255 228 230', '254 205 211', '253 164 175', '251 113 133',
      '244 63 94',   '225 29 72',   '190 18 60',   '159 18 57',   '136 19 55',
    ],
  },
];

const STORAGE_KEY = 'pulsar:themeColor';

export function applyThemeColor(id: ThemeColorId) {
  const preset = THEME_PRESETS.find((p) => p.id === id) || THEME_PRESETS[0];
  const root = document.documentElement;
  const tiers = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900'];
  preset.shades.forEach((rgb, i) => {
    root.style.setProperty(`--c-primary-${tiers[i]}`, rgb);
  });
  try { localStorage.setItem(STORAGE_KEY, id); } catch { /* private mode */ }
}

export function getStoredThemeColor(): ThemeColorId {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && THEME_PRESETS.some((p) => p.id === v)) return v as ThemeColorId;
  } catch { /* ignore */ }
  return 'blue';
}

/** Mount once near the app root — applies stored theme color on boot. */
export function useThemeColorBoot() {
  useEffect(() => {
    applyThemeColor(getStoredThemeColor());
  }, []);
}
