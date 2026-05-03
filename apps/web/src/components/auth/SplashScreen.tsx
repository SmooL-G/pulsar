import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n';

/**
 * Full-screen "starfield" loader shown after a successful login while
 * keys decrypt and chats hydrate. Mantras at the bottom rotate every
 * 3s. Calls onDone() once both the minimum display time has elapsed
 * and the parent's awaited work is finished.
 */
const MIN_DISPLAY_MS = 3500;

export function SplashScreen({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const [mantraIdx, setMantraIdx] = useState(0);

  const mantras = [
    t('splash.mantra1'),
    t('splash.mantra2'),
    t('splash.mantra3'),
    t('splash.mantra4'),
    t('splash.mantra5'),
    t('splash.mantra6'),
  ];

  useEffect(() => {
    const id = setInterval(() => setMantraIdx((i) => (i + 1) % mantras.length), 2800);
    return () => clearInterval(id);
  }, [mantras.length]);

  useEffect(() => {
    const id = setTimeout(onDone, MIN_DISPLAY_MS);
    return () => clearTimeout(id);
  }, [onDone]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse at center, #1a1d3a 0%, #0a0d1a 50%, #000000 100%)',
      }}
    >
      <Stars />

      <div className="relative z-10 flex flex-col items-center text-center px-6">
        <div
          className="w-20 h-20 rounded-2xl mb-6 animate-pulse"
          style={{
            background: 'linear-gradient(135deg, #06b6d4, #6366f1)',
            boxShadow: '0 0 60px rgba(99, 102, 241, 0.6), 0 0 100px rgba(6, 182, 212, 0.3)',
          }}
        />
        <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Pulsar</h1>
        <p className="text-gray-400 text-sm">{t('splash.tagline')}</p>
      </div>

      <div className="absolute bottom-16 left-0 right-0 px-8 z-10">
        <p
          key={mantraIdx}
          className="text-center text-base md:text-lg font-medium text-gray-200 leading-relaxed mantra-fade"
          style={{ minHeight: '3.5rem' }}
        >
          {mantras[mantraIdx]}
        </p>
        <div className="flex justify-center gap-1.5 mt-4">
          {mantras.map((_, i) => (
            <div
              key={i}
              className="h-1 rounded-full transition-all duration-300"
              style={{
                width: i === mantraIdx ? '24px' : '6px',
                backgroundColor: i === mantraIdx ? '#6366f1' : 'rgba(99, 102, 241, 0.3)',
              }}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes mantraFade {
          0% { opacity: 0; transform: translateY(8px); }
          15% { opacity: 1; transform: translateY(0); }
          85% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-8px); }
        }
        .mantra-fade { animation: mantraFade 2.8s ease-in-out; }
      `}</style>
    </div>
  );
}

/**
 * Pure-CSS starfield: three layers drifting at different speeds for parallax.
 * Each layer = a single element with a box-shadow array — no per-star DOM.
 */
function Stars() {
  return (
    <>
      <div className="stars stars-far" />
      <div className="stars stars-mid" />
      <div className="stars stars-near" />
      <style>{`
        .stars {
          position: absolute;
          top: 0; left: 0;
          width: 1px; height: 1px;
          background: transparent;
          will-change: transform;
        }
        .stars-far {
          box-shadow: ${makeStars(120, 2000, 2000, 1)};
          animation: drift 200s linear infinite;
        }
        .stars-mid {
          box-shadow: ${makeStars(80, 2000, 2000, 1.5)};
          animation: drift 130s linear infinite;
        }
        .stars-near {
          box-shadow: ${makeStars(40, 2000, 2000, 2)};
          animation: drift 80s linear infinite;
        }
        @keyframes drift {
          from { transform: translate3d(0, 0, 0); }
          to   { transform: translate3d(-1000px, 500px, 0); }
        }
      `}</style>
    </>
  );
}

function makeStars(count: number, w: number, h: number, size: number): string {
  const shadows: string[] = [];
  let seed = 1;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  for (let i = 0; i < count; i++) {
    const x = Math.floor(rand() * w * 2);
    const y = Math.floor(rand() * h * 2);
    const opacity = 0.4 + rand() * 0.6;
    shadows.push(`${x}px ${y}px ${size}px rgba(255, 255, 255, ${opacity.toFixed(2)})`);
  }
  return shadows.join(', ');
}
