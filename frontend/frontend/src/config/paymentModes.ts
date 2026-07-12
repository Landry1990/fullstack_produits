/**
 * Configuration centralisée des modes de paiement.
 * Source de vérité unique côté frontend — miroir de backend/api/models/billing.py MODES_PAIEMENT.
 * 
 * Pour ajouter un nouveau mode de paiement :
 * 1. Ajouter l'entrée dans MODES_PAIEMENT du backend (billing.py)
 * 2. Ajouter l'entrée ici dans PAYMENT_MODES
 * 3. Ajouter les traductions dans locales/fr/common.json et locales/en/common.json (clé payment_modes.xxx)
 */

export interface PaymentMode {
  /** Clé technique (valeur envoyée au backend) */
  value: string
  /** Emoji/icône pour affichage compact */
  icon: string
  /** Couleur CSS pour les stats/badges */
  colorClass: string
  /** Visible dans la modale de paiement caisse ? */
  showInCaisse: boolean
  /** Visible dans la facturation ? */
  showInFacturation: boolean
  /** Visible dans les filtres du journal ? */
  showInJournal: boolean
}

/**
 * Liste ordonnée de tous les modes de paiement.
 * L'ordre détermine l'affichage dans les boutons et filtres.
 */
export const PAYMENT_MODES: PaymentMode[] = [
  { value: 'especes',       icon: '💵', colorClass: 'bg-emerald-500', showInCaisse: true,  showInFacturation: true,  showInJournal: true },
  { value: 'carte',         icon: '💳', colorClass: 'bg-sky-500',     showInCaisse: true,  showInFacturation: true,  showInJournal: true },
  { value: 'om',            icon: '📱', colorClass: 'bg-amber-500',   showInCaisse: true,  showInFacturation: true,  showInJournal: true },
  { value: 'momo',          icon: '📱', colorClass: 'bg-amber-400',   showInCaisse: true,  showInFacturation: true,  showInJournal: true },
  { value: 'cheque',        icon: '✍️', colorClass: 'bg-sky-500',     showInCaisse: true,  showInFacturation: true,  showInJournal: true },
  { value: 'virement',      icon: '🏦', colorClass: 'bg-sky-500',     showInCaisse: true,  showInFacturation: true,  showInJournal: true },
  { value: 'depot',         icon: '💰', colorClass: 'bg-sky-500',     showInCaisse: true,  showInFacturation: true,  showInJournal: false },
  { value: 'en_compte',     icon: '📋', colorClass: 'bg-amber-500',   showInCaisse: false, showInFacturation: false, showInJournal: false },
  { value: 'recouvrement',  icon: '🔄', colorClass: 'bg-emerald-600', showInCaisse: false, showInFacturation: false, showInJournal: true },
  { value: 'coupon',        icon: '🎫', colorClass: 'bg-purple-500',  showInCaisse: false, showInFacturation: false, showInJournal: false },
]

/** Obtenir un mode par sa clé */
export function getPaymentMode(value: string): PaymentMode | undefined {
  return PAYMENT_MODES.find(m => m.value === value)
}

/** Convertir les modes personnalisés en PaymentMode */
function customModesToPaymentModes(customModes?: { value: string; label: string }[]): PaymentMode[] {
  if (!customModes || customModes.length === 0) return []
  return customModes.map(m => ({
    value: m.value,
    icon: '🔹',
    colorClass: 'bg-indigo-500',
    showInCaisse: true,
    showInFacturation: true,
    showInJournal: true,
  }))
}

/** Modes visibles dans la modale de paiement caisse */
export function getCaissePaymentModes(disabledModes?: string[], customModes?: { value: string; label: string }[]): PaymentMode[] {
  const allModes = [...PAYMENT_MODES, ...customModesToPaymentModes(customModes)]
  return allModes.filter(m => m.showInCaisse && !disabledModes?.includes(m.value))
}

/** Modes visibles dans la facturation */
function getFacturationPaymentModes(disabledModes?: string[], customModes?: { value: string; label: string }[]): PaymentMode[] {
  const allModes = [...PAYMENT_MODES, ...customModesToPaymentModes(customModes)]
  return allModes.filter(m => m.showInFacturation && !disabledModes?.includes(m.value))
}

/** Modes visibles dans les filtres du journal */
export function getJournalPaymentModes(disabledModes?: string[], customModes?: { value: string; label: string }[]): PaymentMode[] {
  const allModes = [...PAYMENT_MODES, ...customModesToPaymentModes(customModes)]
  return allModes.filter(m => m.showInJournal && !disabledModes?.includes(m.value))
}

/** Tous les modes configurables par l'utilisateur (standards + custom) */
export function getConfigurablePaymentModes(customModes?: { value: string; label: string }[]): PaymentMode[] {
  const allModes = [...PAYMENT_MODES, ...customModesToPaymentModes(customModes)]
  return allModes.filter(m => m.showInCaisse || m.showInFacturation)
}

/**
 * Obtenir le label traduit d'un mode de paiement.
 * @param value - clé du mode (ex: 'especes')
 * @param t - fonction de traduction i18next
 * @param customModes - modes personnalisés (optionnel, pour résoudre les labels custom)
 * @returns label traduit ou la clé en majuscules si inconnu
 */
export function getPaymentModeLabel(value: string, t: (key: string) => string, customModes?: { value: string; label: string }[]): string {
  const mode = getPaymentMode(value)
  if (mode) return t(`common:payment_modes.${value}`)
  // Check custom modes
  const custom = customModes?.find(m => m.value === value)
  if (custom) return custom.label
  return value.toUpperCase()
}

/**
 * Obtenir le label avec icône d'un mode de paiement.
 */
export function getPaymentModeWithIcon(value: string, t: (key: string) => string, customModes?: { value: string; label: string }[]): string {
  const mode = getPaymentMode(value)
  if (mode) return `${mode.icon} ${t(`common:payment_modes.${value}`)}`
  // Check custom modes
  const custom = customModes?.find(m => m.value === value)
  if (custom) return `🔹 ${custom.label}`
  return value.toUpperCase()
}
