import { redis } from '../../config/redis.js';
import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';

const HELIUS_API_KEY = env.HELIUS_API_KEY;
const HELIUS_RPC_URL = env.HELIUS_RPC_URL || `https://devnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const NFT_CACHE_TTL = 300; // 5 минут в Redis

export interface NftItem {
  mint: string;
  name: string;
  image: string;
  collection?: string;
  description?: string;
}

/**
 * Получить NFT кошелька через Helius DAS API.
 * Результат кэшируется в Redis на 5 минут.
 */
export async function getNftsByWallet(walletAddress: string): Promise<NftItem[]> {
  if (!HELIUS_API_KEY) return [];

  // Проверяем кэш
  const cacheKey = `nft:gallery:${walletAddress}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  try {
    const response = await fetch(HELIUS_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'pulsar-nft',
        method: 'getAssetsByOwner',
        params: {
          ownerAddress: walletAddress,
          page: 1,
          limit: 100,
          displayOptions: { showFungible: false, showNativeBalance: false },
        },
      }),
    });

    const data = await response.json() as any;
    const items: NftItem[] = (data.result?.items || [])
      .filter((item: any) => item.content?.metadata?.name && item.content?.links?.image)
      .map((item: any) => ({
        mint: item.id,
        name: item.content.metadata.name,
        image: item.content.links.image,
        collection: item.grouping?.[0]?.group_value || null,
        description: item.content.metadata.description || null,
      }));

    // Кэшируем результат
    await redis.set(cacheKey, JSON.stringify(items), 'EX', NFT_CACHE_TTL);

    // Обновляем кэш в БД
    for (const nft of items) {
      await prisma.nftCache.upsert({
        where: { mintAddress: nft.mint },
        create: {
          mintAddress: nft.mint,
          ownerWallet: walletAddress,
          name: nft.name,
          imageUrl: nft.image,
          collection: nft.collection || null,
        },
        update: {
          ownerWallet: walletAddress,
          name: nft.name,
          imageUrl: nft.image,
          collection: nft.collection || null,
          lastVerified: new Date(),
        },
      });
    }

    return items;
  } catch (err) {
    console.error('Helius DAS API error:', err);
    return [];
  }
}

/**
 * Проверить владение конкретным NFT через Helius.
 */
export async function verifyNftOwnership(mintAddress: string, walletAddress: string): Promise<NftItem | null> {
  if (!HELIUS_API_KEY) return null;

  try {
    const response = await fetch(HELIUS_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'pulsar-verify',
        method: 'getAsset',
        params: { id: mintAddress },
      }),
    });

    const data = await response.json() as any;
    const asset = data.result;

    if (!asset || asset.ownership?.owner !== walletAddress) {
      return null;
    }

    return {
      mint: asset.id,
      name: asset.content?.metadata?.name || 'Unknown',
      image: asset.content?.links?.image || '',
      collection: asset.grouping?.[0]?.group_value || null,
      description: asset.content?.metadata?.description || null,
    };
  } catch (err) {
    console.error('Helius verify error:', err);
    return null;
  }
}

/**
 * Cron: проверить владение NFT-аватарами.
 * Вызывать каждые 6 часов.
 */
export async function verifyAllNftAvatars(): Promise<void> {
  const usersWithNftAvatar = await prisma.user.findMany({
    where: { nftAvatarMint: { not: null } },
    select: { id: true, walletAddress: true, nftAvatarMint: true },
  });

  for (const user of usersWithNftAvatar) {
    const owned = await verifyNftOwnership(user.nftAvatarMint!, user.walletAddress);
    if (!owned) {
      // NFT продан/передан — сбрасываем аватар
      await prisma.user.update({
        where: { id: user.id },
        data: { nftAvatarMint: null, avatarUrl: null },
      });
      console.log(`NFT avatar reset for user ${user.id} — no longer owns ${user.nftAvatarMint}`);
    }
  }
}
