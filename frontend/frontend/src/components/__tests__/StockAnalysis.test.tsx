import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import StockAnalysis from '../StockAnalysis';

vi.mock('../stock/StockHealthDashboard', () => ({
    default: () => <div data-testid="stock-health-dashboard" />
}));

vi.mock('../../hooks/useStockAnalysis', () => ({ useStockAnalysis: vi.fn() }));

import { AuthProvider } from '../../context/AuthContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useStockAnalysis } from '../../hooks/useStockAnalysis';

const mockFournisseurs = [
    { id: 1, name: 'Fournisseur A' },
    { id: 2, name: 'Fournisseur B' }
];

const mockAnalysisData = {
    type: 'shortage',
    fournisseur: '',
    total_items: 2,
    total_value: 1400,
    critical_count: 1,
    warning_count: 1,
    items: [
        { 
            id: 1, 
            name: 'Produit A', 
            stock: 10, 
            selling_price: 100, 
            urgency: 'warning', 
            rotation: 5, 
            avg_daily_sales: 2, 
            days_until_stockout: 5, 
            value: 1000, 
            cost_price: 80, 
            fournisseur_name: 'Fournisseur A' 
        },
        { 
            id: 2, 
            name: 'Produit B', 
            stock: 2, 
            selling_price: 200, 
            urgency: 'critical', 
            rotation: 10, 
            avg_daily_sales: 4, 
            days_until_stockout: 0, 
            value: 400, 
            cost_price: 150, 
            fournisseur_name: 'Fournisseur B' 
        },
    ],
    current_page: 1,
    total_pages: 1
};

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: false,
            gcTime: 0
        }
    }
});

const renderWithContext = (ui: React.ReactElement) => {
    return render(
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                <MemoryRouter>
                    {ui}
                </MemoryRouter>
            </AuthProvider>
        </QueryClientProvider>
    );
};

const mockSetSelectedFournisseur = vi.fn();
const mockFetchData = vi.fn();

const defaultHookValue = {
    activeTab: 'unsold',
    setActiveTab: vi.fn(),
    fournisseurs: mockFournisseurs,
    selectedFournisseur: '',
    setSelectedFournisseur: mockSetSelectedFournisseur,
    data: mockAnalysisData,
    loading: false,
    error: null,
    selectedItems: new Set(),
    unsoldDays: 90,
    setUnsoldDays: vi.fn(),
    page: 1,
    setPage: vi.fn(),
    actions: { fetchData: mockFetchData, handleGenerateOrder: vi.fn(), toggleSelectItem: vi.fn(), toggleSelectAll: vi.fn() }
};

describe('StockAnalysis', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (useStockAnalysis as any).mockReturnValue(defaultHookValue);
    });

    it('affiche le titre et charge les données au montage', async () => {
        renderWithContext(<StockAnalysis />);
        expect(screen.getByRole('heading', { level: 1, name: /Analyse/i })).toBeInTheDocument();
        expect(useStockAnalysis).toHaveBeenCalled();
    });

    it('affiche la liste des produits après le chargement', async () => {
        renderWithContext(<StockAnalysis />);
        await waitFor(() => {
            expect(screen.getByText('Produit A')).toBeInTheDocument();
            expect(screen.getByText('Produit B')).toBeInTheDocument();
        });
    });

    it('calcule correctement la valeur totale du stock dans les stats', async () => {
        renderWithContext(<StockAnalysis />);
        await waitFor(() => {
            expect(screen.getByText(/1[\s\u00a0]?400/)).toBeInTheDocument();
        });
    });

    it('identifie les produits avec stock faible', async () => {
        (useStockAnalysis as any).mockReturnValue({ ...defaultHookValue, activeTab: 'shortage' });
        renderWithContext(<StockAnalysis />);
        await waitFor(() => {
            expect(screen.getByText('Produit A')).toBeInTheDocument();
        });
    });

    it('gère les erreurs d\'API avec élégance', async () => {
        (useStockAnalysis as any).mockReturnValue({ ...defaultHookValue, data: null, error: 'Erreur de chargement' });
        renderWithContext(<StockAnalysis />);
        await waitFor(() => {
            expect(screen.getByText(/Erreur de chargement/i)).toBeInTheDocument();
        });
    });

    it('permet de filtrer par fournisseur', async () => {
        renderWithContext(<StockAnalysis />);
        await waitFor(() => {
            expect(screen.queryByText(/Chargement/i)).not.toBeInTheDocument();
        });
        const select = screen.getAllByRole('combobox')[0];
        await act(async () => {
            fireEvent.change(select, { target: { value: '1' } });
        });
        expect(mockSetSelectedFournisseur).toHaveBeenCalledWith('1');
    });
});

