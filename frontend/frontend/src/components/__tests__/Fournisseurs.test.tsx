import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import Fournisseurs from '../Fournisseurs';
import axios from 'axios';

// Mock libs
vi.mock('axios');
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

    expect(screen.getByPlaceholderText(/Rechercher un fournisseur/i)).toBeInTheDocument();
    
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

    // Check if Finance modal or its content is visible
    // Based on implementation, FinanceFournisseurModal should open
    await waitFor(() => {
        expect(screen.getByText(/Finance/i) || screen.getByText(/Règlement/i)).toBeInTheDocument();
    });
  });

  it('filters suppliers based on search query', async () => {
    render(
      <MemoryRouter>
        <Fournisseurs />
      </MemoryRouter>
    );

    const searchInput = screen.getByPlaceholderText(/Rechercher un fournisseur/i);
    fireEvent.change(searchInput, { target: { value: 'Med' } });

    await waitFor(() => {
        expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('search=Med'), expect.any(Object));
    });
  });
});
