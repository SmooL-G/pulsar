import { useMemo } from 'react';
import { useMessageStore } from '../../store/messageStore';

interface Props {
  chatId: string;
  onSendText: (text: string) => void;
}

/**
 * Persistent reply keyboard shown above MessageInput (Telegram-style).
 * Reads the most recent bot message's metadata.replyKeyboard.
 * Clicking a button sends its label as a regular text message.
 */
export function BotReplyKeyboard({ chatId, onSendText }: Props) {
  const messages = useMessageStore((s) => s.messages[chatId] || []);

  const keyboard = useMemo<string[][] | null>(() => {
    // Find latest bot message with replyKeyboard in metadata
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i] as any;
      const k = m?.metadata?.replyKeyboard;
      if (k === null) return null; // explicit removal
      if (Array.isArray(k) && k.length > 0) {
        return k as string[][];
      }
    }
    return null;
  }, [messages]);

  if (!keyboard || !keyboard.length) return null;

  return (
    <div className="px-2 pb-1.5 pt-0.5 flex flex-col gap-1.5">
      {keyboard.map((row, ri) => (
        <div key={ri} className="flex gap-1.5">
          {row.map((label, bi) => (
            <button
              key={bi}
              onClick={() => onSendText(label)}
              className="flex-1 px-3 py-2 rounded-xl bg-gray-100 dark:bg-dark-600 hover:bg-gray-200 dark:hover:bg-dark-500 text-sm font-medium text-gray-900 dark:text-gray-100 transition-colors border border-gray-200 dark:border-dark-500"
            >
              {label}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
