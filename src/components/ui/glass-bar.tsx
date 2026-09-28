import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface GlassBarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** "top" : barre de navigation collante. "bottom" : panier flottant. */
  position?: 'top' | 'bottom' | 'static';
  as?: 'div' | 'nav' | 'header' | 'footer';
}

/** Barre Liquid Glass (nav, panier flottant). */
export const GlassBar = forwardRef<HTMLDivElement, GlassBarProps>(function GlassBar(
  { className, position = 'static', as: Tag = 'div', ...props },
  ref,
) {
  return (
    <Tag
      ref={ref}
      className={cn(
        'glass z-40 flex items-center gap-3 shadow-float',
        position === 'top' && 'sticky top-3 mx-3 rounded-full px-4 py-2 sm:mx-auto sm:max-w-3xl',
        position === 'bottom' &&
          'fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] rounded-full px-3 py-2 sm:mx-auto sm:max-w-md',
        position === 'static' && 'rounded-full px-4 py-2',
        className,
      )}
      {...props}
    />
  );
});
