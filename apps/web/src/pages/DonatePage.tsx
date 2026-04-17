import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, Check, ExternalLink, Heart, Gem, Mail, MessageCircle, Users, Handshake, Home } from 'lucide-react';
import { useI18n } from '../i18n';

function generateStars(count: number) {
  const stars: { x: number; y: number; size: number; delay: number; opacity: number }[] = [];
  let seed = 77;
  const rand = () => { seed = (seed * 16807 + 0) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < count; i++) {
    stars.push({ x: rand() * 100, y: rand() * 100, size: rand() > 0.9 ? 2 : 1, delay: rand() * 5, opacity: 0.1 + rand() * 0.4 });
  }
  return stars;
}

const METHODS = [
  {
    id: 'sol',
    name: 'Solana (SOL)',
    symbol: 'SOL',
    address: 'AnAnZWvzuXoGZDtatS9U5yY9QRhGKh21Gpmh5isLH9ba',
    color: 'from-purple-500/20 to-green-500/20',
    border: 'border-purple-500/30 hover:border-purple-400/60',
    glow: '0 0 30px rgba(168,85,247,0.15)',
    badge: 'bg-purple-500/15 text-purple-300 border border-purple-500/30',
    icon: (
      <svg viewBox="0 0 397 311" fill="none" className="w-8 h-8">
        <defs>
          <linearGradient id="sol1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#9945FF" />
            <stop offset="100%" stopColor="#14F195" />
          </linearGradient>
        </defs>
        <path d="M64.6 237.9a10.3 10.3 0 0 1 7.2-3h317.4c4.5 0 6.8 5.5 3.6 8.7l-62.7 62.7a10.3 10.3 0 0 1-7.2 3H5.5c-4.5 0-6.8-5.5-3.6-8.7l62.7-62.7zm0-164.8a10.3 10.3 0 0 1 7.2-3h317.4c4.5 0 6.8 5.5 3.6 8.7l-62.7 62.7a10.3 10.3 0 0 1-7.2 3H5.5c-4.5 0-6.8-5.5-3.6-8.7l62.7-62.7zm317.4-70.7a10.3 10.3 0 0 0-7.2 3L311.9 68.1a10.3 10.3 0 0 0-3 7.2v1.4c0 2.8 2.2 5 5 5h.2l62.7-62.7c3.2-3.2.9-8.6-3.6-8.6H71.8a10.3 10.3 0 0 0-7.2 3L1.9 76.1a10.3 10.3 0 0 0 7.2 17.3H326.5a10.3 10.3 0 0 0 7.2-3l62.7-62.7c3.2-3.2.9-8.7-3.6-8.7L71.8 2.4a10.3 10.3 0 0 0-7.2 3z" fill="url(#sol1)" />
      </svg>
    ),
  },
  {
    id: 'usdt',
    name: 'USDT TRC-20',
    symbol: 'USDT',
    address: 'TYrCHzHkTzKWBB2JK4TV9mM2Fg6Cz3CsuP',
    color: 'from-emerald-500/20 to-teal-500/20',
    border: 'border-emerald-500/30 hover:border-emerald-400/60',
    glow: '0 0 30px rgba(16,185,129,0.15)',
    badge: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
    icon: (
      <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold text-sm">₮</div>
    ),
  },
  {
    id: 'btc',
    name: 'Bitcoin (BTC)',
    symbol: 'BTC',
    address: '1FN2uoT68g6QKBaSvqbkFrDAWtCLZnjD3Y',
    color: 'from-orange-500/20 to-yellow-500/20',
    border: 'border-orange-500/30 hover:border-orange-400/60',
    glow: '0 0 30px rgba(249,115,22,0.15)',
    badge: 'bg-orange-500/15 text-orange-300 border border-orange-500/30',
    icon: (
      <svg viewBox="0 0 32 32" className="w-8 h-8">
        <circle cx="16" cy="16" r="16" fill="#F7931A" />
        <path d="M22.6 14.3c.3-2.2-1.3-3.3-3.6-4.1l.7-3-1.8-.4-.7 2.9-1.4-.4.7-2.9-1.8-.4-.7 3-3.6-.9-.5 1.9s1.3.3 1.3.3c.7.2.8.7.8 1l-.8 3.3c0 .1.1.1.1.2l-.1-.1-1.2 4.7c-.1.2-.3.6-.8.5 0 0-1.3-.3-1.3-.3L8 21.7l3.4.8-.7 3 1.8.4.7-3 1.4.4-.7 3 1.8.4.7-3c3 .6 5.3.3 6.2-2.4.8-2.1 0-3.3-1.6-4.1 1.1-.3 2-.9 2.6-2zm-4.7 6.6c-.6 2.2-4.5.9-5.7.7l1-4c1.2.3 5.2.9 4.7 3.3zm.5-6.7c-.5 2-3.8.9-4.9.7l.9-3.6c1.1.3 4.6.8 4 2.9z" fill="white" />
      </svg>
    ),
  },
];

