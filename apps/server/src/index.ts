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
    console.error('Failed to seed PulsarBot:', e);
  }

  // Start webhook worker (bot webhooks delivery)
  startWebhookWorker().catch((err) => console.error('Webhook worker error:', err));
  console.log('Webhook worker started');

  // Start scheduled messages worker (delivers messages at their sendAt)
  startScheduledMessagesWorker();

  // Start premium subscription worker (auto-renew + expiry notifications)
  startSubscriptionWorker();

  // Start lottery worker (daily draws at 09:00 UTC)
  startLotteryWorker();

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
