import { useEffect, useRef, useState } from 'react';
import { useChatStore } from '../../store/chatStore';
import { GenerativeAvatar } from '../ui/GenerativeAvatar';

interface MentionUser {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl?: string | null;
}

interface MentionPickerProps {
  /** Lowercase prefix the user typed after `@`. Empty string shows everyone. */
  query: string;
  chatId: string;
  /** Called with the username when the user picks a candidate. */
  onPick: (username: string) => void;
  onClose: () => void;
}

export function MentionPicker({ query, chatId, onPick, onClose }: MentionPickerProps) {
  const chats = useChatStore((s) => s.chats);
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Pull members from the in-store chat. They were preloaded by /chats fetch.
  const chat = chats.find((c) => c.id === chatId) as any;
  const members: MentionUser[] = (chat?.members || [])
    .map((m: any) => m.user)
    .filter((u: any): u is MentionUser => !!u && !u.isBot);

  const matches = members
    .filter((u) => {
      if (!query) return true;
      const u1 = u.username?.toLowerCase() || '';
      const u2 = u.displayName?.toLowerCase() || '';
      return u1.startsWith(query) || u2.includes(query);
    })
    .slice(0, 6);

  // Reset highlight when the candidate list changes.
  useEffect(() => { setHighlight(0); }, [query, matches.length]);

  // Keyboard navigation: arrow up/down, enter to pick, escape to close.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (matches.length === 0) {
        if (e.key === 'Escape') { onClose(); }
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlight((h) => (h + 1) % matches.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlight((h) => (h - 1 + matches.length) % matches.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        onPick(matches[highlight].username);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [matches, highlight, onPick, onClose]);

  if (matches.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full left-0 right-0 mx-2 mb-2 bg-dark-700 border border-dark-500 rounded-xl shadow-2xl py-1 z-30 animate-fade-in max-h-64 overflow-y-auto"
    >
      {matches.map((u, idx) => (
        <button
          key={u.id}
          onMouseEnter={() => setHighlight(idx)}
          onClick={() => onPick(u.username)}
          className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
            idx === highlight ? 'bg-primary-500/20' : 'hover:bg-dark-600'
          }`}
        >
          <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white text-xs font-medium overflow-hidden shrink-0">
            {u.avatarUrl ? (
              <img src={u.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <GenerativeAvatar seed={u.id} size={32} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-white truncate">
              {u.displayName || u.username}
            </p>
            <p className="text-xs text-gray-400 truncate">@{u.username}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
