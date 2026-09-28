import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

/** Couleurs définies en canaux RGB dans src/app/globals.css (thème clair/sombre). */
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  // Sombre automatique via prefers-color-scheme, surchargeable avec data-theme sur <html>.
  darkMode: [
    'variant',
    [
      '@media (prefers-color-scheme: dark) { &:where(:root:not([data-theme=light]) *) }',
      '&:where([data-theme=dark], [data-theme=dark] *)',
    ],
  ],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: token('bg'),
        surface: { DEFAULT: token('surface'), 2: token('surface-2') },
        fg: { DEFAULT: token('fg'), muted: token('fg-muted') },
        line: token('line'),
        accent: { DEFAULT: token('accent'), fg: token('accent-fg') },
        cta: { DEFAULT: token('cta'), fg: token('cta-fg') },
        blue: token('blue'),
        violet: token('violet'),
        pink: token('pink'),
        orange: token('orange'),
        green: token('green'),
        red: token('red'),
      },
      fontFamily: {
        sans: [
          '"Inter Variable"',
          '-apple-system',
          'BlinkMacSystemFont',
          'system-ui',
          'sans-serif',
        ],
        rounded: ['"Nunito Variable"', 'ui-rounded', '"SF Pro Rounded"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        body: ['1.0625rem', { lineHeight: '1.5' }], // 17px
        'display-sm': [
          '2.125rem',
          { lineHeight: '1.1', letterSpacing: '-0.03em', fontWeight: '700' },
        ], // 34
        'display-md': [
          '2.75rem',
          { lineHeight: '1.08', letterSpacing: '-0.03em', fontWeight: '700' },
        ], // 44
        'display-lg': [
          '3.5rem',
          { lineHeight: '1.05', letterSpacing: '-0.03em', fontWeight: '700' },
        ], // 56
        'display-xl': ['5rem', { lineHeight: '1.02', letterSpacing: '-0.03em', fontWeight: '700' }], // 80
      },
      letterSpacing: { display: '-0.03em' },
      borderRadius: { bento: '2rem', 'bento-sm': '1.75rem', 'bento-lg': '2.25rem' },
      boxShadow: {
        soft: '0 2px 8px rgb(0 0 0 / 0.04), 0 12px 40px rgb(0 0 0 / 0.06)',
        float: '0 8px 24px rgb(0 0 0 / 0.08), 0 24px 80px rgb(0 0 0 / 0.12)',
      },
      minHeight: { touch: '44px' },
      minWidth: { touch: '44px' },
      keyframes: {
        'mesh-drift': {
          '0%, 100%': { transform: 'translate3d(0,0,0) scale(1)' },
          '33%': { transform: 'translate3d(6%,-4%,0) scale(1.08)' },
          '66%': { transform: 'translate3d(-5%,5%,0) scale(0.95)' },
        },
      },
      animation: { 'mesh-drift': 'mesh-drift 24s ease-in-out infinite' },
    },
  },
  plugins: [animate],
};

export default config;
