import { AppLayout } from '../components/layout/AppLayout';
import { NotificationManager } from '../components/notifications/NotificationManager';
import { useSocket } from '../hooks/useSocket';

export function ChatPage() {
  useSocket();
  return (
    <div className="chat-layout">
      <AppLayout />
      <NotificationManager />
    </div>
  );
}
