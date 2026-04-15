import { cleanEnv, str, port, num } from 'envalid';

export const env = cleanEnv(process.env, {
  NODE_ENV: str({ choices: ['development', 'production', 'test'], default: 'development' }),
  PORT: port({ default: 3001 }),
  HOST: str({ default: '0.0.0.0' }),

  DATABASE_URL: str(),
  REDIS_URL: str(),

  JWT_SECRET: str(),
  JWT_REFRESH_SECRET: str(),

  S3_ENDPOINT: str(),
  S3_ACCESS_KEY: str(),
  S3_SECRET_KEY: str(),
  S3_BUCKET: str({ default: 'pulsar-files' }),
  S3_REGION: str({ default: 'us-east-1' }),
  S3_PUBLIC_URL: str({ default: '' }),

  SOLANA_RPC_URL: str({ default: 'https://api.devnet.solana.com' }),
  SOLANA_NETWORK: str({ choices: ['devnet', 'mainnet-beta', 'testnet'], default: 'devnet' }),

  CORS_ORIGIN: str({ default: 'http://localhost:5173' }),

  PLATFORM_WALLET_ADDRESS: str({ default: '' }),

  HELIUS_API_KEY: str({ default: '' }),
  HELIUS_RPC_URL: str({ default: '' }),

  SMTP_HOST: str({ default: '' }),
  SMTP_PORT: num({ default: 587 }),
  SMTP_USER: str({ default: '' }),
  SMTP_PASS: str({ default: '' }),
  SMTP_FROM: str({ default: 'noreply@pulsar.chat' }),

  // Web Push (VAPID). Generate via: npx web-push generate-vapid-keys
  VAPID_PUBLIC_KEY: str({ default: '' }),
  VAPID_PRIVATE_KEY: str({ default: '' }),
  VAPID_SUBJECT: str({ default: 'mailto:support@pulsar-chat.fun' }),
});
