import { cn } from '@/lib/utils';
import { useBrandStyle } from '@/hooks/use-brand-style';
import type { BrandStyleVariant } from '@/lib/brand-style';

interface BrandMarkProps {
  compact?: boolean;
  className?: string;
  showTagline?: boolean;
  variant?: BrandStyleVariant;
}

const variantStyles = {
  aurelia: {
    mark: 'border-amber-200/75 bg-gradient-to-br from-amber-50 via-amber-200 to-orange-300 text-zinc-900 shadow-[0_14px_30px_-17px_rgba(245,158,11,0.9)]',
    ring: 'border-amber-50/80',
    glow: 'bg-[radial-gradient(circle_at_24%_20%,rgba(255,255,255,0.95),transparent_52%)]',
    title: 'text-foreground',
    tag: 'border-primary/35 bg-primary/10 text-primary',
  },
  halo: {
    mark: 'border-amber-300/70 bg-gradient-to-br from-amber-100 via-amber-300 to-orange-400 text-zinc-950 shadow-[0_16px_34px_-18px_rgba(245,158,11,0.86)]',
    ring: 'border-amber-50/70',
    glow: 'bg-[radial-gradient(circle_at_26%_22%,rgba(255,255,255,0.95),transparent_58%)]',
    title: 'text-foreground',
    tag: 'border-amber-400/45 bg-amber-300/12 text-amber-600 dark:text-amber-400',
  },
  obsidian: {
    mark: 'border-zinc-700/80 bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-700 text-zinc-50 shadow-[0_14px_26px_-16px_rgba(15,23,42,0.9)]',
    ring: 'border-zinc-400/35',
    glow: 'bg-[radial-gradient(circle_at_22%_18%,rgba(255,255,255,0.25),transparent_55%)]',
    title: 'bg-gradient-to-r from-foreground to-foreground/75 bg-clip-text text-transparent',
    tag: 'border-zinc-600/70 bg-zinc-700/35 text-zinc-100',
  },
} as const;

export function BrandMark({ compact = false, className, showTagline = false, variant }: BrandMarkProps) {
  const [activeVariant] = useBrandStyle();
  const resolvedVariant = variant ?? activeVariant;
  const styles = variantStyles[resolvedVariant];

  return (
    <div className={cn('inline-flex items-center gap-2.5', className)}>
      <div
        className={cn(
          'relative grid place-items-center overflow-hidden rounded-[14px] border font-black tracking-[-0.02em] transition-transform duration-300 hover:scale-[1.03]',
          compact ? 'h-9 w-9 text-[13px]' : 'h-10 w-10 text-[14px]',
          styles.mark,
        )}
      >
        <span className={cn('pointer-events-none absolute inset-[2px] rounded-[11px] border', styles.ring)} />
        <span className="relative z-10">CR</span>
        <span className={cn('pointer-events-none absolute inset-0', styles.glow)} />
      </div>

      <div className="leading-none">
        <div className="flex items-center gap-2">
          <span className={cn('font-semibold tracking-tight', compact ? 'text-[15px]' : 'text-base', styles.title)}>Creator Rail</span>
          <span className={cn('rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]', styles.tag)}>
            AI
          </span>
        </div>
        {!compact && showTagline ? (
          <p className="mt-1 hidden text-[11px] font-medium tracking-[0.04em] text-muted-foreground md:block">Proof-first creator rewards arena</p>
        ) : null}
      </div>
    </div>
  );
}
