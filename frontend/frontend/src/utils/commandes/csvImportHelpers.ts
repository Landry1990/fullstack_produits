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

// Calcule le score de similarité entre deux noms (0-100%)
// Basé sur les tokens/mots communs avec vérification stricte
function calculateNameScore(csvName: string, dbName: string): number {
    // Ignorer les codes/numéros (CIP, dosage, etc.)
    const csvTokens = normalizeText(csvName)
        .split(/\s+/)
        .filter(t => t.length >= 3 && !/^\d/.test(t) && !/^(mg|ml|g|mcg|ui|cp|cpr|inj|sol)$/.test(t));
    const dbTokens = normalizeText(dbName)
        .split(/\s+/)
        .filter(t => t.length >= 3 && !/^\d/.test(t) && !/^(mg|ml|g|mcg|ui|cp|cpr|inj|sol)$/.test(t));

    if (csvTokens.length === 0 || dbTokens.length === 0) return 0;

    let exactMatches = 0;     // Match exact (prioritaire)
    let partialMatches = 0;   // Match partiel (début de mot)
    const usedDbTokens = new Set<number>();

    for (const csvToken of csvTokens) {
        let found = false;

        for (let i = 0; i < dbTokens.length; i++) {
            if (usedDbTokens.has(i)) continue;
            const dbToken = dbTokens[i];

            // Correspondance EXACTE (poids fort) : "loolip" = "loolip"
            if (csvToken === dbToken) {
                exactMatches++;
                usedDbTokens.add(i);
                found = true;
                break;
            }
        }

        if (found) continue;

        // Correspondance PARTIELLE (poids faible) : "lool" dans "loolip"
        for (let i = 0; i < dbTokens.length; i++) {
            if (usedDbTokens.has(i)) continue;
            const dbToken = dbTokens[i];

            // Minimum 4 caractères pour un match partiel (évite "cp" qui match tout)
            if (csvToken.length >= 4 && dbToken.startsWith(csvToken)) {
                partialMatches += 0.5;  // Demi-point pour partiel
                usedDbTokens.add(i);
                break;
            }
            if (dbToken.length >= 4 && csvToken.startsWith(dbToken)) {
                partialMatches += 0.5;
                usedDbTokens.add(i);
                break;
            }
        }
    }

    // Score pondéré : exact = 1.0, partiel = 0.5
    const totalScore = exactMatches + partialMatches;
    const maxPossible = csvTokens.length;
    const percentage = (totalScore / maxPossible) * 100;

    // Pénalité si peu de tokens CSV (risque de faux positif)
    if (csvTokens.length === 1 && exactMatches < 1) return 0;      // 1 token doit être exact
    if (csvTokens.length === 2 && exactMatches < 1) return 0;        // 2 tokens : au moins 1 exact

    return percentage;
}
