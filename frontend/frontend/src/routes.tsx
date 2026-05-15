import { lazy, type ComponentType } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ProtectedRoute, AdminRoute, HomeRedirector } from './components/auth/RouteGuards';
import { PermissionRoute } from './components/auth/PermissionRoute';
import { setRouter } from './services/navigationService';

// ── Lazy loading robuste avec timeout et retry ──
const MAX_RETRIES = 3;
const LOAD_TIMEOUT = 10000; // 10 secondes

function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  retries = MAX_RETRIES
): React.LazyExoticComponent<T> {
  return lazy(() => 
    new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Timeout: Le chargement du module a pris trop de temps'));
      }, LOAD_TIMEOUT);

      factory()
        .then((module) => {
          clearTimeout(timeoutId);
          resolve(module);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          if (retries > 0) {
            console.warn(`Retry loading component, ${retries} attempts left`);
            // Retry with delay
            setTimeout(() => {
              resolve(lazyWithRetry(factory, retries - 1) as any);
            }, 1000);
          } else {
            reject(error);
          }
        });
    })
  );
}

// Prefetch helper - charge en arrière-plan au survol
export function prefetchRoute(factory: () => Promise<any>) {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      factory().catch(() => {}); // Silencieux si erreur
    }, { timeout: 2000 });
  } else {
    setTimeout(() => {
      factory().catch(() => {});
    }, 100);
  }
}

// ── Eager-loaded (critical path - toujours chargees) ──
import Login from './components/Login';
import Layout from './components/Layout';
import PrintPage from './components/printing/PrintPage';
import LicenceScreen from './components/LicenceScreen';

// Routes principales - eager loaded pour performance
import Dashboard from './components/Dashboard';
import DashboardManager from './components/DashboardManager';
import Produit from './components/Produit';
import Ventes from './components/Ventes';
import Facturation from './components/Facturation';
import Commandes from './components/Commandes';
import CatalogDCI from './components/CatalogDCI';

// ── Lazy-loaded pages (routes secondaires) ──
const Fournisseurs = lazyWithRetry(() => import('./components/Fournisseurs'));
const Clients = lazyWithRetry(() => import('./components/Clients'));
const BMICalculator = lazyWithRetry(() => import('./components/clinical/BMICalculator'));
const CaisseCentralisee = lazyWithRetry(() => import('./components/CaisseCentralisee'));
const Inventaire = lazyWithRetry(() => import('./components/Inventaire'));
const EtatsInventaire = lazyWithRetry(() => import('./components/EtatsInventaire'));
const Organisation = lazyWithRetry(() => import('./components/Organisation'));
const Vitrine = lazyWithRetry(() => import('./components/Vitrine'));
const StatistiquesFournisseur = lazyWithRetry(() => import('./components/StatistiquesFournisseur'));
const JournalCaisse = lazyWithRetry(() => import('./components/JournalCaisse'));
const Perimes = lazyWithRetry(() => import('./components/Perimes'));
const Creances = lazyWithRetry(() => import('./components/Creances'));
const Avoirs = lazyWithRetry(() => import('./components/Avoirs'));
const RapportMensuel = lazyWithRetry(() => import('./components/RapportMensuel'));
const Transformations = lazyWithRetry(() => import('./components/Transformations'));
const ReapproRayon = lazyWithRetry(() => import('./components/stock/ReapproRayon'));
const ReapproHistory = lazyWithRetry(() => import('./components/stock/ReapproHistory'));
const Ruptures = lazyWithRetry(() => import('./components/stock/Ruptures'));
const JournalAudit = lazyWithRetry(() => import('./components/JournalAudit'));
const JournalAjustements = lazyWithRetry(() => import('./components/JournalAjustements'));
const Promis = lazyWithRetry(() => import('./components/Promis'));
const StockAnalysis = lazyWithRetry(() => import('./components/StockAnalysis'));
const HistoriqueClotures = lazyWithRetry(() => import('./components/HistoriqueClotures'));
const HistoriqueVentes = lazyWithRetry(() => import('./components/HistoriqueVentes'));
const HistoriqueAchats = lazyWithRetry(() => import('./components/HistoriqueAchats'));
const TelegramHistory = lazyWithRetry(() => import('./components/TelegramHistory'));
const OrdonnancierPage = lazyWithRetry(() => import('./components/Ordonnancier'));
const CentreRapports = lazyWithRetry(() => import('./components/CentreRapports'));
const AnalyseABC = lazyWithRetry(() => import('./components/AnalyseABC'));
const PromotionList = lazyWithRetry(() => import('./components/Promotions/PromotionList'));
const ModuleFinancier = lazyWithRetry(() => import('./components/ModuleFinancier'));
const GestionDivers = lazyWithRetry(() => import('./components/divers/GestionDivers'));
const ClassementVendeurs = lazyWithRetry(() => import('./components/ClassementVendeurs'));
const AnalyseTemporelle = lazyWithRetry(() => import('./components/AnalyseTemporelle'));
const StockUGReport = lazyWithRetry(() => import('./components/StockUGReport'));
const UserSessions = lazyWithRetry(() => import('./components/UserSessions'));
const GuideFinancier = lazyWithRetry(() => import('./components/GuideFinancier'));
const HelpTraining = lazyWithRetry(() => import('./components/HelpTraining'));
const GestionUtilisateurs = lazyWithRetry(() => import('./components/GestionUtilisateurs'));
const PharmacySettingsForm = lazyWithRetry(() => import('./components/settings/PharmacySettingsForm'));
const Maintenance = lazyWithRetry(() => import('./components/Maintenance'));
const Changelog = lazyWithRetry(() => import('./components/Changelog'));
const Corbeille = lazyWithRetry(() => import('./components/Corbeille'));
const ImportDCIPage = lazyWithRetry(() => import('./components/ImportDCIPage'));
const Comptabilite = lazyWithRetry(() => import('./components/compta/Comptabilite'));

