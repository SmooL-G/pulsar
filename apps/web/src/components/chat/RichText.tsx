import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MessageCircle, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useChatStore } from '../../store/chatStore';
import { api } from '../../services/api';
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
    <Link
      to={`/${username}`}
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
  );
}

// ─── Inline contact card (one per unique @mention in a message) ─────

export function MentionContactCard({ username, isOwn }: { username: string; isOwn: boolean }) {
  const { user } = useUserLookup(username);
  const navigate = useNavigate();
  const [opening, setOpening] = useState(false);
  const currentUserId = useAuthStore((s) => s.user?.id);

  // If lookup hasn't returned yet, show a slim loading skeleton so the
  // card doesn't pop in suddenly.
  if (user === undefined) {
    return (
      <div className={`mt-2 flex items-center gap-2 px-3 py-2 rounded-xl ${isOwn ? 'bg-white/10' : 'bg-black/5 dark:bg-white/5'}`}>
        <Loader2 size={14} className="animate-spin opacity-50" />
        <span className="text-xs opacity-60">@{username}</span>
      </div>
    );
  }
  // Cached-as-null = doesn't exist; hide the card entirely.
  if (user === null) return null;

  const isMe = currentUserId === user.id;
  const initial = (user.displayName || user.username || '?')[0].toUpperCase();

  const handleWrite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (opening || isMe) return;
    setOpening(true);
    try {
      const res: any = await api.post('/chats/direct', { targetUserId: user.id });
      const created = res?.data ?? res;
      await useChatStore.getState().fetchChats();
      const chat = useChatStore.getState().chats.find(
        (c) => c.id === created.id || c.id === created.chatId,
      );
      if (chat) {
        useChatStore.getState().setActiveChat(chat);
        navigate('/', { replace: false });
      }
    } catch {
      // soft-fail: still navigate to profile so user has a way forward
      navigate(`/${user.username}`);
    } finally {
      setOpening(false);
    }
  };

  return (
    <div
      className={`mt-2 flex items-center gap-2.5 px-2.5 py-2 rounded-xl ${
        isOwn
          ? 'bg-white/10 hover:bg-white/15'
          : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10'
      } transition-colors`}
    >
      <Link
        to={`/${user.username}`}
        className="flex items-center gap-2.5 flex-1 min-w-0 no-underline"
        onClick={(e) => e.stopPropagation()}
      >
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
        ) : (
          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
            isOwn ? 'bg-white/20 text-white' : 'bg-primary-500/20 text-primary-600 dark:text-primary-300'
          }`}>
            {initial}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-semibold truncate ${isOwn ? 'text-white' : 'text-gray-800 dark:text-gray-100'}`}>
            {user.displayName || user.username}
            {user.isBot && (
              <span className={`ml-1.5 text-[9px] font-bold px-1 py-0.5 rounded ${
                isOwn ? 'bg-white/20 text-white' : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
              }`}>BOT</span>
            )}
          </div>
          <div className={`text-[11px] truncate ${isOwn ? 'text-blue-100/80' : 'text-gray-500 dark:text-gray-400'}`}>
            @{user.username}
          </div>
        </div>
      </Link>
      {!isMe && (
        <button
          onClick={handleWrite}
          disabled={opening}
          className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
            isOwn
              ? 'bg-white/20 hover:bg-white/30 text-white'
              : 'bg-primary-500 hover:bg-primary-600 text-white'
          }`}
        >
          {opening ? <Loader2 size={12} className="animate-spin" /> : <MessageCircle size={12} />}
          <span>Написать</span>
        </button>
      )}
    </div>
  );
}

/** Extract unique usernames mentioned in a text block, preserving order. */
export function extractMentions(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of text.matchAll(MENTION_REGEX)) {
    const u = m[1];
    if (!seen.has(u.toLowerCase())) {
      seen.add(u.toLowerCase());
      out.push(u);
    }
  }
  return out;
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
