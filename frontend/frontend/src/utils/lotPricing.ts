/**
 * Utilitaires pour le calcul des prix de lot.
 * Centralise la logique de détermination du prix de vente d'un lot.
 */

/**
 * Retourne le prix de vente d'un lot si valide, sinon le prix de fallback.
 * Un prix de lot est considéré valide s'il est non null, non undefined et non vide.
 */
export function getLotPrice(
    sellingPrice: string | number | null | undefined,
    fallbackPrice: string
): string {
    if (sellingPrice !== null && sellingPrice !== undefined && sellingPrice !== '') {
        return String(sellingPrice)
    }
    return fallbackPrice
}
