import { useEffect } from 'react';

/**
 * Global keyboard-shortcut registry.
 *
 * Register a shortcut once at the top of a component lifecycle:
 *
 *   useShortcut('ctrl+k', () => openSearch());
 *   useShortcut('escape', () => closeModal(), { enabled: isOpen });
 *
 * Modifier order is flexible — "ctrl+shift+k", "shift+ctrl+k" both work.
 * On macOS, "ctrl" is mapped to ⌘ Cmd (so Ctrl+K is intuitive across
 * platforms). Use "meta" explicitly if you need the literal Cmd/Win.
 *
 * Disabled while focus is inside an editable element (input, textarea,
 * contentEditable) so single-letter shortcuts don't fire while typing.
 */

interface ShortcutOptions {
  /** If false, the shortcut is registered but inert. Useful to gate
   *  by panel state without conditional `useEffect`. */
  enabled?: boolean;
  /** Override the editable-element guard. Default false. */
  allowInInput?: boolean;
  /** Prevent the browser default (e.g. Ctrl+K → no quick-find). */
  preventDefault?: boolean;
}

function normalizeCombo(spec: string): string {
  return spec
    .toLowerCase()
    .split('+')
    .map((p) => p.trim())
    .sort((a, b) => {
      // modifiers first, in stable order
      const order = ['ctrl', 'meta', 'alt', 'shift'];
      const ai = order.indexOf(a);
      const bi = order.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    })
    .join('+');
}

function comboFromEvent(e: KeyboardEvent): string {
  const parts: string[] = [];
  // Treat ⌘ Cmd as ctrl on macOS so the same shortcut spec works.
  const isMac = navigator.platform.toLowerCase().includes('mac');
  if (e.ctrlKey || (isMac && e.metaKey)) parts.push('ctrl');
  if (!isMac && e.metaKey) parts.push('meta');
  if (e.altKey) parts.push('alt');
  if (e.shiftKey) parts.push('shift');
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase();
  // Skip if the "key" is just a modifier press
  if (!['control', 'meta', 'alt', 'shift'].includes(key)) parts.push(key);
  return normalizeCombo(parts.join('+'));
}

function isEditable(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  return false;
}

export function useShortcut(
  spec: string,
  handler: (e: KeyboardEvent) => void,
  opts: ShortcutOptions = {},
) {
  const { enabled = true, allowInInput = false, preventDefault = true } = opts;
  useEffect(() => {
    if (!enabled) return;
    const target = normalizeCombo(spec);
    const onKey = (e: KeyboardEvent) => {
      if (!allowInInput && isEditable(e.target)) return;
      if (comboFromEvent(e) !== target) return;
      if (preventDefault) e.preventDefault();
      handler(e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [spec, handler, enabled, allowInInput, preventDefault]);
}

/** Built-in shortcut list shown in the Settings → Appearance section
 *  (or wherever you want to surface a cheat-sheet). Keep in sync with
 *  the actual useShortcut() calls scattered across components. */
export const SHORTCUT_CHEATSHEET: { combo: string; label: string }[] = [
  { combo: 'Ctrl+K',         label: 'Поиск чатов и юзеров / Search' },
  { combo: 'Ctrl+N',         label: 'Новый чат / New chat' },
  { combo: 'Escape',         label: 'Закрыть модалку / Close modal' },
  { combo: 'Ctrl+/',         label: 'Список горячих клавиш / This list' },
];
