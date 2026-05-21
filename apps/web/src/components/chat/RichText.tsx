import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { getSocket } from '../../hooks/useSocket';
import { useUserLookup, type ResolvedUser } from '../../hooks/useUserLookup';

/**
 * Rich-text renderer for chat message bodies. Tokenizes the input into
 * URLs, @mentions and /commands and renders each as the appropriate
 * interactive element. Plain text stays plain.
 *
 * - URL          → external link, opens in new tab
 * - @mention     → inline pill with avatar + name; click navigates to
 *                  the user's profile share page (`/<username>`);
 *                  desktop hover shows a mini preview card.
 * - /command     → clickable chip; click *sends* the command into the
 *                  current chat via socket (Telegram-style insta-send).
 *
 * Tokenization is overlap-aware: a /command or @mention living inside
 * a URL is skipped so we don't double-render.
 */

const URL_REGEX     = /(https?:\/\/[^\s<>"{}|\\^`\[\]]+)/g;
// Pulsar usernames allow letters, digits, underscore, hyphen, dot.
// VarChar(32) hard cap, 2 chars min. Start + end on alnum/underscore
// so trailing punctuation like "@user." or "@user-" stops cleanly
// (regex backtracks the trailing hyphen/dot via the final char-class).
const MENTION_REGEX = /@([a-zA-Z0-9_][a-zA-Z0-9_.-]{0,30}[a-zA-Z0-9_])/g;
// Commands: a slash + letter + 0-31 more word chars, preceded by start-
// of-string or whitespace, followed by a word boundary. The lookbehind
// keeps URLs (which contain slashes) from matching.
const COMMAND_REGEX = /(?:^|\s)(\/[a-zA-Z][a-zA-Z0-9_]{0,31})\b/g;

type Token =
  | { kind: 'text';    start: number; end: number; raw: string }
  | { kind: 'url';     start: number; end: number; raw: string }
  | { kind: 'mention'; start: number; end: number; raw: string; username: string }
  | { kind: 'command'; start: number; end: number; raw: string; command: string };

function tokenize(text: string): Token[] {
  type Pre = Omit<Token, 'kind' | 'raw'> & { kind: Exclude<Token['kind'], 'text'>; raw: string; username?: string; command?: string };
  const matches: Pre[] = [];

  for (const m of text.matchAll(URL_REGEX)) {
    if (m.index === undefined) continue;
    matches.push({ kind: 'url', start: m.index, end: m.index + m[0].length, raw: m[1] });
  }
  for (const m of text.matchAll(MENTION_REGEX)) {
    if (m.index === undefined) continue;
    if (matches.some((t) => m.index! >= t.start && m.index! < t.end)) continue;
    matches.push({ kind: 'mention', start: m.index, end: m.index + m[0].length, raw: m[0], username: m[1] });
  }
  for (const m of text.matchAll(COMMAND_REGEX)) {
    if (m.index === undefined) continue;
    // m[0] may include the leading whitespace — anchor on m[1].
    const cmdStart = m.index + m[0].indexOf(m[1]);
    const cmdEnd   = cmdStart + m[1].length;
    if (matches.some((t) => cmdStart >= t.start && cmdStart < t.end)) continue;
    matches.push({ kind: 'command', start: cmdStart, end: cmdEnd, raw: m[1], command: m[1] });
  }
  matches.sort((a, b) => a.start - b.start);

  const result: Token[] = [];
  let pos = 0;
  for (const m of matches) {
    if (m.start > pos) {
      result.push({ kind: 'text', start: pos, end: m.start, raw: text.slice(pos, m.start) });
    }
    if (m.kind === 'mention') {
      result.push({ kind: 'mention', start: m.start, end: m.end, raw: m.raw, username: m.username! });
    } else if (m.kind === 'command') {
      result.push({ kind: 'command', start: m.start, end: m.end, raw: m.raw, command: m.command! });
    } else {
      result.push({ kind: 'url', start: m.start, end: m.end, raw: m.raw });
    }
    pos = m.end;
  }
  if (pos < text.length) {
    result.push({ kind: 'text', start: pos, end: text.length, raw: text.slice(pos) });
  }
  return result;
}

interface RichTextProps {
  content: string;
  isOwn: boolean;
  /** chatId is needed for /command click → socket emit. */
  chatId: string;
}

export function RichText({ content, isOwn, chatId }: RichTextProps) {
  const tokens = tokenize(content);
  if (tokens.length === 0) return <>{content}</>;
  const myUsername = useAuthStore.getState().user?.username?.toLowerCase();

  return (
    <>
      {tokens.map((tok, i) => {
        if (tok.kind === 'text') return <span key={i}>{tok.raw}</span>;
        if (tok.kind === 'url') {
          return (
            <a
              key={i}
              href={tok.raw}
              target="_blank"
              rel="noopener noreferrer"
              className={`underline break-all ${isOwn ? 'text-blue-200 hover:text-white' : 'text-primary-500 hover:text-primary-400'}`}
            >
              {tok.raw}
            </a>
          );
        }
        if (tok.kind === 'mention') {
          return (
            <MentionPill
              key={i}
              username={tok.username}
              isOwn={isOwn}
              isMe={!!myUsername && tok.username.toLowerCase() === myUsername}
            />
          );
        }
        // command
        return <CommandChip key={i} command={tok.command} isOwn={isOwn} chatId={chatId} />;
      })}
    </>
  );
}

// ─── @mention pill with avatar + hover preview ─────────────────────

function MentionPill({ username, isOwn, isMe }: { username: string; isOwn: boolean; isMe: boolean }) {
  const { user } = useUserLookup(username);
  const [hovering, setHovering] = useState(false);
  const linkRef = useRef<HTMLAnchorElement | null>(null);
  // Delay hiding so the cursor has time to travel from link → card.
  const hideTimer = useRef<number | null>(null);
  const showCard = () => {
    if (hideTimer.current) { window.clearTimeout(hideTimer.current); hideTimer.current = null; }
    setHovering(true);
  };
  const hideCard = () => {
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setHovering(false), 150);
  };
  useEffect(() => () => { if (hideTimer.current) window.clearTimeout(hideTimer.current); }, []);

  // Don't render hover-card on touch devices (no hover state) — tap
  // navigates straight to the profile.
  const supportsHover = typeof window !== 'undefined' && window.matchMedia?.('(hover: hover)').matches;

  // Color emphasis if it's a mention of *me*.
  const baseCls = isMe
    ? isOwn
      ? 'bg-amber-300/30 text-amber-100 ring-1 ring-amber-300/50'
      : 'bg-amber-500/20 text-amber-600 dark:text-amber-300 ring-1 ring-amber-400/40'
    : isOwn
      ? 'bg-white/15 text-blue-100 hover:bg-white/25'
      : 'bg-primary-500/15 text-primary-600 dark:text-primary-300 hover:bg-primary-500/25';

  const initial = (user?.displayName || username || '?')[0].toUpperCase();

  return (
    <>
      <Link
        ref={linkRef}
        to={`/${username}`}
        onMouseEnter={supportsHover ? showCard : undefined}
        onMouseLeave={supportsHover ? hideCard : undefined}
        className={`inline-flex items-center gap-1 align-baseline px-1.5 py-0.5 rounded-md font-medium no-underline transition-colors ${baseCls}`}
        onClick={(e) => { e.stopPropagation(); }}
      >
        {user?.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt=""
            className="w-4 h-4 rounded-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="w-4 h-4 rounded-full bg-black/20 dark:bg-white/20 flex items-center justify-center text-[8px] font-bold leading-none">
            {initial}
          </span>
        )}
        <span>@{user?.username || username}</span>
        {user?.isBot && <span className="text-[9px] opacity-70 font-bold">BOT</span>}
      </Link>
      {hovering && user && supportsHover && linkRef.current && (
        <MentionPreviewCard
          user={user}
          anchor={linkRef.current}
          onEnter={showCard}
          onLeave={hideCard}
        />
      )}
    </>
  );
}