// ── Helper to reduce boilerplate ──
const perm = (permission: string | string[], Component: React.ComponentType<any>, props?: Record<string, any>) => ({
  element: (
    <PermissionRoute permission={permission}>
      <Component {...props} />
    </PermissionRoute>
  ),
});

const admin = (Component: React.ComponentType<any>) => ({
  element: (
    <AdminRoute>
      <Component />
    </AdminRoute>
  ),
});

// ── Router ──
import RouteErrorBoundary from './components/RouteErrorBoundary';

export const router = createBrowserRouter([
  { path: '/', element: <Login />, errorElement: <RouteErrorBoundary /> },
  { path: '/login', element: <Login />, errorElement: <RouteErrorBoundary /> },
  { path: '/licence', element: <LicenceScreen />, errorElement: <RouteErrorBoundary /> },
  {
    path: '/app',
    element: <ProtectedRoute />,
    errorElement: <RouteErrorBoundary />,
    children: [
      { path: 'print-invoice/:id', element: <PrintPage /> },
      { path: 'printing/:id', element: <PrintPage /> },
      {
        element: <Layout />,
        children: [
          { index: true, element: <HomeRedirector /> },

          // ── Dashboard ──
          { path: 'dashboard', ...perm('dashboard', Dashboard) },
          { path: 'manager-dashboard', ...perm('manager_sidebar', DashboardManager) },

          // ── Produits & Stock ──
          { path: 'produits', ...perm('produits', Produit) },
          { path: 'catalog-dci', ...perm('produits', CatalogDCI) },
          { path: 'vitrine', ...perm('vitrine', Vitrine) },

          // ── Commandes ──
          { path: 'commandes', ...perm(['commandes', 'commandes_loc', 'commandes_dir'], Commandes) },
          { path: 'commandes/locales', ...perm(['commandes', 'commandes_loc'], Commandes, { forcedType: 'LOC' }) },
          { path: 'commandes/directes', ...perm(['commandes', 'commandes_dir'], Commandes, { forcedType: 'DIR' }) },

          // ── Ventes ──
          { path: 'ventes', ...perm('ventes_consultation', Ventes) },
          { path: 'facturation', ...perm('facturation', Facturation) },
          { path: 'caisse-centralisee', ...perm('caisse', CaisseCentralisee) },
          { path: 'promotions', ...perm('ventes_promotions', PromotionList) },
          { path: 'historique-ventes', ...perm('ventes_historique', HistoriqueVentes) },
          { path: 'ordonnancier', ...perm('ventes_ordonnancier', OrdonnancierPage) },
          { path: 'journal-caisse', ...perm('ventes_journal', JournalCaisse) },
          { path: 'historique-clotures', ...perm('ventes_clotures', HistoriqueClotures) },

          // ── Tiers ──
          { path: 'fournisseurs', ...perm('fournisseurs', Fournisseurs) },
          { path: 'clients', ...perm('clients', Clients) },
          { path: 'outils/imc', ...perm('clients', BMICalculator) },
          { path: 'creances', ...perm('creances', Creances) },
          { path: 'statistiques-fournisseurs', ...perm('statistiques_fournisseurs', StatistiquesFournisseur) },

          // ── Inventaire ──
          { path: 'inventaire', ...perm(['inventaire', 'inventaire_saisie'], Inventaire) },
          { path: 'organisation', ...perm(['inventaire', 'inventaire_organisation'], Organisation) },
          { path: 'rayons', ...perm(['inventaire', 'inventaire_organisation'], Organisation, { defaultTab: 'rayons' }) },
          { path: 'formes', ...perm(['inventaire', 'inventaire_organisation'], Organisation, { defaultTab: 'formes' }) },
          { path: 'groupes', ...perm(['inventaire', 'inventaire_organisation'], Organisation, { defaultTab: 'groupes' }) },
          { path: 'perimes', ...perm(['inventaire', 'inventaire_perimes', 'perimes'], Perimes) },
          { path: 'avoirs', ...perm(['inventaire', 'inventaire_avoirs', 'avoirs'], Avoirs) },
          { path: 'promis', ...perm(['inventaire', 'inventaire_promis', 'promis'], Promis) },
          { path: 'stock-analysis', ...perm(['inventaire', 'inventaire_analyse'], StockAnalysis) },
          { path: 'ruptures', ...perm(['inventaire', 'inventaire_ruptures'], Ruptures) },
          { path: 'reappro-rayon', ...perm(['inventaire', 'inventaire_reappro'], ReapproRayon) },
          { path: 'reappro-history', ...perm(['inventaire', 'inventaire_reappro'], ReapproHistory) },
          { path: 'rapport-ug', ...perm(['inventaire', 'inventaire_rapport_ug'], StockUGReport) },
          { path: 'etats-inventaire', ...perm(['inventaire', 'inventaire_etats'], EtatsInventaire) },
          { path: 'journal-ajustements', ...perm(['inventaire', 'inventaire_journal'], JournalAjustements) },
          { path: 'transformations', ...perm(['inventaire', 'inventaire_transformations'], Transformations) },

          // ── Historique Achats ──
          { path: 'historique-achats', ...perm(['commandes_loc_history', 'commandes_dir_history'], HistoriqueAchats) },
          { path: 'historique-achats/locales', ...perm('commandes_loc_history', HistoriqueAchats, { forcedType: 'LOC' }) },
          { path: 'historique-achats/directes', ...perm('commandes_dir_history', HistoriqueAchats, { forcedType: 'DIR' }) },

          // ── Statistiques & Rapports ──
          { path: 'rapports-mensuels', ...perm('statistiques_mensuels', RapportMensuel) },
          { path: 'centre-rapports', ...perm('statistiques_rapports', CentreRapports) },
          { path: 'analyse-abc', ...perm('statistiques_abc', AnalyseABC) },
          { path: 'module-financier', ...perm('statistiques_finances', ModuleFinancier) },
          { path: 'classement-vendeurs', ...perm('statistiques_vendeurs', ClassementVendeurs) },
          { path: 'analyse-temporelle', ...perm('statistiques_temporelle', AnalyseTemporelle) },
          { path: 'guide-financier', ...perm('statistiques_guide', GuideFinancier) },
          { path: 'compta/dashboard', ...perm('compta_dashboard', Comptabilite, { defaultTab: 'dashboard' }) },
          { path: 'compta/grand-livre', ...perm('compta_grand_livre', Comptabilite, { defaultTab: 'grand-livre' }) },
          { path: 'compta/balance', ...perm('compta_balance', Comptabilite, { defaultTab: 'balance' }) },
          { path: 'compta/resultat', ...perm('compta_resultat', Comptabilite, { defaultTab: 'resultat' }) },
          { path: 'compta/charges', ...perm('compta_charges', Comptabilite, { defaultTab: 'charges' }) },
          { path: 'compta/plan-comptable', ...perm('compta_plan', Comptabilite, { defaultTab: 'plan' }) },

          // ── Gestion Divers ──
          { path: 'divers/ca', ...perm('divers_ca', GestionDivers, { defaultTab: 'ca' }) },
          { path: 'divers/commandes', ...perm('divers_commandes', GestionDivers, { defaultTab: 'commandes' }) },

          // ── Communication ──
          { path: 'telegram-history', ...perm('settings_telegram', TelegramHistory) },

          // ── Aide ──
          { path: 'aide-formation', ...perm('aide_formation', HelpTraining) },
          { path: 'changelog', element: <Changelog /> },

          // ── Admin only ──
          { path: 'utilisateurs', ...admin(GestionUtilisateurs) },
          { path: 'user-sessions', ...admin(UserSessions) },
          { path: 'journal-audit', ...admin(JournalAudit) },
          { path: 'import-dci', ...admin(ImportDCIPage) },
          { path: 'maintenance', ...admin(Maintenance) },
          { path: 'corbeille', ...admin(Corbeille) },

          // ── Paramètres ──
          { path: 'pharmacy-settings', ...perm('settings_pharmacie', PharmacySettingsForm) },

          // ── Catch-all ──
          { path: '*', element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
]);

setRouter(router);
