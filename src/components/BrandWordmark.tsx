import { brand } from '@/config/brand';

interface BrandWordmarkProps {
  className?: string;
  showMark?: boolean;
}

export function BrandWordmark({
  className = '',
  showMark = true,
}: BrandWordmarkProps) {
  return (
    <span
      className={`inline-flex min-w-0 items-center gap-2.5 ${className}`}
      aria-label={brand.name}
      data-brand-provisional="true"
    >
      {showMark ? (
        <span
          className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#29C5FF]/70"
          aria-hidden="true"
        >
          <span className="h-4 w-4 rounded-full border border-white/80" />
        </span>
      ) : null}
      <span className="whitespace-nowrap font-black tracking-[-0.035em]">
        <span className="text-white">{brand.shortName}</span>{' '}
        <span className="text-[#1E9BF0]">{brand.aiSuffix}</span>
      </span>
    </span>
  );
}