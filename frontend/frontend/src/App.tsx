import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom'
import PrintPage from './components/printing/PrintPage'
import Layout from './components/Layout'
import Produit from './components/Produit'
import Commandes from './components/Commandes'
import Ventes from './components/Ventes'
import Fournisseurs from './components/Fournisseurs'
import Clients from './components/Clients'
import Facturation from './components/Facturation'
import Dashboard from './components/Dashboard'
import DashboardManager from './components/DashboardManager'
import GestionUtilisateurs from './components/GestionUtilisateurs'
import Vitrine from './components/Vitrine'
import Inventaire from './components/Inventaire'
import EtatsInventaire from './components/EtatsInventaire'
import Organisation from './components/Organisation'
import Login from './components/Login'
import StatistiquesFournisseur from './components/StatistiquesFournisseur'
import JournalCaisse from './components/JournalCaisse'
import Perimes from './components/Perimes'
import Creances from './components/Creances'
import Avoirs from './components/Avoirs'
import RapportMensuel from './components/RapportMensuel'
import Transformations from './components/Transformations'
// import InvoiceSettings from './components/InvoiceSettings' (removed)
import ReapproRayon from './components/stock/ReapproRayon'
import ReapproHistory from './components/stock/ReapproHistory'
import Ruptures from './components/stock/Ruptures'

import JournalAudit from './components/JournalAudit'
import JournalAjustements from './components/JournalAjustements'
import Promis from './components/Promis'
import StockAnalysis from './components/StockAnalysis'
import CaisseCentralisee from './components/CaisseCentralisee'
import HistoriqueClotures from './components/HistoriqueClotures'
import HistoriqueVentes from './components/HistoriqueVentes'
import HistoriqueAchats from './components/HistoriqueAchats'
import WhatsAppHistory from './components/WhatsAppHistory'
import OrdonnancierPage from './components/Ordonnancier'
import CentreRapports from './components/CentreRapports'
import AnalyseABC from './components/AnalyseABC'
import PromotionList from './components/Promotions/PromotionList';
import ModuleFinancier from './components/ModuleFinancier';
import ClassementVendeurs from './components/ClassementVendeurs';
import AnalyseTemporelle from './components/AnalyseTemporelle';
import StockUGReport from './components/StockUGReport';
import UserSessions from './components/UserSessions';
import GuideFinancier from './components/GuideFinancier';
import HelpTraining from './components/HelpTraining';
import { AuthProvider, useAuth } from './context/AuthContext'
import { ConfirmProvider } from './hooks/useConfirm'
import { PharmacySettingsProvider } from './context/PharmacySettingsContext'
import { Toaster } from 'react-hot-toast'
import PharmacySettingsForm from './components/settings/PharmacySettingsForm'
import ConfigurationOptions from './components/settings/ConfigurationOptions'
import Maintenance from './components/Maintenance'
import { useAutoLogout } from './hooks/useAutoLogout';
import { PermissionRoute } from './components/auth/PermissionRoute';

const ProtectedRoute = () => {
  const { isAuthenticated, loading } = useAuth();
  
  // Initialize inactivity auto-logout tracking
  useAutoLogout();

  if (loading) {
    return <div className="h-screen flex items-center justify-center"><span className="loading loading-spinner loading-lg"></span></div>;
  }

  return isAuthenticated ? <Outlet /> : <Navigate to="/" />;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="h-screen flex items-center justify-center"><span className="loading loading-spinner loading-lg"></span></div>;
  }

  if (!user) {
    return <Navigate to="/" />;
  }

  return user.is_superuser ? <>{children}</> : <Navigate to="/app/facturation" />;
};

const HomeRedirector = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="h-screen flex items-center justify-center"><span className="loading loading-spinner loading-lg"></span></div>;
  }

  if (!user) {
    return <Navigate to="/" />;
  }

  if (user.is_superuser) return <Navigate to="/app/dashboard" />;
  
  const allowed = (user as any).allowed_menus || [];
  if (allowed.includes('dashboard')) return <Navigate to="/app/dashboard" />;
  if (allowed.includes('facturation')) return <Navigate to="/app/facturation" />;
  if (allowed.includes('caisse')) return <Navigate to="/app/caisse-centralisee" />;
  if (allowed.includes('produits')) return <Navigate to="/app/produits" />;
  
  return <Navigate to="/app/facturation" />; // Fallback safer
};

