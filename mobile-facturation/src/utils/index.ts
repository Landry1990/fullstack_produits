// ─── UUID ────────────────────────────────────────────────
/** Génère un UUID v4 unique pour identifier une facture temporaire (pur JS, compatible React Native) */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ─── Formatage ───────────────────────────────────────────
/**
 * Formate un prix en FCFA
 * @example formatPrice(15000) → "15 000 FCFA"
 */
export function formatPrice(amount: number): string {
  return `${amount.toLocaleString('fr-FR')} FCFA`;
}

/**
 * Formate une date ISO en format lisible
 * @example formatDate("2026-05-17T10:30:00") → "17/05/2026 10:30"
 */
export function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

/**
 * Formate une date ISO en format court (date seulement)
 * @example formatDateShort("2026-05-17T10:30:00") → "17/05/2026"
 */
export function formatDateShort(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return isoString;
  }
}

/**
 * Retourne la date/heure courante en ISO string (heure locale)
 */
export function nowISO(): string {
  return new Date().toISOString();
}

// ─── Validation ──────────────────────────────────────────
/**
 * Vérifie si un code-barres est un EAN-13 valide
 * Contrôle la longueur (13 chiffres) et la clé de contrôle
 */
export function isValidEAN13(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false;

  const digits = code.split('').map(Number);
  const checksum = digits.slice(0, 12).reduce((sum, digit, index) => {
    return sum + digit * (index % 2 === 0 ? 1 : 3);
  }, 0);

  const expectedCheck = (10 - (checksum % 10)) % 10;
  return digits[12] === expectedCheck;
}

/**
 * Vérifie si un code-barres a un format minimal acceptable
 * (EAN-13, EAN-8, ou code alphanumérique de 4+ caractères)
 */
export function isValidBarcode(code: string): boolean {
  if (!code || code.trim().length < 4) return false;
  return /^[A-Za-z0-9\-]+$/.test(code.trim());
}

/**
 * Valide qu'un montant est un nombre positif
 */
export function isValidAmount(amount: number): boolean {
  return typeof amount === 'number' && !isNaN(amount) && amount >= 0;
}

/**
 * Valide qu'une quantité est un entier positif
 */
export function isValidQuantity(quantity: number): boolean {
  return Number.isInteger(quantity) && quantity > 0;
}
