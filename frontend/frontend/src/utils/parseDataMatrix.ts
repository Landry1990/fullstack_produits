/**
 * Parsing Data Matrix / GS1-128 pour médicaments
 * Extrait les Application Identifiers (AI) GS1 depuis la chaîne envoyée par la douchette
 *
 * Format GS1-128 typique :  ]d2  01  03400936191017  10  LOT123  17  260531
 * Avec séparateurs GS (char 0x1D) entre champs de longueur variable
 */

export interface ParsedDataMatrix {
    cip: string | null;       // AI 01 → GTIN-13 (CIP)
    lot: string | null;       // AI 10 → Numéro de lot
    dateExpiration: string | null; // AI 17 → Date de péremption au format MM/YY
    serial: string | null;    // AI 21 → Numéro de série (si présent)
    rawDate: string | null;   // Date brute extraite avant normalisation
}

/**
 * Normalise une date de péremption vers le format MM/YY
 * Supporte : "05/2026", "05 2026", "05.2026", "05.26", "05/26", "260531" (YYMMDD GS1)
 */
export function normalizeDateExpiration(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const s = raw.trim();

    // Format GS1 YYMMDD (ex: "260531" = Mai 2026)
    if (/^\d{6}$/.test(s)) {
        const yy = s.slice(0, 2);
        const mm = s.slice(2, 4);
        // dd = s.slice(4, 6) — ignoré, on ne garde que MM/YY
        if (parseInt(mm) >= 1 && parseInt(mm) <= 12) {
            return `${mm}/${yy}`;
        }
    }

    // Format YYYY-MM-DD ou YYYY/MM/DD (ISO)
    const isoMatch = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (isoMatch) {
        const mm = isoMatch[2].padStart(2, '0');
        const yy = isoMatch[1].slice(-2);
        return `${mm}/${yy}`;
    }

    // Format MM/YYYY, MM YYYY, MM.YYYY
    const longMatch = s.match(/^(\d{1,2})[/\s.](\d{4})$/);
    if (longMatch) {
        const mm = longMatch[1].padStart(2, '0');
        const yy = longMatch[2].slice(-2);
        return `${mm}/${yy}`;
    }

    // Format MM/YY, MM YY, MM.YY (déjà court)
    const shortMatch = s.match(/^(\d{1,2})[/\s.](\d{2})$/);
    if (shortMatch) {
        const mm = shortMatch[1].padStart(2, '0');
        const yy = shortMatch[2];
        return `${mm}/${yy}`;
    }

    return null;
}

/**
 * Parse une chaîne GS1 Data Matrix reçue de la douchette
 * La douchette envoie généralement : ]d2<données>
 * Les champs de longueur variable sont séparés par GS (0x1D)
 */
export function parseDataMatrix(raw: string): ParsedDataMatrix {
    const result: ParsedDataMatrix = {
        cip: null,
        lot: null,
        dateExpiration: null,
        serial: null,
        rawDate: null,
    };

    if (!raw || raw.trim() === '') return result;

    // Nettoyer le préfixe AIM (]d2, ]C1, etc.)
    let data = raw.trim().replace(/^\]d[12]/i, '').replace(/^\]C1/i, '');

    // Remplacer le séparateur GS (0x1D) par un délimiteur lisible
    const GS = '\x1d';
    // Certaines douchettes envoient <GS> en ASCII char ou en \x1D
    // eslint-disable-next-line no-control-regex
    data = data.replace(/\x1d/g, GS);

    // Extraction des AI GS1 connus
    // Stratégie : parcourir la chaîne position par position
    let pos = 0;

    while (pos < data.length) {
        // Sauter les séparateurs GS
        if (data[pos] === GS) {
            pos++;
            continue;
        }

        // Lire l'AI (2 ou 3 chiffres)
        const remaining = data.slice(pos);

        // AI 01 : GTIN (14 chiffres fixes)
        if (remaining.startsWith('01') && /^\d{16}$/.test(remaining.slice(2, 16).padEnd(14, 'X'))) {
            const gtin14 = remaining.slice(2, 16);
            if (/^\d{14}$/.test(gtin14)) {
                // Extraire CIP13 : supprimer premier chiffre (indicateur packaging) et checkdigit ?
                // Format GTIN-14 : 0 + CIP13 (13 chiffres)
                // ou : 1 chiffre emballage + CIP (12) + checkdigit
                // En France : 034XXXXXXXXXX checkdigit → CIP7 ou CIP13
                const cip13 = gtin14.slice(1); // Retire le leading indicator
                result.cip = cip13;
                pos += 16;
                continue;
            }
        }

        // AI 10 : Lot (longueur variable, max 20 chars)
        // Terminé par GS (\x1D) si présent, sinon on cherche uniquement AI 21 imbriqué.
        // Note : certains fabricants encodent un lot court précédé d'un préfixe (ex: "2310" + lot "3091")
        // mais sans GS séparateur, on extrait le champ complet tel quel depuis le Data Matrix.
        if (remaining.startsWith('10')) {
            pos += 2;
            const endGs = data.indexOf(GS, pos);
            if (endGs !== -1) {
                // GS présent : extraction propre
                result.lot = data.slice(pos, endGs).trim();
                pos = endGs;
            } else {
                // Pas de GS : chercher seulement AI 21 imbriqué (pattern "21" + alphanum, longueur connue)
                // On ne tente la détection que si la chaîne restante est > 6 chars (lot min + "21" + série)
                const rest = data.slice(pos);
                const ai21Idx = rest.search(/21[A-Z0-9]/i);
                if (ai21Idx > 0 && ai21Idx <= 20) {
                    result.lot = rest.slice(0, ai21Idx).trim();
                    pos += ai21Idx;
                } else {
                    result.lot = rest.trim();
                    pos = data.length;
                }
            }
            continue;
        }

        // AI 17 : Date d'expiration (6 chiffres fixes YYMMDD)
        if (remaining.startsWith('17')) {
            const dateStr = remaining.slice(2, 8);
            if (/^\d{6}$/.test(dateStr)) {
                result.rawDate = dateStr;
                result.dateExpiration = normalizeDateExpiration(dateStr);
                pos += 8;
                continue;
            }
        }

        // AI 21 : Numéro de série (longueur variable, max 20 chars, terminé par GS ou fin)
        if (remaining.startsWith('21')) {
            pos += 2;
            const endGs = data.indexOf(GS, pos);
            const end = endGs !== -1 ? endGs : data.length;
            result.serial = data.slice(pos, end).trim();
            pos = end;
            continue;
        }

        // AI inconnu : avancer d'un caractère pour éviter la boucle infinie
        pos++;
    }

    return result;
}
