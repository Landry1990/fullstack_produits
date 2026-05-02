import { lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ProtectedRoute, AdminRoute, HomeRedirector } from './components/auth/RouteGuards';
import { PermissionRoute } from './components/auth/PermissionRoute';
import { setRouter } from './services/navigationService';

// ── Eager-loaded (critical path) ──
import Login from './components/Login';
import Layout from './components/Layout';
import PrintPage from './components/printing/PrintPage';

// ── Lazy-loaded pages ──
const Dashboard = lazy(() => import('./components/Dashboard'));
const DashboardManager = lazy(() => import('./components/DashboardManager'));
const Produit = lazy(() => import('./components/Produit'));
const Commandes = lazy(() => import('./components/Commandes'));
const Ventes = lazy(() => import('./components/Ventes'));
const Fournisseurs = lazy(() => import('./components/Fournisseurs'));
const Clients = lazy(() => import('./components/Clients'));
const BMICalculator = lazy(() => import('./components/clinical/BMICalculator'));
const Facturation = lazy(() => import('./components/Facturation'));
const CaisseCentralisee = lazy(() => import('./components/CaisseCentralisee'));
const Inventaire = lazy(() => import('./components/Inventaire'));
const EtatsInventaire = lazy(() => import('./components/EtatsInventaire'));
const Organisation = lazy(() => import('./components/Organisation'));
const Vitrine = lazy(() => import('./components/Vitrine'));
const StatistiquesFournisseur = lazy(() => import('./components/StatistiquesFournisseur'));
const JournalCaisse = lazy(() => import('./components/JournalCaisse'));
const Perimes = lazy(() => import('./components/Perimes'));
const Creances = lazy(() => import('./components/Creances'));
const Avoirs = lazy(() => import('./components/Avoirs'));
const RapportMensuel = lazy(() => import('./components/RapportMensuel'));
const Transformations = lazy(() => import('./components/Transformations'));
const ReapproRayon = lazy(() => import('./components/stock/ReapproRayon'));
const ReapproHistory = lazy(() => import('./components/stock/ReapproHistory'));
const Ruptures = lazy(() => import('./components/stock/Ruptures'));
const JournalAudit = lazy(() => import('./components/JournalAudit'));
const JournalAjustements = lazy(() => import('./components/JournalAjustements'));
const Promis = lazy(() => import('./components/Promis'));
const StockAnalysis = lazy(() => import('./components/StockAnalysis'));
const HistoriqueClotures = lazy(() => import('./components/HistoriqueClotures'));
const HistoriqueVentes = lazy(() => import('./components/HistoriqueVentes'));
const HistoriqueAchats = lazy(() => import('./components/HistoriqueAchats'));
const WhatsAppHistory = lazy(() => import('./components/WhatsAppHistory'));
const OrdonnancierPage = lazy(() => import('./components/Ordonnancier'));
const CentreRapports = lazy(() => import('./components/CentreRapports'));
const AnalyseABC = lazy(() => import('./components/AnalyseABC'));
const PromotionList = lazy(() => import('./components/Promotions/PromotionList'));
const ModuleFinancier = lazy(() => import('./components/ModuleFinancier'));
const ClassementVendeurs = lazy(() => import('./components/ClassementVendeurs'));
const AnalyseTemporelle = lazy(() => import('./components/AnalyseTemporelle'));
const StockUGReport = lazy(() => import('./components/StockUGReport'));
const UserSessions = lazy(() => import('./components/UserSessions'));
const GuideFinancier = lazy(() => import('./components/GuideFinancier'));
const HelpTraining = lazy(() => import('./components/HelpTraining'));
const GestionUtilisateurs = lazy(() => import('./components/GestionUtilisateurs'));
const PharmacySettingsForm = lazy(() => import('./components/settings/PharmacySettingsForm'));
const Maintenance = lazy(() => import('./components/Maintenance'));
const Changelog = lazy(() => import('./components/Changelog'));
const Corbeille = lazy(() => import('./components/Corbeille'));

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
export const router = createBrowserRouter([
  { path: '/', element: <Login /> },
  { path: '/login', element: <Login /> },
  {
    path: '/app',
    element: <ProtectedRoute />,
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

          // ── Communication ──
          { path: 'whatsapp-history', ...perm('settings_whatsapp', WhatsAppHistory) },

          // ── Aide ──
          { path: 'aide-formation', ...perm('aide_formation', HelpTraining) },
          { path: 'changelog', element: <Changelog /> },

          // ── Admin only ──
          { path: 'utilisateurs', ...admin(GestionUtilisateurs) },
          { path: 'user-sessions', ...admin(UserSessions) },
          { path: 'journal-audit', ...admin(JournalAudit) },
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