export function DonatePage() {
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const stars = useMemo(() => generateStars(150), []);
  const [copied, setCopied] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState<string | null>(null);

  const copyAddress = async (id: string, address: string) => {
    try {
      await navigator.clipboard.writeText(address);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = address;
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="bg-dark-900 text-white" style={{ height: '100dvh', overflowY: 'auto', touchAction: 'pan-y' }}>
      {/* Stars */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(76,110,245,0.07) 0%, rgba(16,17,19,1) 60%)' }} />
        {stars.map((s, i) => (
          <div key={i} className="absolute rounded-full bg-white animate-star-twinkle"
            style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.size, height: s.size, opacity: s.opacity, animationDelay: `${s.delay}s`, animationDuration: `${3 + s.delay}s` }} />
        ))}
      </div>

      {/* Header */}
      <header className="relative z-20 flex items-center px-4 sm:px-8 py-4 pt-3-safe border-b border-white/5 backdrop-blur-sm bg-dark-900/60">
        <button
          onClick={() => navigate('/info')}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors text-sm"
        >
          <ArrowLeft size={15} />
          {t('roadmap.back')}
        </button>
        <div className="flex-1 text-center">
          <span className="text-sm font-semibold tracking-widest uppercase text-primary-400">Pulsar</span>
        </div>
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-500/15 border border-primary-500/30 text-primary-400 hover:bg-primary-500/25 text-xs font-medium transition-colors"
        >
          <Home size={12} />
          Pulsar
        </button>
      </header>

      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-8 pb-24">

        {/* Hero */}
        <div className="text-center pt-14 pb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500/20 to-pink-500/20 border border-primary-500/20 mb-6">
            <Heart size={28} className="text-pink-400" style={{ filter: 'drop-shadow(0 0 8px rgba(244,114,182,0.6))' }} />
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight mb-4"
            style={{ background: 'linear-gradient(135deg, #fff 0%, rgba(244,114,182,0.9) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {t('donate.title')}
          </h1>
          <p className="text-gray-400 text-base sm:text-lg max-w-xl mx-auto leading-relaxed">
            {t('donate.subtitle')}
          </p>
        </div>

        {/* Crypto cards */}
        <div className="space-y-4 mb-6">
          {METHODS.map((m) => (
            <div
              key={m.id}
              className={`rounded-2xl border bg-gradient-to-r ${m.color} ${m.border} p-5 sm:p-6 transition-all duration-300 cursor-default`}
              style={{ boxShadow: copied === m.id ? m.glow.replace('0.15', '0.4') : m.glow }}
            >
              <div className="flex items-center gap-3 mb-4">
                {m.icon}
                <div>
                  <h3 className="font-semibold text-white text-base">{m.name}</h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${m.badge}`}>{m.symbol}</span>
                </div>
              </div>

              {/* Address row */}
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0 bg-black/30 rounded-xl px-4 py-2.5 border border-white/5">
                  <p className="text-xs text-gray-400 mb-0.5">{t('donate.address')}</p>
                  <p className="text-sm font-mono text-gray-200 truncate">{m.address}</p>
                </div>
                <button
                  onClick={() => copyAddress(m.id, m.address)}
                  className="shrink-0 w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all"
                  title={t('donate.copy')}
                >
                  {copied === m.id
                    ? <Check size={16} className="text-green-400" />
                    : <Copy size={16} className="text-gray-400" />
                  }
                </button>
                <button
                  onClick={() => setQrOpen(qrOpen === m.id ? null : m.id)}
                  className="shrink-0 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-gray-400 hover:text-white transition-all"
                >
                  QR
                </button>
              </div>

              {/* Copied toast */}
              {copied === m.id && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-green-400">
                  <Check size={12} />
                  {t('donate.copied')}
                </div>
              )}

              {/* QR code */}
              {qrOpen === m.id && (
                <div className="mt-4 flex flex-col items-center gap-2 animate-fade-in">
                  <div className="p-3 bg-white rounded-2xl shadow-xl">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(m.address)}&size=180x180&margin=0`}
                      alt={`QR ${m.name}`}
                      width={180}
                      height={180}
                      className="rounded-lg"
                    />
                  </div>
                  <p className="text-xs text-gray-500">{t('donate.scanQr')}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Investor / Strategic Partner */}
        <InvestorSection locale={locale} />

        {/* Boosty card */}
        <a
          href="https://boosty.to/smoolwood/donate"
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-2xl border border-amber-500/30 hover:border-amber-400/60 bg-gradient-to-r from-amber-500/10 to-orange-500/10 p-5 sm:p-6 transition-all duration-300 group mb-12"
          style={{ boxShadow: '0 0 30px rgba(245,158,11,0.1)' }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-2xl">
                ☕
              </div>
              <div>
                <h3 className="font-semibold text-white">Boosty</h3>
                <p className="text-xs text-gray-400">{t('donate.boostyDesc')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-sm font-medium group-hover:bg-amber-500/25 transition-colors">
              {t('donate.support')}
              <ExternalLink size={14} />
            </div>
          </div>
        </a>

        {/* Thank you */}
        <div className="text-center">
          <p className="text-gray-600 text-sm">{t('donate.thanks')}</p>
          <p className="text-gray-700 text-xs mt-1">Pulsar © 2026</p>
        </div>
      </div>

      {/* QR overlay click-outside */}
      {qrOpen && (
        <div className="fixed inset-0 z-0" onClick={() => setQrOpen(null)} />
      )}
    </div>
  );
}

const T = (texts: Record<string, string>, lang: string) => texts[lang] || texts.en;

const INV = {
  badge: {
    en: 'EXCLUSIVE', ru: 'ЭКСКЛЮЗИВ', uk: 'ЕКСКЛЮЗИВ', de: 'EXKLUSIV', es: 'EXCLUSIVO',
    fr: 'EXCLUSIF', pt: 'EXCLUSIVO', tr: 'ÖZEL', zh: '独家', ja: '限定', ko: '독점',
  },
  title: {
    en: 'Strategic Partners Program', ru: 'Программа стратегических партнёров',
    uk: 'Програма стратегічних партнерів', de: 'Strategisches Partnerprogramm',
    es: 'Programa de socios estratégicos', fr: 'Programme de partenaires stratégiques',
    pt: 'Programa de parceiros estratégicos', tr: 'Stratejik Ortaklık Programı',
    zh: '战略合伙人计划', ja: '戦略パートナープログラム', ko: '전략적 파트너 프로그램',
  },
  subtitle: {
    en: 'Become an early investor. Help shape the future of encrypted communication and crypto economy.',
    ru: 'Станьте ранним инвестором. Участвуйте в формировании будущего зашифрованных коммуникаций и крипто-экономики.',
    uk: 'Станьте раннім інвестором. Долучайтесь до формування майбутнього шифрованих комунікацій.',
    de: 'Werden Sie Frühphaseninvestor. Gestalten Sie die Zukunft der verschlüsselten Kommunikation mit.',
    es: 'Conviértete en inversor temprano. Ayuda a moldear el futuro de la comunicación cifrada.',
    fr: 'Devenez un investisseur précoce. Contribuez à façonner l\'avenir de la communication chiffrée.',
    pt: 'Seja um investidor inicial. Ajude a moldar o futuro da comunicação criptografada.',
    tr: 'Erken yatırımcı olun. Şifreli iletişimin geleceğini birlikte şekillendirin.',
    zh: '成为早期投资者，共同塑造加密通信与加密经济的未来。',
    ja: '初期投資家として、暗号通信とクリプト経済の未来を共に築きましょう。',
    ko: '초기 투자자가 되어 암호화 통신과 크립토 경제의 미래를 함께 만들어 가세요.',
  },
  spots: {
    en: 'spots remaining', ru: 'мест осталось', uk: 'місць залишилось',
    de: 'Plätze verfügbar', es: 'plazas disponibles', fr: 'places restantes',
    pt: 'vagas restantes', tr: 'yer kaldı', zh: '名额剩余', ja: '席残り', ko: '자리 남음',
  },
  filled: {
    en: 'filled', ru: 'занято', uk: 'зайнято', de: 'belegt', es: 'ocupado',
    fr: 'occupé', pt: 'preenchido', tr: 'dolu', zh: '已占', ja: '済', ko: '참여',
  },
  emailLabel: {
    en: 'Write to us', ru: 'Напишите нам', uk: 'Напишіть нам',
    de: 'Schreiben Sie uns', es: 'Escríbenos', fr: 'Écrivez-nous',
    pt: 'Escreva-nos', tr: 'Bize yazın', zh: '联系我们', ja: 'メールする', ko: '이메일 보내기',
  },
  chatLabel: {
    en: 'Find us in Pulsar', ru: 'Напишите в Pulsar', uk: 'Напишіть у Pulsar',
    de: 'Kontakt in Pulsar', es: 'Contáctanos en Pulsar', fr: 'Contactez-nous dans Pulsar',
    pt: 'Contate-nos no Pulsar', tr: 'Pulsar\'da yazın', zh: '在Pulsar联系我们', ja: 'Pulsarで連絡', ko: 'Pulsar에서 연락',
  },
  meetingLabel: {
    en: 'Personal meeting for major investments', ru: 'Личная встреча при крупных инвестициях',
    uk: 'Особиста зустріч для великих інвестицій', de: 'Persönliches Treffen bei Großinvestitionen',
    es: 'Reunión personal para grandes inversiones', fr: 'Rencontre en personne pour investissements importants',
    pt: 'Reunião presencial para grandes investimentos', tr: 'Büyük yatırımlar için kişisel görüşme',
    zh: '大额投资可安排面谈', ja: '大型投資は個別面談可能', ko: '대규모 투자 시 직접 미팅 가능',
  },
  cta: {
    en: 'Get in Touch', ru: 'Связаться', uk: 'Зв\'язатися', de: 'Kontakt aufnehmen',
    es: 'Contactar', fr: 'Nous contacter', pt: 'Entrar em contato', tr: 'İletişime geçin',
    zh: '联系我们', ja: 'お問い合わせ', ko: '연락하기',
  },
};

const TOTAL_SPOTS = 10;
const TAKEN_SPOTS = 3;

function InvestorSection({ locale }: { locale: string }) {
  const remaining = TOTAL_SPOTS - TAKEN_SPOTS;
  const pct = Math.round((TAKEN_SPOTS / TOTAL_SPOTS) * 100);

  return (
    <div className="mb-8 rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-500/5 via-yellow-500/5 to-orange-500/5 overflow-hidden"
      style={{ boxShadow: '0 0 60px rgba(245,158,11,0.08), inset 0 1px 0 rgba(255,255,255,0.05)' }}>

      {/* Top accent */}
      <div className="h-1 bg-gradient-to-r from-amber-500 via-yellow-400 to-orange-500" />

      <div className="p-6 sm:p-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-yellow-500/20 border border-amber-500/30 flex items-center justify-center">
              <Gem size={24} className="text-amber-400" style={{ filter: 'drop-shadow(0 0 8px rgba(245,158,11,0.5))' }} />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white">{T(INV.title, locale)}</h2>
            </div>
          </div>
          <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 tracking-wider">
            {T(INV.badge, locale)}
          </span>
        </div>

        <p className="text-gray-300 text-sm leading-relaxed mb-6 max-w-2xl">
          {T(INV.subtitle, locale)}
        </p>

        {/* Spots progress */}
        <div className="bg-black/20 rounded-xl p-4 border border-white/5 mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Users size={14} className="text-amber-400" />
              <span className="text-sm font-semibold text-white">
                {remaining} / {TOTAL_SPOTS} {T(INV.spots, locale)}
              </span>
            </div>
            <span className="text-xs text-amber-400 font-mono">{pct}% {T(INV.filled, locale)}</span>
          </div>
          <div className="w-full h-2.5 bg-dark-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-1000"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex gap-1.5 mt-3">
            {Array.from({ length: TOTAL_SPOTS }, (_, i) => (
              <div
                key={i}
                className={`h-2 flex-1 rounded-full transition-colors ${
                  i < TAKEN_SPOTS
                    ? 'bg-amber-500/60'
                    : 'bg-dark-600 border border-dark-500'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Contact methods */}
        <div className="space-y-3 mb-6">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
            <Mail size={18} className="text-amber-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-400">{T(INV.emailLabel, locale)}</p>
              <a href="mailto:invest@pulsar-chat.fun" className="text-sm text-amber-300 hover:text-amber-200 font-medium transition-colors">
                invest@pulsar-chat.fun
              </a>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
            <MessageCircle size={18} className="text-primary-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-400">{T(INV.chatLabel, locale)}</p>
              <span className="text-sm text-primary-300 font-medium">@SmooL-G</span>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
            <Handshake size={18} className="text-emerald-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-300">{T(INV.meetingLabel, locale)}</p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <a
          href="mailto:invest@pulsar-chat.fun"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-dark-900 font-bold text-sm transition-all shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40"
        >
          <Gem size={16} />
          {T(INV.cta, locale)}
        </a>
      </div>
    </div>
  );
}
