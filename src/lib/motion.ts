import type { Transition } from 'framer-motion';

/** Ressort standard Miaamm (cf. CLAUDE.md > Design). */
export const spring: Transition = { type: 'spring', stiffness: 300, damping: 30 };

/** Échelle appliquée au tap sur tout élément interactif. */
export const TAP_SCALE = 0.96;

/** Apparition au scroll. */
export const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-10% 0px' },
  transition: spring,
} as const;
