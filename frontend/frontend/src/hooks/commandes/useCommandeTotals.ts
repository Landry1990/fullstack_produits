import { useMemo } from 'react';
import type { Commande, CommandeProduit } from '../../types';
import { normalizeNumberInput } from '../../utils/formatters';

export interface CommandeTotals {
    totalHT: number;
    totalTVA: number;
    totalBuyTVA: number;
    totalTTC: number;
    totalBuyHT: number;
    totalBuyTTC: number;
    totalMarginValue: number;
    globalMargin: string;
    globalMarginPercent: string;
}

export function useCommandeTotals(
    commandeProduits: CommandeProduit[],
    selectedCommande: Commande | null
): CommandeTotals {
    return useMemo(() => {
        let totalTVA = 0;  // TVA de vente
        let totalBuyTVA = 0;  // TVA d'achat
        let totalTTC = 0;
        let totalBuyHT = 0;
        let totalBuyTTC = 0;
        let totalSellHT = 0;

        // On utilise toujours la liste éditable (source de vérité).
        // En édition, commandeProduits est initialisé depuis selectedCommande.produits,
        // donc la fallback est inutile — et elle empêche les totaux de se remettre à 0
        // quand l'utilisateur supprime tous les produits.
        const productsToCalc = commandeProduits;

        productsToCalc.forEach(item => {
            const qty = normalizeNumberInput(String(item.quantity || 0));
            const buyPriceHT = normalizeNumberInput(String(item.price || 0));
            const sellPriceTTC = normalizeNumberInput(String(item.selling_price || 0));
            const tvaRate = normalizeNumberInput(String(item.tva || 0));

            const lineBuyHT = qty * buyPriceHT;
            const lineBuyTTC = lineBuyHT * (1 + tvaRate / 100);
            const lineBuyTVA = lineBuyTTC - lineBuyHT;  // TVA sur achat
            const lineSellTTC = qty * sellPriceTTC;
            const lineSellHT = lineSellTTC / (1 + tvaRate / 100);
            const lineSellTVA = lineSellTTC - lineSellHT;  // TVA sur vente

            totalBuyHT += lineBuyHT;
            totalBuyTTC += lineBuyTTC;
            totalBuyTVA += lineBuyTVA;
            totalSellHT += lineSellHT;
            totalTVA += lineSellTVA;  // Garde le nom totalTVA pour compatibilité
            totalTTC += lineSellTTC;
        });

        const globalMargin = totalBuyHT > 0 ? (totalSellHT / totalBuyHT) : 0;
        const globalMarginPercent = totalSellHT > 0 ? ((totalSellHT - totalBuyHT) / totalSellHT * 100) : 0;
        const totalMarginValue = totalSellHT - totalBuyHT;

        return {
            totalHT: totalSellHT,
            totalTVA,  // TVA de vente
            totalBuyTVA,  // TVA d'achat (pour correspondre à la liste)
            totalTTC,
            totalBuyHT,
            totalBuyTTC,
            totalMarginValue,
            globalMargin: globalMargin.toFixed(2),
            globalMarginPercent: globalMarginPercent.toFixed(2)
        };
    }, [commandeProduits]);
}
