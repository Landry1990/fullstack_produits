import type { QueryDefinition } from './types';

export const QUERIES: QueryDefinition[] = [
    {
        id: 'rapport_mensuel',
        name: 'Rapport Mensuel',
        description: 'CA, marges, créances pour un mois donné',
        endpoint: '/api/rapports/rapport_mensuel/',
        params: [
            { key: 'mois', label: 'Mois', type: 'month', required: true }
        ],
        resultType: 'cards'
    },
    {
        id: 'ca_periode',
        name: 'CA par Période',
        description: 'Chiffre d\'affaires sur une période',
        endpoint: '/api/factures/caisse_par_tranche_horaire/',
        params: [
            { key: 'date_debut', label: 'Date début', type: 'datetime', required: true },
            { key: 'date_fin', label: 'Date fin', type: 'datetime', required: true }
        ],
        resultType: 'cards'
    },
    {
        id: 'alertes_stock',
        name: 'Alertes Stock',
        description: 'Stock < Rotation Moyenne OU Stock <= Seuil Minimum',
        endpoint: '/api/produits/stock_alerts/',
        params: [],
        resultType: 'table'
    },
    {
        id: 'produits_perimes',
        name: 'Produits Périmés / Proches',
        description: 'Produits périmés ou proches de la péremption',
        endpoint: '/api/stock-lots/',
        params: [
            { key: 'expiring_within_days', label: 'Jours avant péremption', type: 'number', default: 90 }
        ],
        resultType: 'table'
    },
    {
        id: 'creances',
        name: 'Créances en Cours (Détail)',
        description: 'Liste détaillée des factures non soldées',
        endpoint: '/api/creances/',
        params: [],
        resultType: 'table'
    },
    {
        id: 'creances_synthese',
        name: 'Synthèse Créances par Client',
        description: 'Total des dettes regroupées par client',
        endpoint: '/api/creances/synthese_clients/',
        params: [
            { key: 'date_debut', label: 'Depuis', type: 'date' },
            { key: 'date_fin', label: 'Jusqu\'à', type: 'date' }
        ],
        resultType: 'table'
    },
    {
        id: 'historique_ventes',
        name: 'Ventes par Tranche Horaire',
        description: 'Produits vendus sur une période donnée',
        endpoint: '/api/historique-ventes/ventes_par_tranche/',
        params: [
            { key: 'date_debut', label: 'Début', type: 'datetime', required: true },
            { key: 'date_fin', label: 'Fin', type: 'datetime', required: true }
        ],
        resultType: 'table'
    },
    {
        id: 'produits_non_vendus',
        name: 'Produits Non Vendus',
        description: 'Produits sans vente depuis X jours',
        endpoint: '/api/produits/',
        params: [
            { key: 'jours_sans_vente', label: 'Jours sans vente', type: 'number', default: 90 }
        ],
        resultType: 'table'
    },
    {
        id: 'stock_negatif',
        name: 'Stock Négatif',
        description: 'Produits avec stock négatif ou faible, triés par quantité',
        endpoint: '/api/produits/',
        params: [
            { key: 'stock_lt', label: 'Stock inférieur à', type: 'number', default: 0 },
            { key: 'ordering', label: 'Tri', type: 'text', default: 'stock' }
        ],
        resultType: 'table'
    },
    {
        id: 'valeur_stock_journalier',
        name: 'Valeur Stock Journalier',
        description: 'Reconstitution historique de la valeur du stock, achats et ventes',
        endpoint: '/api/rapports/valeur_stock_journalier/',
        params: [
            { key: 'date_debut', label: 'Date début', type: 'date', required: true },
            { key: 'date_fin', label: 'Date fin', type: 'date', required: true }
        ],
        resultType: 'table'
    },
    {
        id: 'produits_tva',
        name: 'Produits avec TVA',
        description: 'Liste des produits soumis à la TVA (> 0%)',
        endpoint: '/api/produits/',
        params: [
            { key: 'tva_gt', label: 'TVA supérieure à (%)', type: 'number', default: 0 },
            { key: 'ordering', label: 'Tri', type: 'text', default: '-tva' }
        ],
        resultType: 'table'
    },
    {
        id: 'stocks_morts',
        name: 'Stocks Dormants (Dead Stock)',
        description: 'Produits à forte valeur (Argent qui dort) sans vente',
        endpoint: '/api/rapports/stocks_morts/',
        params: [
            { key: 'min_value', label: 'Valeur Min (F)', type: 'number', default: 100000 },
            { key: 'months', label: 'Mois sans vente', type: 'number', default: 6 }
        ],
        resultType: 'table'
    },
    {
        id: 'alertes_annulations',
        name: 'Alertes Annulations Suspectes',
        description: 'Utilisateurs avec un taux d\'annulation élevé (> seuil)',
        endpoint: '/api/statistiques/cancel_alerts/',
        params: [
            { key: 'threshold', label: 'Seuil annulations', type: 'number', default: 5 },
            { key: 'days', label: 'Sur les derniers (jours)', type: 'number', default: 30 }
        ],
        resultType: 'table'
    },
    {
        id: 'stats_vendeurs',
        name: 'Stats par Vendeurs',
        description: 'Classement des vendeurs par CA (hors caissiers)',
        endpoint: '/api/rapports/stats_vendeurs/',
        params: [
            { key: 'date_debut', label: 'Début', type: 'datetime', required: true },
            { key: 'date_fin', label: 'Fin', type: 'datetime', required: true }
        ],
        resultType: 'table'
    },
    {
        id: 'produits_vendus_tva',
        name: 'Produits Vendus (Soumis à TVA)',
        description: 'Produits avec TVA > 0 vendus sur la période',
        endpoint: '/api/rapports/rapport_tva_vendus/',
        params: [
            { key: 'date_debut', label: 'Début', type: 'date', required: true },
            { key: 'date_fin', label: 'Fin', type: 'date', required: true }
        ],
        resultType: 'table'
    },
    {
        id: 'meilleurs_clients',
        name: 'Meilleurs Clients',
        description: 'Classement clients par CA et nombre de ventes',
        endpoint: '/api/rapports/meilleurs_clients/',
        params: [
            { key: 'date_debut', label: 'Début', type: 'date', required: true },
            { key: 'date_fin', label: 'Fin', type: 'date', required: true }
        ],
        resultType: 'table'
    },
    {
        id: 'recap_paiements_fournisseurs',
        name: 'Récapitulatif Paiements Fournisseurs',
        description: 'Somme des paiements par date et fournisseur',
        endpoint: '/api/paiements-fournisseurs/recap_journalier/',
        params: [
            { key: 'date_debut', label: 'Début', type: 'date', required: true },
            { key: 'date_fin', label: 'Fin', type: 'date', required: true }
        ],
        resultType: 'table'
    },
    {
        id: 'produits_annules',
        name: 'Produits Annulés',
        description: 'Liste des produits issus de factures annulées avec quantités et lots',
        endpoint: '/api/rapports/produits_annules/',
        params: [
            { key: 'date_debut', label: 'Début', type: 'date', required: false },
            { key: 'date_fin', label: 'Fin', type: 'date', required: false }
        ],
        resultType: 'table'
    },
    {
        id: 'balance_stock',
        name: 'Balance des Stocks (Comptabilité)',
        description: 'Stock Initial, Achats, Ventes et Final sur une période (Excel)',
        endpoint: '/api/rapports/balance_stock_excel/',
        params: [
            { key: 'date_debut', label: 'Date début', type: 'date', required: true, default: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0] },
            { key: 'date_fin', label: 'Date fin', type: 'date', required: true, default: new Date().toISOString().split('T')[0] },
            { key: 'exclude_zero', label: 'Exclure stocks à zéro', type: 'checkbox', default: true }
        ],
        resultType: 'raw'
    },
    {
        id: 'recap_valeur_stock_pdf',
        name: 'Récapitulatif Valeur Stock (PDF)',
        description: 'Valeur totale HT, TVA, TTC et répartition détaillée par taux (Format PDF)',
        endpoint: '/api/rapports/valeur_stock_pdf/',
        params: [
            { 
                key: 'valorisation', 
                label: 'Type de valorisation', 
                type: 'select', 
                default: 'ACHAT',
                options: [
                    { value: 'ACHAT', label: "Prix d'Achat (PMP)" },
                    { value: 'VENTE', label: "Prix de Vente" }
                ]
            },
            { 
                key: 'group_by', 
                label: 'Grouper par', 
                type: 'select', 
                default: '',
                options: [
                    { value: '', label: "Aucun (Global)" },
                    { value: 'rayon', label: "Rayon" },
                    { value: 'forme', label: "Forme" },
                    { value: 'groupe', label: "Groupe" }
                ]
            }
        ],
        resultType: 'raw'
    },
    {
        id: 'rapport_ca_multi_annuel',
        name: 'Comparatif CA Multi-Annuel',
        description: 'CA TVA vs Exonéré par mois pour toutes les années disponibles',
        endpoint: '/api/rapports/rapport_ca_multi_annuel/',
        params: [],
        resultType: 'table'
    },
    {
        id: 'rapport_remises',
        name: 'Suivi des Remises (Résumé)',
        description: 'Résumé des remises par utilisateur (Global, Lignes, Fidélité)',
        endpoint: '/api/rapports/rapport_remises/',
        params: [
            { key: 'date_debut', label: 'Début', type: 'date', required: true },
            { key: 'date_fin', label: 'Fin', type: 'date', required: true }
        ],
        resultType: 'table'
    },
    {
        id: 'rapport_remises_details',
        name: 'Suivi des Remises (Détail)',
        description: 'Liste détaillée des factures avec remises',
        endpoint: '/api/rapports/rapport_remises_details/',
        params: [
            { key: 'date_debut', label: 'Début', type: 'date', required: true },
            { key: 'date_fin', label: 'Fin', type: 'date', required: true }
        ],
        resultType: 'table'
    },
    {
        id: 'top_selling_products',
        name: 'Produits les plus vendus',
        description: 'Classement des produits par quantité, CA et marge',
        endpoint: '/api/rapports/top_selling_products/',
        params: [
            { key: 'date_debut', label: 'Début', type: 'date', required: true },
            { key: 'date_fin', label: 'Fin', type: 'date', required: true },
            { key: 'fournisseur_id', label: 'Fournisseur', type: 'fournisseur_id' }
        ],
        resultType: 'table'
    },
    {
        id: 'detail_marges_lots',
        name: 'Détail des Marges par Lot',
        description: 'Ventes détaillées avec lot, coût d\'achat et marge exacte',
        endpoint: '/api/rapports/rapport_detail_marges/',
        params: [
            { key: 'date_debut', label: 'Début', type: 'date', required: true },
            { key: 'date_fin', label: 'Fin', type: 'date', required: true }
        ],
        resultType: 'table'
    },
    {
        id: 'rapport_dynamique',
        name: 'Constructeur de Rapport à la Carte',
        description: 'Choisissez vos colonnes et créez votre propre tableau de vente',
        endpoint: '/api/rapports/rapport_dynamique/',
        params: [
            { 
                key: 'source', 
                label: 'Source de données', 
                type: 'select',
                default: 'ventes',
                options: [
                    { value: 'ventes', label: 'Ventes (Factures)' },
                    { value: 'achats', label: 'Achats (Commandes)' },
                    { value: 'stock', label: 'État du Stock (Lots)' },
                    { value: 'produits', label: 'Catalogue Produits' }
                ]
            },
            { key: 'date_debut', label: 'Début', type: 'date', required: true },
            { key: 'date_fin', label: 'Fin', type: 'date', required: true },
            { key: 'vendeur_id', label: 'Vendeur', type: 'vendeur_id' },
            { key: 'client_id', label: 'Client', type: 'client_id' },
            { key: 'fournisseur_id', label: 'Fournisseur', type: 'fournisseur_id' },
            { key: 'famille_id', label: 'Famille', type: 'famille_id' },
            { 
                key: 'fields', 
                label: 'Colonnes à inclure', 
                type: 'fields_selector',
                options: [
                    { value: 'date', label: 'Date / Réception' },
                    { value: 'facture', label: 'N° Facture / Commande' },
                    { value: 'client', label: 'Client / Fournisseur' },
                    { value: 'vendeur', label: 'Vendeur' },
                    { value: 'produit', label: 'Produit' },
                    { value: 'famille', label: 'Famille' },
                    { value: 'lot', label: 'N° Lot' },
                    { value: 'quantite', label: 'Quantité' },
                    { value: 'prix_vente', label: 'Prix Vente' },
                    { value: 'cout_achat', label: 'Coût Achat / PMP' },
                    { value: 'total_ht', label: 'Total HT / Valeur' },
                    { value: 'marge', label: 'Marge Brute' },
                    { value: 'tva', label: 'TVA (%)' },
                    { value: 'rayon', label: 'Rayon' },
                    { value: 'pourcentage_marge', label: 'Marge (%)' },
                    { value: 'cip', label: 'Code CIP' },
                    { value: 'stock_minimum', label: 'Stock Min' },
                    { value: 'forme', label: 'Forme' },
                    { value: 'fournisseur', label: 'Fournisseur' }
                ],
                default: 'date,produit,quantite,total_ht'
            }
        ],
        resultType: 'table'
    }
];
