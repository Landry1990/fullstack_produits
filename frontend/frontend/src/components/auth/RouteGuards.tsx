import React, { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAutoLogout } from '../../hooks/useAutoLogout';
import { savePostLoginRedirect } from '../../utils/postLoginRedirect';

const LoadingSpinner = () => (
  <div className="h-screen flex items-center justify-center">
    <Loader2 className="size-8 animate-spin" />
  </div>
);

export const ProtectedRoute = () => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  // Initialize inactivity auto-logout tracking
  useAutoLogout();

  // Mémorise la page demandée pour y revenir après reconnexion
  // (déconnexion par inactivité, logout manuel, accès direct non authentifié)
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      savePostLoginRedirect(location.pathname + location.search);
    }
  }, [loading, isAuthenticated, location]);

  if (loading) return <LoadingSpinner />;
  return isAuthenticated ? <Outlet /> : <Navigate to="/" replace />;
};

export const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/" />;
  return user.is_superuser ? <>{children}</> : <Navigate to="/app/facturation" />;
};

export const HomeRedirector = () => {
  const { user, loading } = useAuth();

  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/" />;

  if (user.is_superuser) return <Navigate to="/app/dashboard" />;

  // Les caissiers atterrissent directement sur la caisse centrale
  if (user.role === 'CAISSIER') return <Navigate to="/app/caisse-centralisee" />;

  // Tous les autres utilisateurs (non-admin) démarrent sur la facturation
  const allowed = user.allowed_menus || [];
  if (allowed.length === 0 || allowed.includes('facturation')) {
    return <Navigate to="/app/facturation" />;
  }

  // Fallback si l'utilisateur n'a pas la permission facturation :
  // éviter une boucle /app ↔ /app/facturation via PermissionRoute
  if (allowed.includes('caisse')) return <Navigate to="/app/caisse-centralisee" />;
  if (allowed.includes('manager_sidebar')) return <Navigate to="/app/manager-dashboard" />;
  if (allowed.includes('dashboard')) return <Navigate to="/app/dashboard" />;
  if (allowed.includes('produits')) return <Navigate to="/app/produits" />;
  if (allowed.includes('ventes_consultation')) return <Navigate to="/app/ventes" />;

  return <Navigate to="/app/facturation" />;
};
