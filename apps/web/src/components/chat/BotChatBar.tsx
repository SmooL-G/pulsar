import { useState, useEffect } from 'react';
import { Bot, AppWindow } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { api } from '../../services/api';
import { BotPanel } from '../bot/BotPanel';

interface BotCommand {
  botUsername: string;
  command: string;
  description: string;
}

interface BotChatBarProps {
  chatId: string;
  onCommandSelect: (command: string) => void;
}

export function BotChatBar({ chatId, onCommandSelect }: BotChatBarProps) {
  const { activeChat } = useChatStore();
  const [commands, setCommands] = useState<BotCommand[]>([]);
  const [showMenu, setShowMenu] = useState(false);
  const [showBotPanel, setShowBotPanel] = useState(false);

  const hasBot = (activeChat?.members as any[])?.some((m: any) => m.user?.isBot && !m.user?.username?.includes('pulsarbot'));

  useEffect(() => {
    if (!hasBot || !chatId) return;
    api.get(`/bots/chat/${chatId}/commands`)
      .then(r => setCommands(r.data.commands || []))
      .catch(() => setCommands([]));
  }, [chatId, hasBot]);

  if (!hasBot) return null;

  return (
    <>
      {/* Command menu popup */}
      {showMenu && commands.length > 0 && (
        <div className="px-3 pb-1">
          <div className="bg-gray-800 border border-white/10 rounded-xl p-3">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Команды бота</p>
            <div className="flex flex-wrap gap-1.5">
              {commands.map((c, i) => (
                <button
                  key={i}
                  onClick={() => {
                    onCommandSelect(`/${c.command}`);
                    setShowMenu(false);
                  }}
                  className="flex flex-col items-start px-3 py-1.5 rounded-lg bg-white/5 hover:bg-primary-500/20 border border-white/10 hover:border-primary-500/40 transition-all"
                >
                  <span className="text-xs font-mono font-medium text-primary-400">/{c.command}</span>
                  {c.description && (
                    <span className="text-[10px] text-gray-500 leading-tight">{c.description}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bar */}
      <div className="flex items-center gap-2 px-3 pb-2">
        <button
          onClick={() => setShowMenu(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border transition-all ${
            showMenu
              ? 'bg-primary-500/20 border-primary-500/40 text-primary-400'
              : 'bg-white/5 border-white/10 text-gray-400 hover:text-gray-200 hover:bg-white/10'
          }`}
        >
          <Bot size={13} />
          Меню бота
        </button>
        <button
          onClick={() => setShowBotPanel(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs bg-white/5 border border-white/10 text-gray-400 hover:text-gray-200 hover:bg-white/10 transition-all"
        >
          <AppWindow size={13} />
          Открыть приложение
        </button>
      </div>

      {showBotPanel && <BotPanel onClose={() => setShowBotPanel(false)} />}
    </>
  );
}
