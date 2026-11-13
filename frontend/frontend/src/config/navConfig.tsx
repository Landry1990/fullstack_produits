import type { ReactNode } from 'react';
import type { AppPageCategory } from './appPages';
import {
    LayoutDashboard, Gauge, UsersRound, Banknote, ReceiptText, Pill,
    FlaskConical, Globe, ShoppingCart, Factory, Users, CreditCard, Boxes,
    BarChart3, Landmark, Shapes, Settings, GraduationCap, UserCog,
    CalendarDays, ScrollText, FileUp, Wrench, Trash2,
} from 'lucide-react';

/**
 * Source unique de la navigation sidebar.
 *
 * - `key` : clé de permission utilisée dans `allowed_menus`.
 * - `aliasPermissions` : clés héritées qui rendent l'entrée visible
 *   (ex. `commandes_loc` rend visibles seulement les sous-menus locaux).
 * - `adminOnly` : réservé aux superutilisateurs.
 * - `group` (sous-menus) : identifiant de sous-section affiché comme en-tête
 *   dans la liste (`sidebar:menu_groups.<group>`).
 * - `loader` : import lazy du composant de la page — utilisé pour le prefetch
 *   au survol (source unique, fini la map dupliquée dans Sidebar).
 */
export interface NavSubMenuItem {
    path: string;
    labelKey: string;
    labelFallback?: string;
    key: string;
    aliasPermissions?: string[];
    group?: string;
    loader?: () => Promise<unknown>;
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
    loader?: () => Promise<unknown>;
}

const iconClass = 'size-full';

