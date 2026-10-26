import { describe, it, expect } from 'vitest';
import { groupBySupplier, isSupplierLotsGrouped, type SupplierLotRow } from '../supplierGroups';

// `vente` = CA HT ; le CA TTC est majoré de 10 % pour vérifier que le taux se base sur le HT.
const row = (fournisseur: string, quantite: number, vente: number, achat: number): SupplierLotRow => ({
    fournisseur, nom_produit: 'P', lot: 'L', quantite, quantite_ug: 0,
    montant_vente: vente * 1.1, montant_vente_ht: vente, montant_achat: achat, marge: vente - achat,
    taux_marge: vente ? ((vente - achat) / vente) * 100 : 0,
});

describe('groupBySupplier', () => {
    const rows = [row('A', 2, 200, 100), row('A', 4, 100, 75), row('B', 1, 50, 40)];

    it('regroupe par fournisseur dans l’ordre reçu avec totaux et moyennes', () => {
        const { groups, grand } = groupBySupplier(rows);
        expect(groups.map(g => g.fournisseur)).toEqual(['A', 'B']);

        const a = groups[0];
        expect(a.count).toBe(2);
        expect(a.totals.quantite).toBe(6);
        expect(a.totals.montant_vente_ht).toBe(300);
        expect(a.totals.montant_vente).toBeCloseTo(330, 5);
        expect(a.totals.marge).toBe(125);
        // Taux total pondéré par le CA HT : 125 / 300
        expect(a.totals.taux_marge).toBeCloseTo(41.67, 2);
        // Moyennes par lot : uniquement la marge et le taux de marge
        expect(Object.keys(a.averages).sort()).toEqual(['marge', 'taux_marge']);
        expect(a.averages.marge).toBe(62.5);
        expect(a.averages.taux_marge).toBeCloseTo((50 + 25) / 2, 5);

        expect(grand.count).toBe(3);
        expect(grand.totals.montant_vente_ht).toBe(350);
        expect(grand.totals.marge).toBe(135);
    });

    it('ne s’applique qu’à la vue groupée du rapport fournisseur', () => {
        expect(isSupplierLotsGrouped('ventes_fournisseur_lots', rows)).toBe(true);
        expect(isSupplierLotsGrouped('ventes_fournisseur_lots', [{ ...rows[0], date_creation: 'x' }])).toBe(false);
        expect(isSupplierLotsGrouped('top_selling_products', rows)).toBe(false);
        expect(isSupplierLotsGrouped('ventes_fournisseur_lots', [])).toBe(false);
    });
});
