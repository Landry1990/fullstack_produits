/**
 * Regroupement par fournisseur du rapport « Ventes par Fournisseur (Lots) »
 * (vue groupée) : sous-totaux et moyennes par lot après chaque fournisseur.
 */

export type SupplierLotRow = Record<string, unknown> & { fournisseur: string };

/** Colonnes cumulées dans la ligne Total. Seule la marge est moyennée (par lot). */
export const SUPPLIER_SUM_COLUMNS = [
    'quantite', 'quantite_ug', 'montant_vente', 'montant_vente_ht', 'montant_achat', 'marge',
] as const;

export interface SupplierAggregate {
    count: number;
    totals: Record<string, number>;
    averages: Record<string, number>;
}

export interface SupplierGroup extends SupplierAggregate {
    fournisseur: string;
    rows: SupplierLotRow[];
}

const aggregate = (rows: SupplierLotRow[]): SupplierAggregate => {
    const totals: Record<string, number> = {};
    const averages: Record<string, number> = {};
    for (const col of SUPPLIER_SUM_COLUMNS) {
        totals[col] = rows.reduce((sum, r) => sum + (Number(r[col]) || 0), 0);
    }
    averages.marge = rows.length ? totals.marge / rows.length : 0;
    // Total : taux pondéré par le CA HT (marge = CA HT − coût HT) ; moyenne : moyenne simple des taux par lot.
    totals.taux_marge = totals.montant_vente_ht ? (totals.marge / totals.montant_vente_ht) * 100 : 0;
    averages.taux_marge = rows.length
        ? rows.reduce((sum, r) => sum + (Number(r.taux_marge) || 0), 0) / rows.length
        : 0;
    return { count: rows.length, totals, averages };
};

export const isSupplierLotsGrouped = (queryId: string | undefined, results: unknown): results is SupplierLotRow[] =>
    queryId === 'ventes_fournisseur_lots' &&
    Array.isArray(results) &&
    results.length > 0 &&
    !('date_creation' in (results[0] as object));

export function groupBySupplier(rows: SupplierLotRow[]): { groups: SupplierGroup[]; grand: SupplierAggregate } {
    const map = new Map<string, SupplierLotRow[]>();
    for (const row of rows) {
        const list = map.get(row.fournisseur);
        if (list) list.push(row);
        else map.set(row.fournisseur, [row]);
    }
    const groups = [...map.entries()].map(([fournisseur, list]) => ({ fournisseur, rows: list, ...aggregate(list) }));
    return { groups, grand: aggregate(rows) };
}
