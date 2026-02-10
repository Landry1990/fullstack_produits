import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom'
import PrintPage from './components/printing/PrintPage'
import Layout from './components/Layout'
import Produit from './components/Produit'
import Commandes from './components/Commandes'
import Ventes from './components/Ventes'
import Fournisseurs from './components/Fournisseurs'
import Clients from './components/Clients'
import Categories from './components/Categories'
import Facturation from './components/Facturation'
import Dashboard from './components/Dashboard'
import DashboardManager from './components/DashboardManager'
import GestionUtilisateurs from './components/GestionUtilisateurs'
import Vitrine from './components/Vitrine'
import Inventaire from './components/Inventaire'
import EtatsInventaire from './components/EtatsInventaire'
import Formes from './components/Formes'
import Groupes from './components/Groupes'
import Login from './components/Login'
import StatistiquesFournisseur from './components/StatistiquesFournisseur'
import JournalCaisse from './components/JournalCaisse'
import Perimes from './components/Perimes'
import Creances from './components/Creances'
import Avoirs from './components/Avoirs'
import RapportMensuel from './components/RapportMensuel'
import Transformations from './components/Transformations'
import InvoiceSettings from './components/InvoiceSettings'

import JournalAudit from './components/JournalAudit'
import JournalAjustements from './components/JournalAjustements'
import Promis from './components/Promis'
import StockAnalysis from './components/StockAnalysis'
import CaisseCentralisee from './components/CaisseCentralisee'
import HistoriqueClotures from './components/HistoriqueClotures'
import HistoriqueVentes from './components/HistoriqueVentes'
import HistoriqueAchats from './components/HistoriqueAchats'
import OrdonnancierPage from './components/Ordonnancier'
import CentreRapports from './components/CentreRapports'
import AnalyseABC from './components/AnalyseABC'
import PromotionList from './components/Promotions/PromotionList';
import ModuleFinancier from './components/ModuleFinancier';
import ClassementVendeurs from './components/ClassementVendeurs';
import AnalyseTemporelle from './components/AnalyseTemporelle';
import { AuthProvider, useAuth } from './context/AuthContext'
import { ConfirmProvider } from './hooks/useConfirm'
import { Toaster } from 'react-hot-toast'
import PharmacySettingsForm from './components/settings/PharmacySettingsForm'
import ConfigurationOptions from './components/settings/ConfigurationOptions'

const ProtectedRoute = () => {
  const { isAuthenticated, loading } = useAuth();

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
    path: '/app',
    element: <ProtectedRoute />,
    children: [
      { path: 'print-invoice/:id', element: <PrintPage /> },
      {
        element: <Layout />,
        children: [
          { index: true, element: <HomeRedirector /> },
          { 
            path: 'dashboard', 
            element: <Dashboard />
          },
          { 
            path: 'manager-dashboard', 
            element: <DashboardManager />
          },
          { path: 'produits', element: <Produit /> },
          { path: 'commandes', element: <Commandes /> },
          { path: 'commandes/locales', element: <Commandes forcedType="LOC" /> },
          { path: 'commandes/directes', element: <Commandes forcedType="DIR" /> },
          
          { path: 'ventes', element: <Ventes /> },
          { path: 'fournisseurs', element: <Fournisseurs /> },
          { path: 'clients', element: <Clients /> },
          { path: 'inventaire', element: <Inventaire /> },
          { path: 'formes', element: <Formes /> },
          { path: 'groupes', element: <Groupes /> },
          { path: 'rayons', element: <Categories /> },
          { path: 'facturation', element: <Facturation /> },
          { path: 'caisse-centralisee', element: <CaisseCentralisee /> },
          { path: 'statistiques-fournisseurs', element: <StatistiquesFournisseur /> },
          { path: 'journal-caisse', element: <JournalCaisse /> },
          { path: 'historique-clotures', element: <HistoriqueClotures /> },
          { path: 'perimes', element: <Perimes /> },
          { path: 'creances', element: <Creances /> },
          { path: 'avoirs', element: <Avoirs /> },
          { path: 'promis', element: <Promis /> },
          { path: 'stock-analysis', element: <StockAnalysis /> },
          { path: 'etats-inventaire', element: <EtatsInventaire /> },
          { path: 'vitrine', element: <Vitrine /> },
          { path: 'journal-ajustements', element: <JournalAjustements /> },
          { path: 'transformations', element: <Transformations /> },
          { path: 'rapports-mensuels', element: <RapportMensuel /> },
          { path: 'centre-rapports', element: <CentreRapports /> },
          { path: 'analyse-abc', element: <AnalyseABC /> },
          { path: 'module-financier', element: <ModuleFinancier /> },
          { path: 'classement-vendeurs', element: <ClassementVendeurs /> },
          { path: 'analyse-temporelle', element: <AnalyseTemporelle /> },
          { path: 'promotions', element: <PromotionList /> },
          { path: 'historique-ventes', element: <HistoriqueVentes /> },
          { path: 'ordonnancier', element: <OrdonnancierPage /> },
          
          { path: 'historique-achats', element: <HistoriqueAchats /> },
          { path: 'historique-achats/locales', element: <HistoriqueAchats forcedType="LOC" /> },
          { path: 'historique-achats/directes', element: <HistoriqueAchats forcedType="DIR" /> },
          { path: 'utilisateurs', element: <GestionUtilisateurs /> },
          { path: 'invoice-settings', element: <InvoiceSettings /> },

          { path: 'pharmacy-settings', element: <PharmacySettingsForm /> },
          { path: 'settings/options', element: <ConfigurationOptions /> },
          { 
            path: 'journal-audit', 
            element: (
              <AdminRoute>
                <JournalAudit />
              </AdminRoute>
            ) 
          },
        ],
      },
    ],
  },
])

import ErrorBoundary from './components/ErrorBoundary'

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ConfirmProvider>
          <Toaster position="top-right" />
          <RouterProvider router={router} />
        </ConfirmProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}