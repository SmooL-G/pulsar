interface NftAvatarBorderProps {
  isNft: boolean;
  size?: number;
  children: React.ReactNode;
}

export function NftAvatarBorder({ isNft, size = 32, children }: NftAvatarBorderProps) {
  if (!isNft) return <>{children}</>;

  return (
    <div
      className="relative rounded-full"
      style={{ width: size + 4, height: size + 4 }}
    >
      {/* Градиентная рамка */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: 'linear-gradient(135deg, #9945FF, #14F195, #00C2FF, #9945FF)',
          backgroundSize: '300% 300%',
          animation: 'nft-border-spin 3s linear infinite',
        }}
      />
      {/* Внутренний контент */}
      <div
        className="absolute rounded-full overflow-hidden"
        style={{
          top: 2,
          left: 2,
          width: size,
          height: size,
        }}
      >
        {children}
      </div>
    </div>
  );
}
