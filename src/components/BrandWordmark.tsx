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
      className={`inline-flex min-w-0 items-center gap-3 ${className}`}
      aria-label={brand.name}
      data-brand-provisional="true"
    >
      {showMark ? (
        <span
          className="inline-flex h-8 min-w-8 shrink-0 items-center justify-center font-display text-[22px] font-medium leading-none tracking-[-0.12em] text-[#C8FF62]"
          aria-hidden="true"
        >
          an
        </span>
      ) : null}
      <span className="whitespace-nowrap font-display font-semibold tracking-[-0.045em] text-white">
        {brand.shortName.toLowerCase()} {brand.aiSuffix.toLowerCase()}
      </span>
    </span>
  );
}
