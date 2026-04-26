import { Star } from 'lucide-react';

interface PremiumBadgeProps {
  isPremium?: boolean | null;
  size?: number;
  className?: string;
}

/** Tiny gold star shown next to a user's name when they're an active Premium subscriber. */
export function PremiumBadge({ isPremium, size = 13, className = '' }: PremiumBadgeProps) {
  if (!isPremium) return null;
  return (
    <span
      className={`inline-flex items-center justify-center text-amber-400 ${className}`}
      title="Pulsar Premium"
      style={{ filter: 'drop-shadow(0 0 3px rgba(251,191,36,0.6))' }}
    >
      <Star size={size} fill="currentColor" strokeWidth={1.5} />
    </span>
  );
}
