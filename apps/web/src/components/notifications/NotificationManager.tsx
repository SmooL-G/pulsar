import { useEffect, useState, useCallback } from 'react';
import { getSocket } from '../../hooks/useSocket';
import { useAuthStore } from '../../store/authStore';
import { useChatStore } from '../../store/chatStore';
import { useNotificationStore } from '../../store/notificationStore';
import { NotificationToast } from './NotificationToast';
import type { Message } from '@pulsar/shared';

interface Notification {
  id: string;
  sender: string;
  chatId: string;
  chatName?: string;
}

// Notification sound (simple beep)
const playNotificationSound = () => {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // Audio not available
  }
};

export function NotificationManager() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const user = useAuthStore((s) => s.user);
  const activeChat = useChatStore((s) => s.activeChat);
  const { enabled, soundEnabled } = useNotificationStore();

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const handleClick = useCallback((chatId: string, notifId: string) => {
    removeNotification(notifId);
    // Could navigate to chat here
  }, [removeNotification]);

  useEffect(() => {
    if (!enabled) return;

    const socket = getSocket();
    if (!socket) return;

    const handleNewMessage = (message: Message) => {
      // Don't notify for own messages
      if (message.senderId === user?.id) return;
      // Don't notify if chat is currently active
      if (activeChat?.id === message.chatId) return;

      const senderName = message.sender?.displayName || message.sender?.username || 'Unknown';

      const notif: Notification = {
        id: `${message.id}-${Date.now()}`,
        sender: senderName,
        chatId: message.chatId,
      };

      setNotifications((prev) => [...prev.slice(-2), notif]); // Max 3 notifications

      if (soundEnabled) {
        playNotificationSound();
      }
    };

    socket.on('message:new', handleNewMessage);
    return () => {
      socket.off('message:new', handleNewMessage);
    };
  }, [enabled, soundEnabled, user?.id, activeChat?.id]);

  return (
    <>
      {notifications.map((notif, index) => (
        <div key={notif.id} style={{ top: `${index * 70}px` }} className="fixed left-0 right-0 z-[100] pointer-events-none">
          <div className="pointer-events-auto">
            <NotificationToast
              sender={notif.sender}
              chatName={notif.chatName}
              onClose={() => removeNotification(notif.id)}
              onClick={() => handleClick(notif.chatId, notif.id)}
            />
          </div>
        </div>
      ))}
    </>
  );
}
