import { cn } from '../lib/utils';

interface ZenithPharmaLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'horizontal' | 'stacked';
  showTagline?: boolean;
  className?: string;
  iconSize?: number;
}

const SIZE_MAP = {
  sm: { zenith: 'text-lg', pharma: 'text-[0.6rem]', icon: 28 },
  md: { zenith: 'text-2xl', pharma: 'text-xs', icon: 40 },
  lg: { zenith: 'text-4xl', pharma: 'text-sm', icon: 56 },
  xl: { zenith: 'text-6xl', pharma: 'text-lg', icon: 80 },
};

export default function ZenithPharmaLogo({
  size = 'md',
  variant = 'horizontal',
  showTagline = false,
  className = '',
  iconSize,
}: ZenithPharmaLogoProps) {
  const s = SIZE_MAP[size];
  const svgSize = iconSize ?? s.icon;

  return (
    <div
      className={cn(
        'flex items-center gap-3 select-none',
        variant === 'stacked' && 'flex-col gap-2',
        className,
      )}
    >
      {/* ── Custom SVG Icon: Hexagonal emblem + stylized Z + medical cross ── */}
      <div className="relative shrink-0" style={{ width: svgSize, height: svgSize }}>
        <svg
          viewBox="0 0 100 100"
          width={svgSize}
          height={svgSize}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-label="ZENITH PHARMA logo"
        >
          <defs>
            {/* Electric mint gradient */}
            <linearGradient id="zp-mint" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00F5D4" />
              <stop offset="60%" stopColor="#00D9B7" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
            {/* Night-blue gradient for depth */}
            <linearGradient id="zp-night" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#1e293b" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>
            {/* Glow filter */}
            <filter id="zp-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Hexagon — modern tech emblem */}
          <path
            d="M50 6 L86 28 L86 72 L50 94 L14 72 L14 28 Z"
            fill="url(#zp-night)"
            stroke="url(#zp-mint)"
            strokeWidth="3"
            strokeLinejoin="round"
          />

          {/* Stylized "Z" letterform inside hexagon */}
          <path
            d="M32 34 L68 34 L32 66 L68 66"
            fill="none"
            stroke="url(#zp-mint)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.25"
          />

          {/* Medical cross — glowing mint, overlapping the Z */}
          <g filter="url(#zp-glow)">
            <rect x="45" y="36" width="10" height="28" rx="2.5" fill="url(#zp-mint)" />
            <rect x="36" y="45" width="28" height="10" rx="2.5" fill="url(#zp-mint)" />
          </g>
        </svg>
      </div>

      {/* ── Typography ── */}
      <div className={cn('flex flex-col', variant === 'horizontal' && 'leading-none')}>
        <span
          className={cn(
            s.zenith,
            'font-[Syne] font-extrabold uppercase tracking-[0.25em]',
            'text-[#0f172a] dark:text-[#00F5D4]',
          )}
          style={{ fontFamily: 'Syne, sans-serif' }}
        >
          ZENITH
        </span>
        <span
          className={cn(
            s.pharma,
            'font-[Syne] font-bold uppercase tracking-[0.4em]',
            'text-[#059669] dark:text-emerald-400/70',
            variant === 'horizontal' ? 'mt-1' : 'mt-0.5',
          )}
          style={{ fontFamily: 'Syne, sans-serif' }}
        >
          PHARMA
        </span>
        {showTagline && (
          <span className="mt-1.5 text-[0.55rem] font-medium uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
            Pharmacy Management
          </span>
        )}
      </div>
    </div>
  );
}
