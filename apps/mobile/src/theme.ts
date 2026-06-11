// Charte BarberPro — premium, inspirée de Fresha / Booksy
export const colors = {
  black: '#0D0D0D', // noir mat
  anthracite: '#2E2E2E', // gris anthracite
  gold: '#C9A227', // doré
  white: '#FFFFFF',
  muted: '#9A9A9A',
  success: '#3DBE6B',
  warning: '#E8932A',
  danger: '#D64545',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 8,
  md: 14,
  lg: 22,
};

export const typography = {
  title: { fontSize: 26, fontWeight: '700' as const, color: colors.white },
  subtitle: { fontSize: 18, fontWeight: '600' as const, color: colors.white },
  body: { fontSize: 15, color: colors.white },
  caption: { fontSize: 13, color: colors.muted },
  price: { fontSize: 17, fontWeight: '700' as const, color: colors.gold },
};
