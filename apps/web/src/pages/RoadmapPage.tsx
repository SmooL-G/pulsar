import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useI18n } from '../i18n';

type FeatureStatus = 'complete' | 'in-progress' | 'planned';

interface Feature {
  key: string;
  status: FeatureStatus;
}

interface Phase {
  id: number;
  nameKey: string;
  status: FeatureStatus;
  features: Feature[];
}

const PHASES: Phase[] = [
  {
    id: 1, nameKey: 'roadmap.phase1', status: 'complete',
    features: [
      { key: 'monorepo', status: 'complete' },
      { key: 'docker', status: 'complete' },
      { key: 'auth3', status: 'complete' },
      { key: 'fastify', status: 'complete' },
      { key: 'react', status: 'complete' },
      { key: 'layout', status: 'complete' },
      { key: 'deploy', status: 'complete' },
    ],
  },
  {
    id: 2, nameKey: 'roadmap.phase2', status: 'complete',
    features: [
      { key: 'realtime', status: 'complete' },
      { key: 'dm', status: 'complete' },
      { key: 'typing', status: 'complete' },
      { key: 'online', status: 'complete' },
      { key: 'receipts', status: 'complete' },
      { key: 'context', status: 'complete' },
      { key: 'deleteMenu', status: 'complete' },
      { key: 'linkPreview', status: 'complete' },
      { key: 'msgEdit', status: 'complete' },
    ],
  },
  {
    id: 3, nameKey: 'roadmap.phase3', status: 'complete',
    features: [
      { key: 'groups', status: 'complete' },
      { key: 'friends', status: 'complete' },
      { key: 'avatars', status: 'complete' },
      { key: 'i18n', status: 'complete' },
      { key: 'themes', status: 'complete' },
      { key: 'privacy', status: 'complete' },
      { key: 'informer', status: 'complete' },
      { key: 'settings', status: 'complete' },
    ],
  },
  {
    id: 4, nameKey: 'roadmap.phase4', status: 'in-progress',
    features: [
      { key: 'fileShare', status: 'planned' },
      { key: 'imgThumb', status: 'planned' },
      { key: 'emoji', status: 'planned' },
      { key: 'reply', status: 'planned' },
      { key: 'reactions', status: 'planned' },
      { key: 'pinned', status: 'planned' },
      { key: 'search', status: 'planned' },
      { key: 'forward', status: 'planned' },
    ],
  },
  {
    id: 5, nameKey: 'roadmap.phase5', status: 'planned',
    features: [
      { key: 'adminDash', status: 'planned' },
      { key: 'userMgmt', status: 'planned' },
      { key: 'moderation', status: 'planned' },
      { key: 'channels', status: 'planned' },
      { key: 'mobile', status: 'planned' },
      { key: 'push', status: 'planned' },
      { key: 'cicd', status: 'planned' },
    ],
  },
  {
    id: 6, nameKey: 'roadmap.phase6', status: 'planned',
    features: [
      { key: 'tips', status: 'planned' },
      { key: 'psrToken', status: 'planned' },
      { key: 'rewards', status: 'planned' },
      { key: 'redPackets', status: 'planned' },
      { key: 'nftAvatars', status: 'planned' },
      { key: 'nftBadges', status: 'planned' },
      { key: 'nftStickers', status: 'planned' },
      { key: 'tokenGated', status: 'planned' },
      { key: 'swap', status: 'planned' },
      { key: 'balance', status: 'planned' },
      { key: 'priceTrack', status: 'planned' },
      { key: 'solanaPay', status: 'planned' },
      { key: 'reputation', status: 'planned' },
      { key: 'dao', status: 'planned' },
      { key: 'verification', status: 'planned' },
      { key: 'sns', status: 'planned' },
      { key: 'cNft', status: 'planned' },
      { key: 'leaderboard', status: 'planned' },
      { key: 'quests', status: 'planned' },
    ],
  },
  {
    id: 7, nameKey: 'roadmap.phase7', status: 'planned',
    features: [
      { key: 'reactNative', status: 'planned' },
      { key: 'e2e', status: 'planned' },
      { key: 'calls', status: 'planned' },
      { key: 'botApi', status: 'planned' },
    ],
  },
];

