import { formatCurrency, formatNumber } from '../../utils/formatters';

export const COLUMN_LABELS: Record<string, string> = {
    rang: '#',
    client_id: 'ID',
    client_name: 'Client',
    client_type: 'Type',
    nb_ventes: 'Nb Ventes',
    chiffre_affaires: 'CA TTC',
    panier_moyen: 'Panier Moy.',
    name: 'Nom',
    nom_produit: 'Produit',
    cip: 'CIP',
    total_montant: 'Montant Total',
    stock: 'Stock',
    rayon: 'Rayon',
    fournisseur: 'Fournisseur',
    mode_paiement: 'Mode Règl.',
    reference: 'Référence',
    valeur: 'Valeur',
    pmp: 'PMP',
    vendeur: 'Vendeur',
    nbre_ventes: 'Nb Ventes',
    total: 'Total',
    status: 'Statut',
    dernier_vente: 'Dernière Vente',
    date_annulation: 'Date Annulation',
    numero_facture: 'Facture',
    quantite_annulee: 'Qté Annulée',
    lot: 'Lot',
    stock_actuel: 'Stock Actuel',
    annule_par: 'Annulé Par',
    motif: 'Motif',
    source: 'Source',
    remise_globale: 'Remise Glob.',
    remise_lignes: 'Remise Lignes',
    remise_fidelite: 'Fidélité',
    total_remise: 'Total Remise',
    ratio_remise_pct: '% / CA',
    ratio_pct: '%',
    numero: 'Facture',
    date: 'Date',
    client: 'Client',
    ayant_droit_details: 'Bénéficiaire',
    montant_paye: 'Déjà Réglé',
    reste_a_payer: 'Solde Dû',
    solde_du: 'Solde Dû',
    total_facture: 'Total Facturé',
    nb_factures: 'Nb Factures',
    status_display: 'Statut',
    qty: 'Qté',
    catttc: 'CA TTC (F)',
    marge: 'Marge Brute (F)',
    taux_marge: 'Taux Marge (%)',
    prix_vente_net: 'Prix Vente Net',
    cout_achat: 'Coût Achat',
    cip1: 'CIP1'
};

export const formatColumnHeader = (col: string, t?: any): string => {
    if (COLUMN_LABELS[col]) return COLUMN_LABELS[col];
    
    const match = col.match(/^(\d{4})_(.*)$/);
    if (match && t) {
        const year = match[1];
        const type = match[2];
        let label = type;
        if (type === 'ca_tva') label = t('reports:ca_tva', { defaultValue: 'CA TVA' });
        else if (type === 'ca_exo') label = t('reports:ca_exo', { defaultValue: 'CA Exo' });
        else if (type === 'total') label = t('common:total', { defaultValue: 'Total' });
        return `${year} ${label}`;
    }

    return col.replace(/_/g, ' ');
};

export const isNumericColumn = (col: string): boolean => {
    const c = col.toLowerCase();
    return c.includes('montant') || 
           c.includes('total') || 
           c.includes('ca') || 
           c.includes('price') || 
           c.includes('cout') || 
           c.includes('marge') || 
           c.includes('chiffre_affaires') ||
           c.includes('solde') ||
           c.includes('quantite') ||
           c.includes('nbre_ventes') ||
           c.includes('nb_ventes') ||
           c.includes('panier_moyen') ||
           c.includes('remise') ||
           c.includes('pct');
};

export const isSummableColumn = (col: string): boolean => {
    const c = col.toLowerCase();
    return c.includes('montant') || 
           c.includes('total') || 
           c.includes('ca') || 
           c.includes('chiffre_affaires') ||
           c.includes('solde') ||
           c.includes('quantite') ||
           c.includes('qty') ||
           c.includes('nbre_ventes') ||
           c.includes('nb_ventes') ||
           c.includes('remise') ||
           c === 'mt_vente' ||
           c === 'mt_achat';
};

export const isAverageColumn = (col: string): boolean => {
    const c = col.toLowerCase();
    return c === 'marge' || c === 'marge_nette' || c === 'marge_brute';
};

export const isPercentageColumn = (col: string): boolean => {
    const c = col.toLowerCase();
    return c.includes('pct') || c.includes('taux') || c.includes('ratio');
};

export const formatValue = (key: string, value: unknown, t?: any): string => {
    if (value === null || value === undefined) return '-';
    
    if (key === 'Mois' && t) {
        return t(`common:months.${value}`, { defaultValue: String(value) });
    }

    if (key === 'total_general' && t) {
        return t('common:total_general', { defaultValue: 'TOTAL GÉNÉRAL' });
    }

    if (key === 'source' && t) {
        return t(`reports.results.sources.${value}`, { defaultValue: String(value) });
    }

    if (key === 'status' && t) {
        return t(`common.status.${String(value).toLowerCase()}`, { defaultValue: String(value) });
    }

    if (typeof value === 'number') {
        if (key.includes('taux') || key.includes('percent')) {
            return formatNumber(value, 1) + ' %';
        }
        if (key.includes('montant') || key.includes('total') || key.includes('ca') || key.includes('price') || key.includes('cout') || key.includes('marge')) {
            return formatCurrency(value);
        }
        return formatNumber(value);
    }
    if (typeof value === 'object' && value !== null) {
        const obj = value as Record<string, unknown>;
        if (obj.name) return String(obj.name);
        if (obj.nom) return String(obj.nom);
        if (obj.numero_facture) return String(obj.numero_facture);
        return JSON.stringify(value);
    }
    
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
            return date.toLocaleDateString('fr-FR');
        }
    }
    
    return String(value);
};
