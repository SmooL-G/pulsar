import { useState } from 'react';
import { Play, Loader2 } from 'lucide-react';
import { getSocket } from '../../hooks/useSocket';

interface BotStartButtonProps {
  chatId: string;
}

export function BotStartButton({ chatId }: BotStartButtonProps) {
  const [sending, setSending] = useState(false);

  const handleStart = () => {
    if (sending) return;
    const socket = getSocket();
    if (!socket?.connected) return;
    setSending(true);
    socket.emit('message:send', {
      chatId,
      content: '/start',
      type: 'TEXT',
    });
  };

  return (
    <div className="px-4 py-3 border-t border-gray-200 dark:border-dark-500">
      <button
        onClick={handleStart}
        disabled={sending}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-primary-500 hover:bg-primary-600 disabled:opacity-60 text-white text-sm font-semibold shadow-lg hover:shadow-primary-500/30 transition-all"
      >
        {sending ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} fill="currentColor" />}
        {sending ? 'Запуск...' : 'ЗАПУСТИТЬ'}
      </button>
    </div>
  );
}
