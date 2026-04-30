import { getSocket } from '../hooks/useSocket';
import { getPeer } from './PeerConnection';
import { useChatStore } from '../store/chatStore';
import type { Message } from '@pulsar/shared';

interface SendOptions {
  // Target chat (for socket fallback). Required.
  chatId: string;
  // Payload sent to socket. Server constructs the canonical Message
  // using these fields.
  socketPayload: Parameters<ReturnType<typeof getSocket>['emit']>[1];
  // The optimistic Message object used when going pure-P2P (server
  // doesn't see it, so we have to fabricate the row that the recipient
  // will render). Must include `id`, `chatId`, `senderId`, `createdAt`.
  p2pPayload: Message;
}

interface SendResult {
  transport: 'p2p' | 'server';
}

/**
 * Decide whether to send a DM via direct WebRTC or the existing socket.
 * Used only for DIRECT chats; groups/channels always go through socket
 * in Phase 1 (mesh broadcast deferred to Phase 3).
 */
export function sendDmMessage(opts: SendOptions): SendResult {
  const chat = useChatStore.getState().chats.find((c) => c.id === opts.chatId);
  const otherUserId = (chat as any)?.otherUser?.id as string | undefined;

  if (otherUserId) {
    const peer = getPeer(otherUserId);
    if (peer?.isOpen() && peer.send(opts.p2pPayload)) {
      return { transport: 'p2p' };
    }
  }

  // Fallback: socket path. The server will broadcast 'message:new' to
  // both participants via the existing handler.
  getSocket()?.emit('message:send', opts.socketPayload as any);
  return { transport: 'server' };
}
