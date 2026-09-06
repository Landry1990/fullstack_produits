import { useState, useCallback, useRef } from 'react';
import { parseGS1Datamatrix } from '../utils/gs1Parser';
import { normalizeDateExpiration } from '../utils/parseDataMatrix';
import type { CommandeProduit } from '../types/procurement';

export type ScanResult =
    | { status: 'filled'; index: number; cip: string; lot: string; date: string }
    | { status: 'already_filled'; index: number; cip: string }
    | { status: 'not_found'; cip: string | null; raw: string }
    | { status: 'parse_error'; raw: string };

interface UseDataMatrixScannerOptions {
    commandeProduits: CommandeProduit[];
    updateCommandeProduitField: (
        index: number,
        field: 'lot' | 'date_expiration',
        value: string
    ) => void;
    onNotFound?: () => void;
}

function normalizeCip(cip: string | null | undefined): string {
    if (!cip) return '';
    return cip.trim().replace(/[\s\-.]/g, '').toUpperCase();
}

function getProductCip(cp: CommandeProduit): string[] {
    const cips: string[] = [];
    const produit = cp.produit;

    if (typeof produit === 'number') {
        // Si on n'a que l'ID, on se rabat sur les champs dénormalisés de CommandeProduit
        cips.push(normalizeCip(cp.produit_cip));
        cips.push(normalizeCip(cp.produit_ref));
    } else if (produit) {
        cips.push(normalizeCip(produit.cip1));
        cips.push(normalizeCip(produit.cip2));
        cips.push(normalizeCip(produit.cip3));
        cips.push(normalizeCip(produit.cip4));
        cips.push(normalizeCip(cp.produit_cip));
        cips.push(normalizeCip(cp.produit_ref));
    }

    return cips.filter(Boolean);
}

export function useDataMatrixScanner({
    commandeProduits,
    updateCommandeProduitField,
    onNotFound,
}: UseDataMatrixScannerOptions) {
    const [lastScanResult, setLastScanResult] = useState<ScanResult | null>(null);
    const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
    const clearHighlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const processScan = useCallback(
        (rawScan: string): ScanResult => {
            if (!rawScan.trim()) {
                const r: ScanResult = { status: 'parse_error', raw: rawScan };
                setLastScanResult(r);
                return r;
            }

            const parsed = parseGS1Datamatrix(rawScan);

            // Si le parsing n'a rien donné (chaîne inconnue), tenter un fallback :
            // certaines douchettes envoient juste le CIP13 brut (13 chiffres)
            let cip = parsed.cip;
            const lot = parsed.lot;
            const dateExpiration = parsed.expiration ? normalizeDateExpiration(parsed.expiration) : null;

            if (!cip) {
                const raw = rawScan.trim();
                if (/^\d{13}$/.test(raw)) {
                    cip = raw;
                } else if (/^\d{7}$/.test(raw)) {
                    cip = raw;
                }
            }

            if (!cip) {
                const r: ScanResult = { status: 'not_found', cip: null, raw: rawScan };
                setLastScanResult(r);
                onNotFound?.();
                return r;
            }

            const normalizedScannedCip = normalizeCip(cip);
            const numericScanned = normalizedScannedCip.replace(/^0+/, '');

            // Chercher la ligne correspondante dans la commande
            const matchIndex = commandeProduits.findIndex((cp) => {
                const cips = getProductCip(cp);
                return cips.some(
                    (c) =>
                        c === normalizedScannedCip ||
                        c.replace(/^0+/, '') === numericScanned
                );
            });

            if (matchIndex === -1) {
                const r: ScanResult = { status: 'not_found', cip, raw: rawScan };
                setLastScanResult(r);
                onNotFound?.();
                return r;
            }

            const existing = commandeProduits[matchIndex];
            const alreadyFilled = !!(existing.lot && existing.lot.trim() !== '');

            if (alreadyFilled) {
                // Surligner la ligne et signaler
                setHighlightedIndex(matchIndex);
                if (clearHighlightTimer.current) clearTimeout(clearHighlightTimer.current);
                clearHighlightTimer.current = setTimeout(() => setHighlightedIndex(null), 5000);

                const r: ScanResult = { status: 'already_filled', index: matchIndex, cip };
                setLastScanResult(r);
                return r;
            }

            // Remplir lot et date
            const finalLot = lot ?? '';
            const finalDate = dateExpiration ?? '';

            if (finalLot) {
                updateCommandeProduitField(matchIndex, 'lot', finalLot);
            }
            if (finalDate) {
                updateCommandeProduitField(matchIndex, 'date_expiration', finalDate);
            }

            const r: ScanResult = {
                status: 'filled',
                index: matchIndex,
                cip,
                lot: finalLot,
                date: finalDate,
            };
            setLastScanResult(r);
            return r;
        },
        [commandeProduits, updateCommandeProduitField, onNotFound]
    );

    const clearHighlight = useCallback(() => {
        setHighlightedIndex(null);
    }, []);

    return {
        processScan,
        lastScanResult,
        highlightedIndex,
        clearHighlight,
    };
}
