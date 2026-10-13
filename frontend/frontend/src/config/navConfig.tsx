import type { ReactNode } from 'react';
import type { AppPageCategory } from './appPages';

/**
 * Source unique de la navigation sidebar.
 *
 * - `key` : clé de permission utilisée dans `allowed_menus`.
 * - `aliasPermissions` : clés héritées qui rendent l'entrée visible
 *   (ex. `commandes_loc` rend visibles seulement les sous-menus locaux).
 * - `adminOnly` : réservé aux superutilisateurs.
 * - `group` (sous-menus) : identifiant de sous-section affiché comme en-tête
 *   dans la liste (`sidebar:menu_groups.<group>`).
 */
export interface NavSubMenuItem {
  path: string;
  labelKey: string;
  labelFallback?: string;
  key: string;
  aliasPermissions?: string[];
  group?: string;
}

export interface NavItem {
  path?: string;
  labelKey: string;
  labelFallback?: string;
  key: string;
  category: AppPageCategory;
  icon: ReactNode;
  submenus?: NavSubMenuItem[];
  aliasPermissions?: string[];
  adminOnly?: boolean;
}

const ICON_DASHBOARD = (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
);
const ICON_CHART = (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" /></svg>
);
const ICON_TEAM = (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
);
const ICON_MONEY = (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
);
const ICON_RECEIPT = (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
);
const ICON_CUBE = (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
);
const ICON_CLOCK = (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
);
const ICON_GLOBE = (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
);
const ICON_CART = (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
);
const ICON_CARD = (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
);
const ICON_BOX = (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
);
const ICON_GEAR = (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 002.573-1.066c1.543.94-3.31.826-2.37 2.37a1.724 1.724 0 001.065 2.572c.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
);
const ICON_HELP = (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 10 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
);
const ICON_CALENDAR = (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
);
const ICON_DOC = (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
);
const ICON_UPLOAD = (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
);
const ICON_TRASH = (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
);

