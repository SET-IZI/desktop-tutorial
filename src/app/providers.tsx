'use client';

import { MotionConfig } from 'framer-motion';
import { useEffect } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Marqueur d'hydratation : les tests E2E l'attendent avant d'interagir.
    document.documentElement.dataset.hydrated = 'true';
  }, []);

  // Respecte prefers-reduced-motion pour toutes les animations Framer.
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
