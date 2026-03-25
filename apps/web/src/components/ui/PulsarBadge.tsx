interface PulsarBadgeProps {
  level: number; // 0 = none, 1 = gray, 2 = green, 3 = gold
  size?: number;
  className?: string;
}

const LEVEL_COLORS = {
  1: { primary: '#9CA3AF', glow: 'rgba(156,163,175,0.4)', name: 'gray' },
  2: { primary: '#34D399', glow: 'rgba(52,211,153,0.5)', name: 'green' },
  3: { primary: '#FBBF24', glow: 'rgba(251,191,36,0.5)', name: 'gold' },
} as const;

export function PulsarBadge({ level, size = 16, className = '' }: PulsarBadgeProps) {
  if (level < 1 || level > 3) return null;

  const colors = LEVEL_COLORS[level as 1 | 2 | 3];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={`inline-block shrink-0 ${className}`}
      style={{ filter: `drop-shadow(0 0 3px ${colors.glow})` }}
    >
      {/* Outer ring */}
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke={colors.primary}
        strokeWidth="1.5"
        fill="none"
        opacity="0.3"
      />
      {/* Inner ring */}
      <circle
        cx="12"
        cy="12"
        r="7"
        stroke={colors.primary}
        strokeWidth="1"
        fill="none"
        opacity="0.5"
      />
      {/* Core */}
      <circle
        cx="12"
        cy="12"
        r="3.5"
        fill={colors.primary}
      />
      {/* Pulse beams — 4 directions */}
      <line x1="12" y1="1" x2="12" y2="4" stroke={colors.primary} strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
      <line x1="12" y1="20" x2="12" y2="23" stroke={colors.primary} strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
      <line x1="1" y1="12" x2="4" y2="12" stroke={colors.primary} strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
      <line x1="20" y1="12" x2="23" y2="12" stroke={colors.primary} strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
      {/* Diagonal beams for gold */}
      {level === 3 && (
        <>
          <line x1="3.5" y1="3.5" x2="5.5" y2="5.5" stroke={colors.primary} strokeWidth="1" strokeLinecap="round" opacity="0.5" />
          <line x1="18.5" y1="18.5" x2="20.5" y2="20.5" stroke={colors.primary} strokeWidth="1" strokeLinecap="round" opacity="0.5" />
          <line x1="18.5" y1="5.5" x2="20.5" y2="3.5" stroke={colors.primary} strokeWidth="1" strokeLinecap="round" opacity="0.5" />
          <line x1="3.5" y1="20.5" x2="5.5" y2="18.5" stroke={colors.primary} strokeWidth="1" strokeLinecap="round" opacity="0.5" />
        </>
      )}
    </svg>
  );
}
