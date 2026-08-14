"""
Hiérarchie des menus de l'application — source de vérité partagée.

Cette structure est exposée via l'API (endpoint /api/menu-hierarchy/) et
consommée par le frontend pour :
- GestionUtilisateurs : afficher les menus accessibles
- Validation des allowed_menus côté backend

Chaque menu a :
- key : identifiant unique (stocké dans Profile.allowed_menus)
- labelKey : clé de traduction i18n (namespace sidebar)
- submenus : sous-menus optionnels (même structure)
- adminOnly : réservé aux superusers (optionnel)
"""

MENU_HIERARCHY = [
    {'key': 'dashboard', 'labelKey': 'sidebar:dashboard'},
    {'key': 'manager_sidebar', 'labelKey': 'sidebar:manager_sidebar'},
    {
        'key': 'ventes',
        'labelKey': 'sidebar:ventes.title',
        'submenus': [
            {'key': 'ventes_consultation', 'labelKey': 'sidebar:ventes.consultation'},
            {'key': 'ventes_historique', 'labelKey': 'sidebar:ventes.historique'},
            {'key': 'ventes_journal', 'labelKey': 'sidebar:ventes.journal'},
            {'key': 'ventes_clotures', 'labelKey': 'sidebar:ventes.clotures'},
            {'key': 'ventes_ordonnancier', 'labelKey': 'sidebar:ventes.ordonnancier'},
            {'key': 'ventes_promotions', 'labelKey': 'sidebar:ventes.promotions'},
            {'key': 'caisse', 'labelKey': 'sidebar:ventes.caisse_centralisee'},
        ],
    },
    {'key': 'facturation', 'labelKey': 'sidebar:facturation'},
    {'key': 'produits', 'labelKey': 'sidebar:produits'},
    {'key': 'vitrine', 'labelKey': 'sidebar:vitrine'},
    {
        'key': 'commandes_loc',
        'labelKey': 'sidebar:commandes.local_title',
        'submenus': [
            {'key': 'commandes_loc_current', 'labelKey': 'sidebar:commandes.new_current'},
            {'key': 'commandes_loc_history', 'labelKey': 'sidebar:commandes.history'},
        ],
    },
    {
        'key': 'commandes_dir',
        'labelKey': 'sidebar:commandes.direct_title',
        'submenus': [
            {'key': 'commandes_dir_current', 'labelKey': 'sidebar:commandes.new_current'},
            {'key': 'commandes_dir_history', 'labelKey': 'sidebar:commandes.history'},
        ],
    },
    {'key': 'fournisseurs', 'labelKey': 'sidebar:fournisseurs.title'},
    {'key': 'clients', 'labelKey': 'sidebar:clients'},
    {'key': 'creances', 'labelKey': 'sidebar:creances'},
    {
        'key': 'inventaire',
        'labelKey': 'sidebar:stock.title',
        'submenus': [
            {'key': 'inventaire_saisie', 'labelKey': 'sidebar:stock.inventaire.title'},
            {'key': 'inventaire_journal', 'labelKey': 'sidebar:stock.journal'},
            {'key': 'inventaire_analyse', 'labelKey': 'sidebar:stock.analyse.title'},
            {'key': 'inventaire_reappro', 'labelKey': 'sidebar:stock.reappro.title'},
            {'key': 'inventaire_avoirs', 'labelKey': 'sidebar:stock.avoirs'},
            {'key': 'inventaire_promis', 'labelKey': 'sidebar:stock.promis'},
            {'key': 'inventaire_transformations', 'labelKey': 'sidebar:stock.transformations.title'},
            {'key': 'inventaire_perimes', 'labelKey': 'sidebar:stock.perimes.title'},
            {'key': 'inventaire_organisation', 'labelKey': 'sidebar:stock.organisation.title'},
            {'key': 'inventaire_etats', 'labelKey': 'sidebar:stock.etats_inventaire.title'},
            {'key': 'inventaire_rapport_ug', 'labelKey': 'sidebar:stock.rapport_ug'},
        ],
    },
    {
        'key': 'statistiques',
        'labelKey': 'sidebar:statistiques.title',
        'submenus': [
            {'key': 'statistiques_rapports', 'labelKey': 'sidebar:statistiques.rapports'},
            {'key': 'statistiques_abc', 'labelKey': 'sidebar:statistiques.abc'},
            {'key': 'statistiques_fournisseurs', 'labelKey': 'sidebar:statistiques.fournisseurs'},
            {'key': 'statistiques_mensuels', 'labelKey': 'sidebar:statistiques.mensuel'},
            {'key': 'statistiques_finances', 'labelKey': 'sidebar:statistiques.finances'},
            {'key': 'statistiques_vendeurs', 'labelKey': 'sidebar:statistiques.classement_vendeurs'},
            {'key': 'statistiques_temporelle', 'labelKey': 'sidebar:statistiques.analyse_temporelle'},
            {'key': 'statistiques_guide', 'labelKey': 'sidebar:statistiques.guide'},
        ],
    },
    {
        'key': 'settings',
        'labelKey': 'sidebar:parametres.title',
        'submenus': [
            {'key': 'settings_facture', 'labelKey': 'sidebar:parametres.facture'},
            {'key': 'settings_pharmacie', 'labelKey': 'sidebar:parametres.pharmacie'},
            {'key': 'settings_whatsapp', 'labelKey': 'sidebar:parametres.whatsapp'},
            {'key': 'settings_telegram', 'labelKey': 'sidebar:parametres.telegram'},
        ],
    },
    {
        'key': 'compta',
        'labelKey': 'sidebar:compta.title',
        'submenus': [
            {'key': 'compta_dashboard', 'labelKey': 'sidebar:compta.dashboard'},
            {'key': 'compta_grand_livre', 'labelKey': 'sidebar:compta.grand_livre'},
            {'key': 'compta_balance', 'labelKey': 'sidebar:compta.balance'},
            {'key': 'compta_resultat', 'labelKey': 'sidebar:compta.resultat'},
            {'key': 'compta_charges', 'labelKey': 'sidebar:compta.charges'},
            {'key': 'compta_plan', 'labelKey': 'sidebar:compta.plan'},
        ],
    },
    {
        'key': 'divers',
        'labelKey': 'sidebar:divers.title',
        'submenus': [
            {'key': 'divers_ca', 'labelKey': 'sidebar:divers.ca'},
            {'key': 'divers_commandes', 'labelKey': 'sidebar:divers.commandes'},
        ],
    },
    {'key': 'aide_formation', 'labelKey': 'sidebar:aide_formation'},
    {'key': 'perimes', 'labelKey': 'sidebar:stock.perimes.title'},
    {'key': 'commandes', 'labelKey': 'sidebar:commandes.title'},
]


def get_all_menu_keys():
    """Retourne toutes les clés de menus (parents + sous-menus)."""
    keys = []
    for menu in MENU_HIERARCHY:
        keys.append(menu['key'])
        for sub in menu.get('submenus', []):
            keys.append(sub['key'])
    return keys


def get_admin_only_keys():
    """Clés réservées aux superusers."""
    return ['utilisateurs', 'user_sessions', 'audit', 'import_dci', 'maintenance', 'corbeille']


def is_valid_menu_key(key):
    """Vérifie qu'une clé est un menu valide."""
    return key in get_all_menu_keys() or key in get_admin_only_keys()
