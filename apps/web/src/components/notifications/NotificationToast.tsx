import { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';

interface NotificationToastProps {
  sender: string;
  chatName?: string;
  onClose: () => void;
  onClick: () => void;
}

export function NotificationToast({ sender, chatName, onClose, onClick }: NotificationToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    requestAnimationFrame(() => setVisible(true));

    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300);
    }, 4000);

    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      onClick={onClick}
      className={`
        fixed top-0 left-1/2 -translate-x-1/2 z-[100] cursor-pointer
        transition-all duration-300 ease-out
        ${visible ? 'translate-y-4 opacity-100' : '-translate-y-full opacity-0'}
      `}
    >
      <div className="flex items-center gap-3 bg-dark-700 border border-dark-500 shadow-2xl rounded-2xl px-5 py-3.5 min-w-[280px] max-w-[400px]">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center text-white font-medium shrink-0">
          {sender[0]?.toUpperCase() || '?'}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{sender}</p>
          <p className="text-xs text-gray-400 truncate">
            {chatName ? `${chatName}` : ''}
            <span className="inline-flex items-center gap-1">
              <MessageCircle size={10} className="inline" />
              <span className="text-primary-400">новое сообщение</span>
            </span>
          </p>
        </div>

        {/* Pulse indicator */}
        <div className="w-2.5 h-2.5 rounded-full bg-primary-500 animate-pulse shrink-0" />
      </div>
    </div>
  );
}
