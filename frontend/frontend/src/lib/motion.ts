import type { Variants } from 'framer-motion'

/**
 * Variants d'animation pour le dashboard (style subtil / pro).
 * Toutes les animations respectent `prefers-reduced-motion` si le composant
 * est rendu sous <MotionConfig reducedMotion="user">.
 */

const EASE_OUT: [number, number, number, number] = [0.25, 0.1, 0.25, 1]

/** Conteneur : orchestre l'entrée en cascade de ses enfants directs. */
export const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
}

/** Version plus rapprochée pour les grilles de cartes denses (KPI). */
export const staggerGrid: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045 } },
}

/** Container qui fade lui-même ET orchestre l'entrée en cascade de ses enfants. */
export const staggerFadeContainer: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.32, ease: EASE_OUT, staggerChildren: 0.06 },
  },
}

/** Élément : fade + slide-up léger. À utiliser en enfant d'un conteneur stagger. */
export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: EASE_OUT } },
}

/** Transition de page : fondu pur, sans déplacement (évite le jitter du scroll). */
export const pageFade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.2, ease: EASE_OUT } },
}

/** Transition de contenu d'onglet (avec AnimatePresence). */
export const tabContent: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: EASE_OUT } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.14, ease: 'easeIn' } },
}

/** Pop discret pour menus dropdown / popovers. */
export const popover: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: -4 },
  show: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.16, ease: EASE_OUT } },
  exit: { opacity: 0, scale: 0.97, y: -4, transition: { duration: 0.12, ease: 'easeIn' } },
}
