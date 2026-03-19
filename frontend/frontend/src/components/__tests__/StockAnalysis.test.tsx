import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, type Mocked } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import StockAnalysis from '../StockAnalysis';
import axios from 'axios';
import { AuthProvider } from '../../context/AuthContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockedAxios = axios as Mocked<typeof axios>;

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

describe('StockAnalysis', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockedAxios.get.mockImplementation((url) => {
            if (url.includes('/api/fournisseurs/')) {
                return Promise.resolve({ data: mockFournisseurs });
            }
            if (url.includes('/api/stock-analysis/')) {
                return Promise.resolve({ data: mockAnalysisData });
            }
            return Promise.reject(new Error('Unknown API call'));
        });
    });

    it('affiche le titre et charge les données au montage', async () => {
        await renderWithContext(<StockAnalysis />);
        
        expect(screen.getByRole('heading', { level: 1, name: /Analyse/i })).toBeInTheDocument();
        
        await waitFor(() => {
            expect(screen.queryByText(/Chargement/i)).not.toBeInTheDocument();
        });

        // The component fetches suppliers and then analysis data
        expect(mockedAxios.get).toHaveBeenCalledWith(expect.stringContaining('/api/fournisseurs/'));
        expect(mockedAxios.get).toHaveBeenCalledWith(expect.stringContaining('/api/stock-analysis/unsold/'), expect.any(Object));
    });

    it('affiche la liste des produits après le chargement', async () => {
        await renderWithContext(<StockAnalysis />);

        await waitFor(() => {
            expect(screen.getByText(/Produit A/i)).toBeInTheDocument();
            expect(screen.getByText(/Produit B/i)).toBeInTheDocument();
        });
    });

    it('calcule correctement la valeur totale du stock dans les stats', async () => {
        await renderWithContext(<StockAnalysis />);

        await waitFor(() => {
            // Data has total_value: 1400. In stats it should appear.
            expect(screen.getByText(/1\s?400/)).toBeInTheDocument();
        });
    });

    it('identifie les produits avec stock faible', async () => {
        // Change tab to shortage to see urgency badges
        await renderWithContext(<StockAnalysis />);
        
        await waitFor(() => {
            expect(screen.queryByText(/Chargement/i)).not.toBeInTheDocument();
        });

        const shortageTab = screen.getByText(/Ruptures/i);
        fireEvent.click(shortageTab);

        await waitFor(() => {
            expect(screen.getByText(/Stock faible/i)).toBeInTheDocument();
            expect(screen.getByText(/Rupture Imminente/i)).toBeInTheDocument();
        });
    });

    it('gère les erreurs d\'API avec élégance', async () => {
        mockedAxios.get.mockImplementation((url) => {
            if (url.includes('/api/stock-analysis/')) {
                return Promise.reject(new Error('Network Error'));
            }
            return Promise.resolve({ data: [] });
        });
        
        await renderWithContext(<StockAnalysis />);

        await waitFor(() => {
            // The error message is t('stock:analyse.error') which is "Erreur de chargement"
            expect(screen.getByText(/Erreur de chargement/i)).toBeInTheDocument();
        });
    });

    it('permet de filtrer par fournisseur', async () => {
        await renderWithContext(<StockAnalysis />);

        await waitFor(() => {
            expect(screen.queryByText(/Chargement/i)).not.toBeInTheDocument();
        });

        const select = screen.getAllByRole('combobox')[0]; // First select is supplier
        await act(async () => {
            fireEvent.change(select, { target: { value: '1' } });
        });

        expect(mockedAxios.get).toHaveBeenCalledWith(
            expect.stringContaining('/api/stock-analysis/'),
            expect.objectContaining({ params: expect.objectContaining({ fournisseur: '1' }) })
        );
    });
});

