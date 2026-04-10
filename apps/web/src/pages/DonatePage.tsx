import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, Check, ExternalLink, Heart } from 'lucide-react';
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
  const { t } = useI18n();
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
    <div className="min-h-screen bg-dark-900 text-white" style={{ touchAction: 'pan-y' }}>
      {/* Stars */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(76,110,245,0.07) 0%, rgba(16,17,19,1) 60%)' }} />
        {stars.map((s, i) => (
          <div key={i} className="absolute rounded-full bg-white animate-star-twinkle"
            style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.size, height: s.size, opacity: s.opacity, animationDelay: `${s.delay}s`, animationDuration: `${3 + s.delay}s` }} />
        ))}
      </div>

      {/* Header */}
      <header className="relative z-20 flex items-center px-4 sm:px-8 py-4 border-b border-white/5 backdrop-blur-sm bg-dark-900/60">
        <button
          onClick={() => navigate('/login')}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors text-sm"
        >
          <ArrowLeft size={15} />
          {t('roadmap.back')}
        </button>
        <div className="flex-1 text-center">
          <span className="text-sm font-semibold tracking-widest uppercase text-primary-400">Pulsar</span>
        </div>
        <div className="w-20" />
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
