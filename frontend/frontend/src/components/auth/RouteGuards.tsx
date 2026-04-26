import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAutoLogout } from '../../hooks/useAutoLogout';

const LoadingSpinner = () => (
  <div className="h-screen flex items-center justify-center">
    <span className="loading loading-spinner loading-lg"></span>
  </div>
);

export const ProtectedRoute = () => {
  const { isAuthenticated, loading } = useAuth();
  
  // Initialize inactivity auto-logout tracking
  useAutoLogout();

  if (loading) return <LoadingSpinner />;
  return isAuthenticated ? <Outlet /> : <Navigate to="/" />;
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
  
  const allowed = (user as any).allowed_menus || [];
  if (allowed.includes('dashboard')) return <Navigate to="/app/dashboard" />;
  if (allowed.includes('facturation')) return <Navigate to="/app/facturation" />;
  if (allowed.includes('caisse')) return <Navigate to="/app/caisse-centralisee" />;
  if (allowed.includes('produits')) return <Navigate to="/app/produits" />;
  
  return <Navigate to="/app/facturation" />; // Fallback safer
};
