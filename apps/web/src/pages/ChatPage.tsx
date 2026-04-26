import { AppLayout } from '../components/layout/AppLayout';
import { NotificationManager } from '../components/notifications/NotificationManager';
import { useSocket } from '../hooks/useSocket';
import { useTopupLanding } from '../hooks/useTopupLanding';

export function ChatPage() {
  useSocket();
  useTopupLanding();
  return (
    <div className="chat-layout">
      <AppLayout />
      <NotificationManager />
    </div>
  );
}
