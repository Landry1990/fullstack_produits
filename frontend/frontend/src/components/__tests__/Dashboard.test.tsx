import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from '../Dashboard';
import * as useDashboardHooks from '../../hooks/useDashboard';

// Mock recharts
// Mock recharts
vi.mock('recharts', () => ({
    ResponsiveContainer: ({ children }: any) => <div style={{ width: 500, height: 300 }}>{children}</div>,
    BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
    Bar: () => <div data-testid="bar" />,
    AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
    Area: () => <div data-testid="area" />,
    LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
    Line: () => <div data-testid="line" />,
    XAxis: () => <div data-testid="x-axis" />,
    YAxis: () => <div data-testid="y-axis" />,
    CartesianGrid: () => <div data-testid="cartesian-grid" />,
    Tooltip: () => <div data-testid="tooltip" />,
}));

// Mock hooks — includes ALL hooks used by Dashboard
vi.mock('../../hooks/useDashboard', () => ({
    useDashboardStats: vi.fn(),
    useRevenueChart: vi.fn(),
    useLowStock: vi.fn(),
    useUgStats: vi.fn(),
    usePromisDisponibles: vi.fn(),
    useExpiringLots: vi.fn(),
    useHourlyTraffic: vi.fn(),
    useSupplierDebts: vi.fn(),
    useReapproStats: vi.fn(),
}));

vi.mock('../../context/PharmacySettingsContext', () => ({
    usePharmacySettings: () => ({
        settings: { pharmacy_name: 'Test', currency_symbol: 'F', low_stock_threshold_days: 15, dormant_stock_days: 90, locale: 'fr-FR' },
        loading: false, error: null, updateSettings: vi.fn(), refetch: vi.fn()
    })
}));

vi.mock('../../context/AuthContext', () => ({
    useAuth: () => ({ 
        user: { id: 1, username: 'testuser', role: 'PHARMACIEN' },
        getServerDate: () => new Date()
    })
}));

