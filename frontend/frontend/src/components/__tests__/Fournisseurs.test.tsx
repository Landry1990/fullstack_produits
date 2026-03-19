import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import Fournisseurs from '../Fournisseurs';
import axios from 'axios';

// Mock libs
vi.mock('react-hot-toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() }
}));

// Mock hooks
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, role: 'PHARMACIEN' } })
}));

vi.mock('../../hooks/useConfirm', () => ({
  useConfirm: () => vi.fn().mockResolvedValue(true)
}));

// Mock useLocation for state testing
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useLocation: vi.fn().mockReturnValue({ state: null })
    };
});

const mockFournisseurs = [
  { id: 1, name: 'Pharma Distrib', phone: '0102030405', email: 'contact@pharma.com', address: 'Paris', solde_dette: '150000' },
  { id: 2, name: 'MedSupply', phone: '0504030201', email: 'sales@med.com', address: 'Lyon', solde_dette: '50000' }
];

describe('Fournisseurs Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(axios.get).mockImplementation((url: string) => {
        if (url.includes('/fournisseurs/')) {
            return Promise.resolve({ data: { results: mockFournisseurs, count: 2 } });
        }
        return Promise.resolve({ data: [] });
    });
    // Default location mock
    vi.mocked(useLocation).mockReturnValue({ state: null } as any);
  });

  it('renders correctly and displays list', async () => {
    render(
      <MemoryRouter>
        <Fournisseurs />
      </MemoryRouter>
    );

    expect(screen.getByPlaceholderText(/Rechercher par nom/i)).toBeInTheDocument();
    
    // Wait for data to load
    await waitFor(() => {
        expect(screen.getByText('Pharma Distrib')).toBeInTheDocument();
        expect(screen.getByText('MedSupply')).toBeInTheDocument();
    });
  });

  it('opens finance modal automatically when navigating from Dashboard with state', async () => {
    // Mock incoming state
    vi.mocked(useLocation).mockReturnValue({ 
        state: { selectedSupplierId: 1, openFinance: true } 
    } as any);

    render(
      <MemoryRouter>
        <Fournisseurs />
      </MemoryRouter>
    );

    // Should wait for providers to load then open modal
    await waitFor(() => {
        expect(screen.getByText('Pharma Distrib')).toBeInTheDocument();
    });

    // The text in the modal can be "Gestion Financière" or "Règlements" depending on i18n
    await waitFor(() => {
        expect(screen.getByText(/Gestion Financière/i) || screen.getByText(/Règlements/i)).toBeInTheDocument();
    });
  });

  it('filters suppliers based on search query', async () => {
    vi.useFakeTimers();
    render(
      <MemoryRouter>
        <Fournisseurs />
      </MemoryRouter>
    );

    const searchInput = screen.getByPlaceholderText(/Rechercher par nom/i);
    fireEvent.change(searchInput, { target: { value: 'Med' } });

    // Attendre le debounce de 300ms
    await act(async () => {
        vi.advanceTimersByTime(400);
    });

    await waitFor(() => {
        expect(axios.get).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                params: expect.objectContaining({ search: 'Med' })
            })
        );
    });
    vi.useRealTimers();
  });
});
