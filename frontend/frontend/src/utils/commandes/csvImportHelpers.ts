/**
 * Helpers for commande CSV import (CIP/EAN matching and fuzzy name scoring).
 */

// Parse et formate le prix du CSV : "1988.0", "1988.0000", "1 988,50" → "1988" ou "1988.50"
export function parseCsvPrice(value: string | undefined): string | null {
    if (!value || value.trim() === '') return null;

    // Nettoyer : enlever espaces, remplacer virgule par point
    const cleaned = value.trim()
        .replace(/\s/g, '')           // Enlever espaces
        .replace(/,/g, '.');          // Remplacer virgule par point

    const num = parseFloat(cleaned);
    if (isNaN(num)) return null;

    // Formater : si entier, pas de décimale; sinon max 2 décimales
    if (Number.isInteger(num)) {
        return num.toString();
    }
    return num.toFixed(2).replace(/\.00$/, '');  // "1988.00" → "1988"
}

// Normalise le texte pour comparaison fuzzy (enlève accents, passe en minuscules)
export function normalizeText(value: string | null | undefined): string {
    if (!value) return '';
    return value
        .normalize('NFD')                    // Décompose les accents
        .replace(/[\u0300-\u036f]/g, '')    // Enlève les accents
        .toLowerCase()                      // Minuscules
        .trim();                            // Espaces
}

// NOTE: un score de similarité par tokens était présent ici mais n'était pas
// utilisé. Le matching CSV repose actuellement sur les CIPs (produitService.getByCips).
// Si un fallback par nom est nécessaire, il faudra implémenter et exporter une
// fonction testée avec des seuils clairs.