// Deterministic star positions
function generateStars(count: number) {
  const stars: { x: number; y: number; size: number; delay: number; opacity: number }[] = [];
  let seed = 42;
  const rand = () => { seed = (seed * 16807 + 0) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < count; i++) {
    stars.push({
      x: rand() * 100,
      y: rand() * 100,
      size: rand() > 0.9 ? 2 : 1,
      delay: rand() * 5,
      opacity: 0.15 + rand() * 0.5,
    });
  }
  return stars;
}

const STATUS_COLORS: Record<FeatureStatus, { bg: string; glow: string; text: string }> = {
  complete: {
    bg: 'bg-emerald-400',
    glow: '0 0 8px rgba(52,211,153,0.7), 0 0 20px rgba(52,211,153,0.3)',
    text: 'text-emerald-400',
  },
  'in-progress': {
    bg: 'bg-amber-400',
    glow: '0 0 8px rgba(251,191,36,0.7), 0 0 20px rgba(251,191,36,0.3)',
    text: 'text-amber-400',
  },
  planned: {
    bg: 'bg-gray-500',
    glow: 'none',
    text: 'text-gray-500',
  },
};

const ORBIT_RADII = [80, 130, 185, 245, 310, 390, 460];

export function RoadmapPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const stars = useMemo(() => generateStars(120), []);
  const [hoveredFeature, setHoveredFeature] = useState<string | null>(null);
  const [hoveredPos, setHoveredPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [scale, setScale] = useState(0.85);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const panStart = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    setScale(s => Math.min(2.5, Math.max(0.4, s - e.deltaY * 0.001)));
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    panStart.current = { ...pan };
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    setPan({
      x: panStart.current.x + (e.clientX - dragStart.current.x),
      y: panStart.current.y + (e.clientY - dragStart.current.y),
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  const mapCenter = { x: 500, y: 500 };

  return (
    <div className="min-h-screen bg-dark-900 relative overflow-hidden select-none">
      {/* Cosmic background */}
      <div className="fixed inset-0 z-0">
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(76,110,245,0.06) 0%, rgba(16,17,19,1) 70%)',
          }}
        />
        {stars.map((star, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white animate-star-twinkle"
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: star.size,
              height: star.size,
              opacity: star.opacity,
              animationDelay: `${star.delay}s`,
              animationDuration: `${3 + star.delay}s`,
            }}
          />
        ))}
      </div>

      {/* Header */}
      <div className="relative z-20 flex items-center justify-between px-6 py-4">
        <button
          onClick={() => navigate('/login')}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-700/50 border border-dark-500/30 backdrop-blur-sm text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={16} />
          <span className="text-sm">{t('roadmap.back')}</span>
        </button>

        <div className="text-center">
          <h1 className="text-2xl font-bold text-white tracking-wider">
            {t('roadmap.title')}
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">{t('roadmap.subtitle')}</p>
        </div>

        <div className="w-24" />
      </div>

      {/* Legend */}
      <div className="relative z-20 flex justify-center gap-6 pb-2">
        {(['complete', 'in-progress', 'planned'] as FeatureStatus[]).map((status) => (
          <div key={status} className="flex items-center gap-2">
            <div
              className={`w-2.5 h-2.5 rounded-full ${STATUS_COLORS[status].bg} ${
                status === 'in-progress' ? 'animate-star-pulse' : ''
              }`}
              style={{ boxShadow: STATUS_COLORS[status].glow }}
            />
            <span className={`text-xs font-medium ${STATUS_COLORS[status].text}`}>
              {t(`roadmap.${status === 'complete' ? 'complete' : status === 'in-progress' ? 'inProgress' : 'planned'}`)}
            </span>
          </div>
        ))}
      </div>

      {/* Desktop orbital map */}
      <div
        ref={containerRef}
        className="hidden lg:block relative z-10 w-full overflow-hidden cursor-grab active:cursor-grabbing"
        style={{ height: 'calc(100vh - 120px)' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          className="absolute"
          style={{
            width: 1000,
            height: 1000,
            left: '50%',
            top: '50%',
            transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transition: isDragging.current ? 'none' : 'transform 0.1s ease-out',
          }}
        >
          {/* Orbital rings */}
          {PHASES.map((phase, i) => {
            const radius = ORBIT_RADII[i];
            const diameter = radius * 2;
            const borderColor = phase.status === 'complete'
              ? 'border-emerald-500/15'
              : phase.status === 'in-progress'
                ? 'border-amber-500/20'
                : 'border-gray-700/20';

            return (
              <div key={`ring-${phase.id}`}>
                {/* Ring */}
                <div
                  className={`absolute rounded-full border ${borderColor}`}
                  style={{
                    width: diameter,
                    height: diameter,
                    left: mapCenter.x - radius,
                    top: mapCenter.y - radius,
                  }}
                />

                {/* Phase label */}
                <div
                  className="absolute text-center pointer-events-none"
                  style={{
                    left: mapCenter.x,
                    top: mapCenter.y - radius - 14,
                    transform: 'translateX(-50%)',
                  }}
                >
                  <span
                    className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                      phase.status === 'complete'
                        ? 'text-emerald-400/70 bg-emerald-500/5'
                        : phase.status === 'in-progress'
                          ? 'text-amber-400/70 bg-amber-500/5'
                          : 'text-gray-600 bg-gray-800/30'
                    }`}
                  >
                    {t(phase.nameKey as any)}
                  </span>
                </div>

                {/* Feature nodes */}
                {phase.features.map((feature, fi) => {
                  const angle = (2 * Math.PI * fi) / phase.features.length - Math.PI / 2;
                  const x = mapCenter.x + radius * Math.cos(angle);
                  const y = mapCenter.y + radius * Math.sin(angle);
                  const isHovered = hoveredFeature === `${phase.id}-${feature.key}`;
                  const nodeSize = isHovered ? 14 : (phase.id <= 3 ? 8 : phase.id <= 5 ? 7 : 6);
                  const colors = STATUS_COLORS[feature.status];

                  return (
                    <div
                      key={`${phase.id}-${feature.key}`}
                      className={`absolute rounded-full ${colors.bg} transition-all duration-200 cursor-pointer ${
                        feature.status === 'in-progress' ? 'animate-star-pulse' : ''
                      } ${feature.status === 'planned' ? 'opacity-40' : ''}`}
                      style={{
                        width: nodeSize,
                        height: nodeSize,
                        left: x - nodeSize / 2,
                        top: y - nodeSize / 2,
                        boxShadow: feature.status !== 'planned' ? colors.glow : 'none',
                        zIndex: isHovered ? 50 : 5,
                      }}
                      onMouseEnter={(e) => {
                        setHoveredFeature(`${phase.id}-${feature.key}`);
                        const rect = containerRef.current?.getBoundingClientRect();
                        if (rect) {
                          setHoveredPos({
                            x: e.clientX - rect.left,
                            y: e.clientY - rect.top,
                          });
                        }
                      }}
                      onMouseLeave={() => setHoveredFeature(null)}
                    />
                  );
                })}
              </div>
            );
          })}

          {/* Pulsar core */}
          <div
            className="absolute rounded-full bg-primary-500 animate-pulsar-glow"
            style={{
              width: 28,
              height: 28,
              left: mapCenter.x - 14,
              top: mapCenter.y - 14,
              background: 'radial-gradient(circle, rgba(92,124,250,1) 0%, rgba(66,99,235,0.8) 50%, rgba(54,79,199,0.4) 100%)',
            }}
          />
          <div
            className="absolute rounded-full"
            style={{
              width: 50,
              height: 50,
              left: mapCenter.x - 25,
              top: mapCenter.y - 25,
              background: 'radial-gradient(circle, rgba(92,124,250,0.15) 0%, transparent 70%)',
            }}
          />
          <div
            className="absolute pointer-events-none text-center"
            style={{
              left: mapCenter.x,
              top: mapCenter.y + 22,
              transform: 'translateX(-50%)',
            }}
          >
            <span className="text-[9px] font-bold text-primary-400/60 uppercase tracking-[0.2em]">Pulsar</span>
          </div>
        </div>

        {/* Tooltip */}
        {hoveredFeature && (
          <div
            className="absolute z-50 pointer-events-none"
            style={{
              left: hoveredPos.x + 12,
              top: hoveredPos.y - 10,
            }}
          >
            <div className="bg-dark-700/95 border border-dark-400/50 backdrop-blur-md rounded-lg px-3 py-2 shadow-xl">
              <p className="text-xs text-white font-medium whitespace-nowrap">
                {t(`roadmap.f.${hoveredFeature.split('-').slice(1).join('-')}` as any)}
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                <div
                  className={`w-1.5 h-1.5 rounded-full ${
                    STATUS_COLORS[
                      PHASES.find(p => hoveredFeature.startsWith(`${p.id}-`))
                        ?.features.find(f => hoveredFeature === `${PHASES.find(p => hoveredFeature.startsWith(`${p.id}-`))?.id}-${f.key}`)
                        ?.status || 'planned'
                    ].bg
                  }`}
                />
                <span className="text-[10px] text-gray-400">
                  {(() => {
                    const phase = PHASES.find(p => hoveredFeature.startsWith(`${p.id}-`));
                    const feature = phase?.features.find(f => hoveredFeature === `${phase.id}-${f.key}`);
                    const s = feature?.status || 'planned';
                    return t(s === 'complete' ? 'roadmap.complete' : s === 'in-progress' ? 'roadmap.inProgress' : 'roadmap.planned' as any);
                  })()}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Zoom hint */}
        <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-gray-600">
          {t('roadmap.zoom')}
        </p>
      </div>

      {/* Mobile timeline */}
      <div className="lg:hidden relative z-10 px-4 pb-8 space-y-4">
        {PHASES.map((phase) => {
          const colors = STATUS_COLORS[phase.status];
          return (
            <div
              key={phase.id}
              className={`relative rounded-xl bg-dark-800/60 backdrop-blur-sm border overflow-hidden ${
                phase.status === 'complete'
                  ? 'border-emerald-500/20'
                  : phase.status === 'in-progress'
                    ? 'border-amber-500/20'
                    : 'border-dark-500/30'
              }`}
            >
              {/* Left accent bar */}
              <div
                className={`absolute left-0 top-0 bottom-0 w-1 ${colors.bg} ${
                  phase.status === 'planned' ? 'opacity-30' : ''
                }`}
              />

              <div className="pl-5 pr-4 py-4">
                {/* Phase header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-3 h-3 rounded-full ${colors.bg} ${
                        phase.status === 'in-progress' ? 'animate-star-pulse' : ''
                      } ${phase.status === 'planned' ? 'opacity-40' : ''}`}
                      style={{ boxShadow: colors.glow }}
                    />
                    <h3 className="text-sm font-bold text-white">
                      {t('roadmap.phase')} {phase.id} — {t(phase.nameKey as any)}
                    </h3>
                  </div>
                  <span className={`text-[10px] font-medium ${colors.text}`}>
                    {t(phase.status === 'complete' ? 'roadmap.complete' : phase.status === 'in-progress' ? 'roadmap.inProgress' : 'roadmap.planned' as any)}
                  </span>
                </div>

                {/* Features grid */}
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                  {phase.features.map((feature) => (
                    <div key={feature.key} className="flex items-center gap-2">
                      <div
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_COLORS[feature.status].bg} ${
                          feature.status === 'planned' ? 'opacity-40' : ''
                        }`}
                      />
                      <span className={`text-xs truncate ${
                        feature.status === 'complete'
                          ? 'text-gray-300'
                          : feature.status === 'in-progress'
                            ? 'text-amber-300/80'
                            : 'text-gray-500'
                      }`}>
                        {t(`roadmap.f.${feature.key}` as any)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
