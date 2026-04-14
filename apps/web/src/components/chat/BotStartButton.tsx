import { useState, useEffect } from 'react';
import { Play, Loader2, Bot } from 'lucide-react';
import { getSocket } from '../../hooks/useSocket';
import { api } from '../../services/api';

interface BotStartButtonProps {
  chatId: string;
}

interface BotInfo {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  startMessage: string | null;
  commands: { command: string; description: string }[];
}

export function BotStartButton({ chatId }: BotStartButtonProps) {
  const [sending, setSending] = useState(false);
  const [bot, setBot] = useState<BotInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/bots/chat/${chatId}/info`).then((res) => {
      setBot(res.data.bot);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [chatId]);

  const handleStart = () => {
    if (sending) return;
    const socket = getSocket();
    if (!socket?.connected) return;
    setSending(true);
    socket.emit('message:send', { chatId, content: '/start', type: 'TEXT' });
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 overflow-y-auto">
      {!loading && bot && (
        <div className="max-w-md w-full text-center mb-6">
          <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-primary-500 flex items-center justify-center text-white text-3xl font-bold overflow-hidden">
            {bot.avatarUrl ? (
              <img src={bot.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <Bot size={40} />
            )}
          </div>
          <h2 className="text-xl font-bold text-white mb-1">
            {bot.displayName || bot.username}
          </h2>
          <p className="text-xs text-gray-500 mb-3">@{bot.username} · бот</p>

          {bot.bio && (
            <p className="text-sm text-gray-300 mb-4 px-4">{bot.bio}</p>
          )}

          {bot.startMessage && (
            <div className="bg-dark-700/50 border border-dark-500/50 rounded-2xl p-4 text-left mb-4">
              <p className="text-sm text-gray-200 whitespace-pre-wrap">{bot.startMessage}</p>
            </div>
          )}

          {bot.commands && bot.commands.length > 0 && (
            <div className="text-left bg-dark-700/30 rounded-xl p-3 mb-4">
              <p className="text-[10px] uppercase text-gray-500 font-semibold mb-2">Команды</p>
              <div className="space-y-1">
                {bot.commands.slice(0, 5).map((c, i) => (
                  <div key={i} className="flex gap-2 text-xs">
                    <code className="text-primary-400 font-mono">/{c.command}</code>
                    <span className="text-gray-400 truncate">— {c.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="w-full max-w-md">
        <button
          onClick={handleStart}
          disabled={sending}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-primary-500 hover:bg-primary-600 disabled:opacity-60 text-white text-sm font-semibold shadow-lg hover:shadow-primary-500/30 transition-all"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} fill="currentColor" />}
          {sending ? 'Запуск...' : 'ЗАПУСТИТЬ'}
        </button>
      </div>
    </div>
  );
}
