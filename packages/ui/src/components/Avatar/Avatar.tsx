import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface AvatarProps {
  src?: string | null;
  alt?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  online?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
};

const indicatorSizes = {
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
  lg: 'w-3 h-3',
  xl: 'w-3.5 h-3.5',
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function Avatar({ src, alt = '', size = 'md', online, className }: AvatarProps) {
  const initials = alt ? getInitials(alt) : '?';

  return (
    <div className={twMerge(clsx('relative inline-flex shrink-0'), className)}>
      {src ? (
        <img
          src={src}
          alt={alt}
          className={twMerge(
            clsx('rounded-full object-cover', sizeClasses[size])
          )}
        />
      ) : (
        <div
          className={twMerge(
            clsx(
              'rounded-full flex items-center justify-center font-medium',
              'bg-primary-500 text-white',
              sizeClasses[size]
            )
          )}
        >
          {initials}
        </div>
      )}
      {online !== undefined && (
        <span
          className={twMerge(
            clsx(
              'absolute bottom-0 right-0 rounded-full border-2 border-white dark:border-dark-700',
              indicatorSizes[size],
              online ? 'bg-green-500' : 'bg-gray-400'
            )
          )}
        />
      )}
    </div>
  );
}
