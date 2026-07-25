import { useState, useCallback, useRef } from 'react';
import { parseDataMatrix, normalizeDateExpiration } from '../utils/parseDataMatrix';
import type { CommandeProduit } from '../types/procurement';
import type { ProduitModel } from '../types/catalog';

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

function getProductCip(produit: number | ProduitModel | null | undefined): string[] {
    if (!produit || typeof produit === 'number') return [];
    return [
        normalizeCip((produit as ProduitModel).cip1),
        normalizeCip((produit as ProduitModel).cip2),
        normalizeCip((produit as ProduitModel).cip3),
    ].filter(Boolean);
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

            const parsed = parseDataMatrix(rawScan);

            // Si le parsing n'a rien donné (chaîne inconnue), tenter un fallback :
            // certaines douchettes envoient juste le CIP13 brut (13 chiffres)
            let cip = parsed.cip;
            const lot = parsed.lot;
            const dateExpiration = parsed.dateExpiration;

            if (!cip && /^\d{13}$/.test(rawScan.trim())) {
                cip = rawScan.trim();
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
                const cips = getProductCip(cp.produit);
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
            const finalDate = dateExpiration ?? normalizeDateExpiration(parsed.rawDate) ?? '';

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
