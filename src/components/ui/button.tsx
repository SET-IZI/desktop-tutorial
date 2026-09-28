'use client';

import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { forwardRef } from 'react';
import { spring, TAP_SCALE } from '@/lib/motion';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-colors disabled:pointer-events-none disabled:opacity-40',
  {
    variants: {
      variant: {
        primary: 'bg-cta text-cta-fg hover:bg-cta/90',
        accent: 'bg-accent text-accent-fg hover:bg-accent/90',
        secondary: 'bg-fg/[0.06] text-fg hover:bg-fg/10',
        ghost: 'text-fg hover:bg-fg/[0.06]',
        destructive: 'bg-red/10 text-[#C00011] hover:bg-red/15 dark:text-red',
      },
      size: {
        sm: 'min-h-touch px-4 text-[15px]',
        md: 'min-h-[50px] px-6 text-body',
        lg: 'min-h-[56px] px-8 text-[19px]',
        icon: 'size-11 min-h-touch min-w-touch',
      },
      block: { true: 'w-full' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

type Variants = VariantProps<typeof buttonVariants>;

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'>, Variants {
  asChild?: boolean;
  loading?: boolean;
  children?: React.ReactNode;
}

/** Bouton pilule. Jamais d'emoji dans un bouton d'action principal. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant,
    size,
    block,
    asChild,
    loading,
    disabled,
    children,
    type = 'button',
    ...props
  },
  ref,
) {
  const classes = cn(buttonVariants({ variant, size, block }), className);

  if (asChild) {
    return (
      <Slot ref={ref} className={classes} {...(props as React.HTMLAttributes<HTMLElement>)}>
        {children}
      </Slot>
    );
  }

  return (
    <motion.button
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      whileTap={{ scale: TAP_SCALE }}
      transition={spring}
      {...props}
    >
      {loading ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
      {children}
    </motion.button>
  );
});
