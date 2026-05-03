import { describe, it, expect } from 'vitest';
import { calculateLineTotal, calculateCartStats, calculateFactureTotals } from '../finance';
import type { LigneFacture, Client } from '../../types';

describe('finance utilities', () => {
    describe('calculateLineTotal', () => {
        it('should calculate basic line total without discount', () => {
            const result = calculateLineTotal(2, 500, 0);
            expect(result).toBe(1000);
        });

        it('should calculate line total with discount percentage', () => {
            const result = calculateLineTotal(2, 1000, 10);
            expect(result).toBe(1800);
        });
    });

    describe('calculateCartStats', () => {
        const mockLignes: LigneFacture[] = [
            {
                produit: { id: 1, name: 'P1', selling_price: '1000', tva: 18 } as any,
                quantite: 1,
                prix_unitaire: 1000,
                remise_produit: 0,
                total_ligne: 1000
            } as any,
            {
                produit: { id: 2, name: 'P2', selling_price: '2000', tva: 0 } as any,
                quantite: 2,
                prix_unitaire: 2000,
                remise_produit: 10,
                total_ligne: 3600
            } as any
        ];

        it('should calculate aggregate stats for multiple items', () => {
            const stats = calculateCartStats(mockLignes);
            // P1: 1000 (HT: 1000 / 1.18 = 847.45) -> No, app usually does HT = TTC / (1 + TVA/100)
            // But wait, my utility did: 
            // const htTotal = ligneTotal / (1 + (tvaRate / 100));
            // const tvaAmount = ligneTotal - htTotal;

            // P1: 1000 TTC, 18% TVA -> HT = 1000 / 1.18 = 847.457, TVA = 152.542
            // P2: 2 * 2000 * 0.9 = 3600 TTC, 0% TVA -> HT = 3600, TVA = 0
            // Total TTC: 4600
            // Total HT: 4447.457
            // Total TVA: 152.542

            expect(stats.totalTTC).toBe(4600);
            expect(Math.round(stats.sousTotal)).toBe(4447);
            expect(Math.round(stats.totalTva)).toBe(153);
        });
    });

    describe('calculateFactureTotals', () => {
        const stats = { sousTotal: 10000, totalTva: 1800, totalTTC: 11800, totalBuyHT: 0 };

        it('should apply global discount amount', () => {
            const totals = calculateFactureTotals(stats, null, '1800', 'montant');
            expect(totals.totalTtc).toBe(10000);
            expect(totals.remiseMontant).toBe(1800);
        });

        it('should apply coverage (tiers-payant)', () => {
            const client: Client = { id: 1, name: 'C1', taux_couverture: '80' } as any;
            const totals = calculateFactureTotals(stats, client, '0', 'montant');

            expect(totals.totalTtc).toBe(11800);
            expect(totals.tauxCouverture).toBe(80);
            expect(totals.partAssurance).toBe(11800 * 0.8);
            expect(totals.partPatient).toBe(11800 * 0.2);
        });
    });
});
