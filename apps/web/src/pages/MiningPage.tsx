import { Link } from 'react-router-dom';
import { Cpu, Wifi, HardDrive, Zap, Lock, Coins, ArrowLeft, Terminal, Download, Shield, MemoryStick, BatteryCharging } from 'lucide-react';
import { useI18n } from '../i18n';
import { HalvingCountdown } from '../components/economy/HalvingCountdown';
import { BurnedSupplyCard } from '../components/economy/BurnedSupplyCard';

/**
 * Public docs page for users who want to run a Pulsar relay node and
 * earn PLS. Static for now — when the desktop installer ships we'll
 * add a "Download for Windows" button at the top.
 */
export function MiningPage() {
  const { locale } = useI18n();
  const ru = locale === 'ru';
  const tx = (r: string, e: string) => (ru ? r : e);

  // What the desktop node ACTUALLY uses today. Realistic numbers — no
  // future-promises mixed in (those have a separate "Roadmap" block below).
  const resources = [
    {
      icon: Wifi,
      color: 'text-cyan-400',
      title: tx('Сеть', 'Network'),
      use: tx(
        'Постоянное исходящее WebSocket-соединение к pulsar-chat.fun (keep-alive ~50 байт каждые 30 сек). Когда веб-клиенты выбирают твою ноду как relay, через неё проходят WebRTC signaling-пакеты — ~5-30 КБ на handshake. После handshake-а сообщения летят P2P direct между браузерами, нода больше не участвует. Реальный трафик: единицы ГБ в месяц.',
        'Persistent outbound WebSocket to pulsar-chat.fun (keep-alive ~50 bytes every 30s). When web clients pick your node as relay, WebRTC signaling packets flow through it — ~5-30 KB per handshake. After handshake, messages go P2P direct between browsers — the node no longer participates. Real traffic: units of GB per month.',
      ),
      reward: tx('25 PLS / ГБ переданного трафика', '25 PLS / GB relayed'),
    },
    {
      icon: MemoryStick,
      color: 'text-violet-400',
      title: tx('Оперативная память', 'RAM'),
      use: tx(
        'WebView (Edge движок) занимает ~80-150 МБ — единоразово на UI приложения. Rust-runner — ещё ~10-20 МБ + несколько КБ на активную сессию. Итого ~100-200 МБ постоянно, меньше чем одна вкладка браузера.',
        'WebView (Edge engine) uses ~80-150 MB — one-shot for the app UI. The Rust runner adds ~10-20 MB + a few KB per active session. Total ~100-200 MB steady, less than one browser tab.',
      ),
      reward: tx('Косвенно через uptime', 'Indirectly via uptime'),
    },
    {
      icon: Cpu,
      color: 'text-emerald-400',
      title: tx('Процессор', 'CPU'),
      use: tx(
        'В idle-режиме ~0.1%. Кратковременные всплески <1% во время WebRTC-handshake-а. Без активных handshake-ов — практически 0%. Никакого PoW, никакого майнинга криптовалют.',
        'Idle ~0.1%. Brief spikes <1% during a WebRTC handshake. With no active handshakes — basically 0%. No PoW, no crypto mining.',
      ),
      reward: tx('Косвенно через uptime', 'Indirectly via uptime'),
    },
    {
      icon: HardDrive,
      color: 'text-blue-400',
      title: tx('Диск', 'Disk'),
      use: tx(
        'Бинарник приложения ~5 МБ. Файл конфига меньше 1 КБ. Сообщения и медиа НЕ кэшируются (это в планах — см. roadmap). Никаких файлов пользователей на диске.',
        'App binary ~5 MB. Config file <1 KB. Messages and media are NOT cached (planned — see roadmap). No user files stored locally.',
      ),
      reward: tx('—', '—'),
    },
    {
      icon: BatteryCharging,
      color: 'text-pink-400',
      title: tx('Батарея (на ноутбуках)', 'Battery (on laptops)'),
      use: tx(
        'Минимум. В основном idle + редкие IO-всплески. Влияет на расход батареи меньше чем подсветка экрана на 1 шаг.',
        'Minimal. Mostly idle + rare IO bursts. Affects battery less than one notch of screen brightness.',
      ),
      reward: tx('—', '—'),
    },
    {
      icon: Zap,
      color: 'text-amber-400',
      title: tx('Аптайм', 'Uptime'),
      use: tx(
        'Базовая ставка просто за то, что нода онлайн и держит туннель. Нужно минимум 24h непрерывной работы до первой выплаты (анти-фрод).',
        'Base rate just for being online and holding the tunnel. Requires 24h continuous uptime before the first payout (anti-fraud).',
      ),
      reward: tx('50 PLS / час онлайна', '50 PLS / hour online'),
    },
  ];

  // Privacy reassurance — what we explicitly DO NOT touch.
  const notUsed = [
    tx('Криптокошелёк / приватные ключи', 'Crypto wallet / private keys'),
    tx('Камера, микрофон, GPU', 'Camera, microphone, GPU'),
    tx('Браузерная история, личные файлы', 'Browser history, personal files'),
    tx('Фоновые сервисы Windows', 'Background Windows services'),
    tx('Входящие порты, кроме твоего ручного port forwarding', 'Inbound ports, except your manual port forwarding'),
    tx('Содержимое сообщений (E2E nacl-box, нода видит только зашифрованные блобы)', "Message contents (E2E nacl-box — node sees only encrypted blobs)"),
  ];

  // Current implementation has zero meaningful resource floor — even
  // a Raspberry Pi 3 handles it. Tiers describe future-state when
  // CDN-cache and Whisper-transcription land. Marked accordingly.
  const tiers = [
    {
      name: tx('Сейчас (signaling-only)', 'Now (signaling-only)'),
      ram: '~200 MB',
      disk: '~5 MB',
      bandwidth: tx('Любой', 'Any'),
      who: tx('Любой ПК / ноутбук / Raspberry Pi', 'Any PC / laptop / Raspberry Pi'),
      earn: tx('~1200 PLS/день за uptime', '~1200 PLS/day from uptime'),
    },
    {
      name: tx('+CDN-кэш (планы)', '+CDN cache (planned)'),
      ram: '1 GB',
      disk: '50 GB',
      bandwidth: tx('100 Мбит', '100 Mbps'),
      who: tx('Домашний ПК, мини-сервер', 'Home PC, mini server'),
      earn: tx('~2000 PLS/день', '~2000 PLS/day'),
    },
    {
      name: tx('+Whisper (планы)', '+Whisper (planned)'),
      ram: '4 GB',
      disk: '500 GB',
      bandwidth: tx('1 Гбит', '1 Gbps'),
      who: tx('Выделенный сервер, VPS', 'Dedicated server, VPS'),
      earn: tx('~2500 PLS/день (кап)', '~2500 PLS/day (cap)'),
    },
  ];

  return (
    <div className="bg-dark-900 text-white" style={{ height: '100dvh', overflowY: 'auto' }}>
      {/* Header */}
      <div className="border-b border-dark-600 bg-dark-800/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/" className="p-1.5 rounded-lg hover:bg-dark-600 text-gray-400">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-lg font-bold">{tx('Pulsar Mining', 'Pulsar Mining')}</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* Hero */}
        <section className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-primary-500">
            <Cpu size={32} className="text-white" />
          </div>
          <h2 className="text-3xl font-bold">
            {tx('Поддержи сеть — получай PLS', 'Support the network — earn PLS')}
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto">
            {tx(
              'Pulsar — децентрализованный мессенджер. Чем больше нод в сети, тем стабильнее работают P2P-звонки и тем дешевле для всех. За свой канал, диск и uptime — получаешь PLS.',
              'Pulsar is a decentralized messenger. More nodes = more reliable P2P calls and lower hosting costs for everyone. You contribute bandwidth, storage and uptime — earn PLS.',
            )}
          </p>
        </section>

        {/* Eligibility callout */}
        <section className="rounded-2xl border-2 border-amber-500/30 bg-amber-500/5 p-5 flex gap-4">
          <Lock size={24} className="text-amber-400 shrink-0 mt-1" />
          <div>
            <h3 className="font-bold text-amber-400 mb-1">
              {tx('Требование: верификация Level 3 (Elite)', 'Requirement: Level 3 (Elite) verification')}
            </h3>
            <p className="text-sm text-gray-400">
              {tx(
                'Регистрация ноды доступна только аккаунтам, купившим Elite-верификацию (25 000 PLS one-time). Это защищает программу от ботоферм — нечестный оператор сначала вкладывает 25k PLS, потом долго отбивает.',
                'Node registration requires Elite verification (25 000 PLS one-time). This blocks bot-farm sybil attacks — fraudulent operators must commit 25k PLS upfront and earn it back slowly.',
              )}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              {tx('Купить можно в Настройки → Профиль → Верификация.', 'Buy via Settings → Profile → Verification.')}
            </p>
          </div>
        </section>

        {/* Token health: halving countdown + burned supply */}
        <section className="grid sm:grid-cols-2 gap-3">
          <HalvingCountdown />
          <BurnedSupplyCard />
        </section>

        {/* What you contribute */}
        <section>
          <h3 className="text-xl font-bold mb-4">{tx('Что использует нода', 'What the node uses')}</h3>
          <div className="grid gap-3">
            {resources.map((r) => {
              const Icon = r.icon;
              return (
                <div key={r.title} className="rounded-xl border border-dark-500 bg-dark-800/50 p-4 flex gap-3">
                  <Icon size={24} className={`${r.color} shrink-0 mt-0.5`} />
                  <div className="flex-1">
                    <p className="font-semibold">{r.title}</p>
                    <p className="text-xs text-gray-400 mt-1">{r.use}</p>
                    <p className="text-xs font-mono text-amber-400 mt-2">+ {r.reward}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-500 mt-3">
            {tx(
              'Кап: 2500 PLS / нода / сутки. Заморозка: новые награды зачисляются на баланс через 24h после начисления (анти-фрод).',
              'Cap: 2500 PLS / node / day. Freeze: new rewards land on balance 24h after earning (anti-fraud).',
            )}
          </p>
        </section>

        {/* Privacy reassurance: what we DON'T touch */}
        <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
          <h3 className="text-lg font-bold text-emerald-400 mb-3 flex items-center gap-2">
            <Shield size={18} />
            {tx('Чего нода НЕ трогает', "What the node doesn't touch")}
          </h3>
          <ul className="space-y-2 text-sm">
            {notUsed.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-emerald-400 shrink-0">×</span>
                <span className="text-gray-300">{item}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-gray-500 mt-4">
            {tx(
              'Сервер видит только метаданные: nodeId + сколько байт переслал + сколько уникальных peer-pubkey-ев + uptime. Содержимое сообщений зашифровано E2E между браузерами — даже мы не можем прочитать.',
              'Server only sees metadata: nodeId + bytes relayed + unique peer pubkeys + uptime. Message contents are E2E-encrypted between browsers — even we can\'t read them.',
            )}
          </p>
        </section>

        {/* Tiers */}
        <section>
          <h3 className="text-xl font-bold mb-4">{tx('Уровни нод', 'Node tiers')}</h3>
          <div className="grid sm:grid-cols-3 gap-3">
            {tiers.map((tier) => (
              <div key={tier.name} className="rounded-xl border border-dark-500 bg-dark-800/50 p-4 space-y-2">
                <p className="text-lg font-bold">{tier.name}</p>
                <div className="text-xs text-gray-400 space-y-1">
                  <p>RAM: <span className="font-mono text-gray-300">{tier.ram}</span></p>
                  <p>{tx('Диск', 'Disk')}: <span className="font-mono text-gray-300">{tier.disk}</span></p>
                  <p>{tx('Канал', 'Bandwidth')}: <span className="font-mono text-gray-300">{tier.bandwidth}</span></p>
                </div>
                <p className="text-xs text-gray-500 pt-1 border-t border-dark-600">{tier.who}</p>
                <p className="text-sm font-mono text-amber-400">{tier.earn}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How to start */}
        <section>
          <h3 className="text-xl font-bold mb-4">{tx('Как запустить', 'How to start')}</h3>
          <ol className="space-y-3">
            <Step n={1} title={tx('Купи Elite-верификацию', 'Buy Elite verification')}>
              {tx('Настройки → Профиль → Верификация → Level 3 (25 000 PLS)', 'Settings → Profile → Verification → Level 3 (25 000 PLS)')}
            </Step>
            <Step n={2} title={tx('Зарегистрируй ноду', 'Register a node')}>
              {tx(
                'Настройки → Ноды → "Зарегистрировать ноду". Получишь Node ID и одноразовый токен — сохрани, больше не покажу.',
                'Settings → Nodes → "Register a node". You\'ll get a Node ID and one-time token — save it, won\'t show again.',
              )}
            </Step>
            <Step n={3} title={tx('Запусти runner', 'Run the runner')}>
              <p className="text-xs text-gray-400 mb-2">
                {tx('Самый простой способ — через npm (нужен Node.js 20+):', 'Easiest way — via npm (needs Node.js 20+):')}
              </p>
              <pre className="bg-dark-900 border border-dark-600 rounded-lg p-3 text-[11px] text-gray-300 overflow-x-auto mb-3">
{`npx @pulsar-chat/relay-runner \\
  --node-id=<твой-node-id> \\
  --token=<твой-токен>`}
              </pre>
              <p className="text-xs text-gray-400 mb-2">
                {tx('Или через Docker:', 'Or via Docker:')}
              </p>
              <pre className="bg-dark-900 border border-dark-600 rounded-lg p-3 text-[11px] text-gray-300 overflow-x-auto">
{`docker run -d --restart unless-stopped \\
  -p 3030:3030 \\
  -e PULSAR_NODE_ID=<id> \\
  -e PULSAR_NODE_TOKEN=<token> \\
  ghcr.io/smool-g/pulsar-relay:latest`}
              </pre>
              <p className="text-[10px] text-gray-500 mt-2">
                {tx(
                  'systemd / pm2 / Windows Service — примеры в README пакета.',
                  'systemd / pm2 / Windows Service — examples in the package README.',
                )}{' '}
                <a href="https://www.npmjs.com/package/@pulsar-chat/relay-runner" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">
                  npmjs.com/package/@pulsar-chat/relay-runner
                </a>
              </p>
            </Step>
            <Step n={4} title={tx('Открой порт 3030 (если хочешь публичную ноду)', 'Open port 3030 (for public nodes)')}>
              {tx(
                'Если хочешь чтобы твоя нода обслуживала чужих юзеров (за награды) — порт должен быть доступен из интернета. Настрой port-forward на роутере или используй Cloudflare Tunnel.',
                'For your node to serve other users (and earn), port must be reachable. Set up port-forward on your router or use Cloudflare Tunnel.',
              )}
            </Step>
            <Step n={5} title={tx('Жди 24 часа', 'Wait 24 hours')}>
              {tx(
                'После 24h непрерывного uptime начнут начисляться награды. На балансе они появляются через ещё 24h (анти-фрод заморозка).',
                'After 24h continuous uptime, rewards start accruing. They land on your balance after another 24h (anti-fraud freeze).',
              )}
            </Step>
          </ol>
        </section>

        {/* Desktop app */}
        <section className="rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-primary-500/5 p-5 space-y-3">
          <div className="flex items-center justify-center gap-2">
            <Download size={28} className="text-cyan-400" />
            <h3 className="text-lg font-bold">{tx('Pulsar Desktop', 'Pulsar Desktop')}</h3>
          </div>
          <p className="text-sm text-gray-400 text-center">
            {tx(
              'Нативное приложение Windows / Linux: рантайм-бинарник без Node.js + Docker, системный трей, автозапуск, локальная статистика. Установил — забыл, PLS капают.',
              'Native Windows / Linux app: runtime binary without Node.js + Docker, system tray, autostart, local stats. Install once and forget — PLS just drip in.',
            )}
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            <Link
              to="/download"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-semibold"
            >
              <Download size={14} />
              {tx('Скачать (Windows / Linux)', 'Download (Windows / Linux)')}
            </Link>
            <a
              href="https://github.com/SmooL-G/pulsar-node"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10 text-sm font-medium"
            >
              {tx('Исходники', 'Source')}
            </a>
          </div>
          <p className="text-[10px] text-gray-500 text-center">
            {tx(
              'Windows: NSIS-инсталлер + MSI. Linux: .deb пакет. macOS — план.',
              'Windows: NSIS installer + MSI. Linux: .deb package. macOS — planned.',
            )}
          </p>
        </section>

        {/* Earnings link */}
        <section className="rounded-2xl border border-dark-500 bg-dark-800/50 p-5 flex items-center gap-4">
          <Coins size={24} className="text-amber-400" />
          <div className="flex-1">
            <p className="font-semibold">{tx('Уже зарегистрировал ноду?', 'Already registered?')}</p>
            <p className="text-xs text-gray-400">{tx('Открой настройки чтобы увидеть статы и награды.', 'Open settings to see stats and rewards.')}</p>
          </div>
          <Link to="/?settings=nodes" className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-black text-sm font-medium">
            {tx('Открыть', 'Open')}
          </Link>
        </section>

        <p className="text-center text-xs text-gray-600 pt-4">
          {tx('Вопросы — пиши в @pulsar_support.', 'Questions — message @pulsar_support.')}
        </p>
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <div className="shrink-0 w-8 h-8 rounded-full bg-primary-500/20 text-primary-400 font-bold flex items-center justify-center text-sm">
        {n}
      </div>
      <div className="flex-1 pt-1">
        <p className="font-semibold mb-1">{title}</p>
        <div className="text-sm text-gray-400">{children}</div>
      </div>
    </li>
  );
}
