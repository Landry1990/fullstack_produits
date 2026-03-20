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
            if (url.includes('/fournisseurs/')) {
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

        await waitFor(() => {
            expect(screen.getByText('Pharma Distrib')).toBeInTheDocument();
        });

        await waitFor(() => {
            // "Gestion Financière" is an i18n key providers:finance_modal.title or similar
            // In setup.ts, translation returns key or default.
            // We check for some keyword that should be in the modal
            expect(screen.getByText(/Gestion/i) || screen.getByText(/Finance/i) || screen.getByText(/Règlements/i)).toBeInTheDocument();
        });
    });

    it('filters via search query', async () => {
        // Use real timers for search test to be safer with complex effects
        render(
            <MemoryRouter>
                <Fournisseurs />
            </MemoryRouter>
        );

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
