import { useEffect, useRef, useState, useCallback } from 'react';
import { X } from 'lucide-react';
import { useI18n, type Locale } from '../../i18n';

interface LangOption {
  id: Locale;
  flag: string;
  name: string;
}

const LANGUAGES: LangOption[] = [
  { id: 'ru', flag: '\u{1F1F7}\u{1F1FA}', name: 'Русский' },
  { id: 'en', flag: '\u{1F1EC}\u{1F1E7}', name: 'English' },
  { id: 'de', flag: '\u{1F1E9}\u{1F1EA}', name: 'Deutsch' },
  { id: 'fr', flag: '\u{1F1EB}\u{1F1F7}', name: 'Français' },
  { id: 'es', flag: '\u{1F1EA}\u{1F1F8}', name: 'Español' },
  { id: 'zh', flag: '\u{1F1E8}\u{1F1F3}', name: '中文' },
  { id: 'ja', flag: '\u{1F1EF}\u{1F1F5}', name: '日本語' },
  { id: 'ko', flag: '\u{1F1F0}\u{1F1F7}', name: '한국어' },
  { id: 'tr', flag: '\u{1F1F9}\u{1F1F7}', name: 'Türkçe' },
  { id: 'uk', flag: '\u{1F1FA}\u{1F1E6}', name: 'Українська' },
  { id: 'pt', flag: '\u{1F1E7}\u{1F1F7}', name: 'Português' },
];

interface FlagState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseAngle: number;
  orbitRadius: number;
  orbitSpeed: number;
}

export function LanguageSelector({ onClose }: { onClose: () => void }) {
  const { locale, setLocale } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const flagStatesRef = useRef<FlagState[]>([]);
  const animFrameRef = useRef<number>(0);
  const [positions, setPositions] = useState<{ x: number; y: number }[]>([]);
  const [selected, setSelected] = useState<Locale>(locale);
  const timeRef = useRef(0);

  // Initialize flag positions in orbit
  useEffect(() => {
    const states: FlagState[] = LANGUAGES.map((_, i) => {
      const angle = (i / LANGUAGES.length) * Math.PI * 2;
      const radius = 140 + Math.random() * 40;
      return {
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        baseAngle: angle,
        orbitRadius: radius,
        orbitSpeed: 0.3 + Math.random() * 0.2,
      };
    });
    flagStatesRef.current = states;
  }, []);

  const animate = useCallback(() => {
    timeRef.current += 0.016;
    const container = containerRef.current;
    if (!container) {
      animFrameRef.current = requestAnimationFrame(animate);
      return;
    }

    const rect = container.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Mouse position relative to center
    const mx = mouseRef.current.x - rect.left - centerX;
    const my = mouseRef.current.y - rect.top - centerY;

    const states = flagStatesRef.current;
    const newPositions: { x: number; y: number }[] = [];

    for (let i = 0; i < states.length; i++) {
      const s = states[i];
      const t = timeRef.current;

      // Target orbit position
      const angle = s.baseAngle + t * s.orbitSpeed;
      let targetX = Math.cos(angle) * s.orbitRadius;
      let targetY = Math.sin(angle) * s.orbitRadius;

      // Magnetic attraction to cursor (gentle pull)
      const distToCursor = Math.sqrt((targetX - mx) ** 2 + (targetY - my) ** 2);
      if (distToCursor < 200) {
        const pull = (1 - distToCursor / 200) * 0.4;
        targetX += (mx - targetX) * pull;
        targetY += (my - targetY) * pull;
      }

      // Repulsion between flags
      for (let j = 0; j < states.length; j++) {
        if (i === j) continue;
        const dx = s.x - states[j].x;
        const dy = s.y - states[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist < 60) {
          const force = (60 - dist) / 60 * 3;
          targetX += (dx / dist) * force;
          targetY += (dy / dist) * force;
        }
      }

      // Smooth spring physics
      s.vx += (targetX - s.x) * 0.08;
      s.vy += (targetY - s.y) * 0.08;
      s.vx *= 0.85;
      s.vy *= 0.85;
      s.x += s.vx;
      s.y += s.vy;

      newPositions.push({ x: centerX + s.x, y: centerY + s.y });
    }

    setPositions(newPositions);
    animFrameRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [animate]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    mouseRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleSelect = (lang: LangOption) => {
    setSelected(lang.id);
    setLocale(lang.id);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center"
      onClick={onClose}
      onMouseMove={handleMouseMove}
    >
      <div
        ref={containerRef}
        className="relative w-[500px] h-[500px] max-w-[90vw] max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Central panel */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
          <div className="bg-dark-700 border border-dark-500 rounded-2xl px-8 py-6 shadow-2xl text-center min-w-[200px]">
            <p className="text-3xl mb-2">{LANGUAGES.find((l) => l.id === selected)?.flag}</p>
            <p className="text-white font-semibold text-lg">{LANGUAGES.find((l) => l.id === selected)?.name}</p>
            <p className="text-gray-400 text-xs mt-1 uppercase">{selected}</p>
          </div>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 z-20 p-2 rounded-full bg-dark-600 hover:bg-dark-500 text-gray-400 hover:text-white transition-colors"
        >
          <X size={18} />
        </button>

        {/* Floating flags */}
        {LANGUAGES.map((lang, i) => {
          const pos = positions[i];
          if (!pos) return null;
          const isActive = selected === lang.id;

          return (
            <button
              key={lang.id}
              onClick={() => handleSelect(lang)}
              className={`absolute transition-transform duration-100 cursor-pointer select-none group`}
              style={{
                left: pos.x,
                top: pos.y,
                transform: 'translate(-50%, -50%)',
                zIndex: isActive ? 5 : 1,
              }}
            >
              <div
                className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-primary-500/20 border border-primary-500/50 scale-125'
                    : 'hover:bg-dark-600/80 hover:scale-110 border border-transparent'
                }`}
              >
                <span className="text-3xl drop-shadow-lg">{lang.flag}</span>
                <span className={`text-[10px] font-medium whitespace-nowrap ${
                  isActive ? 'text-primary-400' : 'text-gray-400 group-hover:text-gray-200'
                }`}>
                  {lang.name}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