export const NAV_ITEMS: NavItem[] = [
  { path: '/app', labelKey: 'dashboard', key: 'dashboard', category: 'accueil', icon: ICON_DASHBOARD },
  { path: '/app/manager-dashboard', labelKey: 'manager_sidebar', key: 'manager_sidebar', category: 'accueil', icon: ICON_CHART },
  { path: '/app/rapport-equipes', labelKey: 'teams_report_sidebar', labelFallback: 'Rapport Équipes', key: 'manager_sidebar', category: 'accueil', icon: ICON_TEAM },
  {
    labelKey: 'ventes.title',
    key: 'ventes',
    category: 'ventes',
    icon: ICON_MONEY,
    submenus: [
      { path: '/app/ventes', labelKey: 'ventes.consultation', key: 'ventes_consultation' },
      { path: '/app/historique-ventes', labelKey: 'ventes.historique', key: 'ventes_historique' },
      { path: '/app/avoirs-clients', labelKey: 'ventes.avoirs_clients', key: 'ventes_avoirs_clients' },
      { path: '/app/recap-client', labelKey: 'ventes.recap_client', key: 'ventes_consultation' },
      { path: '/app/journal-caisse', labelKey: 'ventes.journal', key: 'ventes_journal' },
      { path: '/app/historique-clotures', labelKey: 'ventes.clotures', key: 'ventes_clotures' },
      { path: '/app/ordonnancier', labelKey: 'ventes.ordonnancier', key: 'ventes_ordonnancier' },
      { path: '/app/promotions', labelKey: 'ventes.promotions', key: 'ventes_promotions' },
      { path: '/app/caisse-centralisee', labelKey: 'ventes.caisse_centralisee', key: 'caisse' },
    ],
  },
  { path: '/app/facturation', labelKey: 'facturation', key: 'facturation', category: 'ventes', icon: ICON_RECEIPT },
  { path: '/app/produits', labelKey: 'produits', key: 'produits', category: 'catalogue', icon: ICON_CUBE },
  { path: '/app/catalog-dci', labelKey: 'catalog_dci', key: 'produits', category: 'catalogue', icon: ICON_CLOCK },
  { path: '/app/vitrine', labelKey: 'vitrine', key: 'vitrine', category: 'catalogue', icon: ICON_GLOBE, aliasPermissions: ['produits'] },
  {
    labelKey: 'commandes.title',
    key: 'commandes',
    category: 'achats',
    icon: ICON_CART,
    aliasPermissions: ['commandes_loc', 'commandes_dir'],
    submenus: [
      { path: '/app/commandes/locales', labelKey: 'commandes.new_current', key: 'commandes_loc_current', group: 'commandes_locales', aliasPermissions: ['commandes_loc'] },
      { path: '/app/historique-achats/locales', labelKey: 'commandes.history', key: 'commandes_loc_history', group: 'commandes_locales', aliasPermissions: ['commandes_loc'] },
      { path: '/app/commandes/directes', labelKey: 'commandes.new_current', key: 'commandes_dir_current', group: 'commandes_directes', aliasPermissions: ['commandes_dir'] },
      { path: '/app/historique-achats/directes', labelKey: 'commandes.history', key: 'commandes_dir_history', group: 'commandes_directes', aliasPermissions: ['commandes_dir'] },
    ],
  },
  { path: '/app/fournisseurs', labelKey: 'fournisseurs.title', key: 'fournisseurs', category: 'achats', icon: ICON_TEAM },
  {
    labelKey: 'clients',
    key: 'clients',
    category: 'tiers',
    icon: ICON_TEAM,
    submenus: [
      { path: '/app/clients', labelKey: 'clients_consultation', labelFallback: 'Consultation', key: 'clients_consultation' },
      { path: '/app/fidelite', labelKey: 'fidelite', labelFallback: 'Fidélité', key: 'clients' },
      { path: '/app/outils/imc', labelKey: 'clients_imc', labelFallback: 'Calculateur IMC', key: 'clients_imc' },
    ],
  },
  { path: '/app/creances', labelKey: 'creances', key: 'creances', category: 'tiers', icon: ICON_CARD },
  {
    labelKey: 'stock.title',
    key: 'inventaire',
    category: 'stock',
    icon: ICON_BOX,
    submenus: [
      { path: '/app/stock', labelKey: 'stock.overview', labelFallback: "Vue d'ensemble", key: 'inventaire', aliasPermissions: ['inventaire_saisie', 'inventaire_journal', 'inventaire_reappro', 'inventaire_avoirs', 'inventaire_promis', 'inventaire_transformations', 'inventaire_perimes', 'inventaire_organisation', 'inventaire_analyse', 'inventaire_cadencier', 'inventaire_etats', 'inventaire_rapport_ug', 'perimes', 'avoirs', 'promis'] },
      { path: '/app/inventaire', labelKey: 'stock.inventaire.title', key: 'inventaire_saisie', group: 'stock_operations' },
      { path: '/app/journal-ajustements', labelKey: 'stock.journal', key: 'inventaire_journal', group: 'stock_operations' },
      { path: '/app/reappro-rayon', labelKey: 'stock.reappro.title', labelFallback: 'Réappro Rayon', key: 'inventaire_reappro', group: 'stock_operations' },
      { path: '/app/avoirs', labelKey: 'stock.avoirs', key: 'inventaire_avoirs', group: 'stock_operations', aliasPermissions: ['avoirs'] },
      { path: '/app/promis', labelKey: 'stock.promis', key: 'inventaire_promis', group: 'stock_operations', aliasPermissions: ['promis'] },
      { path: '/app/transformations', labelKey: 'stock.transformations.title', key: 'inventaire_transformations', group: 'stock_operations' },
      { path: '/app/perimes', labelKey: 'stock.perimes.title', key: 'inventaire_perimes', group: 'stock_operations', aliasPermissions: ['perimes'] },
      { path: '/app/organisation', labelKey: 'stock.organisation.title', labelFallback: 'Organisation', key: 'inventaire_organisation', group: 'stock_operations' },
      { path: '/app/stock-analysis', labelKey: 'stock.analyse.title', key: 'inventaire_analyse', group: 'stock_pilotage' },
      { path: '/app/cadencier', labelKey: 'stock.cadencier.title', labelFallback: 'Cadencier', key: 'inventaire_cadencier', group: 'stock_pilotage' },
      { path: '/app/etats-inventaire', labelKey: 'stock.etats_inventaire.title', labelFallback: 'États Inventaires', key: 'inventaire_etats', group: 'stock_pilotage' },
      { path: '/app/rapport-ug', labelKey: 'stock.rapport_ug.title', labelFallback: 'Rapport Unités Gratuites (UG)', key: 'inventaire_rapport_ug', group: 'stock_pilotage' },
    ],
  },
  {
    labelKey: 'statistiques.title',
    key: 'statistiques',
    category: 'rapports',
    icon: ICON_CHART,
    submenus: [
      { path: '/app/rapports', labelKey: 'statistiques.overview', labelFallback: "Vue d'ensemble", key: 'statistiques', aliasPermissions: ['statistiques_rapports', 'statistiques_mensuels', 'statistiques_vendeurs', 'statistiques_challenges', 'statistiques_temporelle', 'statistiques_abc', 'statistiques_finances', 'statistiques_fournisseurs', 'statistiques_guide', 'compta', 'compta_dashboard', 'divers', 'divers_ca', 'divers_commandes'] },
      { path: '/app/centre-rapports', labelKey: 'statistiques.rapports', key: 'statistiques_rapports', group: 'stats_ventes' },
      { path: '/app/rapports-mensuels', labelKey: 'statistiques.mensuel', key: 'statistiques_mensuels', group: 'stats_ventes' },
      { path: '/app/classement-vendeurs', labelKey: 'statistiques.classement_vendeurs', labelFallback: 'Classement Vendeurs', key: 'statistiques_vendeurs', group: 'stats_ventes' },
      { path: '/app/challenges', labelKey: 'statistiques.challenges', labelFallback: 'Challenges', key: 'statistiques_challenges', group: 'stats_ventes' },
      { path: '/app/analyse-temporelle', labelKey: 'statistiques.analyse_temporelle', labelFallback: 'Analyse Temporelle', key: 'statistiques_temporelle', group: 'stats_ventes' },
      { path: '/app/analyse-abc', labelKey: 'statistiques.abc', key: 'statistiques_abc', group: 'stats_finance' },
      { path: '/app/analyse-marges-produit', labelKey: 'statistiques.marges_produit', labelFallback: 'Marges par Produit', key: 'statistiques_finances', group: 'stats_finance' },
      { path: '/app/statistiques-fournisseurs', labelKey: 'statistiques.fournisseurs', key: 'statistiques_fournisseurs', group: 'stats_finance' },
      { path: '/app/module-financier', labelKey: 'statistiques.finances', key: 'statistiques_finances', group: 'stats_finance' },
      { path: '/app/guide-financier', labelKey: 'statistiques.guide', labelFallback: 'Guide Financier', key: 'statistiques_guide', group: 'stats_finance' },
    ],
  },
  { path: '/app/compta/dashboard', labelKey: 'compta.title', labelFallback: 'Comptabilité', key: 'compta', category: 'rapports', icon: ICON_RECEIPT },
  { path: '/app/divers/ca', labelKey: 'divers.title', labelFallback: 'Gestion Divers', key: 'divers', category: 'rapports', icon: ICON_CUBE, aliasPermissions: ['divers_ca', 'divers_commandes'] },
  {
    labelKey: 'parametres.title',
    key: 'settings',
    category: 'parametres',
    icon: ICON_GEAR,
    submenus: [
      { path: '/app/pharmacy-settings', labelKey: 'parametres.pharmacie', key: 'settings_pharmacie' },
      { path: '/app/telegram-history', labelKey: 'parametres.telegram', labelFallback: 'Historique Telegram', key: 'settings_telegram' },
      { path: '/app/systeme', labelKey: 'parametres.admin_system', key: 'settings_systeme' },
    ],
  },
  { path: '/app/aide-formation', labelKey: 'aide_formation', key: 'aide_formation', category: 'parametres', icon: ICON_HELP },
  { path: '/app/utilisateurs', labelKey: 'utilisateurs', key: 'utilisateurs', category: 'parametres', icon: ICON_TEAM, adminOnly: true },
  { path: '/app/planning-operateurs', labelKey: 'planning_operateurs', key: 'planning_operateurs', category: 'parametres', icon: ICON_CALENDAR, aliasPermissions: ['utilisateurs'] },
  { path: '/app/journal-audit', labelKey: 'audit', key: 'audit', category: 'parametres', icon: ICON_DOC, adminOnly: true },
  { path: '/app/import-dci', labelKey: 'import_dci', labelFallback: 'Import DCI & Matching', key: 'import_dci', category: 'parametres', icon: ICON_UPLOAD, adminOnly: true },
  { path: '/app/maintenance', labelKey: 'maintenance', key: 'maintenance', category: 'parametres', icon: ICON_GEAR },
  { path: '/app/corbeille', labelKey: 'corbeille', labelFallback: 'Corbeille', key: 'corbeille', category: 'parametres', icon: ICON_TRASH },
];

