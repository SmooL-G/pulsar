interface ProfileBadgeIconProps {
  badge: string | null | undefined;
  size?: number;
  className?: string;
}

const BADGE_CONFIG: Record<string, { emoji: string; label: string; color: string; bg: string }> = {
  BLOGGER: { emoji: '🎬', label: 'Blogger', color: 'text-pink-400', bg: 'bg-pink-500/15' },
  AUTHOR: { emoji: '✍️', label: 'Author', color: 'text-blue-400', bg: 'bg-blue-500/15' },
  BUSINESS: { emoji: '💼', label: 'Business', color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
  MODERATOR: { emoji: '🛡️', label: 'Mod', color: 'text-cyan-400', bg: 'bg-cyan-500/15' },
  ADMIN: { emoji: '⚡', label: 'Admin', color: 'text-amber-400', bg: 'bg-amber-500/15' },
};

export function ProfileBadgeIcon({ badge, size = 14, className = '' }: ProfileBadgeIconProps) {
  if (!badge || !BADGE_CONFIG[badge]) return null;
  const cfg = BADGE_CONFIG[badge];

  return (
    <span
      className={`inline-flex items-center shrink-0 ${cfg.bg} ${cfg.color} rounded-full font-medium ${className}`}
      style={{ fontSize: size * 0.65, padding: `${size * 0.1}px ${size * 0.35}px`, lineHeight: 1.2 }}
      title={cfg.label}
    >
      {cfg.emoji}
    </span>
  );
}

export function ProfileBadgeTag({ badge }: { badge: string | null | undefined }) {
  if (!badge || !BADGE_CONFIG[badge]) return null;
  const cfg = BADGE_CONFIG[badge];

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${cfg.bg} ${cfg.color}`}>
      {cfg.emoji} {cfg.label}
    </span>
  );
}

export { BADGE_CONFIG };
