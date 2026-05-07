import { useEffect, useState } from 'react';

export interface SparklinePoint {
  ts: string;
  price: number;
  source: string;
}

type Window = '24h' | '7d' | '30d';

let cache: Partial<Record<Window, SparklinePoint[]>> = {};
let cachedAt: Partial<Record<Window, number>> = {};
const REFRESH_MS = 5 * 60 * 1000; // 5 min — chart doesn't need to be live

async function fetchHistory(window: Window): Promise<SparklinePoint[]> {
  try {
    const res = await fetch(`/api/v1/price/history?window=${window}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.points ?? [];
  } catch {
    return [];
  }
}

interface Props {
  window: Window;
  width?: number;
  height?: number;
  /** Stroke colour. Defaults to currentColor so the parent can theme it. */
  color?: string;
  /** Fill area below the line (uses color at 15% opacity). */
  filled?: boolean;
}

export function PriceSparkline({
  window,
  width = 280,
  height = 60,
  color = '#10b981',
  filled = true,
}: Props) {
  const [points, setPoints] = useState<SparklinePoint[] | null>(cache[window] ?? null);

  useEffect(() => {
    if (!cache[window] || Date.now() - (cachedAt[window] ?? 0) > REFRESH_MS) {
      fetchHistory(window).then((p) => {
        cache[window] = p;
        cachedAt[window] = Date.now();
        setPoints(p);
      });
    }
  }, [window]);

  if (!points || points.length < 2) {
    return (
      <div className="text-[10px] text-gray-500 italic h-[60px] flex items-center justify-center">
        {points === null ? 'loading…' : 'not enough data yet'}
      </div>
    );
  }

  // Map each point to (x, y) in viewBox coordinates.
  const min = Math.min(...points.map((p) => p.price));
  const max = Math.max(...points.map((p) => p.price));
  const range = max - min || max || 1;

  const padX = 2;
  const padY = 4;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const xy = points.map((p, i) => {
    const x = padX + (i / (points.length - 1)) * innerW;
    const norm = (p.price - min) / range;
    const y = padY + (1 - norm) * innerH;
    return [x, y] as const;
  });

  const path = xy.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const areaPath = `${path} L${xy[xy.length - 1][0].toFixed(1)},${(height - padY).toFixed(1)} L${xy[0][0].toFixed(1)},${(height - padY).toFixed(1)} Z`;

  const last = points[points.length - 1];
  const lastXY = xy[xy.length - 1];

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block w-full">
      {filled && (
        <path d={areaPath} fill={color} opacity={0.15} />
      )}
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      {/* Endpoint dot */}
      <circle cx={lastXY[0]} cy={lastXY[1]} r={2.2} fill={color} />
    </svg>
  );
}
