import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import StockAnalysis from '../StockAnalysis';
import axios from 'axios';

// Mock axios
vi.mock('axios');

// Mock react-i18next
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => {
            const translations: Record<string, string> = {
                'stockAnalysis.title': 'Analyse des Stocks',
                'stockAnalysis.tabs.unsold': 'Invendus',
                'stockAnalysis.tabs.overstock': 'Surstock',
                'stockAnalysis.tabs.shortage': 'Ruptures',
                'stockAnalysis.tabs.unsold_desc': 'Produits sans vente récente',
                'stockAnalysis.tabs.overstock_desc': 'Produits en surstock',
                'stockAnalysis.tabs.shortage_desc': 'Prévision des ruptures',
                'stockAnalysis.filters.supplier': 'Fournisseur',
                'stockAnalysis.filters.all_suppliers': 'Tous les fournisseurs',
                'stockAnalysis.filters.days_threshold': 'Seuil (jours)',
                'stockAnalysis.filters.refresh': 'Actualiser',
                'stockAnalysis.stats.supplier': 'Fournisseur',
                'stockAnalysis.stats.item_count': 'Nb. produits',
                'stockAnalysis.stats.estimated_value': 'Valeur estimée',
                'stockAnalysis.stats.overstock_value': 'Valeur surstock',
                'stockAnalysis.stats.value_at_risk': 'Valeur à risque',
                'stockAnalysis.stats.critical_alerts': 'Alertes critiques',
                'stockAnalysis.columns.product': 'Produit',
                'stockAnalysis.columns.current_stock': 'Stock actuel',
                'stockAnalysis.columns.created_at': 'Date création',
                'stockAnalysis.columns.cost_price': 'Prix coût',
                'stockAnalysis.columns.stock_value': 'Valeur stock',
                'stockAnalysis.columns.avg_rotation': 'Rotation Moy.',
                'stockAnalysis.columns.threshold': 'Seuil',
                'stockAnalysis.columns.excess_qty': 'Excédent',
                'stockAnalysis.columns.excess_value': 'Valeur excédent',
                'stockAnalysis.columns.avg_daily_sales': 'Ventes/jour',
                'stockAnalysis.columns.days_until_stockout': 'Jours restants',
                'stockAnalysis.columns.urgency': 'Urgence',
                'stockAnalysis.columns.value_at_risk': 'Valeur à risque',
                'stockAnalysis.shortage.warnings': 'avertissements',
                'stockAnalysis.shortage.selected': 'sélectionné(s)',
                'stockAnalysis.shortage.generate_order': 'Générer commande',
                'stockAnalysis.shortage.urgency.critical': 'Critique',
                'stockAnalysis.shortage.urgency.warning': 'Attention',
                'stockAnalysis.shortage.urgency.caution': 'Prudence',
                'stockAnalysis.empty.unsold': 'Aucun produit invendu',
                'stockAnalysis.empty.overstock': 'Pas de surstock',
                'stockAnalysis.empty.shortage': 'Pas de rupture prévue',
                'stockAnalysis.empty.all_good': 'Tout semble en ordre !',
                'stockAnalysis.error': 'Erreur de chargement',
                'stockAnalysis.days': 'jours',
                'stockAnalysis.per_month': 'mois',
                'stockAnalysis.per_day': 'jour',
            };
            return translations[key] || key;
        },
        i18n: { language: 'fr' },
    }),
}));

