import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ModuleFinancier from '../ModuleFinancier';
import * as useFinanceStats from '../../hooks/useFinanceStats';

// Mock useRecharts so the component renders synchronously with all chart components
vi.mock('../../hooks/useRecharts', () => ({
  useRecharts: () => ({
    ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    AreaChart: ({ children }: { children?: React.ReactNode }) => <div data-testid="area-chart">{children}</div>,
    Area: () => <div />,
    LineChart: ({ children }: { children?: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
    Line: () => <div />,
    BarChart: ({ children }: { children?: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
    Bar: () => <div />,
    PieChart: ({ children }: { children?: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
    Pie: () => <div />,
    XAxis: () => <div />,
    YAxis: () => <div />,
    CartesianGrid: () => <div />,
    Tooltip: () => <div />,
    Legend: () => <div />,
    Cell: () => <div />,
  }),
}));

// Mock hooks
vi.mock('../../hooks/useFinanceStats', () => ({
  useCAEvolution: vi.fn(),
  useMargesEvolution: vi.fn(),
  usePredictions: vi.fn(),
  useKPIs: vi.fn(),
  useTopProducts: vi.fn(),
  useRepartitionCA: vi.fn(),
  useAnalyseCategories: vi.fn(),
  useEvolutionCategories: vi.fn(),
  useAnalyseMarges: vi.fn(),
  useAnalyseFournisseurs: vi.fn(),
  useComparaisonPrix: vi.fn(),
  useRepartitionAchats: vi.fn(),
  useMarginVarianceAnalysis: vi.fn(),
}));

vi.mock('../../context/PharmacySettingsContext', () => ({
    usePharmacySettings: () => ({
        settings: { pharmacy_name: 'Test', currency_symbol: 'F', locale: 'fr-FR' },
        loading: false, error: null, updateSettings: vi.fn(), refetch: vi.fn()
    })
}));

vi.mock('../../context/AuthContext', () => ({
    useAuth: () => ({ 
        user: { id: 1, username: 'testuser', role: 'PHARMACIEN' },
        getServerDate: () => new Date()
    })
}));

const mockKPIs = {
  panier_moyen: { mois: 15000, annee: 14000 },
  taux_marge: 25.5,
  dsi: 45,
  ca_mois: 1200000,
  nb_ventes_mois: 80,
  ca_annee: 14000000,
  nb_ventes_annee: 1000,
  stock_value: 2500000,
  croissance_mensuelle: 5.2
};

describe('ModuleFinancier Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mock returns
    (useFinanceStats.useKPIs as unknown as Mock).mockReturnValue({ data: mockKPIs, isLoading: false });
    (useFinanceStats.useCAEvolution as unknown as Mock).mockReturnValue({ data: null, isLoading: false });
    (useFinanceStats.useMargesEvolution as unknown as Mock).mockReturnValue({ data: null, isLoading: false });
    (useFinanceStats.usePredictions as unknown as Mock).mockReturnValue({ data: null, isLoading: false });
    (useFinanceStats.useTopProducts as unknown as Mock).mockReturnValue({ data: { data: [] }, isLoading: false });
    (useFinanceStats.useRepartitionCA as unknown as Mock).mockReturnValue({ data: { data: [] }, isLoading: false });
    (useFinanceStats.useAnalyseCategories as unknown as Mock).mockReturnValue({ data: { data: [] }, isLoading: false });
    (useFinanceStats.useEvolutionCategories as unknown as Mock).mockReturnValue({ data: { series: [] }, isLoading: false });
    (useFinanceStats.useAnalyseMarges as unknown as Mock).mockReturnValue({ data: null, isLoading: false });
    (useFinanceStats.useAnalyseFournisseurs as unknown as Mock).mockReturnValue({ data: { results: [], count: 0 }, isLoading: false });
    (useFinanceStats.useComparaisonPrix as unknown as Mock).mockReturnValue({ data: [], isLoading: false });
    (useFinanceStats.useRepartitionAchats as unknown as Mock).mockReturnValue({ data: [], isLoading: false });
    (useFinanceStats.useMarginVarianceAnalysis as unknown as Mock).mockReturnValue({ data: null, isLoading: false });
  });

  it('renders correctly and displays KPI cards', async () => {
    render(
      <MemoryRouter>
        <ModuleFinancier />
      </MemoryRouter>
    );

    expect(screen.getByText(/Tableau de Bord Financier/i)).toBeInTheDocument();
    
    await waitFor(() => {
        // Check for CA Mois
        expect(screen.getAllByText(/1\s?200\s?000/).length).toBeGreaterThan(0);
        // Check for Panier Moyen
        expect(screen.getAllByText(/15\s?000/).length).toBeGreaterThan(0);
    });
  });

  it('displays loading state when data is fetching', () => {
    (useFinanceStats.useKPIs as unknown as Mock).mockReturnValue({ isLoading: true });
    
    render(
      <MemoryRouter>
        <ModuleFinancier />
      </MemoryRouter>
    );

    expect(screen.getByTestId('finance-loading')).toBeInTheDocument();
  });

  it('renders chart sections', async () => {
    render(
      <MemoryRouter>
        <ModuleFinancier />
      </MemoryRouter>
    );

    await waitFor(() => {
        expect(screen.getByText(/Évolution du Chiffre d'Affaires/i)).toBeInTheDocument();
        expect(screen.getByTestId('area-chart')).toBeInTheDocument();
    });
  });
});
