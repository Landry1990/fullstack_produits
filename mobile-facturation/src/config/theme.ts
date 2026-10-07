/**
 * Palette unifiée pour l'app mobile-facturation, alignée sur le design
 * system de l'application web et de pda-inventaire (slate clair + emerald
 * primary).
 */
export const theme = {
  // Backgrounds
  bg: '#f8fafc',
  bgElevated: '#ffffff',
  bgMuted: '#f1f5f9',
  bgOverlay: 'rgba(15, 23, 42, 0.45)',

  // Text
  text: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#64748b',
  textOnPrimary: '#ffffff',

  // Accents
  primary: '#059669',
  primaryDark: '#047857',
  primaryLight: '#d1fae5',
  primaryWash: 'rgba(5, 150, 105, 0.12)',

  // Semantic
  danger: '#dc2626',
  dangerWash: '#fef2f2',
  warning: '#d97706',
  warningWash: '#fffbeb',
  info: '#2563eb',
  infoWash: 'rgba(37, 99, 235, 0.12)',

  // Borders
  border: '#e2e8f0',
  borderStrong: '#cbd5e1',

  // Radius
  radiusSm: 8,
  radiusMd: 12,
  radiusLg: 16,
  radiusXl: 18,
} as const;
