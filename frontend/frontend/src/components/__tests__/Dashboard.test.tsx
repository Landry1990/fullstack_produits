import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from '../Dashboard';
import * as useDashboardHooks from '../../hooks/useDashboard';

// Mock recharts
vi.mock('recharts', () => {
    const OriginalModule = vi.importActual('recharts');
    return {
        ...OriginalModule,
        ResponsiveContainer: ({ children }: any) => <div style={{ width: 500, height: 300 }}>{children}</div>,
        BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
        Bar: () => <div data-testid="bar" />,
        LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
        Line: () => <div data-testid="line" />,
        XAxis: () => <div data-testid="x-axis" />,
        YAxis: () => <div data-testid="y-axis" />,
        CartesianGrid: () => <div data-testid="cartesian-grid" />,
        Tooltip: () => <div data-testid="tooltip" />,
    };
});

// Mock hooks
vi.mock('../../hooks/useDashboard', () => ({
    useDashboardStats: vi.fn(),
    useRevenueChart: vi.fn(),
    useLowStock: vi.fn(),
    useUgStats: vi.fn(),
    usePromisDisponibles: vi.fn(),
    useExpiringLots: vi.fn(),
}));

describe('Dashboard Component', () => {
    
    // Default mock data
    const mockStats = {
        revenue: { value: 150000, change: 5.2 },
        discount: { value: 2000, change: 0 },
        receivables: { value: 45000, count: 3 },
        stock_value: { value: 2500000 },
        low_stock: { value: 2 }
    };

    const mockRevenueChart = {
        labels: ['Lun', 'Mar', 'Mer'],
        data: [10000, 20000, 15000]
    };

    const mockLowStock = [
        { name: 'Paracétamol', stock: 2 },
        { name: 'Ibuprofène', stock: 0 }
    ];

    const mockUgStats = {
        results: [
            { fournisseur_nom: 'Fournisseur A', valeur_acquise: 1000, valeur_vendue: 500, valeur_restante: 500 }
        ]
    };

    const mockPromis = [
        { id: 1, produit_nom: 'Produit Rare', client: 'Jean Dupont', quantite: 1, jours_attente: 2 }
    ];

    const mockExpiringLots = [
        { id: 1, produit_nom: 'Sirop', lot: 'LOT123', date_expiration: new Date(Date.now() + 86400000).toISOString() } // Expire tomorrow
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        
        // Setup default mock implementations
        (useDashboardHooks.useDashboardStats as any).mockReturnValue({ data: mockStats, isLoading: false, error: null });
        (useDashboardHooks.useRevenueChart as any).mockReturnValue({ data: mockRevenueChart, isLoading: false });
        (useDashboardHooks.useLowStock as any).mockReturnValue({ data: mockLowStock });
        (useDashboardHooks.useUgStats as any).mockReturnValue({ data: mockUgStats });
        (useDashboardHooks.usePromisDisponibles as any).mockReturnValue({ data: mockPromis });
        (useDashboardHooks.useExpiringLots as any).mockReturnValue({ data: mockExpiringLots });
    });

    it('renders loading state correctly', () => {
        (useDashboardHooks.useDashboardStats as any).mockReturnValue({ isLoading: true });
        
        const { container } = render(
            <MemoryRouter>
                <Dashboard />
            </MemoryRouter>
        );
        
        // Check for the spinner by class
        const spinner = container.querySelector('.loading-spinner');
        expect(spinner).toBeInTheDocument();
    });

    it('renders error state correctly', () => {
        (useDashboardHooks.useDashboardStats as any).mockReturnValue({ error: new Error('Failed'), isLoading: false });
        
        render(
            <MemoryRouter>
                <Dashboard />
            </MemoryRouter>
        );
        
        expect(screen.getByText(/Impossible de charger les données du tableau de bord/i)).toBeInTheDocument();
    });

    it('renders main statistics correctly', () => {
        render(
            <MemoryRouter>
                <Dashboard />
            </MemoryRouter>
        );
        
        // Check Revenue
        expect(screen.getByText("Chiffre d'affaires")).toBeInTheDocument();
        expect(screen.getByText(/150\s?000/)).toBeInTheDocument(); // Regex for spacing
        
        // Check Receivables
        expect(screen.getByText("Créances Clients")).toBeInTheDocument();
        expect(screen.getByText(/45\s?000/)).toBeInTheDocument();
        
        // Check Stock Value
        expect(screen.getByText("Valeur Stock")).toBeInTheDocument();
        expect(screen.getByText(/2\s?500\s?000/)).toBeInTheDocument();
    });

    it('renders charts', () => {
        render(
            <MemoryRouter>
                <Dashboard />
            </MemoryRouter>
        );
        
        expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
        expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });

    it('displays Promis notification when data exists', () => {
        render(
            <MemoryRouter>
                <Dashboard />
            </MemoryRouter>
        );
        
        expect(screen.getByText(/Promis Disponibles/i)).toBeInTheDocument();
        expect(screen.getByText(/Produit Rare/i)).toBeInTheDocument();
    });

    it('displays Expiring Lots notification when critical lots exist', () => {
        render(
            <MemoryRouter>
                <Dashboard />
            </MemoryRouter>
        );
        
        expect(screen.getByText(/Péremption Proche/i)).toBeInTheDocument();
        expect(screen.getByText(/Sirop/i)).toBeInTheDocument();
    });

    it('renders UG statistics table', () => {
        render(
            <MemoryRouter>
                <Dashboard />
            </MemoryRouter>
        );
        
        expect(screen.getByText("Statistiques UG par Fournisseur")).toBeInTheDocument();
        expect(screen.getByText("Fournisseur A")).toBeInTheDocument();
        // Check values in table (simplified check for presence)
        expect(screen.getAllByText(/500/).length).toBeGreaterThan(0);
    });

    it('handles expiration period change', async () => {
         render(
            <MemoryRouter>
                <Dashboard />
            </MemoryRouter>
        );
        
        // Find select
        const select = screen.getByDisplayValue('1 mois');
        fireEvent.change(select, { target: { value: '3' } });
        
        // Verify mock was called with new period (due to re-render potentially or just check state update logic if observable)
        // Since useExpiringLots is a custom hook, ensuring it's called with new value requires inspecting the mock calls after re-render
        // But dashboard calls it in the body: useExpiringLots(expirationMonths)
        
        await waitFor(() => {
             expect(useDashboardHooks.useExpiringLots).toHaveBeenCalledWith(3);
        });
    });
});
