import { Link } from 'react-router-dom';
import { Cpu, Wifi, HardDrive, Zap, Lock, Coins, ArrowLeft, Terminal, Download } from 'lucide-react';
import { useI18n } from '../i18n';

/**
 * Public docs page for users who want to run a Pulsar relay node and
 * earn PLS. Static for now — when the desktop installer ships we'll
 * add a "Download for Windows" button at the top.
 */
export function MiningPage() {
  const { locale } = useI18n();
  const ru = locale === 'ru';
  const tx = (r: string, e: string) => (ru ? r : e);

  const resources = [
    {
      icon: Wifi,
      color: 'text-cyan-400',
      title: tx('Канал интернета (TURN-relay)', 'Internet bandwidth (TURN-relay)'),
      use: tx(
        'Когда у двух пользователей не получается прямое соединение (симметричный NAT — частая проблема мобильных операторов), их трафик идёт через твою ноду. ~50-500 KB/s на одну активную сессию.',
        'When two users can\'t connect directly (symmetric NAT — common on mobile carriers), their traffic flows through your node. ~50-500 KB/s per active session.',
      ),
      reward: tx('25 PLS / GB переданного трафика', '25 PLS / GB relayed'),
    },
    {
      icon: HardDrive,
      color: 'text-violet-400',
      title: tx('Жёсткий диск (CDN-кэш)', 'Disk space (CDN cache)'),
      use: tx(
        'Кэшируешь популярные файлы (аватары, картинки, голосовые) и раздаёшь ближайшим юзерам — экономишь нагрузку на главный сервер. ~50-500 GB.',
        'Cache popular files (avatars, images, voice messages) and serve them to nearby users — reduces load on the main server. ~50-500 GB.',
      ),
      reward: tx('10 PLS / GB отданного трафика', '10 PLS / GB served from cache'),
    },
    {
      icon: Cpu,
      color: 'text-emerald-400',
      title: tx('Процессор (Whisper-транскрипция)', 'CPU (Whisper transcription)'),
      use: tx(
        'Распознавание голосовых сообщений в текст. Фича работает на whisper-cpp, нужно 2 свободных ядра. Опционально.',
        'Speech-to-text for voice messages. Runs whisper-cpp, needs 2 idle cores. Optional.',
      ),
      reward: tx('2 PLS / минута транскрипции', '2 PLS / minute transcribed'),
    },
    {
      icon: Zap,
      color: 'text-amber-400',
      title: tx('Аптайм', 'Uptime'),
      use: tx(
        'Базовая ставка просто за то, что нода онлайн и принимает соединения. Нужен минимум 24h непрерывного uptime для первой выплаты.',
        'Base rate just for being online and accepting connections. Requires 24h continuous uptime for first payout.',
      ),
      reward: tx('50 PLS / час онлайна', '50 PLS / hour online'),
    },
  ];

  const tiers = [
    {
      name: 'Lite',
      ram: '256 MB',
      disk: '1 GB',
      bandwidth: tx('10 Мбит', '10 Mbps'),
      who: tx('Старый ноутбук, raspberry pi', 'Old laptop, Raspberry Pi'),
      earn: tx('~500-1000 PLS/день', '~500-1000 PLS/day'),
    },
    {
      name: 'Standard',
      ram: '1 GB',
      disk: '50 GB',
      bandwidth: tx('100 Мбит', '100 Mbps'),
      who: tx('Домашний ПК, мини-сервер', 'Home PC, mini server'),
      earn: tx('~1500-2000 PLS/день', '~1500-2000 PLS/day'),
    },
    {
      name: 'Pro',
      ram: '4 GB',
      disk: '500 GB',
      bandwidth: tx('1 Гбит', '1 Gbps'),
      who: tx('Выделенный сервер, VPS', 'Dedicated server, VPS'),
      earn: tx('~2500 PLS/день (макс)', '~2500 PLS/day (cap)'),
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
            <Step n={3} title={tx('Запусти Docker-контейнер', 'Run the Docker container')}>
              <p className="text-xs text-gray-400 mb-2">
                {tx('Пока десктоп-инсталлер не готов, запускай через Docker:', 'Until the desktop installer ships, run via Docker:')}
              </p>
              <pre className="bg-dark-900 border border-dark-600 rounded-lg p-3 text-[11px] text-gray-300 overflow-x-auto">
{`docker run -d --restart unless-stopped \\
  -p 3030:3030 \\
  -e PULSAR_NODE_ID=<твой-node-id> \\
  -e PULSAR_NODE_TOKEN=<твой-токен> \\
  -e PULSAR_API_URL=https://pulsar-chat.fun \\
  ghcr.io/smool-g/pulsar-relay:latest`}
              </pre>
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

        {/* Desktop coming */}
        <section className="rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-primary-500/5 p-5 text-center space-y-2">
          <Download size={28} className="mx-auto text-cyan-400" />
          <h3 className="text-lg font-bold">{tx('Десктоп-приложение для Windows', 'Windows desktop app')}</h3>
          <p className="text-sm text-gray-400">
            {tx(
              'Будет в разработке: Tauri-инсталлер с автозапуском, треем, статистикой в реальном времени, графиком заработка. Не нужно знать Docker.',
              'In development: Tauri installer with auto-start, system tray, live stats, earnings chart. No Docker required.',
            )}
          </p>
          <p className="text-xs text-gray-500">
            {tx('Подпишись на @pulsar_official чтобы узнать когда выйдет.', 'Follow @pulsar_official for release notice.')}
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
