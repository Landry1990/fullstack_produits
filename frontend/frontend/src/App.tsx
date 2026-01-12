import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom'
import Layout from './components/Layout'
import Produit from './components/Produit'
import Commandes from './components/Commandes'
import Ventes from './components/Ventes'
import Fournisseurs from './components/Fournisseurs'
import Clients from './components/Clients'
import Rayons from './components/Rayons'
import Facturation from './components/Facturation'
import Dashboard from './components/Dashboard'
import StatistiquesProduit from './components/StatistiquesProduit'
import GestionUtilisateurs from './components/GestionUtilisateurs'
import Inventaire from './components/Inventaire'
import Formes from './components/Formes'
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
import { AuthProvider, useAuth } from './context/AuthContext'
import { ConfirmProvider } from './hooks/useConfirm'
import { Toaster } from 'react-hot-toast'

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
      {
        element: <Layout />,
        children: [
          { index: true, element: <HomeRedirector /> },
          { 
            path: 'dashboard', 
            element: <Dashboard />
          },
          { path: 'produits', element: <Produit /> },
          { path: 'commandes', element: <Commandes /> },
          { path: 'ventes', element: <Ventes /> },
          { path: 'fournisseurs', element: <Fournisseurs /> },
          { path: 'clients', element: <Clients /> },
          { path: 'inventaire', element: <Inventaire /> },
          { path: 'formes', element: <Formes /> },
          { path: 'rayons', element: <Rayons /> },
          { path: 'facturation', element: <Facturation /> },
          { path: 'caisse-centralisee', element: <CaisseCentralisee /> },
          { path: 'statistiques', element: <StatistiquesProduit /> },
          { path: 'statistiques-fournisseurs', element: <StatistiquesFournisseur /> },
          { path: 'journal-caisse', element: <JournalCaisse /> },
          { path: 'historique-clotures', element: <HistoriqueClotures /> },
          { path: 'perimes', element: <Perimes /> },
          { path: 'creances', element: <Creances /> },
          { path: 'avoirs', element: <Avoirs /> },
          { path: 'promis', element: <Promis /> },
          { path: 'stock-analysis', element: <StockAnalysis /> },
          { path: 'journal-ajustements', element: <JournalAjustements /> },
          { path: 'transformations', element: <Transformations /> },
          { path: 'rapports-mensuels', element: <RapportMensuel /> },
          { path: 'centre-rapports', element: <CentreRapports /> },
          { path: 'historique-ventes', element: <HistoriqueVentes /> },
          { path: 'ordonnancier', element: <OrdonnancierPage /> },
          { path: 'historique-achats', element: <HistoriqueAchats /> },
          { path: 'utilisateurs', element: <GestionUtilisateurs /> },
          { path: 'invoice-settings', element: <InvoiceSettings /> },
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

export default function App() {
  return (
    <AuthProvider>
      <ConfirmProvider>
        <Toaster position="top-right" />
        <RouterProvider router={router} />
      </ConfirmProvider>
    </AuthProvider>
  )
}