export const NAV_ITEMS: NavItem[] = [
    { path: '/app', labelKey: 'dashboard', key: 'dashboard', category: 'accueil', icon: <LayoutDashboard className={iconClass} />, loader: () => import('../components/DashboardShadcn') },
    { path: '/app/manager-dashboard', labelKey: 'manager_sidebar', key: 'manager_sidebar', category: 'accueil', icon: <Gauge className={iconClass} />, loader: () => import('../components/DashboardManagerShadcn') },
    { path: '/app/rapport-equipes', labelKey: 'teams_report_sidebar', labelFallback: 'Rapport Équipes', key: 'manager_sidebar', category: 'accueil', icon: <UsersRound className={iconClass} /> },
    {
        labelKey: 'ventes.title',
        key: 'ventes',
        category: 'ventes',
        icon: <Banknote className={iconClass} />,
        submenus: [
            { path: '/app/ventes', labelKey: 'ventes.consultation', key: 'ventes_consultation', loader: () => import('../components/Ventes') },
            { path: '/app/historique-ventes', labelKey: 'ventes.historique', key: 'ventes_historique', loader: () => import('../components/HistoriqueVentes') },
            { path: '/app/avoirs-clients', labelKey: 'ventes.avoirs_clients', key: 'ventes_avoirs_clients', loader: () => import('../components/avoirs-client/ClientCreditsPage') },
            { path: '/app/recap-client', labelKey: 'ventes.recap_client', key: 'ventes_consultation', loader: () => import('../components/RecapClient') },
            { path: '/app/journal-caisse', labelKey: 'ventes.journal', key: 'ventes_journal', loader: () => import('../components/JournalCaisse') },
            { path: '/app/historique-clotures', labelKey: 'ventes.clotures', key: 'ventes_clotures', loader: () => import('../components/HistoriqueClotures') },
            { path: '/app/ordonnancier', labelKey: 'ventes.ordonnancier', key: 'ventes_ordonnancier', loader: () => import('../components/Ordonnancier') },
            { path: '/app/promotions', labelKey: 'ventes.promotions', key: 'ventes_promotions', loader: () => import('../components/Promotions/PromotionList') },
            { path: '/app/caisse-centralisee', labelKey: 'ventes.caisse_centralisee', key: 'caisse', loader: () => import('../components/CaisseCentralisee') },
        ],
    },
    { path: '/app/facturation', labelKey: 'facturation', key: 'facturation', category: 'ventes', icon: <ReceiptText className={iconClass} />, loader: () => import('../components/Facturation') },
    { path: '/app/produits', labelKey: 'produits', key: 'produits', category: 'catalogue', icon: <Pill className={iconClass} />, loader: () => import('../components/ProduitShadcn') },
    { path: '/app/catalog-dci', labelKey: 'catalog_dci', key: 'produits', category: 'catalogue', icon: <FlaskConical className={iconClass} /> },
    { path: '/app/vitrine', labelKey: 'vitrine', key: 'vitrine', category: 'catalogue', icon: <Globe className={iconClass} />, aliasPermissions: ['produits'], loader: () => import('../components/Vitrine') },
    {
        labelKey: 'commandes.title',
        key: 'commandes',
        category: 'achats',
        icon: <ShoppingCart className={iconClass} />,
        aliasPermissions: ['commandes_loc', 'commandes_dir'],
        submenus: [
            { path: '/app/commandes/locales', labelKey: 'commandes.new_current', key: 'commandes_loc_current', group: 'commandes_locales', aliasPermissions: ['commandes_loc'], loader: () => import('../components/Commandes') },
            { path: '/app/historique-achats/locales', labelKey: 'commandes.history', key: 'commandes_loc_history', group: 'commandes_locales', aliasPermissions: ['commandes_loc'], loader: () => import('../components/HistoriqueAchats') },
            { path: '/app/commandes/directes', labelKey: 'commandes.new_current', key: 'commandes_dir_current', group: 'commandes_directes', aliasPermissions: ['commandes_dir'], loader: () => import('../components/Commandes') },
            { path: '/app/historique-achats/directes', labelKey: 'commandes.history', key: 'commandes_dir_history', group: 'commandes_directes', aliasPermissions: ['commandes_dir'], loader: () => import('../components/HistoriqueAchats') },
        ],
    },
    { path: '/app/fournisseurs', labelKey: 'fournisseurs.title', key: 'fournisseurs', category: 'achats', icon: <Factory className={iconClass} />, loader: () => import('../components/Fournisseurs') },
    {
        labelKey: 'clients',
        key: 'clients',
        category: 'tiers',
        icon: <Users className={iconClass} />,
        submenus: [
            { path: '/app/clients', labelKey: 'clients_consultation', labelFallback: 'Consultation', key: 'clients_consultation', loader: () => import('../components/Clients') },
            { path: '/app/fidelite', labelKey: 'fidelite', labelFallback: 'Fidélité', key: 'clients', loader: () => import('../components/loyalty/LoyaltyPage') },
            { path: '/app/rappels-traitement', labelKey: 'clients_rappels', labelFallback: 'Rappels traitement', key: 'clients_rappels', loader: () => import('../components/RappelsTraitement') },
            { path: '/app/outils/imc', labelKey: 'clients_imc', labelFallback: 'Calculateur IMC', key: 'clients_imc', loader: () => import('../components/clinical/BMICalculator') },
        ],
    },
    { path: '/app/creances', labelKey: 'creances', key: 'creances', category: 'tiers', icon: <CreditCard className={iconClass} />, loader: () => import('../components/Creances') },
    {
        labelKey: 'stock.title',
        key: 'inventaire',
        category: 'stock',
        icon: <Boxes className={iconClass} />,
        submenus: [
            { path: '/app/stock', labelKey: 'stock.overview', labelFallback: "Vue d'ensemble", key: 'inventaire', aliasPermissions: ['inventaire_saisie', 'inventaire_journal', 'inventaire_reappro', 'inventaire_avoirs', 'inventaire_promis', 'inventaire_transformations', 'inventaire_perimes', 'inventaire_organisation', 'inventaire_analyse', 'inventaire_cadencier', 'inventaire_etats', 'inventaire_rapport_ug', 'perimes', 'avoirs', 'promis'], loader: () => import('../components/hubs/FeatureHub') },
            { path: '/app/inventaire', labelKey: 'stock.inventaire.title', key: 'inventaire_saisie', group: 'stock_operations', loader: () => import('../components/Inventaire') },
            { path: '/app/journal-ajustements', labelKey: 'stock.journal', key: 'inventaire_journal', group: 'stock_operations', loader: () => import('../components/JournalAjustements') },
            { path: '/app/reappro-rayon', labelKey: 'stock.reappro.title', labelFallback: 'Réappro Rayon', key: 'inventaire_reappro', group: 'stock_operations', loader: () => import('../components/stock/ReapproRayon') },
            { path: '/app/avoirs', labelKey: 'stock.avoirs', key: 'inventaire_avoirs', group: 'stock_operations', aliasPermissions: ['avoirs'], loader: () => import('../components/Avoirs') },
            { path: '/app/promis', labelKey: 'stock.promis', key: 'inventaire_promis', group: 'stock_operations', aliasPermissions: ['promis'], loader: () => import('../components/Promis') },
            { path: '/app/transformations', labelKey: 'stock.transformations.title', key: 'inventaire_transformations', group: 'stock_operations', loader: () => import('../components/Transformations') },
            { path: '/app/perimes', labelKey: 'stock.perimes.title', key: 'inventaire_perimes', group: 'stock_operations', aliasPermissions: ['perimes'], loader: () => import('../components/Perimes') },
            { path: '/app/organisation', labelKey: 'stock.organisation.title', labelFallback: 'Organisation', key: 'inventaire_organisation', group: 'stock_operations', loader: () => import('../components/Organisation') },
            { path: '/app/stock-analysis', labelKey: 'stock.analyse.title', key: 'inventaire_analyse', group: 'stock_pilotage', loader: () => import('../components/StockAnalysis') },
            { path: '/app/cadencier', labelKey: 'stock.cadencier.title', labelFallback: 'Cadencier', key: 'inventaire_cadencier', group: 'stock_pilotage', loader: () => import('../components/stock/Cadencier') },
            { path: '/app/etats-inventaire', labelKey: 'stock.etats_inventaire.title', labelFallback: 'États Inventaires', key: 'inventaire_etats', group: 'stock_pilotage', loader: () => import('../components/EtatsInventaire') },
            { path: '/app/rapport-ug', labelKey: 'stock.rapport_ug.title', labelFallback: 'Rapport Unités Gratuites (UG)', key: 'inventaire_rapport_ug', group: 'stock_pilotage', loader: () => import('../components/StockUGReportShadcn') },
        ],
    },
    {
        labelKey: 'statistiques.title',
        key: 'statistiques',
        category: 'rapports',
        icon: <BarChart3 className={iconClass} />,
        submenus: [
            { path: '/app/rapports', labelKey: 'statistiques.overview', labelFallback: "Vue d'ensemble", key: 'statistiques', aliasPermissions: ['statistiques_rapports', 'statistiques_mensuels', 'statistiques_vendeurs', 'statistiques_challenges', 'statistiques_temporelle', 'statistiques_abc', 'statistiques_finances', 'statistiques_fournisseurs', 'statistiques_guide', 'compta', 'compta_dashboard', 'divers', 'divers_ca', 'divers_commandes'], loader: () => import('../components/hubs/FeatureHub') },
            { path: '/app/centre-rapports', labelKey: 'statistiques.rapports', key: 'statistiques_rapports', group: 'stats_ventes', loader: () => import('../components/CentreRapports') },
            { path: '/app/rapports-mensuels', labelKey: 'statistiques.mensuel', key: 'statistiques_mensuels', group: 'stats_ventes', loader: () => import('../components/RapportMensuel') },
            { path: '/app/classement-vendeurs', labelKey: 'statistiques.classement_vendeurs', labelFallback: 'Classement Vendeurs', key: 'statistiques_vendeurs', group: 'stats_ventes', loader: () => import('../components/ClassementVendeurs') },
            { path: '/app/challenges', labelKey: 'statistiques.challenges', labelFallback: 'Challenges', key: 'statistiques_challenges', group: 'stats_ventes', loader: () => import('../components/challenges/ChallengesPage') },
            { path: '/app/analyse-temporelle', labelKey: 'statistiques.analyse_temporelle', labelFallback: 'Analyse Temporelle', key: 'statistiques_temporelle', group: 'stats_ventes', loader: () => import('../components/AnalyseTemporelle') },
            { path: '/app/analyse-abc', labelKey: 'statistiques.abc', key: 'statistiques_abc', group: 'stats_finance', loader: () => import('../components/AnalyseABC') },
            { path: '/app/analyse-marges-produit', labelKey: 'statistiques.marges_produit', labelFallback: 'Marges par Produit', key: 'statistiques_finances', group: 'stats_finance', loader: () => import('../components/AnalyseMargesProduit') },
            { path: '/app/statistiques-fournisseurs', labelKey: 'statistiques.fournisseurs', key: 'statistiques_fournisseurs', group: 'stats_finance', loader: () => import('../components/StatistiquesFournisseur') },
            { path: '/app/module-financier', labelKey: 'statistiques.finances', key: 'statistiques_finances', group: 'stats_finance', loader: () => import('../components/ModuleFinancier') },
            { path: '/app/guide-financier', labelKey: 'statistiques.guide', labelFallback: 'Guide Financier', key: 'statistiques_guide', group: 'stats_finance', loader: () => import('../components/GuideFinancier') },
        ],
    },
    { path: '/app/compta/dashboard', labelKey: 'compta.title', labelFallback: 'Comptabilité', key: 'compta', category: 'rapports', icon: <Landmark className={iconClass} />, loader: () => import('../components/compta/Comptabilite') },
    { path: '/app/divers/ca', labelKey: 'divers.title', labelFallback: 'Gestion Divers', key: 'divers', category: 'rapports', icon: <Shapes className={iconClass} />, aliasPermissions: ['divers_ca', 'divers_commandes'], loader: () => import('../components/divers/GestionDivers') },
    {
        labelKey: 'parametres.title',
        key: 'settings',
        category: 'parametres',
        icon: <Settings className={iconClass} />,
        submenus: [
            { path: '/app/pharmacy-settings', labelKey: 'parametres.pharmacie', key: 'settings_pharmacie', loader: () => import('../components/settings/PharmacySettingsForm') },
            { path: '/app/telegram-history', labelKey: 'parametres.telegram', labelFallback: 'Historique Telegram', key: 'settings_telegram', loader: () => import('../components/TelegramHistory') },
            { path: '/app/systeme', labelKey: 'parametres.admin_system', key: 'settings_systeme', loader: () => import('../components/SystemAdmin') },
        ],
    },
    { path: '/app/aide-formation', labelKey: 'aide_formation', key: 'aide_formation', category: 'parametres', icon: <GraduationCap className={iconClass} />, loader: () => import('../components/HelpTraining') },
    { path: '/app/utilisateurs', labelKey: 'utilisateurs', key: 'utilisateurs', category: 'parametres', icon: <UserCog className={iconClass} />, adminOnly: true, loader: () => import('../components/users/GestionUtilisateurs') },
    { path: '/app/planning-operateurs', labelKey: 'planning_operateurs', key: 'planning_operateurs', category: 'parametres', icon: <CalendarDays className={iconClass} />, aliasPermissions: ['utilisateurs'], loader: () => import('../components/PlanningOperateurs') },
    { path: '/app/journal-audit', labelKey: 'audit', key: 'audit', category: 'parametres', icon: <ScrollText className={iconClass} />, adminOnly: true, loader: () => import('../components/JournalAudit') },
    { path: '/app/import-dci', labelKey: 'import_dci', labelFallback: 'Import DCI & Matching', key: 'import_dci', category: 'parametres', icon: <FileUp className={iconClass} />, adminOnly: true, loader: () => import('../components/ImportDCIPage') },
    { path: '/app/maintenance', labelKey: 'maintenance', key: 'maintenance', category: 'parametres', icon: <Wrench className={iconClass} />, loader: () => import('../components/Maintenance') },
    { path: '/app/corbeille', labelKey: 'corbeille', labelFallback: 'Corbeille', key: 'corbeille', category: 'parametres', icon: <Trash2 className={iconClass} />, loader: () => import('../components/Corbeille') },
];

