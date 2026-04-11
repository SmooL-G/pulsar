import { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Loader2, Clock, Sparkles, Shield, Gem, Crown, Search, MessageCircle, Globe, Megaphone, Bot, Zap } from 'lucide-react';
import { useI18n } from '../i18n';

type Status = 'done' | 'active' | 'planned';

interface Feature {
  text: string;
  status: Status;
  icon?: React.ReactNode;
}

interface Phase {
  title: string;
  subtitle: string;
  status: Status;
  date: string;
  features: Feature[];
  highlight?: boolean;
}

const PHASES: Phase[] = [
  {
    title: 'Foundation',
    subtitle: 'Core messaging platform',
    status: 'done',
    date: 'Q1 2026',
    features: [
      { text: 'Real-time messaging (Socket.IO)', status: 'done' },
      { text: 'Direct & group chats', status: 'done' },
      { text: 'User authentication (email + wallet)', status: 'done' },
      { text: 'File sharing & media', status: 'done' },
      { text: 'Online presence & typing indicators', status: 'done' },
      { text: 'Message editing, deletion, forwarding', status: 'done' },
      { text: 'Link previews', status: 'done' },
      { text: 'Friends system', status: 'done' },
    ],
  },
  {
    title: 'Social Features',
    subtitle: 'Community & engagement',
    status: 'done',
    date: 'Q1 2026',
    features: [
      { text: 'Emoji reactions on messages', status: 'done' },
      { text: 'Pinned messages', status: 'done' },
      { text: 'Channels with comments system', status: 'done', icon: <Megaphone size={14} /> },
      { text: 'Universal search (users, groups, channels, messages)', status: 'done', icon: <Search size={14} /> },
      { text: 'Message search with highlight & scroll-to', status: 'done' },
      { text: 'Internationalization (11 languages)', status: 'done', icon: <Globe size={14} /> },
      { text: 'Dark/light themes', status: 'done' },
      { text: 'Legal pages (Terms, Privacy, Cookies)', status: 'done' },
    ],
  },
  {
    title: 'Crypto Integration',
    subtitle: 'Web3 & Solana ecosystem',
    status: 'done',
    date: 'Q1 2026',
    features: [
      { text: 'Solana wallet authentication', status: 'done' },
      { text: 'PLS token economy (1 SOL = 100K PLS)', status: 'done' },
      { text: 'SOL → PLS deposits (on-chain verified)', status: 'done' },
      { text: 'P2P transfers with 2% burn fee', status: 'done' },
      { text: 'E2E encryption (NaCl)', status: 'done', icon: <Shield size={14} /> },
      { text: 'Message signing with Solana wallet', status: 'done' },
      { text: 'NFT avatar verification', status: 'done' },
      { text: 'Generative avatars', status: 'done' },
    ],
  },
  {
    title: 'Monetization & Status',
    subtitle: 'Token-powered features',
    status: 'active',
    date: 'Q2 2026',
    highlight: true,
    features: [
      { text: 'Verification levels (Starter/Pro/Elite)', status: 'done', icon: <Sparkles size={14} /> },
      { text: 'Profile badges (Blogger/Author/Business)', status: 'done' },
      { text: 'Founder badge for platform creator', status: 'done', icon: <Crown size={14} /> },
      { text: 'SuperChat — donate PLS with highlighted messages', status: 'done', icon: <Gem size={14} /> },
      { text: 'File size limits by verification level', status: 'done' },
      { text: 'Channel creation limits by level', status: 'done' },
      { text: 'Premium subscription (PLS/month)', status: 'planned' },
      { text: 'Sticker marketplace (create & sell)', status: 'planned' },
      { text: 'Channel boost system', status: 'planned' },
      { text: 'Custom nick colors & profile frames', status: 'planned' },
    ],
  },
  {
    title: 'Moderation & Safety',
    subtitle: 'Trust & community health',
    status: 'active',
    date: 'Q2 2026',
    features: [
      { text: 'Report system (spam, harassment, etc.)', status: 'done' },
      { text: 'Moderator voting on reports', status: 'done' },
      { text: 'Punishments (warn, mute, ban)', status: 'done' },
      { text: 'Bot system (PulsarBot + webhook API)', status: 'done', icon: <Bot size={14} /> },
      { text: 'Auto-moderator role (earn by contribution)', status: 'planned', icon: <Shield size={14} /> },
      { text: 'Moderator progress tracker', status: 'planned' },
      { text: 'AI-powered content moderation', status: 'planned' },
    ],
  },
  {
    title: 'Infrastructure',
    subtitle: 'Reliability & scale',
    status: 'active',
    date: 'Q2 2026',
    features: [
      { text: 'Multi-server architecture (separate DB & app)', status: 'done' },
      { text: 'Socket.IO Redis Adapter (multi-instance ready)', status: 'done' },
      { text: 'Automated daily backups', status: 'done' },
      { text: 'Firewall & security hardening', status: 'done' },
      { text: 'SSL/TLS encryption', status: 'done' },
      { text: 'Health monitoring endpoint', status: 'done', icon: <Zap size={14} /> },
      { text: 'Second app server + Cloudflare CDN', status: 'planned' },
      { text: 'CI/CD pipeline (GitHub Actions)', status: 'planned' },
    ],
  },
  {
    title: 'Mobile & Desktop',
    subtitle: 'Cross-platform experience',
    status: 'planned',
    date: 'Q3 2026',
    features: [
      { text: 'Progressive Web App (PWA)', status: 'planned' },
      { text: 'React Native mobile app (iOS & Android)', status: 'planned' },
      { text: 'Push notifications (Firebase FCM)', status: 'planned' },
      { text: 'Desktop client (Electron/Tauri)', status: 'planned' },
      { text: 'Voice & video calls (WebRTC)', status: 'planned' },
    ],
  },
  {
    title: 'Node Network',
    subtitle: 'Decentralized key storage',
    status: 'planned',
    date: 'Q4 2026',
    features: [
      { text: 'Desktop node software (key guardians)', status: 'planned' },
      { text: "Shamir's Secret Sharing for encryption keys", status: 'planned' },
      { text: 'PLS rewards for node operators', status: 'planned' },
      { text: 'Proof of Storage verification', status: 'planned' },
      { text: 'P2P network (libp2p/WebRTC)', status: 'planned' },
      { text: 'Solana smart contract for rewards', status: 'planned' },
      { text: 'Message cache & media relay on nodes', status: 'planned' },
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

function PhaseCard({ phase, index }: { phase: Phase; index: number }) {
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
              <h3 className="text-lg font-bold text-white">{phase.title}</h3>
              <p className="text-xs text-gray-400">{phase.subtitle}</p>
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
                  {feature.text}
                </span>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className={`mt-4 pt-3 border-t border-dark-600/50 flex items-center gap-2 text-[11px] text-gray-500 ${isLeft ? 'lg:flex-row-reverse' : ''}`}>
            <span>{doneCount}/{phase.features.length} completed</span>
            <span>•</span>
            <span>{progress}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function RoadmapPage() {
  const navigate = useNavigate();
  const { t } = useI18n();

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
        <button
          onClick={() => navigate('/login')}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-700/50 border border-dark-500/30 backdrop-blur-sm text-gray-400 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft size={16} />
          <span className="text-sm">{t('roadmap.back')}</span>
        </button>

        {/* Hero */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-400 text-xs font-medium mb-4">
            <Sparkles size={12} />
            Building the future of crypto messaging
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold text-white mb-3 tracking-tight">
            Pulsar Roadmap
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            From encrypted messaging to decentralized node network — our journey to reshape communication.
          </p>

          {/* Overall progress */}
          <div className="mt-8 max-w-md mx-auto">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Overall progress</span>
              <span className="text-emerald-400 font-mono font-bold">{totalProgress}%</span>
            </div>
            <div className="w-full h-2.5 bg-dark-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-primary-500 transition-all duration-2000"
                style={{ width: `${totalProgress}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">{doneFeatures} of {totalFeatures} features shipped</p>
          </div>
        </div>

        {/* Timeline */}
        <div className="relative">
          {/* Vertical line */}
          <div className="hidden lg:block absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-emerald-500/30 via-amber-500/20 to-gray-700/20" />

          <div className="space-y-12 lg:space-y-16">
            {PHASES.map((phase, i) => (
              <PhaseCard key={i} phase={phase} index={i} />
            ))}
          </div>
        </div>

        {/* Footer CTA */}
        <div className="text-center mt-20 pb-12">
          <div className="inline-block p-8 rounded-2xl bg-dark-800/50 border border-dark-500/30 backdrop-blur-sm">
            <h3 className="text-xl font-bold text-white mb-2">Want to shape the future?</h3>
            <p className="text-gray-400 text-sm mb-4">Join Pulsar today and be part of the revolution.</p>
            <button
              onClick={() => navigate('/login')}
              className="px-6 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors"
            >
              Get Started
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