const renderWithRouter = (ui: React.ReactElement) => {
    return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('StockAnalysis', () => {
    const mockFournisseurs = [
        { id: 1, name: 'FOURNISSEUR A' },
        { id: 2, name: 'FOURNISSEUR B' }
    ];

    const mockUnsoldData = {
        type: 'unsold',
        fournisseur: 'Tous les fournisseurs',
        total_items: 2,
        total_value: 15000,
        items: [
            {
                id: 101,
                name: 'PRODUIT A',
                stock: 10,
                value: 5000,
                cost_price: 500,
                selling_price: 1000,
                fournisseur_name: 'FOURNISSEUR A',
                created_at: '2025-01-01T10:00:00Z'
            },
            {
                id: 102,
                name: 'PRODUIT B',
                stock: 5,
                value: 10000,
                cost_price: 2000,
                selling_price: 3000,
                fournisseur_name: 'FOURNISSEUR B',
                created_at: '2025-01-02T10:00:00Z'
            }
        ]
    };

    const mockOverstockData = {
        type: 'overstock',
        fournisseur: 'Tous les fournisseurs',
        total_items: 1,
        total_value: 50000,
        items: [
            {
                id: 201,
                name: 'PRODUIT C',
                stock: 100,
                rotation: 10,
                threshold: 17,
                excess_qty: 83,
                value: 50000,
                cost_price: 600,
                selling_price: 1000,
                fournisseur_name: 'FOURNISSEUR A'
            }
        ]
    };

    const mockShortageData = {
        type: 'shortage',
        fournisseur: 'Tous',
        total_items: 2,
        total_value: 25000,
        critical_count: 1,
        warning_count: 1,
        trending_up_count: 1,
        items: [
            {
                id: 301,
                name: 'PRODUIT D',
                stock: 3,
                avg_daily_sales: 1.5,
                days_until_stockout: 2.0,
                days_with_pending_orders: 12.0,
                urgency: 'critical',
                value: 9000,
                cost_price: 3000,
                selling_price: 5000,
                fournisseur_name: 'FOURNISSEUR A',
                pending_orders: 15,
                suggested_order_qty: 30,
                trend: 'hausse',
                trend_pct: 45.2,
                sold_last_7d: 10,
                sold_prev_23d: 18,
            },
            {
                id: 302,
                name: 'PRODUIT E',
                stock: 20,
                avg_daily_sales: 2.0,
                days_until_stockout: 10.0,
                days_with_pending_orders: 10.0,
                urgency: 'warning',
                value: 16000,
                cost_price: 800,
                selling_price: 1200,
                fournisseur_name: 'FOURNISSEUR B',
                pending_orders: 0,
                suggested_order_qty: 40,
                trend: 'stable',
                trend_pct: -5.0,
                sold_last_7d: 14,
                sold_prev_23d: 32,
            }
        ]
    };

    beforeEach(() => {
        vi.clearAllMocks();
        // Default mocks
        (axios.get as any).mockImplementation((url: string) => {
            if (url.includes('/api/fournisseurs/')) {
                return Promise.resolve({ data: mockFournisseurs });
            }
            if (url.includes('/api/stock-analysis/unsold/')) {
                return Promise.resolve({ data: mockUnsoldData });
            }
            if (url.includes('/api/stock-analysis/overstock/')) {
                return Promise.resolve({ data: mockOverstockData });
            }
            if (url.includes('/api/stock-analysis/shortage/')) {
                return Promise.resolve({ data: mockShortageData });
            }
            return Promise.resolve({ data: [] });
        });
    });

    it('renders the title', async () => {
        renderWithRouter(<StockAnalysis />);
        expect(screen.getByText(/Analyse des Stocks/i)).toBeInTheDocument();
    });

    it('displays unsold products by default', async () => {
        renderWithRouter(<StockAnalysis />);
        
        await waitFor(() => {
            expect(screen.getByText('PRODUIT A')).toBeInTheDocument();
            expect(screen.getByText('PRODUIT B')).toBeInTheDocument();
        });
        
        // Vérifie que les valeurs sont affichées dans le tableau
        const values = screen.getAllByText((content, element) => {
             return element?.tagName.toLowerCase() === 'td' && content.replace(/\s/g, '').includes('5000');
        });
        expect(values.length).toBeGreaterThan(0);
    });

    it('switches to overstock tab', async () => {
        renderWithRouter(<StockAnalysis />);
        
        // Attendre le chargement initial
        await waitFor(() => expect(screen.getByText('PRODUIT A')).toBeInTheDocument());
        
        // Cliquer sur l'onglet Surstock
        const overstockTab = screen.getByText(/Surstock/i);
        fireEvent.click(overstockTab);
        
        await waitFor(() => {
            expect(screen.getByText('PRODUIT C')).toBeInTheDocument();
            expect(screen.queryByText('PRODUIT A')).not.toBeInTheDocument();
        });
        
        // Vérifier les colonnes spécifiques au surstock
        expect(screen.getByText(/Rotation Moy/i)).toBeInTheDocument();
        expect(screen.getByText('+83')).toBeInTheDocument();
    });

    it('switches to shortage tab and displays predictions', async () => {
        renderWithRouter(<StockAnalysis />);
        
        // Attendre le chargement initial
        await waitFor(() => expect(screen.getByText('PRODUIT A')).toBeInTheDocument());
        
        // Cliquer sur l'onglet Ruptures
        const shortageTab = screen.getByText(/Ruptures/i);
        fireEvent.click(shortageTab);
        
        await waitFor(() => {
            expect(screen.getByText('PRODUIT D')).toBeInTheDocument();
            expect(screen.getByText('PRODUIT E')).toBeInTheDocument();
        });
        
        // Vérifier les badges d'urgence
        expect(screen.getByText(/Critique/)).toBeInTheDocument();
        expect(screen.getByText(/Attention/)).toBeInTheDocument();
    });

    it('filters by supplier', async () => {
        renderWithRouter(<StockAnalysis />);

        // Attendre le chargement des produits
        await waitFor(() => expect(screen.getByText('PRODUIT A')).toBeInTheDocument());

        // Trouver le select fournisseur via son option par défaut
        const select = screen.getByDisplayValue('Tous les fournisseurs') as HTMLSelectElement;
        expect(select).toBeInTheDocument();

        // Vérifier que les options sont chargées
        await waitFor(() => {
            expect(screen.getByText('FOURNISSEUR A')).toBeInTheDocument();
        });

        fireEvent.change(select, { target: { value: '1' } });
        
        // Vérifier que l'appel API inclut le filtre fournisseur
        await waitFor(() => {
            expect(axios.get).toHaveBeenCalledWith(
                expect.stringContaining('/api/stock-analysis/unsold/'),
                expect.objectContaining({ params: expect.objectContaining({ fournisseur: '1' }) })
            );
        });
    });

    it('handles empty state', async () => {
        (axios.get as any).mockImplementation((url: string) => {
             if (url.includes('/api/fournisseurs/')) return Promise.resolve({ data: [] });
             return Promise.resolve({ data: { items: [], total_items: 0, total_value: 0 } });
        });

        renderWithRouter(<StockAnalysis />);
        
        await waitFor(() => {
            expect(screen.getByText(/Aucun produit invendu/i)).toBeInTheDocument();
            expect(screen.getByText(/Tout semble en ordre !/i)).toBeInTheDocument();
        });
    });

    it('displays shortage statistics summary', async () => {
        renderWithRouter(<StockAnalysis />);
        
        // Attendre le chargement et basculer sur shortage
        await waitFor(() => expect(screen.getByText('PRODUIT A')).toBeInTheDocument());
        fireEvent.click(screen.getByText(/Ruptures/i));
        
        await waitFor(() => {
            expect(screen.getByText('PRODUIT D')).toBeInTheDocument();
        });

        // Vérifier les stats résumées (critical_count, warning_count)
        expect(screen.getByText('1')).toBeInTheDocument(); // critical_count
        expect(screen.getByText(/1 avertissements/)).toBeInTheDocument(); // warning_count
    });

    it('handles API errors gracefully', async () => {
        (axios.get as any).mockImplementation((url: string) => {
             if (url.includes('/api/fournisseurs/')) return Promise.resolve({ data: [] });
             return Promise.reject(new Error('Network Error'));
        });

        renderWithRouter(<StockAnalysis />);
        
        await waitFor(() => {
            expect(screen.getByText(/Erreur de chargement/i)).toBeInTheDocument();
        });
    });
});
