import { buildApp } from './app.js';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { redis } from './config/redis.js';
import { initSocketServer } from './socket/index.js';

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
