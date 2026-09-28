import { cn } from '@/lib/utils';

interface WordmarkProps {
  className?: string;
  /** Couleur du point d'accent. */
  dot?: 'orange' | 'pink' | 'blue';
}

const DOT = { orange: 'bg-orange', pink: 'bg-pink', blue: 'bg-blue' } as const;

/** Logo Miaamm : wordmark en typo arrondie + point d'accent coloré. */
export function Wordmark({ className, dot = 'orange' }: WordmarkProps) {
  return (
    <span
      className={cn(
        'inline-flex items-baseline font-rounded text-[26px] font-extrabold leading-none tracking-[-0.04em] text-fg',
        className,
      )}
    >
      <span aria-hidden>miaamm</span>
      <span
        aria-hidden
        className={cn('ml-[0.08em] inline-block size-[0.26em] rounded-full', DOT[dot])}
      />
      <span className="sr-only">Miaamm</span>
    </span>
  );
}
