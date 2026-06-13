import { cleanEnv, str, port, num, bool } from 'envalid';

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
  SMTP_FROM: str({ default: 'noreply@pulsar-chat.fun' }),

  // Web Push (VAPID). Generate via: npx web-push generate-vapid-keys
  VAPID_PUBLIC_KEY: str({ default: '' }),
  VAPID_PRIVATE_KEY: str({ default: '' }),
  VAPID_SUBJECT: str({ default: 'mailto:support@pulsar-chat.fun' }),

  // YooKassa (RUB top-ups for PLS via card)
  YOOKASSA_SHOP_ID: str({ default: '' }),
  YOOKASSA_SECRET_KEY: str({ default: '' }),

  // PLS price quoted in USD. Used by /api/v1/price for the in-app
  // informer cards. Currently a fixed presale value; swap to a DEX
  // fetch once PLS lists.
  PLS_USD_RATE: str({ default: '0.001' }),

  // OpenAI (Whisper for voice message transcription — Premium feature)
  // OPENAI_API_KEY is no longer used directly: jino is geo-blocked by
  // OpenAI, so we proxy through a relay running on a non-RU VPS.
  OPENAI_API_KEY: str({ default: '' }),
  WHISPER_RELAY_URL: str({ default: '' }),
  WHISPER_RELAY_TOKEN: str({ default: '' }),

  // KIE.AI — multi-model AI marketplace powering Pulsar GPT bot.
  // Two distinct base URLs: one OpenAI-compatible chat endpoint,
  // one async-task endpoint for image/video/audio generation.
  // When AI_RELAY_URL is set, KIE_API_BASE_TASKS should point at the
  // relay instead of api.kie.ai directly — the relay forwards from a
  // non-RU IP so we avoid geo-flakiness from jino.
  KIE_API_KEY: str({ default: '' }),
  KIE_API_BASE_TASKS: str({ default: 'https://api.kie.ai/api/v1' }),
  KIE_API_BASE_CHAT: str({ default: 'https://kieai.erweima.ai/api/v1' }),

  // Pulsar AI relay — proxies OpenAI (DALL-E) + KIE through a non-RU
  // VPS. AI_RELAY_URL is the base URL (e.g. http://92.51.37.201:8080),
  // AI_RELAY_TOKEN is the shared secret matching the relay's
  // PULSAR_RELAY_TOKEN env. When AI_RELAY_TOKEN is set, the kie client
  // adds an X-Relay-Token header to every request so the relay accepts
  // it; when empty the requests go raw (useful for direct-mode testing).
  AI_RELAY_URL: str({ default: '' }),
  AI_RELAY_TOKEN: str({ default: '' }),

  // Fake-activity ("growth illusion") feature flag + tuning. When
  // ENABLED, boot seeds N fake users with realistic profiles +
  // P2P offers; a worker rotates their online status, periodically
  // adds new fakes, and auto-dissolves them as real users grow.
  // Default OFF — must be set explicitly per environment.
  FAKE_ACTIVITY_ENABLED: bool({ default: false }),
  // Peak number of fake users when real-active is at THRESHOLD.
  FAKE_ACTIVITY_BASE: num({ default: 2500 }),
  // Real-active user count at which dissolution begins. Each real
  // user above this point removes ~one fake from the target until 0.
  // Scaled with BASE: 500 real → fakes start dropping, 3000 real → 0.
  FAKE_ACTIVITY_THRESHOLD: num({ default: 500 }),
  // Currently informative — actual rotation uses personality-based
  // schedule in fakeActivity.worker (high baseline so online count
  // hugs the total user count with natural per-tick fluctuation).
  FAKE_ACTIVITY_ONLINE_PCT: num({ default: 90 }),
});
