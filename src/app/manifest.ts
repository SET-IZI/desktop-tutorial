import type { MetadataRoute } from 'next';

/** Installable sur l'écran d'accueil : requis pour les notifications sur iPhone. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Miaamm',
    short_name: 'Miaamm',
    description: 'Click & Collect et livraison sans commission.',
    start_url: '/app/cuisine',
    display: 'standalone',
    background_color: '#F5F5F7',
    theme_color: '#F5F5F7',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
