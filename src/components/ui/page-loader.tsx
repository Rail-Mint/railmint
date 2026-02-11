import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { BrandMark } from '@/components/branding/BrandMark';

interface PageLoaderProps {
  message?: string;
  className?: string;
}

interface InlineLoaderProps {
  label?: string;
  className?: string;
}

export function PageLoader({ message = 'Syncing creator data...', className }: PageLoaderProps) {
  return (
    <div className={cn('container py-16 md:py-20', className)}>
      <div className="mx-auto max-w-md rounded-2xl border border-border/70 bg-background/75 p-6 text-center shadow-[0_16px_45px_-30px_rgba(245,158,11,0.65)]">
        <div className="mb-4 flex justify-center">
          <BrandMark compact />
        </div>

        <div className="mb-3 flex items-center justify-center gap-2">
          {[0, 1, 2].map((dot) => (
            <motion.span
              key={dot}
              className="h-2 w-2 rounded-full bg-primary"
              animate={{ opacity: [0.35, 1, 0.35], y: [0, -3, 0] }}
              transition={{ repeat: Number.POSITIVE_INFINITY, duration: 0.9, delay: dot * 0.14 }}
            />
          ))}
        </div>

        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

export function InlineLoader({ label = 'Loading...', className }: InlineLoaderProps) {
  return (
    <div className={cn('inline-flex items-center gap-2 text-sm text-muted-foreground', className)}>
      <motion.span
        className="h-2 w-2 rounded-full bg-primary"
        animate={{ scale: [0.85, 1.2, 0.85], opacity: [0.45, 1, 0.45] }}
        transition={{ repeat: Number.POSITIVE_INFINITY, duration: 0.9 }}
      />
      {label}
    </div>
  );
}
