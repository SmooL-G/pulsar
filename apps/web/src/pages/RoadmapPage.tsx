import { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Loader2, Clock, Sparkles, Shield, Gem, Crown, Search, MessageCircle, Globe, Megaphone, Bot, Zap } from 'lucide-react';
import { useI18n } from '../i18n';

type Status = 'done' | 'active' | 'planned';

interface Feature {
  text: Record<string, string>;
  status: Status;
  icon?: React.ReactNode;
}

interface Phase {
  title: Record<string, string>;
  subtitle: Record<string, string>;
  status: Status;
  date: string;
  features: Feature[];
  highlight?: boolean;
}

const T = (texts: Record<string, string>, lang: string) => texts[lang] || texts.en;

const PHASES: Phase[] = [
  {
    title: { en: 'Foundation', ru: 'Основа' },
    subtitle: { en: 'Core messaging platform', ru: 'Ядро мессенджера' },
    status: 'done', date: 'Q1 2026',
    features: [
      { text: { en: 'Real-time messaging (Socket.IO)', ru: 'Сообщения в реальном времени (Socket.IO)' }, status: 'done' },
      { text: { en: 'Direct & group chats', ru: 'Личные и групповые чаты' }, status: 'done' },
      { text: { en: 'User authentication (email + wallet)', ru: 'Авторизация (email + кошелёк)' }, status: 'done' },
      { text: { en: 'File & photo sharing (Cloudflare R2)', ru: 'Обмен файлами и фото (Cloudflare R2)' }, status: 'done' },
      { text: { en: 'Online presence & typing indicators', ru: 'Онлайн-статус и индикатор набора' }, status: 'done' },
      { text: { en: 'Large emoji display (1-3 emoji without bubble)', ru: 'Увеличенные эмодзи (1-3 без фона)' }, status: 'done' },
      { text: { en: 'Message editing, deletion, forwarding', ru: 'Редактирование, удаление, пересылка' }, status: 'done' },
      { text: { en: 'Link previews', ru: 'Превью ссылок' }, status: 'done' },
      { text: { en: 'Friends system', ru: 'Система друзей' }, status: 'done' },
    ],
  },
  {
    title: { en: 'Social Features', ru: 'Социальные функции' },
    subtitle: { en: 'Community & engagement', ru: 'Сообщество и вовлечение' },
    status: 'done', date: 'Q1 2026',
    features: [
      { text: { en: 'Emoji reactions on messages', ru: 'Реакции эмодзи на сообщения' }, status: 'done' },
      { text: { en: 'Pinned messages', ru: 'Закреплённые сообщения' }, status: 'done' },
      { text: { en: 'Channels with comments system', ru: 'Каналы с системой комментариев' }, status: 'done', icon: <Megaphone size={14} /> },
      { text: { en: 'Universal search (users, groups, channels, messages)', ru: 'Универсальный поиск (пользователи, группы, каналы, сообщения)' }, status: 'done', icon: <Search size={14} /> },
      { text: { en: 'Message search with highlight & scroll-to', ru: 'Поиск по сообщениям с подсветкой' }, status: 'done' },
      { text: { en: 'Internationalization (11 languages)', ru: 'Мультиязычность (11 языков)' }, status: 'done', icon: <Globe size={14} /> },
      { text: { en: 'Dark/light themes', ru: 'Тёмная/светлая темы' }, status: 'done' },
      { text: { en: 'Legal pages (Terms, Privacy, Cookies)', ru: 'Юридические страницы' }, status: 'done' },
      { text: { en: 'Shared media & documents panel', ru: 'Панель общих медиа и документов' }, status: 'done' },
      { text: { en: 'Avatar preview modal (fullscreen)', ru: 'Просмотр аватара в полный экран' }, status: 'done' },
      { text: { en: 'Floating message input with shadow', ru: 'Плавающее поле ввода с тенью' }, status: 'done' },
    ],
  },
  {
    title: { en: 'Crypto Integration', ru: 'Крипто-интеграция' },
    subtitle: { en: 'Web3 & Solana ecosystem', ru: 'Web3 и экосистема Solana' },
    status: 'done', date: 'Q1 2026',
    features: [
      { text: { en: 'Solana wallet authentication', ru: 'Авторизация через Solana кошелёк' }, status: 'done' },
      { text: { en: 'PLS token economy (1 SOL = 100K PLS)', ru: 'Экономика PLS (1 SOL = 100K PLS)' }, status: 'done' },
      { text: { en: 'SOL → PLS deposits (on-chain verified)', ru: 'Депозиты SOL → PLS (проверка на блокчейне)' }, status: 'done' },
      { text: { en: 'P2P transfers with 2% burn fee', ru: 'P2P переводы с 2% сжиганием' }, status: 'done' },
      { text: { en: 'E2E encryption (NaCl)', ru: 'Сквозное шифрование (NaCl)' }, status: 'done', icon: <Shield size={14} /> },
      { text: { en: 'Message signing with Solana wallet', ru: 'Подпись сообщений кошельком Solana' }, status: 'done' },
      { text: { en: 'NFT avatar verification', ru: 'Верификация NFT-аватаров' }, status: 'done' },
      { text: { en: 'Generative avatars', ru: 'Генеративные аватары' }, status: 'done' },
    ],
  },
  {
    title: { en: 'Monetization & Status', ru: 'Монетизация и статус' },
    subtitle: { en: 'Token-powered features', ru: 'Функции на основе токенов' },
    status: 'active', date: 'Q2 2026', highlight: true,
    features: [
      { text: { en: 'Verification levels (Starter/Pro/Elite)', ru: 'Уровни верификации (Starter/Pro/Elite)' }, status: 'done', icon: <Sparkles size={14} /> },
      { text: { en: 'Profile badges (Blogger/Author/Business)', ru: 'Бейджи профиля (Блогер/Автор/Бизнес)' }, status: 'done' },
      { text: { en: 'Founder badge for platform creator', ru: 'Значок основателя платформы' }, status: 'done', icon: <Crown size={14} /> },
      { text: { en: 'SuperChat — donate PLS with highlighted messages', ru: 'SuperChat — донат PLS с выделением сообщений' }, status: 'done', icon: <Gem size={14} /> },
      { text: { en: 'File size limits by verification level', ru: 'Лимиты файлов по уровню верификации' }, status: 'done' },
      { text: { en: 'Channel creation limits by level', ru: 'Лимиты каналов по уровню' }, status: 'done' },
      { text: { en: 'Premium subscription (PLS/month)', ru: 'Премиум подписка (PLS/мес)' }, status: 'planned' },
      { text: { en: 'Sticker marketplace (create & sell)', ru: 'Маркетплейс стикеров' }, status: 'planned' },
      { text: { en: 'Channel boost system', ru: 'Система бустов каналов' }, status: 'planned' },
      { text: { en: 'Custom nick colors & profile frames', ru: 'Кастомные цвета ников и рамки' }, status: 'planned' },
    ],
  },
  {
    title: { en: 'Moderation & Safety', ru: 'Модерация и безопасность' },
    subtitle: { en: 'Trust & community health', ru: 'Доверие и здоровье сообщества' },
    status: 'active', date: 'Q2 2026',
    features: [
      { text: { en: 'Report system (spam, harassment, etc.)', ru: 'Система жалоб (спам, оскорбления и т.д.)' }, status: 'done' },
      { text: { en: 'Moderator voting on reports', ru: 'Голосование модераторов по жалобам' }, status: 'done' },
      { text: { en: 'Punishments (warn, mute, ban)', ru: 'Наказания (предупреждение, мут, бан)' }, status: 'done' },
      { text: { en: 'Bot system (PulsarBot + webhook API)', ru: 'Система ботов (PulsarBot + webhook API)' }, status: 'done', icon: <Bot size={14} /> },
      { text: { en: 'Official Bot SDKs (npm + PyPI)', ru: 'Официальные SDK для ботов (npm + PyPI)' }, status: 'done', icon: <Bot size={14} /> },
      { text: { en: 'Inline buttons + callback queries', ru: 'Inline-кнопки + callback queries' }, status: 'done', icon: <Bot size={14} /> },
      { text: { en: 'Auto-moderator role (earn by contribution)', ru: 'Авто-модератор (заслуги за активность)' }, status: 'done', icon: <Shield size={14} /> },
      { text: { en: 'Moderator progress tracker (5 requirements)', ru: 'Трекер прогресса модератора (5 условий)' }, status: 'done' },
      { text: { en: 'AI-powered content moderation', ru: 'ИИ-модерация контента' }, status: 'planned' },
    ],
  },
  {
    title: { en: 'Infrastructure', ru: 'Инфраструктура' },
    subtitle: { en: 'Reliability & scale', ru: 'Надёжность и масштаб' },
    status: 'active', date: 'Q2 2026',
    features: [
      { text: { en: 'Multi-server architecture (separate DB & app)', ru: 'Мульти-серверная архитектура (БД отдельно)' }, status: 'done' },
      { text: { en: 'Socket.IO Redis Adapter (multi-instance ready)', ru: 'Socket.IO Redis Adapter (готово к масштабированию)' }, status: 'done' },
      { text: { en: 'Automated daily backups', ru: 'Автоматические ежедневные бэкапы' }, status: 'done' },
      { text: { en: 'Firewall & security hardening', ru: 'Файрвол и усиление безопасности' }, status: 'done' },
      { text: { en: 'SSL/TLS encryption', ru: 'SSL/TLS шифрование' }, status: 'done' },
      { text: { en: 'Health monitoring endpoint', ru: 'Мониторинг здоровья сервера' }, status: 'done', icon: <Zap size={14} /> },
      { text: { en: 'Cloudflare R2 for file storage (unlimited scale)', ru: 'Cloudflare R2 для хранения файлов' }, status: 'done' },
      { text: { en: 'Real-time presence sync (auto-offline detection)', ru: 'Синхронизация онлайн-статуса в реальном времени' }, status: 'done' },
      { text: { en: 'Second app server + Cloudflare CDN', ru: 'Второй сервер + Cloudflare CDN' }, status: 'planned' },
      { text: { en: 'CI/CD pipeline (GitHub Actions)', ru: 'CI/CD (GitHub Actions)' }, status: 'planned' },
    ],
  },
  {
    title: { en: 'Mobile & Desktop', ru: 'Мобильное и десктоп' },
    subtitle: { en: 'Cross-platform experience', ru: 'Кроссплатформенность' },
    status: 'active', date: 'Q2 2026',
    features: [
      { text: { en: 'Progressive Web App (installable, offline-ready)', ru: 'PWA (установка на устройство, оффлайн-shell)' }, status: 'done' },
      { text: { en: 'Web Push notifications (VAPID)', ru: 'Web Push уведомления (VAPID)' }, status: 'done' },
      { text: { en: 'iOS safe-area + Dynamic Island support', ru: 'Поддержка safe-area и Dynamic Island на iOS' }, status: 'done' },
      { text: { en: 'Auto-reconnect on tab resume (iOS-friendly)', ru: 'Авто-реконнект при возврате из бэкграунда (iOS)' }, status: 'done' },
      { text: { en: 'Info Center & Developer Docs pages (11 langs)', ru: 'Info Center и страница для разработчиков (11 языков)' }, status: 'done' },
      { text: { en: 'React Native mobile app (iOS & Android)', ru: 'Мобильное приложение (iOS и Android)' }, status: 'planned' },
      { text: { en: 'Desktop client (Electron/Tauri)', ru: 'Десктоп-клиент (Electron/Tauri)' }, status: 'planned' },
      { text: { en: 'Voice & video calls (WebRTC)', ru: 'Голосовые и видеозвонки (WebRTC)' }, status: 'planned' },
    ],
  },
  {
    title: { en: 'Node Network', ru: 'Сеть нод' },
    subtitle: { en: 'Decentralized key storage', ru: 'Децентрализованное хранение ключей' },
    status: 'planned', date: 'Q4 2026',
    features: [
      { text: { en: 'Desktop node software (key guardians)', ru: 'Софт ноды-хранителя ключей' }, status: 'planned' },
      { text: { en: "Shamir's Secret Sharing for encryption keys", ru: 'Shamir Secret Sharing для ключей шифрования' }, status: 'planned' },
      { text: { en: 'PLS rewards for node operators', ru: 'PLS награды за работу ноды' }, status: 'planned' },
      { text: { en: 'Proof of Storage verification', ru: 'Proof of Storage верификация' }, status: 'planned' },
      { text: { en: 'P2P network (libp2p/WebRTC)', ru: 'P2P сеть (libp2p/WebRTC)' }, status: 'planned' },
      { text: { en: 'Solana smart contract for rewards', ru: 'Смарт-контракт Solana для наград' }, status: 'planned' },
      { text: { en: 'Message cache & media relay on nodes', ru: 'Кэш сообщений и медиа-relay на нодах' }, status: 'planned' },
    ],
  },
];

