import { buildApp } from './app.js';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { redis } from './config/redis.js';
import { initSocketServer } from './socket/index.js';
import { seedPulsarBot } from './modules/bot/pulsarBot.seed.js';
import { startWebhookWorker } from './modules/bot/webhookWorker.js';
import { startScheduledMessagesWorker } from './modules/message/scheduledWorker.js';
import { startSubscriptionWorker } from './modules/subscription/renewWorker.js';
import { startLotteryWorker } from './modules/lottery/lotteryWorker.js';
import { startRevenueWorker } from './modules/revenue/revenueWorker.js';
import { startTreasuryWorker } from './modules/treasury/treasuryWorker.js';
import { startNodesWorker } from './modules/nodes/nodesWorker.js';
import { adminWs } from './modules/messages/admin-ws-client.js';
import { startStorageChallengeWorker } from './modules/messages/storage-challenge.worker.js';
import { backfillDevicesFromBundles } from './modules/keys/devices-backfill.js';
import { startP2PWorker } from './modules/p2p/p2p.worker.js';
import { startPriceSnapshotWorker } from './modules/price/price.worker.js';
import { startMerchantWorker } from './modules/merchant/merchant.worker.js';
// Pulsar GPT in-server bot is retired — replaced by the standalone
// pulsar-gpt-bot service running on the DE VPS using the public bot
// SDK. Old imports removed; the AI / KIE / DALL-E logic lives in that
// service now.

async function main() {
  const app = await buildApp();

  // Connect to database
  await connectDatabase();
  console.log('Connected to PostgreSQL');

  // Start HTTP server
  const server = await app.listen({ port: env.PORT, host: env.HOST });
  console.log(`Server listening on ${server}`);

  // Initialize Socket.IO
  initSocketServer(app.server);
  console.log('Socket.IO initialized');

  // Seed PulsarBot system account
  try {
    await seedPulsarBot();
    console.log('PulsarBot seeded');
  } catch (e) {
    console.error('PulsarBot seed failed:', e);
  }
  // (Pulsar GPT bot now runs out-of-process; no seed/probe here.)

  // Start webhook worker (bot webhooks delivery)
  startWebhookWorker().catch((err) => console.error('Webhook worker error:', err));
  console.log('Webhook worker started');

  // Start scheduled messages worker (delivers messages at their sendAt)
  startScheduledMessagesWorker();

  // Start premium subscription worker (auto-renew + expiry notifications)
  startSubscriptionWorker();

  // Start lottery worker (daily draws at 09:00 UTC)
  startLotteryWorker();

  // Start channel revenue worker (daily distributions at 10:00 UTC)
  startRevenueWorker();

  // Start treasury worker (closes expired proposals hourly)
  startTreasuryWorker();

  // Start desktop-relay-node worker (stale + daily payout)
  startNodesWorker();

  // Persistent admin-ws to relay container (Phase 1+ miner-storage)
  adminWs.start();
  startStorageChallengeWorker();

  // One-shot backfill: copy each UserKeyBundle into UserDevice so
  // existing single-keypair users immediately appear as one linked
  // device. No-op once every bundle has a matching device row.
  backfillDevicesFromBundles().catch((err) => {
    console.error('[devices-backfill] failed:', err);
  });

  // Auto-cancel P2P trades whose payment window expired (every 60s).
  startP2PWorker();

  // Hourly snapshot of effective PLS price for the chart sparkline.
  startPriceSnapshotWorker();

  // P2P merchant: hourly TRUSTED-tier sweep + daily expiry sweep.
  startMerchantWorker();

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received. Shutting down...`);
    await app.close();
    await disconnectDatabase();
    await redis.quit();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
