import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import React from 'react';
import { AlertsShadcn, type DashboardAlert } from '../DashboardManagerShadcn';

const renderAlerts = (alerts?: DashboardAlert[]) =>
    render(
        <MemoryRouter initialEntries={['/app/manager-dashboard']}>
            <Routes>
                <Route path="/app/manager-dashboard" element={<AlertsShadcn alerts={alerts} />} />
                <Route path="/app/stock-analysis" element={<div>ANALYSE STOCK</div>} />
                <Route path="/app/ventes" element={<div>VENTES</div>} />
                <Route path="/" element={<div>LOGIN</div>} />
            </Routes>
        </MemoryRouter>
    );

describe('Alertes intelligentes — navigation', () => {
    it('affiche l’état vide sans alertes', () => {
        renderAlerts([]);
        expect(screen.getByText(/tout va bien/i)).toBeInTheDocument();
    });

    it('les boutons d’action ont type="button"', () => {
        renderAlerts([{
            type: 'danger', priority: 1, icon: 'package',
            title_key: 'Ruptures', message_key: 'msg',
            action_key: 'Voir', action_route: '/app/stock-analysis',
        }]);
        const btn = screen.getByRole('button', { name: /voir/i });
        expect(btn).toHaveAttribute('type', 'button');
    });

    it('clic alerte rupture → /app/stock-analysis (régression déconnexion)', () => {
        renderAlerts([{
            type: 'danger', priority: 1, icon: 'package',
            title_key: 'Ruptures', message_key: 'msg',
            action_key: 'Voir', action_route: '/app/stock-analysis',
        }]);
        fireEvent.click(screen.getByRole('button', { name: /voir/i }));
        // Ne doit JAMAIS retomber sur la page de connexion
        expect(screen.queryByText('LOGIN')).toBeNull();
        expect(screen.getByText('ANALYSE STOCK')).toBeInTheDocument();
    });

    it('clic alerte ventes → /app/ventes', () => {
        renderAlerts([{
            type: 'warning', priority: 2, icon: 'chart',
            title_key: 'Ventes', message_key: 'msg',
            action_key: 'Voir', action_route: '/app/ventes',
        }]);
        fireEvent.click(screen.getByRole('button', { name: /voir/i }));
        expect(screen.getByText('VENTES')).toBeInTheDocument();
    });

    it('tri par priorité croissante', () => {
        renderAlerts([
            { type: 'info', priority: 5, title_key: 'Basse priorité', message_key: 'm' },
            { type: 'danger', priority: 1, title_key: 'Haute priorité', message_key: 'm' },
        ]);
        const titles = screen.getAllByRole('heading', { level: 4 }).map(h => h.textContent);
        expect(titles[0]).toBe('Haute priorité');
        expect(titles[1]).toBe('Basse priorité');
    });

    it('compteur de danger affiché', () => {
        renderAlerts([
            { type: 'danger', priority: 1, title_key: 'A1', message_key: 'm' },
            { type: 'danger', priority: 2, title_key: 'A2', message_key: 'm' },
            { type: 'info', priority: 3, title_key: 'A3', message_key: 'm' },
        ]);
        expect(screen.getByText('2')).toBeInTheDocument();
    });
});
