import { useEffect, useState, useRef } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';
import { getSocket } from '../../hooks/useSocket';
import { useI18n } from '../../i18n';

interface NotificationToastProps {
  sender: string;
  chatId: string;
  chatName?: string;
  onClose: () => void;
  onClick: () => void;
}

export function NotificationToast({ sender, chatId, chatName, onClose, onClick }: NotificationToastProps) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [reply, setReply] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));

    timerRef.current = setTimeout(() => {
      if (!expanded) {
        setVisible(false);
        setTimeout(onClose, 300);
      }
    }, 5000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [onClose, expanded]);

  const handleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleSend = () => {
    const content = reply.trim();
    if (!content) return;

    const socket = getSocket();
    if (socket?.connected) {
      socket.emit('message:send', { chatId, content, type: 'TEXT' });
    }

    setReply('');
    setVisible(false);
    setTimeout(onClose, 300);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') {
      setVisible(false);
      setTimeout(onClose, 300);
    }
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    setVisible(false);
    setTimeout(onClose, 300);
  };

  return (
    <div
      className={`
        fixed top-0 left-1/2 -translate-x-1/2 z-[100]
        transition-all duration-300 ease-out
        ${visible ? 'translate-y-4 opacity-100' : '-translate-y-full opacity-0'}
      `}
    >
      <div className={`bg-dark-700 border border-dark-500 shadow-2xl rounded-2xl overflow-hidden transition-all duration-200 ${expanded ? 'min-w-[360px] max-w-[440px]' : 'min-w-[280px] max-w-[400px]'}`}>
        {/* Header — always visible */}
        <div
          onClick={expanded ? onClick : handleExpand}
          className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-dark-600/50 transition-colors"
        >
          <div className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center text-white font-medium shrink-0">
            {sender[0]?.toUpperCase() || '?'}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{sender}</p>
            <p className="text-xs text-gray-400 truncate">
              {chatName ? `${chatName} · ` : ''}
              <span className="inline-flex items-center gap-1">
                <MessageCircle size={10} className="inline" />
                <span className="text-primary-400">{t('chat.newMessage')}</span>
              </span>
            </p>
          </div>

          {expanded ? (
            <button onClick={handleClose} className="p-1 rounded-lg hover:bg-dark-500 text-gray-400 shrink-0">
              <X size={16} />
            </button>
          ) : (
            <div className="w-2.5 h-2.5 rounded-full bg-primary-500 animate-pulse shrink-0" />
          )}
        </div>

        {/* Quick reply input */}
        {expanded && (
          <div className="px-4 pb-3">
            <div className="flex items-center gap-2 bg-dark-600 rounded-xl px-3 py-2">
              <input
                ref={inputRef}
                type="text"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('chat.quickReply')}
                className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-gray-500"
              />
              <button
                onClick={handleSend}
                disabled={!reply.trim()}
                className="p-1.5 rounded-lg bg-primary-500 hover:bg-primary-600 text-white disabled:opacity-30 transition-colors shrink-0"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
