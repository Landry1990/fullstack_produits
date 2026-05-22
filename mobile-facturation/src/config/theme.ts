/**
 * Thème de l'application Mobile Facturation
 * Inspiré de DaisyUI mais adapté pour React Native
 * Supporte le thème sombre (par défaut) et potentiellement un thème clair
 */

export const theme = {
  // Couleurs de fond
  background: {
    primary: '#0f172a',      // slate-900 - Fond principal
    secondary: '#1e293b',    // slate-800 - Fond secondaire  
    tertiary: '#334155',     // slate-700 - Fond tertiaire
    card: 'rgba(255, 255, 255, 0.05)',  // Carte glassmorphism
    elevated: '#1e293b',     // Élévation
  },

  // Couleurs de texte
  text: {
    primary: '#f1f5f9',      // slate-100 - Texte principal
    secondary: '#94a3b8',    // slate-400 - Texte secondaire
    muted: '#64748b',        // slate-500 - Texte faible
    inverse: '#0f172a',      // Pour fond clair
  },

  // Couleurs sémantiques
  primary: {
    main: '#10b981',         // emerald-500
    light: '#34d399',        // emerald-400
    dark: '#059669',         // emerald-600
    bg: 'rgba(16, 185, 129, 0.15)',
  },

  success: {
    main: '#22c55e',         // green-500
    light: '#4ade80',        // green-400
    dark: '#16a34a',         // green-600
    bg: 'rgba(34, 197, 94, 0.15)',
  },

  warning: {
    main: '#f59e0b',         // amber-500
    light: '#fbbf24',        // amber-400
    dark: '#d97706',         // amber-600
    bg: 'rgba(245, 158, 11, 0.15)',
  },

  error: {
    main: '#ef4444',         // red-500
    light: '#f87171',        // red-400
    dark: '#dc2626',         // red-600
    bg: 'rgba(239, 68, 68, 0.1)',
  },

  info: {
    main: '#3b82f6',         // blue-500
    light: '#60a5fa',        // blue-400
    dark: '#2563eb',         // blue-600
    bg: 'rgba(59, 130, 246, 0.15)',
  },

  // Bordures
  border: {
    light: 'rgba(255, 255, 255, 0.05)',
    DEFAULT: 'rgba(255, 255, 255, 0.08)',
    strong: 'rgba(255, 255, 255, 0.1)',
  },

  // Ombres et élévation
  shadow: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 4,
    },
  },

  // Rayons de bordure
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    full: 9999,
  },

  // Espacements
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    '2xl': 24,
    '3xl': 32,
  },
} as const;

// Type pour l'autocomplétion
export type Theme = typeof theme;
