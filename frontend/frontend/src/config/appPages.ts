export type AppPageCategory =
  | 'accueil'
  | 'ventes'
  | 'catalogue'
  | 'achats'
  | 'tiers'
  | 'stock'
  | 'rapports'
  | 'parametres';

export interface AppPage {
  path: string;
  value: string;
  titleKey: string;
  category: AppPageCategory;
  permissions: string[];
  keywords: string[];
  adminOnly?: boolean;
}

const page = (
  path: string,
  value: string,
  titleKey: string,
  category: AppPageCategory,
  permissions: string[],
  keywords: string[] = [],
  adminOnly = false
): AppPage => ({ path, value, titleKey, category, permissions, keywords, adminOnly });

export const APP_PAGES: AppPage[] = [
  page('/app/dashboard', 'nav-dashboard', 'dashboard', 'accueil', ['dashboard'], ['accueil', 'home', 'tableau de bord']),
  page('/app/manager-dashboard', 'nav-manager-dashboard', 'manager_sidebar', 'accueil', ['manager_sidebar'], ['manager', 'pilotage', 'objectifs']),
  page('/app/rapport-equipes', 'nav-rapport-equipes', 'teams_report_sidebar', 'accueil', ['manager_sidebar'], ['equipe', 'vendeurs', 'rapport']),

  page('/app/ventes', 'nav-ventes', 'ventes.title', 'ventes', ['ventes', 'ventes_consultation'], ['factures', 'consultation ventes']),
  page('/app/facturation', 'nav-facturation', 'facturation', 'ventes', ['facturation'], ['caisse', 'encaisser', 'nouvelle vente', 'ticket']),
  page('/app/caisse-centralisee', 'nav-caisse-centralisee', 'ventes.caisse_centralisee', 'ventes', ['ventes', 'caisse'], ['caisse', 'paiements', 'encaissements']),
  page('/app/promotions', 'nav-promotions', 'ventes.promotions', 'ventes', ['ventes', 'ventes_promotions'], ['promo', 'remise']),
  page('/app/historique-ventes', 'nav-historique-ventes', 'ventes.historique', 'ventes', ['ventes', 'ventes_historique'], ['historique', 'jour', 'ventes']),
  page('/app/avoirs-clients', 'nav-avoirs-clients', 'ventes.avoirs_clients', 'ventes', ['ventes', 'ventes_avoirs_clients'], ['credit client', 'remboursement', 'retour client']),
  page('/app/recap-client', 'nav-recap-client', 'ventes.recap_client', 'ventes', ['ventes', 'ventes_consultation'], ['recapitulatif', 'client', 'ventes']),
  page('/app/ordonnancier', 'nav-ordonnancier', 'ventes.ordonnancier', 'ventes', ['ventes', 'ventes_ordonnancier'], ['ordonnances', 'prescriptions']),
  page('/app/journal-caisse', 'nav-journal-caisse', 'ventes.journal', 'ventes', ['ventes', 'ventes_journal'], ['journal', 'caisse', 'mouvements']),
  page('/app/historique-clotures', 'nav-historique-clotures', 'ventes.clotures', 'ventes', ['ventes', 'ventes_clotures'], ['cloture', 'caisse', 'historique']),

  page('/app/produits', 'nav-produits', 'produits', 'catalogue', ['produits'], ['articles', 'medicaments', 'cip', 'catalogue', 'stock']),
  page('/app/catalog-dci', 'nav-catalog-dci', 'catalog_dci', 'catalogue', ['produits'], ['dci', 'generique', 'substitution']),
  page('/app/vitrine', 'nav-vitrine', 'vitrine', 'catalogue', ['vitrine'], ['site web', 'boutique', 'web']),

  page('/app/commandes/locales', 'nav-commandes-locales', 'commandes.local_title', 'achats', ['commandes', 'commandes_loc'], ['commande locale', 'grossiste', 'achats']),
  page('/app/commandes/directes', 'nav-commandes-directes', 'commandes.direct_title', 'achats', ['commandes', 'commandes_dir'], ['commande directe', 'import', 'etranger', 'achats']),
  page('/app/historique-achats', 'nav-historique-achats', 'commandes.history', 'achats', ['commandes_loc_history', 'commandes_dir_history'], ['achats', 'receptions', 'commandes cloturees']),
  page('/app/historique-achats/locales', 'nav-historique-achats-locales', 'commandes.history', 'achats', ['commandes_loc_history'], ['achats locaux', 'receptions', 'grossiste']),
  page('/app/historique-achats/directes', 'nav-historique-achats-directes', 'commandes.history', 'achats', ['commandes_dir_history'], ['achats directs', 'import', 'receptions']),
  page('/app/fournisseurs', 'nav-fournisseurs', 'fournisseurs.title', 'achats', ['fournisseurs'], ['grossistes', 'laboratoires', 'tiers']),
  page('/app/statistiques-fournisseurs', 'nav-statistiques-fournisseurs', 'statistiques.fournisseurs', 'achats', ['statistiques_fournisseurs'], ['statistiques', 'analyse fournisseur', 'achats']),

  page('/app/clients', 'nav-clients', 'clients', 'tiers', ['clients', 'clients_consultation'], ['patients', 'ayants droit', 'credits']),
  page('/app/fidelite', 'nav-fidelite', 'fidelite', 'tiers', ['clients'], ['points', 'loyalty', 'carte fidelite']),
  page('/app/outils/imc', 'nav-imc', 'clients_imc', 'tiers', ['clients', 'clients_imc'], ['imc', 'bmi', 'poids', 'clinique']),
  page('/app/creances', 'nav-creances', 'creances', 'tiers', ['creances'], ['dettes', 'impayes', 'credits']),

  page('/app/stock', 'nav-stock-hub', 'hub.stock_title', 'stock', ['inventaire'], ['hub stock', 'centre stock', 'operations']),
  page('/app/inventaire', 'nav-inventaire', 'stock.inventaire.title', 'stock', ['inventaire', 'inventaire_saisie'], ['compter', 'stock physique', 'comptage']),
  page('/app/organisation', 'nav-organisation', 'stock.organisation.title', 'stock', ['inventaire', 'inventaire_organisation'], ['rayons', 'formes', 'groupes', 'rangement']),
  page('/app/rayons', 'nav-rayons', 'stock.organisation.tabs.rayons', 'stock', ['inventaire', 'inventaire_organisation'], ['shelves', 'rangement', 'organisation']),
  page('/app/formes', 'nav-formes', 'stock.organisation.tabs.formes', 'stock', ['inventaire', 'inventaire_organisation'], ['forms', 'galenique', 'organisation']),
  page('/app/groupes', 'nav-groupes', 'stock.organisation.tabs.groupes', 'stock', ['inventaire', 'inventaire_organisation'], ['groups', 'categories', 'organisation']),
  page('/app/perimes', 'nav-perimes', 'stock.perimes.title', 'stock', ['inventaire', 'inventaire_perimes', 'perimes'], ['expiration', 'lots perimes', 'rebut']),
  page('/app/avoirs', 'nav-avoirs', 'stock.avoirs', 'stock', ['inventaire', 'inventaire_avoirs', 'avoirs'], ['retours fournisseurs', 'avoirs', 'rebut']),
  page('/app/promis', 'nav-promis', 'stock.promis', 'stock', ['inventaire', 'inventaire_promis', 'promis'], ['promesses', 'stock reserve', 'rupture']),
  page('/app/stock-analysis', 'nav-stock-analysis', 'stock.analyse.title', 'stock', ['inventaire', 'inventaire_analyse'], ['analyse stock', 'valeur stock', 'rotation']),
  page('/app/cadencier', 'nav-cadencier', 'stock.cadencier.title', 'stock', ['inventaire', 'inventaire_cadencier'], ['commande suggeree', 'echeances', 'reappro']),
  page('/app/reappro-rayon', 'nav-reappro-rayon', 'stock.reappro.title', 'stock', ['inventaire', 'inventaire_reappro'], ['remplir rayon', 'reserve', 'stock rayon']),
  page('/app/reappro-history', 'nav-reappro-history', 'stock.reappro_history', 'stock', ['inventaire', 'inventaire_reappro'], ['historique reappro', 'transferts reserve']),
  page('/app/rapport-ug', 'nav-rapport-ug', 'stock.rapport_ug.title', 'stock', ['inventaire', 'inventaire_rapport_ug'], ['unites gratuites', 'ug', 'rapport']),
  page('/app/etats-inventaire', 'nav-etats-inventaire', 'stock.etats_inventaire.title', 'stock', ['inventaire', 'inventaire_etats'], ['etat stock', 'rapports inventaire']),
  page('/app/journal-ajustements', 'nav-journal-ajustements', 'stock.journal', 'stock', ['inventaire', 'inventaire_journal'], ['ajustements', 'mouvements stock', 'audit stock']),
  page('/app/transformations', 'nav-transformations', 'stock.transformations.title', 'stock', ['inventaire', 'inventaire_transformations'], ['reconditionnement', 'transformation', 'packaging']),

  page('/app/rapports', 'nav-rapports-hub', 'hub.rapports_title', 'rapports', ['statistiques'], ['hub rapports', 'centre rapports', 'reports']),
  page('/app/rapports-mensuels', 'nav-rapports-mensuels', 'statistiques.mensuel', 'rapports', ['statistiques', 'statistiques_mensuels'], ['rapport mensuel', 'synthese', 'performance']),
  page('/app/centre-rapports', 'nav-centre-rapports', 'statistiques.rapports', 'rapports', ['statistiques', 'statistiques_rapports'], ['reports', 'exports', 'analyses']),
  page('/app/analyse-abc', 'nav-analyse-abc', 'statistiques.abc', 'rapports', ['statistiques', 'statistiques_abc'], ['abc', 'pareto', 'produits']),
  page('/app/analyse-marges-produit', 'nav-analyse-marges-produit', 'statistiques.marges_produit', 'rapports', ['statistiques', 'statistiques_finances'], ['marge', 'profit', 'produit']),
  page('/app/module-financier', 'nav-module-financier', 'statistiques.finances', 'rapports', ['statistiques', 'statistiques_finances'], ['finance', 'tresorerie', 'analyse']),
  page('/app/classement-vendeurs', 'nav-classement-vendeurs', 'statistiques.classement_vendeurs', 'rapports', ['statistiques', 'statistiques_vendeurs'], ['vendeurs', 'performance', 'classement']),
  page('/app/challenges', 'nav-challenges', 'statistiques.challenges', 'rapports', ['statistiques', 'statistiques_challenges'], ['objectifs', 'challenge', 'equipe']),
  page('/app/analyse-temporelle', 'nav-analyse-temporelle', 'statistiques.analyse_temporelle', 'rapports', ['statistiques', 'statistiques_temporelle'], ['temps', 'evolution', 'tendance']),
  page('/app/guide-financier', 'nav-guide-financier', 'statistiques.guide', 'rapports', ['statistiques', 'statistiques_guide'], ['guide', 'finance', 'aide']),
  page('/app/compta/dashboard', 'nav-compta-dashboard', 'compta.dashboard', 'rapports', ['compta', 'compta_dashboard'], ['comptabilite', 'dashboard']),
  page('/app/compta/grand-livre', 'nav-compta-grand-livre', 'compta.grand_livre', 'rapports', ['compta', 'compta_grand_livre'], ['comptabilite', 'livre', 'ecritures']),
  page('/app/compta/balance', 'nav-compta-balance', 'compta.balance', 'rapports', ['compta', 'compta_balance'], ['comptabilite', 'balance']),
  page('/app/compta/resultat', 'nav-compta-resultat', 'compta.resultat', 'rapports', ['compta', 'compta_resultat'], ['comptabilite', 'resultat', 'benefice']),
  page('/app/compta/charges', 'nav-compta-charges', 'compta.charges', 'rapports', ['compta', 'compta_charges'], ['comptabilite', 'charges', 'depenses']),
  page('/app/compta/plan-comptable', 'nav-compta-plan', 'compta.plan', 'rapports', ['compta', 'compta_plan'], ['comptabilite', 'plan comptable', 'comptes']),
  page('/app/divers/ca', 'nav-divers-ca', 'divers.ca', 'rapports', ['divers', 'divers_ca', 'divers_commandes'], ['divers', 'chiffre affaires', 'autres ventes']),
  page('/app/divers/stock', 'nav-divers-stock', 'divers.stock', 'rapports', ['divers', 'divers_ca', 'divers_commandes'], ['divers', 'stock divers', 'commandes divers']),

  page('/app/telegram-history', 'nav-telegram-history', 'parametres.telegram', 'parametres', ['settings', 'settings_telegram'], ['telegram', 'messages', 'historique']),
  page('/app/aide-formation', 'nav-aide-formation', 'aide_formation', 'parametres', ['aide_formation'], ['aide', 'formation', 'documentation']),
  page('/app/utilisateurs', 'nav-utilisateurs', 'utilisateurs', 'parametres', [], ['utilisateurs', 'employes', 'permissions'], true),
  page('/app/planning-operateurs', 'nav-planning-operateurs', 'planning_operateurs', 'parametres', ['utilisateurs'], ['planning', 'horaires', 'operateurs']),
  page('/app/user-sessions', 'nav-user-sessions', 'user_sessions_sidebar', 'parametres', [], ['sessions', 'presence', 'connexions'], true),
  page('/app/journal-audit', 'nav-journal-audit', 'audit', 'parametres', [], ['audit', 'traçabilite', 'logs'], true),
  page('/app/import-dci', 'nav-import-dci', 'import_dci', 'parametres', [], ['import', 'dci', 'base medicaments'], true),
  page('/app/maintenance', 'nav-maintenance', 'maintenance', 'parametres', ['maintenance'], ['maintenance', 'nettoyage', 'base']),
  page('/app/systeme', 'nav-systeme', 'parametres.admin_system', 'parametres', [], ['systeme', 'admin', 'serveur'], true),
  page('/app/corbeille', 'nav-corbeille', 'corbeille', 'parametres', ['corbeille'], ['trash', 'supprimes', 'restaurer']),
  page('/app/pharmacy-settings', 'nav-pharmacy-settings', 'parametres.pharmacie', 'parametres', ['settings', 'settings_pharmacie'], ['parametres', 'pharmacie', 'configuration']),
];

export function getAppPage(pathname: string): AppPage | undefined {
  return APP_PAGES.find((item) => item.path === pathname);
}
