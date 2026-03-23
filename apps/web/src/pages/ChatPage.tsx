import { AppLayout } from '../components/layout/AppLayout';
import { useSocket } from '../hooks/useSocket';

export function ChatPage() {
  useSocket();
  return <AppLayout />;
}
