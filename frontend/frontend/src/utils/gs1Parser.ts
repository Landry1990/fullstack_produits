/**
 * Parser GS1 Datamatrix pharmaceutique.
 *
 * Format standard GS1-128 / GS1-Datamatrix (norme européenne médicaments) :
 *   ]d2  01<GTIN14>  17<YYMMDD>  10<N°LOT>  21<N°SÉRIE>
 *
 * Identifiants d'application (AI) :
 *   01 = GTIN (14 chiffres)
 *   17 = Date expiration (YYMMDD)
 *   10 = Numéro de lot (longueur variable, terminé par FNC1 ou prochain AI)
 *   21 = Numéro de série (longueur variable)
 *
 * Le CIP13 = les 13 derniers chiffres du GTIN14 (le 1er chiffre est le préfixe GS1).
 */

export interface GS1ParseResult {
    gtin: string | null;
    cip: string | null;
    lot: string | null;
    expiration: string | null;
    serial: string | null;
}

// Caractère FNC1 souvent encodé comme \u001d (GS) dans les scanners HID
const GS = '\u001d';

/**
 * Parse une chaîne brute issue d'un scan datamatrix GS1.
 * Retourne les champs extraits, ou null pour les champs absents.
 */
export function parseGS1Datamatrix(raw: string): GS1ParseResult {
    // Nettoyer les marqueurs de début de format (]d2, ]C1, etc.)
    let s = raw.replace(/^\][a-zA-Z][0-9]/, '').replace(/^\]d[0-9]/, '');

    const result: GS1ParseResult = {
        gtin: null,
        cip: null,
        lot: null,
        expiration: null,
        serial: null,
    };

    // Parcours itératif des AI
    let i = 0;
    while (i < s.length) {
        // Sauter les séparateurs GS
        if (s[i] === GS) { i++; continue; }

        const remaining = s.slice(i);

        // AI 01 — GTIN 14 chiffres (longueur fixe)
        if (remaining.startsWith('01') && remaining.length >= 16) {
            result.gtin = remaining.slice(2, 16);
            result.cip = result.gtin.slice(1); // CIP13 = 13 derniers chiffres
            i += 16;
            continue;
        }

        // AI 17 — Date expiration YYMMDD (longueur fixe 6)
        if (remaining.startsWith('17') && remaining.length >= 8) {
            const raw_date = remaining.slice(2, 8);
            const yy = raw_date.slice(0, 2);
            const mm = raw_date.slice(2, 4);
            const dd = raw_date.slice(4, 6);
            const year = parseInt(yy) + (parseInt(yy) >= 50 ? 1900 : 2000);
            result.expiration = `${year}-${mm}-${dd}`;
            i += 8;
            continue;
        }

        // AI 10 — N° lot (longueur variable, max 20, terminé par GS ou prochain AI connu)
        if (remaining.startsWith('10')) {
            const afterAI = remaining.slice(2);
            const gsPos = afterAI.indexOf(GS);
            // Chercher aussi la position du prochain AI connu (17, 21)
            const nextAI = _findNextAI(afterAI);
            let end = gsPos >= 0 ? gsPos : afterAI.length;
            if (nextAI >= 0 && nextAI < end) end = nextAI;
            end = Math.min(end, 20);
            result.lot = afterAI.slice(0, end);
            i += 2 + end;
            if (i < s.length && s[i] === GS) i++;
            continue;
        }

        // AI 21 — N° série (longueur variable, max 20)
        if (remaining.startsWith('21')) {
            const afterAI = remaining.slice(2);
            const gsPos = afterAI.indexOf(GS);
            const nextAI = _findNextAI(afterAI);
            let end = gsPos >= 0 ? gsPos : afterAI.length;
            if (nextAI >= 0 && nextAI < end) end = nextAI;
            end = Math.min(end, 20);
            result.serial = afterAI.slice(0, end);
            i += 2 + end;
            if (i < s.length && s[i] === GS) i++;
            continue;
        }

        // AI inconnu — avancer d'un caractère pour éviter la boucle infinie
        i++;
    }

    return result;
}

/** Trouve la position du prochain AI connu (01, 10, 17, 21) dans la chaîne. */
function _findNextAI(s: string): number {
    const knownAIs = ['01', '17', '10', '21'];
    let earliest = -1;
    for (const ai of knownAIs) {
        // Chercher à partir de 1 (éviter position 0 qui est l'AI courant)
        const pos = s.indexOf(ai, 1);
        if (pos > 0 && (earliest < 0 || pos < earliest)) {
            earliest = pos;
        }
    }
    return earliest;
}