function StatusIcon({ status }: { status: Status }) {
  if (status === 'done') return <Check size={14} className="text-emerald-400" />;
  if (status === 'active') return <Loader2 size={14} className="text-amber-400 animate-spin" />;
  return <Clock size={14} className="text-gray-500" />;
}

function useInView(ref: React.RefObject<HTMLElement | null>) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return visible;
}

function PhaseCard({ phase, index, lang }: { phase: Phase; index: number; lang: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref);
  const isLeft = index % 2 === 0;
  const doneCount = phase.features.filter(f => f.status === 'done').length;
  const progress = Math.round((doneCount / phase.features.length) * 100);

  const borderColor = phase.status === 'done' ? 'border-emerald-500/30' : phase.status === 'active' ? 'border-amber-500/30' : 'border-gray-700/30';
  const glowColor = phase.status === 'done' ? 'shadow-emerald-500/10' : phase.status === 'active' ? 'shadow-amber-500/10' : '';

  return (
    <div
      ref={ref}
      className={`relative flex items-start gap-8 ${isLeft ? 'lg:flex-row' : 'lg:flex-row-reverse'} flex-col lg:flex-row`}
    >
      {/* Timeline dot */}
      <div className="hidden lg:flex absolute left-1/2 -translate-x-1/2 z-10 flex-col items-center">
        <div className={`w-5 h-5 rounded-full border-2 ${
          phase.status === 'done' ? 'bg-emerald-500 border-emerald-400' :
          phase.status === 'active' ? 'bg-amber-500 border-amber-400 animate-pulse' :
          'bg-gray-700 border-gray-600'
        }`} style={{ boxShadow: phase.status !== 'planned' ? `0 0 12px ${phase.status === 'done' ? 'rgba(52,211,153,0.5)' : 'rgba(251,191,36,0.5)'}` : 'none' }} />
      </div>

      {/* Content card */}
      <div className={`lg:w-[45%] ${isLeft ? 'lg:text-right lg:ml-auto lg:mr-[55%]' : 'lg:text-left lg:mr-auto lg:ml-[55%]'} w-full`}>
        <div
          className={`rounded-2xl border ${borderColor} bg-dark-800/70 backdrop-blur-sm p-6 shadow-xl ${glowColor} transition-all duration-700 ${
            visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          } ${phase.highlight ? 'ring-1 ring-amber-500/20' : ''}`}
          style={{ transitionDelay: `${index * 100}ms` }}
        >
          {/* Header */}
          <div className={`flex items-center gap-3 mb-4 ${isLeft ? 'lg:flex-row-reverse' : ''}`}>
            <StatusIcon status={phase.status} />
            <div className={isLeft ? 'lg:text-right' : ''}>
              <h3 className="text-lg font-bold text-white">{T(phase.title, lang)}</h3>
              <p className="text-xs text-gray-400">{T(phase.subtitle, lang)}</p>
            </div>
            <span className={`ml-auto text-[10px] font-mono px-2 py-0.5 rounded-full ${
              phase.status === 'done' ? 'bg-emerald-500/10 text-emerald-400' :
              phase.status === 'active' ? 'bg-amber-500/10 text-amber-400' :
              'bg-gray-700/50 text-gray-500'
            } ${isLeft ? 'lg:ml-0 lg:mr-auto' : ''}`}>
              {phase.date}
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1 bg-dark-600 rounded-full mb-4 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${
                phase.status === 'done' ? 'bg-emerald-500' : phase.status === 'active' ? 'bg-amber-500' : 'bg-gray-600'
              }`}
              style={{ width: visible ? `${progress}%` : '0%', transitionDelay: `${index * 100 + 300}ms` }}
            />
          </div>

          {/* Features */}
          <div className="space-y-2">
            {phase.features.map((feature, fi) => (
              <div
                key={fi}
                className={`flex items-center gap-2.5 transition-all duration-500 ${
                  visible ? 'opacity-100 translate-x-0' : `opacity-0 ${isLeft ? 'translate-x-4' : '-translate-x-4'}`
                } ${isLeft ? 'lg:flex-row-reverse' : ''}`}
                style={{ transitionDelay: `${index * 100 + fi * 60 + 200}ms` }}
              >
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  feature.status === 'done' ? 'bg-emerald-400' :
                  feature.status === 'active' ? 'bg-amber-400 animate-pulse' :
                  'bg-gray-600'
                }`} />
                {feature.icon && <span className={feature.status === 'done' ? 'text-emerald-400' : feature.status === 'active' ? 'text-amber-400' : 'text-gray-500'}>{feature.icon}</span>}
                <span className={`text-sm ${
                  feature.status === 'done' ? 'text-gray-300' :
                  feature.status === 'active' ? 'text-amber-300/80' :
                  'text-gray-500'
                } ${isLeft ? 'lg:text-right' : ''}`}>
                  {T(feature.text, lang)}
                </span>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className={`mt-4 pt-3 border-t border-dark-600/50 flex items-center gap-2 text-[11px] text-gray-500 ${isLeft ? 'lg:flex-row-reverse' : ''}`}>
            <span>{doneCount}/{phase.features.length} {T(HERO.completed, lang)}</span>
            <span>•</span>
            <span>{progress}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const HERO = {
  tagline: { en: 'Building the future of crypto messaging', ru: 'Строим будущее крипто-мессенджеров' },
  title: { en: 'Pulsar Roadmap', ru: 'Дорожная карта Pulsar' },
  desc: { en: 'From encrypted messaging to decentralized node network — our journey to reshape communication.', ru: 'От зашифрованных сообщений до децентрализованной сети нод — наш путь к новой коммуникации.' },
  progress: { en: 'Overall progress', ru: 'Общий прогресс' },
  shipped: { en: 'features shipped', ru: 'функций реализовано' },
  completed: { en: 'completed', ru: 'выполнено' },
  cta: { en: 'Want to shape the future?', ru: 'Хотите формировать будущее?' },
  ctaDesc: { en: 'Join Pulsar today and be part of the revolution.', ru: 'Присоединяйтесь к Pulsar и станьте частью революции.' },
  ctaBtn: { en: 'Get Started', ru: 'Начать' },
};

export function RoadmapPage() {
  const navigate = useNavigate();
  const { t, locale, setLocale } = useI18n();
  const lang = locale;

  const totalFeatures = PHASES.reduce((acc, p) => acc + p.features.length, 0);
  const doneFeatures = PHASES.reduce((acc, p) => acc + p.features.filter(f => f.status === 'done').length, 0);
  const totalProgress = Math.round((doneFeatures / totalFeatures) * 100);

  return (
    <div className="bg-dark-900 relative" style={{ height: '100dvh', overflowY: 'auto' }}>
      {/* Gradient background */}
      <div className="fixed inset-0 z-0" style={{
        background: 'radial-gradient(ellipse at 30% 0%, rgba(76,110,245,0.08) 0%, transparent 50%), radial-gradient(ellipse at 70% 100%, rgba(52,211,153,0.05) 0%, transparent 50%)',
      }} />

      {/* Header */}
      <div className="relative z-10 max-w-5xl mx-auto px-6 pt-8 pb-12">
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => navigate('/login')}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-700/50 border border-dark-500/30 backdrop-blur-sm text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={16} />
            <span className="text-sm">{t('roadmap.back')}</span>
          </button>

          {/* Language switcher */}
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
            className="px-3 py-2 rounded-lg bg-dark-700/50 border border-dark-500/30 backdrop-blur-sm text-gray-300 text-sm outline-none"
          >
            <option value="en">EN</option>
            <option value="ru">RU</option>
            <option value="uk">UA</option>
            <option value="de">DE</option>
            <option value="es">ES</option>
            <option value="fr">FR</option>
            <option value="pt">PT</option>
            <option value="tr">TR</option>
            <option value="zh">CN</option>
            <option value="ja">JP</option>
            <option value="ko">KR</option>
          </select>
        </div>

        {/* Hero */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-400 text-xs font-medium mb-4">
            <Sparkles size={12} />
            {T(HERO.tagline, lang)}
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold text-white mb-3 tracking-tight">
            {T(HERO.title, lang)}
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            {T(HERO.desc, lang)}
          </p>

          {/* Overall progress */}
          <div className="mt-8 max-w-md mx-auto">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">{T(HERO.progress, lang)}</span>
              <span className="text-emerald-400 font-mono font-bold">{totalProgress}%</span>
            </div>
            <div className="w-full h-2.5 bg-dark-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-primary-500 transition-all duration-2000"
                style={{ width: `${totalProgress}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">{doneFeatures} / {totalFeatures} {T(HERO.shipped, lang)}</p>
          </div>
        </div>

        {/* Timeline */}
        <div className="relative">
          {/* Vertical line */}
          <div className="hidden lg:block absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-emerald-500/30 via-amber-500/20 to-gray-700/20" />

          <div className="space-y-12 lg:space-y-16">
            {PHASES.map((phase, i) => (
              <PhaseCard key={i} phase={phase} index={i} lang={lang} />
            ))}
          </div>
        </div>

        {/* Footer CTA */}
        <div className="text-center mt-20 pb-12">
          <div className="inline-block p-8 rounded-2xl bg-dark-800/50 border border-dark-500/30 backdrop-blur-sm">
            <h3 className="text-xl font-bold text-white mb-2">{T(HERO.cta, lang)}</h3>
            <p className="text-gray-400 text-sm mb-4">{T(HERO.ctaDesc, lang)}</p>
            <button
              onClick={() => navigate('/login')}
              className="px-6 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors"
            >
              {T(HERO.ctaBtn, lang)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
