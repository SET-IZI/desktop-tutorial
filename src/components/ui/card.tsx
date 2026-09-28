import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

/** Carte Bento : grand radius, ombre diffuse, jamais de bordure dure. */
export const cardVariants = cva('rounded-bento p-6 sm:p-8', {
  variants: {
    tone: {
      surface: 'bg-surface shadow-soft',
      muted: 'bg-surface-2',
      glass: 'glass shadow-float',
      blue: 'bg-blue/10',
      violet: 'bg-violet/10',
      pink: 'bg-pink/10',
      orange: 'bg-orange/10',
      green: 'bg-green/10',
    },
    interactive: {
      true: 'transition-transform duration-300 hover:-translate-y-0.5 hover:shadow-float',
    },
  },
  defaultVariants: { tone: 'surface' },
});

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof cardVariants> {}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, tone, interactive, ...props },
  ref,
) {
  return (
    <div ref={ref} className={cn(cardVariants({ tone, interactive }), className)} {...props} />
  );
});

export function CardTitle({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn('text-[21px] font-semibold tracking-tight', className)} {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('mt-1 text-fg-muted', className)} {...props} />;
}
