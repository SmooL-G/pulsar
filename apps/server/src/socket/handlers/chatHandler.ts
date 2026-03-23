import type { Server, Socket } from 'socket.io';
import { prisma } from '../../config/database.js';

export function registerChatHandlers(io: Server, socket: Socket) {
  const userId = socket.data.userId as string;

  // Join all chat rooms the user belongs to
  (async () => {
    const memberships = await prisma.chatMember.findMany({
      where: { userId, leftAt: null },
      select: { chatId: true },
    });

    for (const { chatId } of memberships) {
      socket.join(`chat:${chatId}`);
    }
  })();
}
