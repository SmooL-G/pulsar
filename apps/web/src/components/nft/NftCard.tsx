interface NftCardProps {
  mint: string;
  name: string;
  image: string;
  collection?: string;
  selected?: boolean;
  onSelect: (mint: string) => void;
}

export function NftCard({ mint, name, image, collection, selected, onSelect }: NftCardProps) {
  return (
    <button
      onClick={() => onSelect(mint)}
      className={`relative rounded-xl overflow-hidden border-2 transition-all hover:scale-[1.02] ${
        selected
          ? 'border-primary-500 ring-2 ring-primary-500/30'
          : 'border-transparent hover:border-dark-400'
      }`}
    >
      <div className="aspect-square bg-dark-600">
        <img
          src={image}
          alt={name}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23333" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%23666" font-size="14">NFT</text></svg>';
          }}
        />
      </div>
      <div className="px-2 py-1.5 bg-dark-700">
        <p className="text-xs font-medium text-gray-200 truncate">{name}</p>
        {collection && (
          <p className="text-[10px] text-gray-500 truncate">{collection}</p>
        )}
      </div>
      {selected && (
        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary-500 flex items-center justify-center">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      )}
    </button>
  );
}