function MentionPreviewCard({
  user, anchor, onEnter, onLeave,
}: {
  user: ResolvedUser;
  anchor: HTMLElement;
  onEnter: () => void;
  onLeave: () => void;
}) {
  // Compute position from anchor's bounding rect — render via portal
  // so we escape any clipping ancestor (overflow:hidden on chat panel,
  // message bubble z-stacking, etc).
  const rect = anchor.getBoundingClientRect();
  const cardWidth = 256; // w-64
  const cardHeight = 100; // approx
  // Prefer above the pill; fall back to below if no room.
  const placeAbove = rect.top > cardHeight + 16;
  const top = placeAbove
    ? rect.top - cardHeight - 8
    : rect.bottom + 8;
  // Clamp left so card doesn't go off-screen.
  let left = rect.left;
  if (left + cardWidth > window.innerWidth - 16) {
    left = window.innerWidth - cardWidth - 16;
  }
  if (left < 16) left = 16;

  return createPortal(
    <div
      role="tooltip"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{ position: 'fixed', top, left, width: cardWidth, zIndex: 9999 }}
      className="rounded-xl bg-white dark:bg-dark-700 shadow-xl ring-1 ring-black/10 dark:ring-white/10 p-3 text-left animate-fade-in"
    >
      <div className="flex items-center gap-2">
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-500 font-semibold shrink-0">
            {(user.displayName || user.username || '?')[0].toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
            {user.displayName || user.username}
            {user.isBot && <span className="ml-1 text-[10px] font-bold text-amber-500">BOT</span>}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">@{user.username}</div>
        </div>
      </div>
      {user.bio && (
        <div className="mt-2 text-xs text-gray-600 dark:text-gray-300 line-clamp-3">
          {user.bio}
        </div>
      )}
    </div>,
    document.body,
  );
}

// ─── /command chip — click sends the command ────────────────────────

function CommandChip({ command, isOwn, chatId }: { command: string; isOwn: boolean; chatId: string }) {
  const [sending, setSending] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const socket = getSocket();
    if (!socket || !chatId || sending) return;
    setSending(true);
    socket.emit('message:send', { chatId, content: command, type: 'TEXT' });
    // Brief visual feedback — disable for 1s then re-enable. The user
    // sees the new message appear in the chat almost immediately via
    // the optimistic-render path in messageStore.
    setTimeout(() => setSending(false), 1000);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={sending}
      className={`inline-flex items-center align-baseline px-1.5 py-0.5 rounded-md font-mono text-[0.95em] font-medium no-underline transition-colors disabled:opacity-50 ${
        isOwn
          ? 'bg-white/15 text-blue-100 hover:bg-white/25 cursor-pointer'
          : 'bg-primary-500/15 text-primary-600 dark:text-primary-300 hover:bg-primary-500/25 cursor-pointer'
      }`}
      title="Нажми чтобы отправить команду"
    >
      {command}
    </button>
  );
}
