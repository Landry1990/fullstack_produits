import { useState, useCallback, useRef } from 'react';
import { toast } from 'react-hot-toast';
import api from '../services/api';
import { parseGS1Datamatrix } from '../utils/gs1Parser';
import type { LigneFacture, ProduitModel } from '../types';

export type ScanStatus = 'idle' | 'loading' | 'success' | 'error';

interface UseDatamatrixScanOptions {
    /** Ajoute le produit au panier (via useCart.addProduit) */
    addProduit: (produit: ProduitModel, options?: { forceStock?: boolean }) => void;
    /** Met à jour le lot sur une ligne existante du panier */
    setLignesFacture: (lignes: LigneFacture[]) => void;
    lignesFacture: LigneFacture[];
}

export function useDatamatrixScan({
    addProduit,
    setLignesFacture,
    lignesFacture,
}: UseDatamatrixScanOptions) {
    const [scanInput, setScanInput] = useState('');
    const [scanStatus, setScanStatus] = useState<ScanStatus>('idle');
    const [lastScanned, setLastScanned] = useState<string | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lignesRef = useRef<LigneFacture[]>(lignesFacture);
    lignesRef.current = lignesFacture;

    const processScan = useCallback(async (raw: string) => {
        const trimmed = raw.trim();
        if (!trimmed) return;

        const parsed = parseGS1Datamatrix(trimmed);

        // Fallback : si le parser ne trouve pas de CIP/lot, tenter de traiter
        // comme une saisie manuelle CIP|LOT séparés par un espace ou pipe
        let cip = parsed.cip;
        let lot = parsed.lot;

        if (!cip || !lot) {
            const parts = trimmed.split(/[\s|;]/).filter(Boolean);
            if (parts.length >= 2) {
                cip = parts[0];
                lot = parts[1];
            }
        }

        if (!cip || !lot) {
            setScanStatus('error');
            toast.error('Format datamatrix non reconnu. Attendu : CIP + N° lot.');
            setTimeout(() => setScanStatus('idle'), 2500);
            return;
        }

        setScanStatus('loading');

        try {
            const { data } = await api.get('stock-lots/by-datamatrix/', {
                params: { cip, lot },
            });

            const produitData: ProduitModel = {
                ...data.produit,
                selling_price: data.selling_price,
                expire_date: data.date_expiration,
            } as ProduitModel;

            // Vérifier si le produit est déjà dans le panier
            const existingIndex = lignesFacture.findIndex(
                (l) => l.produit.id === data.produit.id
            );

            if (existingIndex >= 0) {
                // Mettre à jour le lot sur la ligne existante + incrémenter la quantité
                const updated = lignesFacture.map((l, idx) => {
                    if (idx !== existingIndex) return l;
                    return {
                        ...l,
                        quantite: l.quantite + 1,
                        lotId: String(data.lot_id),
                        lotText: data.lot_numero,
                        lotExpiration: data.date_expiration,
                        prix_unitaire: data.selling_price,
                    };
                });
                setLignesFacture(updated);
            } else {
                // Ajouter le produit au panier, puis forcer le lot
                await addProduit(produitData, { forceStock: true });
                // Après addProduit, injecter le lot sur la nouvelle ligne
                // On utilise un micro-délai pour laisser le state se mettre à jour
                setTimeout(() => {
                    const current = lignesRef.current;
                    const idx = current.findIndex((l) => l.produit.id === data.produit.id);
                    if (idx >= 0) {
                        setLignesFacture(
                            current.map((l, i) =>
                                i === idx
                                    ? {
                                          ...l,
                                          lotId: String(data.lot_id),
                                          lotText: data.lot_numero,
                                          lotExpiration: data.date_expiration,
                                          prix_unitaire: data.selling_price,
                                      }
                                    : l
                            )
                        );
                    }
                }, 150);
            }

            setScanStatus('success');
            setLastScanned(`${data.produit.name} — Lot ${data.lot_numero}`);
            if (data.quantity_remaining <= 0) {
                toast(`⚠️ ${data.produit.name} : stock de ce lot épuisé`, {
                    icon: '⚠️',
                    style: { background: '#fef3c7', color: '#92400e' },
                });
            } else {
                toast.success(`${data.produit.name} ajouté (Lot ${data.lot_numero})`);
            }
        } catch (err: any) {
            setScanStatus('error');
            const detail = err?.response?.data?.detail || 'Lot ou produit introuvable.';
            toast.error(detail);
        } finally {
            setScanInput('');
            setTimeout(() => setScanStatus('idle'), 2000);
        }
    }, [addProduit, setLignesFacture, lignesFacture]);

    const handleScanChange = useCallback((value: string) => {
        setScanInput(value);
        // Les scanners HID envoient tout en < 100ms et terminent par \n ou \r
        // On détecte la fin par le caractère de retour chariot
        if (value.endsWith('\n') || value.endsWith('\r')) {
            processScan(value.trim());
            return;
        }
        // Délai de sécurité : si rien d'autre n'arrive en 300ms → traiter
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            if (value.trim().length > 5) processScan(value.trim());
        }, 300);
    }, [processScan]);

    const handleScanKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && scanInput.trim().length > 0) {
            e.preventDefault();
            if (debounceRef.current) clearTimeout(debounceRef.current);
            processScan(scanInput.trim());
        }
    }, [scanInput, processScan]);

    return {
        scanInput,
        setScanInput,
        scanStatus,
        lastScanned,
        handleScanChange,
        handleScanKeyDown,
    };
}
