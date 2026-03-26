import type { FastifyInstance } from 'fastify';
import { prisma } from '../../config/database.js';
import { authMiddleware } from '../../middleware/auth.js';
import { getNftsByWallet, verifyNftOwnership } from './nft.service.js';

export async function nftRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authMiddleware);

  // GET /nft/gallery — NFT текущего юзера
  app.get('/gallery', async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user!.userId },
      select: { walletAddress: true },
    });

    if (!user) return reply.status(404).send({ error: 'USER_NOT_FOUND' });

    const nfts = await getNftsByWallet(user.walletAddress);
    return { nfts };
  });

  // GET /nft/gallery/:wallet — NFT любого кошелька (публичный)
  app.get<{ Params: { wallet: string } }>('/gallery/:wallet', async (request) => {
    const nfts = await getNftsByWallet(request.params.wallet);
    return { nfts };
  });

  // POST /nft/set-avatar — установить NFT как аватар
  app.post<{ Body: { mintAddress: string } }>('/set-avatar', async (request, reply) => {
    const { mintAddress } = request.body;
    if (!mintAddress) return reply.status(400).send({ error: 'MINT_REQUIRED' });

    const user = await prisma.user.findUnique({
      where: { id: request.user!.userId },
      select: { id: true, walletAddress: true },
    });

    if (!user) return reply.status(404).send({ error: 'USER_NOT_FOUND' });

    // Проверяем владение через Helius
    const nft = await verifyNftOwnership(mintAddress, user.walletAddress);
    if (!nft) {
      return reply.status(403).send({ error: 'NOT_NFT_OWNER', message: 'You do not own this NFT' });
    }

    // Устанавливаем NFT как аватар
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        nftAvatarMint: mintAddress,
        avatarUrl: nft.image,
      },
      select: { id: true, avatarUrl: true, nftAvatarMint: true },
    });

    return { success: true, user: updated };
  });

  // POST /nft/clear-avatar — убрать NFT-аватар
  app.post('/clear-avatar', async (request) => {
    await prisma.user.update({
      where: { id: request.user!.userId },
      data: { nftAvatarMint: null },
    });

    return { success: true };
  });
}
