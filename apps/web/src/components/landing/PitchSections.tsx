import { Link } from 'react-router-dom';
import {
  Cpu, Lock, ArrowLeftRight, Rocket, ChevronRight,
} from 'lucide-react';
import { useI18n } from '../../i18n';

/**
 * Marketing pitch sections, reused by:
 *   - LoginPage (compact 3-tile + token tease, below the auth card)
 *   - FeaturesPage (deep content, same audience split)
 *
 * Three audiences are addressed in parallel:
 *   - 🌐 Miners (node operators) — earn PLS, make network un-killable
 *   - 🔒 Users (everyday messaging) — E2E + Solana-signed + P2P
 *   - 💱 Traders (P2P exchange) — global, cheap, escrow, 24/7
 *
 * Plus a "token will list" tease so early users understand the
 * accumulation play and why activity now = upside later.
 */

interface Audience {
  icon: typeof Cpu;
  iconColor: string;
  cardGradient: string;
  borderColor: string;
  ru: { tag: string; title: string; tagline: string; bullets: string[] };
  en: { tag: string; title: string; tagline: string; bullets: string[] };
}

const AUDIENCES: Audience[] = [
  {
    icon: Cpu,
    iconColor: 'text-emerald-400',
    cardGradient: 'from-emerald-500/15 via-teal-500/8 to-emerald-700/5',
    borderColor: 'border-emerald-500/30 hover:border-emerald-400/60',
    ru: {
      tag: 'Майнерам',
      title: 'Стань частью сети',
      tagline: 'Твой ноутбук = зарплата + неубиваемость Pulsar.',
      bullets: [
        'Запусти Pulsar Desktop — становишься нодой в P2P-сети',
        'Каждый день в онлайне = PLS на кошелёк, пассивно',
        'Больше нод = сильнее цензуроустойчивость. Pulsar нельзя выключить рубильником',
        'Не пустой майнинг — твоя нода реально гоняет трафик пользователей',
      ],
    },
    en: {
      tag: 'For Miners',
      title: 'Become part of the network',
      tagline: 'Your laptop = paycheck + Pulsar resilience.',
      bullets: [
        'Run Pulsar Desktop — your machine becomes a node in the P2P network',
        'Every day online = PLS to your wallet, passively',
        'More nodes = stronger censorship-resistance. No kill switch',
        'Not idle mining — your node actually relays user traffic',
      ],
    },
  },
  {
    icon: Lock,
    iconColor: 'text-cyan-400',
    cardGradient: 'from-cyan-500/15 via-blue-500/8 to-blue-700/5',
    borderColor: 'border-cyan-500/30 hover:border-cyan-400/60',
    ru: {
      tag: 'Пользователям',
      title: 'Общайся без оглядки',
      tagline: 'Мессенджер где даже мы не видим ваших сообщений.',
      bullets: [
        'E2E-шифрование nacl-box — расшифровать может только адресат',
        'Каждое сообщение подписано Solana-кошельком — подделать невозможно',
        'DM по WebRTC идут direct, минуя сервер (P2P)',
        'Без телефона, email, паспорта — только кошелёк',
      ],
    },
    en: {
      tag: 'For Users',
      title: 'Talk without watching your back',
      tagline: 'A messenger where even we can\'t read your messages.',
      bullets: [
        'nacl-box E2E encryption — only the recipient can decrypt',
        'Every message signed with your Solana wallet — impossible to forge',
        'WebRTC P2P DMs — messages go direct, bypassing the server',
        'No phone, email, or ID — wallet-only signup',
      ],
    },
  },
  {
    icon: ArrowLeftRight,
    iconColor: 'text-purple-400',
    cardGradient: 'from-purple-500/15 via-pink-500/8 to-pink-700/5',
    borderColor: 'border-purple-500/30 hover:border-purple-400/60',
    ru: {
      tag: 'Торговцам',
      title: 'P2P без границ',
      tagline: 'Шли деньги в любую точку мира за копейки.',
      bullets: [
        'Solana под капотом — транзакции мгновенные и стоят ~$0.0001',
        'Меняй USDT/SOL/PLS на рубли, евро, тенге, гривны через локальных мерчантов',
        '24/7 — биржа не закрывается, банковские часы нерелевантны',
        'Smart-escrow + onchain-репутация мерчанта. Нельзя подделать',
      ],
    },
    en: {
      tag: 'For Traders',
      title: 'P2P without borders',
      tagline: 'Move money anywhere in the world for pennies.',
      bullets: [
        'Powered by Solana — instant transfers at ~$0.0001 fee',
        'Swap USDT/SOL/PLS into RUB/EUR/UAH/etc via local merchants',
        '24/7 — markets never close, banking hours are irrelevant',
        'Smart-escrow + on-chain merchant reputation. Can\'t be faked',
      ],
    },
  },
];

interface AudienceTilesProps {
  /** When true, show the "Узнать больше" link to /features at the bottom. */
  showFeaturesLink?: boolean;
  /** Use compact bullet count (2 instead of 4) — for the landing intro. */
  compact?: boolean;
}

