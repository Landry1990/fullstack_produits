import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import React from 'react';

// Utilisateur mutable contrôlé par chaque test
const mockAuth = vi.hoisted(() => ({
    user: null as null | {
        id: number;
        username: string;
        is_superuser?: boolean;
        role?: string;
        allowed_menus?: string[];
    },
    isAuthenticated: false,
    loading: false,
}));

vi.mock('../../../context/AuthContext', () => ({
    useAuth: () => mockAuth,
    AuthProvider: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../../hooks/useAutoLogout', () => ({
    useAutoLogout: () => undefined,
}));

import { ProtectedRoute, AdminRoute, HomeRedirector } from '../RouteGuards';
import { PermissionRoute } from '../PermissionRoute';

const renderWithRoutes = (initial: string, routes: React.ReactNode) =>
    render(
        <MemoryRouter initialEntries={[initial]}>
            <Routes>{routes}</Routes>
        </MemoryRouter>
    );

beforeEach(() => {
    mockAuth.user = null;
    mockAuth.isAuthenticated = false;
    mockAuth.loading = false;
});

describe('ProtectedRoute', () => {
    it('affiche un spinner pendant le chargement', () => {
        mockAuth.loading = true;
        const { container } = renderWithRoutes('/app/x', (
            <>
                <Route element={<ProtectedRoute />}>
                    <Route path="/app/x" element={<div>CONTENU</div>} />
                </Route>
                <Route path="/" element={<div>LOGIN</div>} />
            </>
        ));
        expect(container.querySelector('.animate-spin')).toBeTruthy();
        expect(screen.queryByText('CONTENU')).toBeNull();
    });

    it('redirige vers / si non authentifié', () => {
        renderWithRoutes('/app/x', (
            <>
                <Route element={<ProtectedRoute />}>
                    <Route path="/app/x" element={<div>CONTENU</div>} />
                </Route>
                <Route path="/" element={<div>LOGIN</div>} />
            </>
        ));
        expect(screen.getByText('LOGIN')).toBeInTheDocument();
        expect(screen.queryByText('CONTENU')).toBeNull();
    });

    it('rend le contenu si authentifié', () => {
        mockAuth.user = { id: 1, username: 'u' };
        mockAuth.isAuthenticated = true;
        renderWithRoutes('/app/x', (
            <>
                <Route element={<ProtectedRoute />}>
                    <Route path="/app/x" element={<div>CONTENU</div>} />
                </Route>
            </>
        ));
        expect(screen.getByText('CONTENU')).toBeInTheDocument();
    });
});

describe('AdminRoute', () => {
    it('redirige un non-superuser vers /app/facturation', () => {
        mockAuth.user = { id: 2, username: 'vendeur', is_superuser: false };
        renderWithRoutes('/admin', (
            <>
                <Route path="/admin" element={
                    <AdminRoute><div>ADMIN ZONE</div></AdminRoute>
                } />
                <Route path="/app/facturation" element={<div>FACTURATION</div>} />
            </>
        ));
        expect(screen.getByText('FACTURATION')).toBeInTheDocument();
        expect(screen.queryByText('ADMIN ZONE')).toBeNull();
    });

    it('rend les enfants pour un superuser', () => {
        mockAuth.user = { id: 1, username: 'admin', is_superuser: true };
        renderWithRoutes('/admin', (
            <Route path="/admin" element={
                <AdminRoute><div>ADMIN ZONE</div></AdminRoute>
            } />
        ));
        expect(screen.getByText('ADMIN ZONE')).toBeInTheDocument();
    });

    it('redirige vers / sans utilisateur', () => {
        renderWithRoutes('/admin', (
            <>
                <Route path="/admin" element={
                    <AdminRoute><div>ADMIN ZONE</div></AdminRoute>
                } />
                <Route path="/" element={<div>LOGIN</div>} />
            </>
        ));
        expect(screen.getByText('LOGIN')).toBeInTheDocument();
    });
});