const router = createBrowserRouter([
  {
    path: '/',
    element: <Login />,
  },
  {
    path: '/login',
    element: <Login />,
  },
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
          { 
            path: 'dashboard', 
            element: (
              <PermissionRoute permission="dashboard">
                <Dashboard />
              </PermissionRoute>
            )
          },
          { 
            path: 'manager-dashboard', 
            element: (
              <PermissionRoute permission="manager_sidebar">
                <DashboardManager />
              </PermissionRoute>
            )
          },
          { 
            path: 'produits', 
            element: (
              <PermissionRoute permission="produits">
                <Produit />
              </PermissionRoute>
            )
          },
          { 
            path: 'commandes', 
            element: (
              <PermissionRoute permission={['commandes', 'commandes_loc', 'commandes_dir']}>
                <Commandes />
              </PermissionRoute>
            )
          },
          { 
            path: 'commandes/locales', 
            element: (
              <PermissionRoute permission={['commandes', 'commandes_loc']}>
                <Commandes forcedType="LOC" />
              </PermissionRoute>
            )
          },
          { 
            path: 'commandes/directes', 
            element: (
              <PermissionRoute permission={['commandes', 'commandes_dir']}>
                <Commandes forcedType="DIR" />
              </PermissionRoute>
            )
          },
          
          { 
            path: 'ventes', 
            element: (
              <PermissionRoute permission="ventes_consultation">
                <Ventes />
              </PermissionRoute>
            )
          },
          { 
            path: 'fournisseurs', 
            element: (
              <PermissionRoute permission="fournisseurs">
                <Fournisseurs />
              </PermissionRoute>
            )
          },
          { 
            path: 'clients', 
            element: (
              <PermissionRoute permission="clients">
                <Clients />
              </PermissionRoute>
            )
          },
           { 
            path: 'inventaire', 
            element: (
              <PermissionRoute permission={['inventaire', 'inventaire_saisie']}>
                <Inventaire />
              </PermissionRoute>
            )
          },
          { 
            path: 'organisation', 
            element: (
              <PermissionRoute permission={['inventaire', 'inventaire_organisation']}>
                <Organisation />
              </PermissionRoute>
            )
          },
          { 
            path: 'rayons', 
            element: (
              <PermissionRoute permission={['inventaire', 'inventaire_organisation']}>
                <Organisation defaultTab="rayons" />
              </PermissionRoute>
            )
          },
          { 
            path: 'formes', 
            element: (
              <PermissionRoute permission={['inventaire', 'inventaire_organisation']}>
                <Organisation defaultTab="formes" />
              </PermissionRoute>
            )
          },
          { 
            path: 'groupes', 
            element: (
              <PermissionRoute permission={['inventaire', 'inventaire_organisation']}>
                <Organisation defaultTab="groupes" />
              </PermissionRoute>
            )
          },
           { 
            path: 'facturation', 
            element: (
              <PermissionRoute permission="facturation">
                <Facturation />
              </PermissionRoute>
            )
          },
          { 
            path: 'caisse-centralisee', 
            element: (
              <PermissionRoute permission="caisse">
                <CaisseCentralisee />
              </PermissionRoute>
            )
          },
          { 
            path: 'statistiques-fournisseurs', 
            element: (
              <PermissionRoute permission="statistiques_fournisseurs">
                <StatistiquesFournisseur />
              </PermissionRoute>
            )
          },
          { 
            path: 'journal-caisse', 
            element: (
              <PermissionRoute permission="ventes_journal">
                <JournalCaisse />
              </PermissionRoute>
            )
          },
          { 
            path: 'historique-clotures', 
            element: (
              <PermissionRoute permission="ventes_clotures">
                <HistoriqueClotures />
              </PermissionRoute>
            )
          },
          { 
            path: 'perimes', 
            element: (
              <PermissionRoute permission={['inventaire', 'inventaire_perimes', 'perimes']}>
                <Perimes />
              </PermissionRoute>
            )
          },
          { 
            path: 'creances', 
            element: (
              <PermissionRoute permission="creances">
                <Creances />
              </PermissionRoute>
            )
          },
          { 
            path: 'avoirs', 
            element: (
              <PermissionRoute permission={['inventaire', 'inventaire_avoirs', 'avoirs']}>
                <Avoirs />
              </PermissionRoute>
            )
          },
          { 
            path: 'promis', 
            element: (
              <PermissionRoute permission={['inventaire', 'inventaire_promis', 'promis']}>
                <Promis />
              </PermissionRoute>
            )
          },
          { 
            path: 'stock-analysis', 
            element: (
              <PermissionRoute permission={['inventaire', 'inventaire_analyse']}>
                <StockAnalysis />
              </PermissionRoute>
            )
          },
          { 
            path: 'ruptures', 
            element: (
              <PermissionRoute permission={['inventaire', 'inventaire_ruptures']}>
                <Ruptures />
              </PermissionRoute>
            )
          },
          { 
            path: 'reappro-rayon', 
            element: (
              <PermissionRoute permission={['inventaire', 'inventaire_reappro']}>
                <ReapproRayon />
              </PermissionRoute>
            )
          },
          { 
            path: 'reappro-history', 
            element: (
              <PermissionRoute permission={['inventaire', 'inventaire_reappro']}>
                <ReapproHistory />
              </PermissionRoute>
            )
          },
          { 
            path: 'rapport-ug', 
            element: (
              <PermissionRoute permission={['inventaire', 'inventaire_rapport_ug']}>
                <StockUGReport />
              </PermissionRoute>
            )
          },
          { 
            path: 'etats-inventaire', 
            element: (
              <PermissionRoute permission={['inventaire', 'inventaire_etats']}>
                <EtatsInventaire />
              </PermissionRoute>
            )
          },
          { 
            path: 'vitrine', 
            element: (
              <PermissionRoute permission="vitrine">
                <Vitrine />
              </PermissionRoute>
            )
          },
          { 
            path: 'journal-ajustements', 
            element: (
              <PermissionRoute permission={['inventaire', 'inventaire_journal']}>
                <JournalAjustements />
              </PermissionRoute>
            )
          },
          { 
            path: 'transformations', 
            element: (
              <PermissionRoute permission={['inventaire', 'inventaire_transformations']}>
                <Transformations />
              </PermissionRoute>
            )
          },
          { 
            path: 'rapports-mensuels', 
            element: (
              <PermissionRoute permission="statistiques_mensuels">
                <RapportMensuel />
              </PermissionRoute>
            )
          },
          { 
            path: 'centre-rapports', 
            element: (
              <PermissionRoute permission="statistiques_rapports">
                <CentreRapports />
              </PermissionRoute>
            )
          },
          { 
            path: 'analyse-abc', 
            element: (
              <PermissionRoute permission="statistiques_abc">
                <AnalyseABC />
              </PermissionRoute>
            )
          },
          { 
            path: 'module-financier', 
            element: (
              <PermissionRoute permission="statistiques_finances">
                <ModuleFinancier />
              </PermissionRoute>
            )
          },
          { 
            path: 'classement-vendeurs', 
            element: (
              <PermissionRoute permission="statistiques_vendeurs">
                <ClassementVendeurs />
              </PermissionRoute>
            )
          },
          { 
            path: 'analyse-temporelle', 
            element: (
              <PermissionRoute permission="statistiques_temporelle">
                <AnalyseTemporelle />
              </PermissionRoute>
            )
          },
          { 
            path: 'promotions', 
            element: (
              <PermissionRoute permission="ventes_promotions">
                <PromotionList />
              </PermissionRoute>
            )
          },
          { 
            path: 'guide-financier', 
            element: (
              <PermissionRoute permission="statistiques_guide">
                <GuideFinancier />
              </PermissionRoute>
            )
          },
          { 
            path: 'historique-ventes', 
            element: (
              <PermissionRoute permission="ventes_historique">
                <HistoriqueVentes />
              </PermissionRoute>
            )
          },
          { 
            path: 'ordonnancier', 
            element: (
              <PermissionRoute permission="ventes_ordonnancier">
                <OrdonnancierPage />
              </PermissionRoute>
            )
          },
          { 
            path: 'whatsapp-history', 
            element: (
              <PermissionRoute permission="settings_whatsapp">
                <WhatsAppHistory />
              </PermissionRoute>
            )
          },
          { 
            path: 'aide-formation', 
            element: (
              <PermissionRoute permission="aide_formation">
                <HelpTraining />
              </PermissionRoute>
            )
          },
          
          { 
            path: 'historique-achats', 
            element: (
              <PermissionRoute permission={['commandes_loc_history', 'commandes_dir_history']}>
                <HistoriqueAchats />
              </PermissionRoute>
            )
          },
          { 
            path: 'historique-achats/locales', 
            element: (
              <PermissionRoute permission="commandes_loc_history">
                <HistoriqueAchats forcedType="LOC" />
              </PermissionRoute>
            )
          },
          { 
            path: 'historique-achats/directes', 
            element: (
              <PermissionRoute permission="commandes_dir_history">
                <HistoriqueAchats forcedType="DIR" />
              </PermissionRoute>
            )
          },
          { 
            path: 'utilisateurs', 
            element: (
              <AdminRoute>
                <GestionUtilisateurs />
              </AdminRoute>
            )
          },
          { 
            path: 'user-sessions', 
            element: (
              <AdminRoute>
                <UserSessions />
              </AdminRoute>
            )
          },
          // { path: 'invoice-settings', element: <InvoiceSettings /> }, (removed)

          { 
            path: 'pharmacy-settings', 
            element: (
              <PermissionRoute permission="settings_pharmacie">
                <PharmacySettingsForm />
              </PermissionRoute>
            )
          },
          { 
            path: 'settings/options', 
            element: (
              <PermissionRoute permission="settings_etiquettes">
                <ConfigurationOptions />
              </PermissionRoute>
            )
          },
          { 
            path: 'journal-audit', 
            element: (
              <AdminRoute>
                <JournalAudit />
              </AdminRoute>
            ) 
          },
          {
            path: 'maintenance',
            element: (
              <AdminRoute>
                <Maintenance />
              </AdminRoute>
            )
          },
          { path: '*', element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
])


import { Suspense } from 'react'
import ErrorBoundary from './components/ErrorBoundary'

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <PharmacySettingsProvider>
          <ConfirmProvider>
            <Toaster position="top-right" />
            <Suspense fallback={<div className="h-screen flex items-center justify-center"><span className="loading loading-spinner loading-lg text-primary"></span></div>}>
              <RouterProvider router={router} />
            </Suspense>
          </ConfirmProvider>
        </PharmacySettingsProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}