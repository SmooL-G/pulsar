/**
 * Генеративный аватар — уникальный по wallet address.
 * Рисует абстрактную фигуру из хэша адреса в стиле Pulsar (фиолетовый/зелёный/голубой).
 */

interface GenerativeAvatarProps {
  seed: string;
  size?: number;
  className?: string;
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function seedRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const PALETTE = [
  '#9945FF', '#14F195', '#00C2FF', '#FF6B6B', '#FFD93D',
  '#6C5CE7', '#00B894', '#0984E3', '#E17055', '#FDCB6E',
  '#A29BFE', '#55EFC4', '#74B9FF', '#FAB1A0', '#FFEAA7',
];

export function GenerativeAvatar({ seed, size = 40, className }: GenerativeAvatarProps) {
  const hash = hashCode(seed);
  const rand = seedRandom(hash);

  // Выбираем 3 цвета из палитры
  const c1 = PALETTE[Math.floor(rand() * PALETTE.length)];
  const c2 = PALETTE[Math.floor(rand() * PALETTE.length)];
  const c3 = PALETTE[Math.floor(rand() * PALETTE.length)];

  // Генерируем фигуры
  const shapes: string[] = [];
  const shapeCount = 3 + Math.floor(rand() * 3);

  for (let i = 0; i < shapeCount; i++) {
    const x = rand() * 100;
    const y = rand() * 100;
    const r = 15 + rand() * 30;
    const color = [c1, c2, c3][Math.floor(rand() * 3)];
    const opacity = 0.4 + rand() * 0.6;
    shapes.push(
      `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" opacity="${opacity}"/>`
    );
  }

  const bgAngle = Math.floor(rand() * 360);

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <defs>
        <linearGradient id="bg${hash}" gradientTransform="rotate(${bgAngle})">
          <stop offset="0%" stop-color="${c1}" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="${c2}" stop-opacity="0.3"/>
        </linearGradient>
        <clipPath id="clip${hash}">
          <circle cx="50" cy="50" r="50"/>
        </clipPath>
      </defs>
      <g clip-path="url(#clip${hash})">
        <rect width="100" height="100" fill="url(#bg${hash})"/>
        ${shapes.join('')}
      </g>
    </svg>
  `.trim();

  const dataUrl = `data:image/svg+xml,${encodeURIComponent(svg)}`;

  return (
    <img
      src={dataUrl}
      alt="avatar"
      width={size}
      height={size}
      className={`rounded-full ${className || ''}`}
    />
  );
}

/**
 * Получить data URL генеративного аватара (для сохранения на сервере).
 */
export function getGenerativeAvatarUrl(seed: string): string {
  const hash = hashCode(seed);
  const rand = seedRandom(hash);

  const c1 = PALETTE[Math.floor(rand() * PALETTE.length)];
  const c2 = PALETTE[Math.floor(rand() * PALETTE.length)];
  const c3 = PALETTE[Math.floor(rand() * PALETTE.length)];

  const shapes: string[] = [];
  const shapeCount = 3 + Math.floor(rand() * 3);

  for (let i = 0; i < shapeCount; i++) {
    const x = rand() * 100;
    const y = rand() * 100;
    const r = 15 + rand() * 30;
    const color = [c1, c2, c3][Math.floor(rand() * 3)];
    const opacity = 0.4 + rand() * 0.6;
    shapes.push(
      `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" opacity="${opacity}"/>`
    );
  }

  const bgAngle = Math.floor(rand() * 360);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="bg" gradientTransform="rotate(${bgAngle})"><stop offset="0%" stop-color="${c1}" stop-opacity="0.3"/><stop offset="100%" stop-color="${c2}" stop-opacity="0.3"/></linearGradient><clipPath id="c"><circle cx="50" cy="50" r="50"/></clipPath></defs><g clip-path="url(#c)"><rect width="100" height="100" fill="url(#bg)"/>${shapes.join('')}</g></svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
