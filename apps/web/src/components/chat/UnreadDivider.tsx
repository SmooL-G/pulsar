import { useI18n } from '../../i18n';

/**
 * Telegram-style "Unread messages" divider line. Rendered by
 * MessageList above the first unread message captured at the moment
 * the chat was opened (snapshot lives in chatStore.lastOpenedUnread).
 *
 * Disappears when the user leaves the chat (snapshot cleared) — we
 * deliberately don't dismiss it on scroll so the user always has the
 * anchor point of "where I was" while reading the catch-up batch.
 */
export function UnreadDivider() {
  const locale = useI18n((s) => s.locale);
  const label = locale === 'ru' ? 'Новые сообщения' : 'Unread messages';
  return (
    <div className="flex items-center gap-3 my-3 px-1" aria-label={label}>
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-primary-500/50 to-primary-500/50" />
      <span className="text-[11px] font-semibold uppercase tracking-wider text-primary-500 px-2 py-0.5 rounded-full bg-primary-500/10 ring-1 ring-primary-500/20">
        {label}
      </span>
      <div className="flex-1 h-px bg-gradient-to-l from-transparent via-primary-500/50 to-primary-500/50" />
    </div>
  );
}