/** Loaders de routes accessibles hors sidebar (liens internes, tabs). */
const EXTRA_ROUTE_LOADERS: Record<string, () => Promise<unknown>> = {
    '/app/reappro-history': () => import('../components/stock/ReapproHistory'),
    '/app/historique-achats': () => import('../components/HistoriqueAchats'),
    '/app/divers/stock': () => import('../components/divers/GestionDivers'),
    '/app/user-sessions': () => import('../components/UserSessionsShadcn'),
    '/app/compta/grand-livre': () => import('../components/compta/Comptabilite'),
    '/app/compta/balance': () => import('../components/compta/Comptabilite'),
    '/app/compta/resultat': () => import('../components/compta/Comptabilite'),
    '/app/compta/charges': () => import('../components/compta/Comptabilite'),
    '/app/compta/plan-comptable': () => import('../components/compta/Comptabilite'),
};

const ROUTE_LOADERS = (() => {
    const map: Record<string, () => Promise<unknown>> = { ...EXTRA_ROUTE_LOADERS };
    for (const item of NAV_ITEMS) {
        if (item.path && item.loader) map[item.path] = item.loader;
        for (const sub of item.submenus ?? []) {
            if (sub.loader) map[sub.path] = sub.loader;
        }
    }
    return map;
})();

export function getRouteLoader(path: string): (() => Promise<unknown>) | undefined {
    return ROUTE_LOADERS[path];
}

/** Tous les loaders de routes lazy (warm-up en arrière-plan). */
export function getAllRouteLoaders(): (() => Promise<unknown>)[] {
    return Object.values(ROUTE_LOADERS);
}

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
