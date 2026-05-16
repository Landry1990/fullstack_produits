import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Fournisseurs from '../Fournisseurs';
import axios from 'axios';

// Mock axios globally
const mockedAxios = axios as any;

vi.mock('react-hot-toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() }
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, role: 'PHARMACIEN' } })
}));

vi.mock('../../hooks/useSupplierDashboard', () => ({
  useSupplierDashboard: () => ({
    stats: {
      total_dette: 1000000,
      nb_fournisseurs_actifs: 10,
      stats_echeances: { en_retard: 50000, aujourdhui: 10000, a_venir: 940000, count_retard: 2 },
      repartition_dette: [],
      prochaines_echeances: [],
      evolution_dette: []
    },
    loading: false,
    error: null,
    refresh: vi.fn()
  })
}));

vi.mock('../../hooks/useConfirm', () => ({
  useConfirm: () => vi.fn().mockResolvedValue(true)
}));

const mockFournisseurs = [
  { id: 1, name: 'Pharma Distrib', phone: '0102030405', email: 'contact@pharma.com', address: 'Paris', solde_dette: '150000' },
  { id: 2, name: 'MedSupply', phone: '0504030201', email: 'sales@med.com', address: 'Lyon', solde_dette: '50000' }
];

describe('Fournisseurs Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockedAxios.get.mockImplementation((url: string) => {
            if (url.includes('fournisseurs/dashboard_stats')) {
                return Promise.resolve({ data: { 
                    total_dette: 1000000,
                    nb_fournisseurs_actifs: 10,
                    stats_echeances: {
                        en_retard: 200000,
                        count_retard: 5,
                        aujourdhui: 50000,
                        a_venir: 150000
                    }
                } });
            }
            if (url.includes('fournisseurs')) {
                return Promise.resolve({ data: { results: mockFournisseurs, count: 2 } });
            }
            return Promise.resolve({ data: [] });
        });
    });

    it('renders and displays list', async () => {
        render(
            <MemoryRouter>
                <Fournisseurs />
            </MemoryRouter>
        );

        // Switch to management tab
        fireEvent.click(screen.getByText('Liste & Gestion'));

        expect(screen.getByPlaceholderText(/Rechercher par nom/i)).toBeInTheDocument();
        
        await waitFor(() => {
            expect(screen.getByText('Pharma Distrib')).toBeInTheDocument();
            expect(screen.getByText('MedSupply')).toBeInTheDocument();
        });
    });

    it('opens finance modal via location state', async () => {
        render(
            <MemoryRouter initialEntries={[{ pathname: '/fournisseurs', state: { selectedSupplierId: 1, openFinance: true } }]}>
                <Fournisseurs />
            </MemoryRouter>
        );

        // Switch to management tab to see the list
        fireEvent.click(screen.getByText('Liste & Gestion'));

        await waitFor(() => {
            expect(screen.getByText('Pharma Distrib')).toBeInTheDocument();
        });

        await waitFor(() => {
            // Look for the finance modal by its specific title text
            expect(screen.getByText(/Gestion Financi/i)).toBeInTheDocument();
        });
    });

    it('filters via search query', async () => {
        // Use real timers for search test to be safer with complex effects
        render(
            <MemoryRouter>
                <Fournisseurs />
            </MemoryRouter>
        );

        // Switch to management tab
        fireEvent.click(screen.getByText('Liste & Gestion'));

        const searchInput = screen.getByPlaceholderText(/Rechercher par nom/i);
        fireEvent.change(searchInput, { target: { value: 'Med' } });

        // Wait for debounce and effect
        await waitFor(() => {
            const calls = mockedAxios.get.mock.calls;
            const searchCall = calls.find((c: any) => c[1]?.params?.search === 'Med');
            expect(searchCall).toBeDefined();
        }, { timeout: 4000 });
    });
});