export function AudienceTiles({ showFeaturesLink = true, compact = false }: AudienceTilesProps) {
  const { locale } = useI18n();
  const ru = locale === 'ru';
  return (
    <section className="w-full max-w-6xl mx-auto px-4 py-12">
      <div className="text-center mb-10">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
          {ru ? 'Кому Pulsar подойдёт' : 'Who Pulsar is for'}
        </h2>
        <p className="text-gray-400 text-sm md:text-base max-w-2xl mx-auto">
          {ru
            ? 'Три разных пути использования — одна экосистема. Каждый получает своё.'
            : 'Three different ways to use it — one ecosystem. Each gets their own value.'}
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {AUDIENCES.map((a) => {
          const copy = ru ? a.ru : a.en;
          const bullets = compact ? copy.bullets.slice(0, 2) : copy.bullets;
          const Icon = a.icon;
          return (
            <div
              key={copy.tag}
              className={`relative rounded-2xl p-5 border bg-gradient-to-br ${a.cardGradient} ${a.borderColor} transition-all hover:shadow-xl hover:-translate-y-0.5`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center ${a.iconColor}`}>
                  <Icon size={20} />
                </div>
                <div>
                  <div className={`text-[10px] uppercase tracking-wider font-bold ${a.iconColor}`}>{copy.tag}</div>
                  <h3 className="text-base font-bold text-white leading-tight">{copy.title}</h3>
                </div>
              </div>
              <p className="text-sm text-gray-300 mb-3 font-medium">{copy.tagline}</p>
              <ul className="space-y-1.5">
                {bullets.map((b, i) => (
                  <li key={i} className="text-xs text-gray-400 leading-relaxed flex items-start gap-2">
                    <span className={`shrink-0 mt-1 w-1 h-1 rounded-full ${a.iconColor.replace('text-', 'bg-')}`} />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      {showFeaturesLink && (
        <div className="text-center mt-6">
          <Link
            to="/features"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary-400 hover:text-primary-300 transition-colors"
          >
            {ru ? 'Подробнее о возможностях' : 'See all features'}
            <ChevronRight size={14} />
          </Link>
        </div>
      )}
    </section>
  );
}

// ─── Token strategy tease ──────────────────────────────────────────

export function TokenTease({ deep = false }: { deep?: boolean }) {
  const { locale } = useI18n();
  const ru = locale === 'ru';
  return (
    <section className="w-full max-w-6xl mx-auto px-4 py-12">
      <div className="relative overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-yellow-500/5 p-6 md:p-10">
        {/* Decorative glow */}
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-72 h-72 bg-orange-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Rocket size={22} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider font-bold text-amber-400">
                {ru ? 'Стратегия PLS' : 'PLS Strategy'}
              </div>
              <h3 className="text-xl md:text-2xl font-bold text-white">
                {ru ? 'Сейчас копишь — потом продаёшь' : 'Stack now, sell later'}
              </h3>
            </div>
          </div>

          <p className="text-sm md:text-base text-gray-200 leading-relaxed mb-5 max-w-3xl">
            {ru
              ? 'PLS сейчас живёт внутри Pulsar. Каждый твой день в сети — это накопление: майнеры получают за uptime, юзеры — за активность и рефералов, мерчанты — за объём P2P-сделок.'
              : 'PLS lives inside Pulsar today. Every day you spend on the network builds your stack: miners earn for uptime, users for activity and referrals, merchants for trade volume.'}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
            {(ru
              ? [
                  { emoji: '💎', label: 'Майнеры', desc: 'PLS за uptime нод' },
                  { emoji: '💬', label: 'Юзеры',    desc: 'PLS за активность и рефералов' },
                  { emoji: '🛒', label: 'Мерчанты', desc: 'Кэшбэк PLS за объём' },
                ]
              : [
                  { emoji: '💎', label: 'Miners',    desc: 'PLS for node uptime' },
                  { emoji: '💬', label: 'Users',     desc: 'PLS for activity & referrals' },
                  { emoji: '🛒', label: 'Merchants', desc: 'PLS cashback on volume' },
                ]
            ).map((row) => (
              <div key={row.label} className="bg-black/20 rounded-xl px-3 py-2.5 border border-white/5">
                <div className="text-base">{row.emoji} <span className="font-bold text-white text-sm">{row.label}</span></div>
                <div className="text-[11px] text-gray-400 mt-0.5">{row.desc}</div>
              </div>
            ))}
          </div>

          <div className="bg-black/30 rounded-2xl p-4 border border-amber-500/20">
            <p className="text-sm md:text-base text-white font-medium mb-2">
              {ru
                ? '🚀 Когда аудитория наберёт критическую массу — PLS выходит на DEX (Raydium, Jupiter) и крупные CEX.'
                : '🚀 When the user base hits critical mass, PLS lists on DEXes (Raydium, Jupiter) and major CEXes.'}
            </p>
            <p className="text-xs md:text-sm text-gray-300 leading-relaxed">
              {ru
                ? 'Накопленные сейчас токены становятся торгуемыми. Те кто в Pulsar на старте — оказываются в начале кривой. Чем раньше вошёл — тем дешевле точка входа.'
                : 'All accumulated tokens become tradeable. Early users are positioned at the start of the curve. The sooner you join, the lower your entry.'}
            </p>
          </div>

          {deep && (
            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-gray-300">
              <div className="bg-black/20 rounded-xl p-3 border border-white/5">
                <div className="font-bold text-amber-300 mb-1">
                  {ru ? '🔥 Burn-механика' : '🔥 Burn mechanics'}
                </div>
                <div>
                  {ru
                    ? '10% от каждого внутреннего платежа в PLS сжигается. Total Supply постоянно сокращается.'
                    : '10% of every in-app PLS payment is burned. Total supply shrinks continuously.'}
                </div>
              </div>
              <div className="bg-black/20 rounded-xl p-3 border border-white/5">
                <div className="font-bold text-amber-300 mb-1">
                  {ru ? '⛓ Solana SPL' : '⛓ Solana SPL'}
                </div>
                <div>
                  {ru
                    ? 'PLS — стандартный SPL-токен. После листинга работает в любом Solana-кошельке (Phantom, Solflare).'
                    : 'PLS is a standard SPL token. After listing, works in any Solana wallet (Phantom, Solflare).'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
