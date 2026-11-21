import { useState } from 'react';
import type { PresenceStatus } from '../types/app';

interface AvatarProps {
  src?: string;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  presence?: PresenceStatus;
}

const SIZE_CLASSES: Record<NonNullable<AvatarProps['size']>, string> = {
  sm: 'w-9 h-9 text-xs',
  md: 'w-11 h-11 text-sm',
  lg: 'w-14 h-14 text-base',
  xl: 'w-24 h-24 text-2xl',
};

export function Avatar({ src, name, size = 'md', presence }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const firstChar = parts[0]?.[0] || 'W';
  const isArabicFirst = /[\u0600-\u06FF]/.test(firstChar);
  const initials = isArabicFirst
    ? firstChar
    : parts
        .slice(0, 2)
        .map((part) => part[0] || '')
        .join('')
        .toUpperCase() || 'W';

  const presenceColor =
    presence === 'online'
      ? 'bg-emerald-500'
      : presence === 'in-call'
        ? 'bg-amber-500'
        : presence === 'busy'
          ? 'bg-rose-500'
          : 'bg-slate-400';

  return (
    <div className={`relative inline-flex shrink-0 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold overflow-visible ${SIZE_CLASSES[size]}`}>
      <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center">
        {src && !failed ? (
          <img
            src={src}
            alt={name}
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <span>{initials}</span>
        )}
      </div>
      {presence && (
        <span
          aria-hidden="true"
          className={`absolute bottom-0 end-0 w-3 h-3 rounded-full ring-2 ring-white dark:ring-[#131924] ${presenceColor}`}
        />
      )}
    </div>
  );
}