export interface NavUser {
  is_superuser?: boolean;
  allowed_menus?: string[];
}

/**
 * Filtre la navigation selon les permissions de l'utilisateur.
 * Partagé entre la sidebar et les pages hub pour un comportement identique.
 */
export function filterNavItemsForUser<T extends NavItem>(user: NavUser | null | undefined, items: T[] = NAV_ITEMS as unknown as T[]): T[] {
  if (user?.is_superuser) return items;

  const allowedSet = new Set(user?.allowed_menus || []);

  return items.flatMap(item => {
    if (item.adminOnly) return [];

    const hasExplicitParent = allowedSet.has(item.key);
    const hasAlias = item.aliasPermissions?.some(key => allowedSet.has(key)) ?? false;

    if (item.submenus) {
      const filteredSubmenus = item.submenus.filter(sub =>
        allowedSet.has(sub.key) ||
        (sub.aliasPermissions?.some(key => allowedSet.has(key)) ?? false) ||
        hasExplicitParent
      );
      return filteredSubmenus.length > 0 ? [{ ...item, submenus: filteredSubmenus }] : [];
    }

    return (hasExplicitParent || hasAlias) ? [item] : [];
  });
}

/** Regroupe les sous-menus consécutifs par `group` pour afficher des en-têtes de section. */
export function groupNavSubMenus<T extends NavSubMenuItem>(subs: T[]): { group?: string; items: T[] }[] {
  const groups: { group?: string; items: T[] }[] = [];
  for (const sub of subs) {
    const last = groups[groups.length - 1];
    if (last && last.group === sub.group) {
      last.items.push(sub);
    } else {
      groups.push({ group: sub.group, items: [sub] });
    }
  }
  return groups;
}