describe('HomeRedirector', () => {
    const renderHome = () => renderWithRoutes('/app', (
        <>
            <Route path="/app" element={<HomeRedirector />} />
            <Route path="/" element={<div>LOGIN</div>} />
            <Route path="/app/dashboard" element={<div>DASHBOARD</div>} />
            <Route path="/app/manager-dashboard" element={<div>MANAGER</div>} />
            <Route path="/app/caisse-centralisee" element={<div>CAISSE</div>} />
            <Route path="/app/facturation" element={<div>FACTURATION</div>} />
            <Route path="/app/produits" element={<div>PRODUITS</div>} />
        </>
    ));

    it('superuser → /app/dashboard', () => {
        mockAuth.user = { id: 1, username: 'admin', is_superuser: true };
        renderHome();
        expect(screen.getByText('DASHBOARD')).toBeInTheDocument();
    });

    it('caissier → /app/caisse-centralisee', () => {
        mockAuth.user = { id: 2, username: 'caissier', role: 'CAISSIER' };
        renderHome();
        expect(screen.getByText('CAISSE')).toBeInTheDocument();
    });

    it('manager_sidebar → /app/manager-dashboard', () => {
        mockAuth.user = { id: 3, username: 'mgr', allowed_menus: ['manager_sidebar'] };
        renderHome();
        expect(screen.getByText('MANAGER')).toBeInTheDocument();
    });

    it('dashboard menu → /app/dashboard', () => {
        mockAuth.user = { id: 4, username: 'u', allowed_menus: ['dashboard', 'facturation'] };
        renderHome();
        expect(screen.getByText('DASHBOARD')).toBeInTheDocument();
    });

    it('aucun menu → fallback /app/facturation', () => {
        mockAuth.user = { id: 5, username: 'u', allowed_menus: [] };
        renderHome();
        expect(screen.getByText('FACTURATION')).toBeInTheDocument();
    });
});

describe('PermissionRoute', () => {
    const renderPerm = (permission: string | string[], requireAll = false) =>
        renderWithRoutes('/app/secure', (
            <>
                <Route element={<PermissionRoute permission={permission} requireAll={requireAll} />}>
                    <Route path="/app/secure" element={<div>SECURE</div>} />
                </Route>
                <Route path="/login" element={<div>LOGIN</div>} />
                <Route path="/app" element={<div>HOME REDIRECT</div>} />
            </>
        ));

    it('non authentifié → /login', () => {
        renderPerm('produits');
        expect(screen.getByText('LOGIN')).toBeInTheDocument();
    });

    it('superuser bypass la permission', () => {
        mockAuth.user = { id: 1, username: 'admin', is_superuser: true };
        mockAuth.isAuthenticated = true;
        renderPerm('permission_inexistante');
        expect(screen.getByText('SECURE')).toBeInTheDocument();
    });

    it('permission accordée → contenu', () => {
        mockAuth.user = { id: 2, username: 'u', allowed_menus: ['produits'] };
        mockAuth.isAuthenticated = true;
        renderPerm('produits');
        expect(screen.getByText('SECURE')).toBeInTheDocument();
    });

    it('permission refusée → retour /app (pas de déconnexion)', () => {
        mockAuth.user = { id: 2, username: 'u', allowed_menus: ['facturation'] };
        mockAuth.isAuthenticated = true;
        renderPerm('produits');
        expect(screen.getByText('HOME REDIRECT')).toBeInTheDocument();
        expect(screen.queryByText('SECURE')).toBeNull();
    });

    it('tableau de permissions : une suffit par défaut', () => {
        mockAuth.user = { id: 2, username: 'u', allowed_menus: ['b'] };
        mockAuth.isAuthenticated = true;
        renderPerm(['a', 'b', 'c']);
        expect(screen.getByText('SECURE')).toBeInTheDocument();
    });

    it('requireAll : toutes les permissions exigées', () => {
        mockAuth.user = { id: 2, username: 'u', allowed_menus: ['a', 'b'] };
        mockAuth.isAuthenticated = true;
        renderPerm(['a', 'b', 'c'], true);
        expect(screen.getByText('HOME REDIRECT')).toBeInTheDocument();
    });
});
