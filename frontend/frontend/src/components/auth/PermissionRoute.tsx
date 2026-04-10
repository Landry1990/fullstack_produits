import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface PermissionRouteProps {
  /** The permission key(s) required to access this route */
  permission: string | string[];
  /** If true, all permissions in the array are required. If false, only one is required. */
  requireAll?: boolean;
  /** Optional children if used as a wrapper component */
  children?: React.ReactNode;
}

/**
 * Route wrapper that enforces permission-based access control.
 * Superusers always have access.
 */
export const PermissionRoute: React.FC<PermissionRouteProps> = ({ 
  permission, 
  requireAll = false,
  children
}) => {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // Superusers bypass all permission checks
  if (user.is_superuser) {
    return children ? <>{children}</> : <Outlet />;
  }

  const allowed = user.allowed_menus || [];
  const permissionsToCheck = Array.isArray(permission) ? permission : [permission];
  
  const hasPermission = requireAll
    ? permissionsToCheck.every(p => allowed.includes(p))
    : permissionsToCheck.some(p => allowed.includes(p));

  if (!hasPermission) {
    // If not authorized, redirect back to the home redirector 
    // which will find a safe place for the user
    return <Navigate to="/app" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};
