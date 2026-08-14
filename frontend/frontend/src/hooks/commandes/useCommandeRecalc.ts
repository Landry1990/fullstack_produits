import { useEffect, useRef } from 'react';
import type { CommandeProduit } from '../../types';
import { normalizeNumberInput } from '../../utils/formatters';

interface UseCommandeRecalcParams {
    commandeType: string;
    viewMode: string;
    tauxChange: string;
    fraisCoefficient: string;
    setCommandeProduits: (updater: (prev: CommandeProduit[]) => CommandeProduit[]) => void;
}

export function useCommandeRecalc(params: UseCommandeRecalcParams) {
    const { commandeType, viewMode, tauxChange, fraisCoefficient, setCommandeProduits } = params;

    const lastRecalcRef = useRef<{ taux: string; coeff: string }>({ taux: '', coeff: '' });
    const recalcTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (commandeType === 'DIR' && (viewMode === 'CREATE' || viewMode === 'EDIT')) {
            const rate = normalizeNumberInput(tauxChange || '0');
            const coeff = normalizeNumberInput(fraisCoefficient || '0');

            if (!rate || !coeff) return;

            if (lastRecalcRef.current.taux === tauxChange && lastRecalcRef.current.coeff === fraisCoefficient) {
                return;
            }

            if (recalcTimeoutRef.current) clearTimeout(recalcTimeoutRef.current);

            recalcTimeoutRef.current = setTimeout(() => {
                lastRecalcRef.current = { taux: tauxChange, coeff: fraisCoefficient };

                setCommandeProduits(prev => {
                    if (!prev.some(item => item.prix_euro)) return prev;

                    let hasChanges = false;
                    const updated = prev.map(item => {
                        if (item.prix_euro) {
                            const pEuro = normalizeNumberInput(String(item.prix_euro));
                            if (!isNaN(pEuro)) {
                                // PA HT = prix_euro * taux (sans coefficient)
                                const priceFCFA = pEuro * rate;
                                const newPrice = Math.round(priceFCFA).toString();

                                // selling_price = PA_HT * coeff * marge * (1 + TVA)
                                const costWithFrais = priceFCFA * coeff;
                                const currentMargin = normalizeNumberInput(String(item.marge || 1.3));
                                const currentTva = normalizeNumberInput(String(item.tva || 0));
                                const newSelling = Math.round(costWithFrais * currentMargin * (1 + currentTva / 100)).toString();

                                if (item.price !== newPrice || item.selling_price !== newSelling) {
                                    hasChanges = true;
                                    return { ...item, price: newPrice, selling_price: newSelling };
                                }
                            }
                        }
                        return item;
                    });
                    return hasChanges ? updated : prev;
                });
            }, 500);
        }

        return () => {
            if (recalcTimeoutRef.current) clearTimeout(recalcTimeoutRef.current);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tauxChange, fraisCoefficient, commandeType, viewMode]);
}
