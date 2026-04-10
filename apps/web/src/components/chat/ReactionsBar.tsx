import React, { useState, useRef, useEffect } from 'react';
import { Smile } from 'lucide-react';
import { api } from '../../services/api';

interface ReactionGroup {
  emoji: string;
  count: number;
  userIds: string[];
}

interface ReactionsBarProps {
  reactions: ReactionGroup[];
  messageId: string;
  chatId: string;
  isOwn: boolean;
  currentUserId?: string;
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡', '🔥', '👏'];

export function ReactionsBar({ reactions, messageId, chatId, isOwn, currentUserId }: ReactionsBarProps) {
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPicker) return;
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showPicker]);

  const handleReact = async (emoji: string) => {
    setShowPicker(false);
    try {
      await api.post(`/messages/${messageId}/react`, { emoji });
    } catch {
      // silent
    }
  };

  const hasAny = reactions.length > 0;

  if (!hasAny && !currentUserId) return null;

  return (
    <div className={`flex flex-wrap items-center gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
      {reactions.map((r) => {
        const iReacted = currentUserId ? r.userIds.includes(currentUserId) : false;
        return (
          <button
            key={r.emoji}
            onClick={() => handleReact(r.emoji)}
            className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-sm transition-all border ${
              iReacted
                ? 'bg-primary-500/30 border-primary-500/60 text-white'
                : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
            }`}
            title={iReacted ? 'Убрать реакцию' : 'Добавить реакцию'}
          >
            <span>{r.emoji}</span>
            <span className="text-xs font-medium">{r.count}</span>
          </button>
        );
      })}

      {currentUserId && (
        <div className="relative" ref={pickerRef}>
          <button
            onClick={() => setShowPicker((v) => !v)}
            className={`flex items-center justify-center w-6 h-6 rounded-full bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-gray-200 transition-all ${hasAny ? 'opacity-60 hover:opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
            title="Добавить реакцию"
          >
            <Smile size={12} />
          </button>

          {showPicker && (
            <div
              className={`absolute z-50 bottom-8 bg-gray-800 border border-white/10 rounded-xl p-2 flex gap-1 shadow-xl ${
                isOwn ? 'right-0' : 'left-0'
              }`}
            >
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleReact(emoji)}
                  className="text-lg hover:scale-125 transition-transform p-0.5 rounded"
                  title={emoji}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
