/**
 * Animated decorative border around an avatar. Driven by the user's
 * `avatarFrame` cosmetic field (purchased via PLS). Renders nothing
 * special if no frame is set or NFT border is already active (NFT
 * takes priority because it's the more "earned" cosmetic).
 */
export type FrameId = 'gold' | 'neon' | 'rainbow' | 'fire' | 'void' | 'aurora';

const FRAME_GRADIENT: Record<FrameId, string> = {
  gold: 'linear-gradient(135deg, #FCD34D, #F59E0B, #B45309, #FCD34D)',
  neon: 'linear-gradient(135deg, #EC4899, #06B6D4, #8B5CF6, #EC4899)',
  rainbow: 'linear-gradient(135deg, #EF4444, #F59E0B, #84CC16, #06B6D4, #8B5CF6, #EF4444)',
  fire: 'linear-gradient(135deg, #FBBF24, #F97316, #DC2626, #7F1D1D, #FBBF24)',
  void: 'linear-gradient(135deg, #1E1B4B, #581C87, #1E1B4B, #4C1D95)',
  aurora: 'linear-gradient(135deg, #34D399, #06B6D4, #8B5CF6, #34D399)',
};

const FRAME_GLOW: Record<FrameId, string> = {
  gold: '0 0 8px rgba(251,191,36,0.6)',
  neon: '0 0 10px rgba(236,72,153,0.7), 0 0 14px rgba(6,182,212,0.5)',
  rainbow: '0 0 10px rgba(139,92,246,0.5)',
  fire: '0 0 10px rgba(239,68,68,0.7)',
  void: '0 0 10px rgba(124,58,237,0.6)',
  aurora: '0 0 10px rgba(52,211,153,0.6)',
};

interface Props {
  frame: string | null | undefined;
  size?: number;
  children: React.ReactNode;
}

export function AvatarFrame({ frame, size = 40, children }: Props) {
  if (!frame || !(frame in FRAME_GRADIENT)) return <>{children}</>;
  const f = frame as FrameId;
  return (
    <div
      className="relative rounded-full"
      style={{
        width: size + 4,
        height: size + 4,
        boxShadow: FRAME_GLOW[f],
      }}
    >
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: FRAME_GRADIENT[f],
          backgroundSize: '300% 300%',
          animation: 'nft-border-spin 4s linear infinite',
        }}
      />
      <div
        className="absolute rounded-full overflow-hidden"
        style={{ top: 2, left: 2, width: size, height: size }}
      >
        {children}
      </div>
    </div>
  );
}

/** Static thumbnail for picker — non-animated, smaller cost. */
export function FrameThumb({ frame, size = 40 }: { frame: FrameId; size?: number }) {
  return (
    <div
      className="rounded-full"
      style={{
        width: size,
        height: size,
        background: FRAME_GRADIENT[frame],
        backgroundSize: '200% 200%',
        boxShadow: FRAME_GLOW[frame],
      }}
    />
  );
}

export const ALL_FRAMES: FrameId[] = ['gold', 'neon', 'rainbow', 'fire', 'void', 'aurora'];
