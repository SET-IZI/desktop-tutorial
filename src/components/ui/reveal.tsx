'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { spring } from '@/lib/motion';

interface RevealProps {
  className?: string;
  children?: React.ReactNode;
  /** Décalage (secondes) pour enchaîner plusieurs éléments. */
  delay?: number;
  as?: 'div' | 'li';
}

/**
 * Apparition au scroll (fondu + montée, ressort Miaamm). Une seule fois par élément.
 * Désactivée si l'utilisateur a demandé à réduire les animations : rendu statique.
 */
export function Reveal({ delay = 0, as = 'div', className, children }: RevealProps) {
  const reduce = useReducedMotion();
  if (reduce) {
    return as === 'li' ? (
      <li className={className}>{children}</li>
    ) : (
      <div className={className}>{children}</div>
    );
  }
  const Component = as === 'li' ? motion.li : motion.div;
  return (
    <Component
      className={className}
      initial={{ opacity: 0, y: 28, scale: 0.98 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: '0px 0px -8% 0px' }}
      transition={{ ...spring, delay }}
    >
      {children}
    </Component>
  );
}