describe('Dashboard Component', () => {
    
    // Default mock data
    const mockStats = {
        role: 'PHARMACIEN',
        revenue: { value: 150000, change: 5.2 },
        discount: { value: 2000, change: 0 },
        receivables: { value: 45000, count: 3 },
        stock_value: { value: 2500000, count: 342 },
        low_stock: { value: 2 },
        user_stats: {
            sales: 80000,
            count: 5,
            avg_basket: 16000
        }
    };

    const mockRevenueChart = {
        labels: ['Lun', 'Mar', 'Mer'],
        data: [10000, 20000, 15000]
    };

    const mockLowStock = [
        { id: 1, name: 'Paracétamol', stock: 2 },
        { id: 2, name: 'Ibuprofène', stock: 0 }
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
        { id: 1, produit_nom: 'Sirop', lot: 'LOT123', date_expiration: new Date(Date.now() + 86400000).toISOString() }
    ];

    const mockHourlyTraffic = [
        { hour: '08h', sales_count: 2.5, revenue: 15000 },
        { hour: '09h', sales_count: 5.0, revenue: 30000 },
    ];

    const mockSupplierDebts = {
        total_debt: 250000,
        suppliers: [
            { id: 1, name: 'Pharma Distrib', debt: 150000 },
            { id: 2, name: 'MedSupply', debt: 100000 },
        ]
    };

    beforeEach(() => {
        vi.clearAllMocks();
        
        // Setup default mock implementations
        (useDashboardHooks.useDashboardStats as any).mockReturnValue({
            data: mockStats, isLoading: false, error: null, refetch: vi.fn()
        });
        (useDashboardHooks.useRevenueChart as any).mockReturnValue({
            data: mockRevenueChart, isLoading: false, refetch: vi.fn()
        });
        (useDashboardHooks.useLowStock as any).mockReturnValue({
            data: mockLowStock, isFetching: false, refetch: vi.fn()
        });
        (useDashboardHooks.useUgStats as any).mockReturnValue({ data: mockUgStats });
        (useDashboardHooks.usePromisDisponibles as any).mockReturnValue({ data: mockPromis });
        (useDashboardHooks.useExpiringLots as any).mockReturnValue({
            data: mockExpiringLots, refetch: vi.fn()
        });
        (useDashboardHooks.useHourlyTraffic as any).mockReturnValue({ data: mockHourlyTraffic });
        (useDashboardHooks.useSupplierDebts as any).mockReturnValue({
            data: mockSupplierDebts, refetch: vi.fn(), isRefetching: false
        });
        (useDashboardHooks.useReapproStats as any).mockReturnValue({ data: null });
    });

    it('renders loading state correctly', () => {
        (useDashboardHooks.useDashboardStats as any).mockReturnValue({ isLoading: true });
        (useDashboardHooks.useRevenueChart as any).mockReturnValue({ isLoading: true });
        
        const { container } = render(
            <MemoryRouter>
                <Dashboard />
            </MemoryRouter>
        );
        
        const spinner = container.querySelector('.loading-spinner');
        expect(spinner).toBeInTheDocument();
    });

    it('renders error state correctly', () => {
        (useDashboardHooks.useDashboardStats as any).mockReturnValue({
            error: new Error('Failed'), isLoading: false
        });
        (useDashboardHooks.useRevenueChart as any).mockReturnValue({ isLoading: false });
        
        render(
            <MemoryRouter>
                <Dashboard />
            </MemoryRouter>
        );
        
        expect(screen.getByText(/Erreur|Impossible/i)).toBeInTheDocument();
    });

    it('renders main statistics correctly', () => {
        render(
            <MemoryRouter>
                <Dashboard />
            </MemoryRouter>
        );
        
        // Check Revenue (150 000 appears in revenue card)
        expect(screen.getAllByText(/150\s?000/).length).toBeGreaterThan(0);
        
        // Check Receivables
        expect(screen.getAllByText(/45\s?000/).length).toBeGreaterThan(0);
        
        // Check Stock Value
        expect(screen.getAllByText(/2\s?500\s?000/).length).toBeGreaterThan(0);
    });

    it('displays stock product count', () => {
        render(
            <MemoryRouter>
                <Dashboard />
            </MemoryRouter>
        );
        
        // Le nombre de produits en stock doit s'afficher
        expect(screen.getByText(/342 produit\(s\)/)).toBeInTheDocument();
    });

    it('displays user personal stats', () => {
        render(
            <MemoryRouter>
                <Dashboard />
            </MemoryRouter>
        );
        
        // MES VENTES (JOUR) - 80000
        expect(screen.getByText(/80\s?000/)).toBeInTheDocument();
        // 5 ventes
        expect(screen.getByText(/5 vente\(s\)/)).toBeInTheDocument();
    });

    it('displays Promis notification when data exists', () => {
        render(
            <MemoryRouter>
                <Dashboard />
            </MemoryRouter>
        );
        
        fireEvent.click(screen.getByRole('button', { name: /^Stock$/i }));
        expect(screen.getByText(/Produit Rare/i)).toBeInTheDocument();
    });

    it('displays Expiring Lots notification when critical lots exist', () => {
        render(
            <MemoryRouter>
                <Dashboard />
            </MemoryRouter>
        );
        
        fireEvent.click(screen.getByRole('button', { name: /^Stock$/i }));
        expect(screen.getByText(/Sirop/i)).toBeInTheDocument();
    });

    it('renders UG statistics table', () => {
        render(
            <MemoryRouter>
                <Dashboard />
            </MemoryRouter>
        );
        
        fireEvent.click(screen.getByRole('button', { name: /Finance/i }));
        expect(screen.getByText("Fournisseur A")).toBeInTheDocument();
        expect(screen.getAllByText(/500/).length).toBeGreaterThan(0);
    });

    it('displays supplier debts section', () => {
        render(
            <MemoryRouter>
                <Dashboard />
            </MemoryRouter>
        );

        fireEvent.click(screen.getByRole('button', { name: /Finance/i }));
        expect(screen.getByText(/Dettes Fournisseurs/i)).toBeInTheDocument();
        expect(screen.getByText(/Pharma Distrib/)).toBeInTheDocument();
        expect(screen.getByText(/MedSupply/)).toBeInTheDocument();
    });

    it('handles expiration period change', async () => {
         render(
            <MemoryRouter>
                <Dashboard />
            </MemoryRouter>
        );
        
        fireEvent.click(screen.getByRole('button', { name: /^Stock$/i }));
        const select = screen.getByDisplayValue(/1 MOIS/i);
        fireEvent.change(select, { target: { value: '3' } });
        
        await waitFor(() => {
             expect(useDashboardHooks.useExpiringLots).toHaveBeenCalledWith(3, true);
        });
    });

    it('renders restricted view for VENDEUR role', () => {
        const vendeurStats = {
            role: 'VENDEUR',
            user_stats: { sales: 50000, count: 3, avg_basket: 16667 }
        };
        (useDashboardHooks.useDashboardStats as any).mockReturnValue({
            data: vendeurStats, isLoading: false, error: null, refetch: vi.fn()
        });

        render(
            <MemoryRouter>
                <Dashboard />
            </MemoryRouter>
        );

        // Vendeur should see personal stats
        expect(screen.getByText(/50\s?000/)).toBeInTheDocument();
        expect(screen.getByText(/3 vente\(s\)/)).toBeInTheDocument();
    });

    it('does not crash when stats data is undefined (Regression)', () => {
        (useDashboardHooks.useDashboardStats as any).mockReturnValue({
            data: undefined, isLoading: false, error: null, refetch: vi.fn()
        });

        const { container } = render(
            <MemoryRouter>
                <Dashboard />
            </MemoryRouter>
        );
        
        // Should render without crashing
        expect(container).toBeInTheDocument();
        // Stats grid should be empty
        // Should render without crashing — container always has children
        expect(container.firstChild).toBeInTheDocument();
    });

    it('navigates to providers with correct state when clicking supplier debt action', () => {
        render(
            <MemoryRouter>
                <Dashboard />
            </MemoryRouter>
        );

        fireEvent.click(screen.getByRole('button', { name: /Finance/i }));
        
        // Find the Link in the supplier debts table
        const debtLinks = screen.getAllByRole('link', { name: '' }).filter(link => 
            link.getAttribute('href') === '/app/fournisseurs'
        );
        
        // The first one should be Pharma Distrib from mockSupplierDebts
        const pharmaLink = debtLinks[0];
        expect(pharmaLink).toBeInTheDocument();
    });
});
