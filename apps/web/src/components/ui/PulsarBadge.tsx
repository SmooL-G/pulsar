interface PulsarBadgeProps {
  level: number; // 0 = none, 1 = gray, 2 = green, 3 = gold, 4 = founder
  size?: number;
  className?: string;
  role?: string; // if SUPER_ADMIN → always show founder badge
}

const LEVEL_COLORS = {
  1: { primary: '#9CA3AF', glow: 'rgba(156,163,175,0.4)', name: 'Starter' },
  2: { primary: '#34D399', glow: 'rgba(52,211,153,0.5)', name: 'Pro' },
  3: { primary: '#FBBF24', glow: 'rgba(251,191,36,0.5)', name: 'Elite' },
  4: { primary: '#F59E0B', glow: 'rgba(245,158,11,0.8)', name: 'Founder' },
} as const;

export function PulsarBadge({ level, size = 16, className = '', role }: PulsarBadgeProps) {
  // SUPER_ADMIN always gets founder badge
  const effectiveLevel = role === 'SUPER_ADMIN' ? 4 : level;

  if (effectiveLevel < 1 || effectiveLevel > 4) return null;

  const colors = LEVEL_COLORS[effectiveLevel as 1 | 2 | 3 | 4];
  const isFounder = effectiveLevel === 4;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={`inline-block shrink-0 ${isFounder ? 'animate-pulse' : ''} ${className}`}
      style={{ filter: `drop-shadow(0 0 ${isFounder ? '6' : '3'}px ${colors.glow})` }}
    >
      {/* Founder crown */}
      {isFounder && (
        <>
          <polygon
            points="6,8 8,4 10,7 12,2 14,7 16,4 18,8"
            fill={colors.primary}
            opacity="0.9"
          />
          <rect x="6" y="7.5" width="12" height="1.5" rx="0.5" fill={colors.primary} opacity="0.7" />
        </>
      )}
      {/* Outer ring */}
      <circle
        cx="12"
        cy={isFounder ? 15 : 12}
        r={isFounder ? 7 : 10}
        stroke={colors.primary}
        strokeWidth="1.5"
        fill="none"
        opacity="0.3"
      />
      {/* Inner ring */}
      <circle
        cx="12"
        cy={isFounder ? 15 : 12}
        r={isFounder ? 5 : 7}
        stroke={colors.primary}
        strokeWidth="1"
        fill="none"
        opacity="0.5"
      />
      {/* Core */}
      <circle
        cx="12"
        cy={isFounder ? 15 : 12}
        r={isFounder ? 2.5 : 3.5}
        fill={colors.primary}
      />
      {/* Pulse beams — 4 directions */}
      {!isFounder && (
        <>
          <line x1="12" y1="1" x2="12" y2="4" stroke={colors.primary} strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
          <line x1="12" y1="20" x2="12" y2="23" stroke={colors.primary} strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
          <line x1="1" y1="12" x2="4" y2="12" stroke={colors.primary} strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
          <line x1="20" y1="12" x2="23" y2="12" stroke={colors.primary} strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
        </>
      )}
      {/* Diagonal beams for gold/elite */}
      {effectiveLevel >= 3 && !isFounder && (
        <>
          <line x1="3.5" y1="3.5" x2="5.5" y2="5.5" stroke={colors.primary} strokeWidth="1" strokeLinecap="round" opacity="0.5" />
          <line x1="18.5" y1="18.5" x2="20.5" y2="20.5" stroke={colors.primary} strokeWidth="1" strokeLinecap="round" opacity="0.5" />
          <line x1="18.5" y1="5.5" x2="20.5" y2="3.5" stroke={colors.primary} strokeWidth="1" strokeLinecap="round" opacity="0.5" />
          <line x1="3.5" y1="20.5" x2="5.5" y2="18.5" stroke={colors.primary} strokeWidth="1" strokeLinecap="round" opacity="0.5" />
        </>
      )}
      {/* Founder sparkles */}
      {isFounder && (
        <>
          <circle cx="4" cy="14" r="0.8" fill={colors.primary} opacity="0.6" />
          <circle cx="20" cy="14" r="0.8" fill={colors.primary} opacity="0.6" />
          <circle cx="6" cy="20" r="0.6" fill={colors.primary} opacity="0.4" />
          <circle cx="18" cy="20" r="0.6" fill={colors.primary} opacity="0.4" />
        </>
      )}
    </svg>
  );
}
