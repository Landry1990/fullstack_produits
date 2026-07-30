import '@testing-library/jest-dom';
import { vi } from 'vitest';
import React, { createContext } from 'react';

// Global mock for axios to prevent crashes during module initialization
const mockAxios: Record<string, unknown> & { create?: unknown } = {
  get: vi.fn(() => Promise.resolve({ data: {} })),
  post: vi.fn(() => Promise.resolve({ data: {} })),
  put: vi.fn(() => Promise.resolve({ data: {} })),
  delete: vi.fn(() => Promise.resolve({ data: {} })),
  patch: vi.fn(() => Promise.resolve({ data: {} })),
  head: vi.fn(() => Promise.resolve({ data: {} })),
  options: vi.fn(() => Promise.resolve({ data: {} })),
  defaults: { headers: { common: {} }, adapter: vi.fn() },
  interceptors: {
    request: { use: vi.fn(), eject: vi.fn() },
    response: { use: vi.fn(), eject: vi.fn() },
  },
  isAxiosError: vi.fn((err: unknown) => !!(err as { isAxiosError?: boolean })?.isAxiosError),
  Spread: vi.fn(),
  Cancel: vi.fn(),
  CancelToken: {
    source: vi.fn(() => ({
      token: {},
      cancel: vi.fn(),
    })),
  },
};
mockAxios.create = vi.fn(() => mockAxios);

vi.mock('axios', () => ({
  default: mockAxios,
  ...mockAxios
}));

// Global mock for react-i18next
import frClients from '../../public/locales/fr/clients.json';
import frCommon from '../../public/locales/fr/common.json';
import frStock from '../../public/locales/fr/stock.json';
import frOrders from '../../public/locales/fr/orders.json';
import frDashboard from '../../public/locales/fr/dashboard.json';
import frFacturation from '../../public/locales/fr/facturation.json';
import frUsers from '../../public/locales/fr/users.json';
import frProviders from '../../public/locales/fr/providers.json';
import frAuth from '../../public/locales/fr/auth.json';
import frCashJournal from '../../public/locales/fr/cash_journal.json';
import frCaisse from '../../public/locales/fr/caisse.json';
import frCreances from '../../public/locales/fr/creances.json';
import frProducts from '../../public/locales/fr/products.json';
import frFinance from '../../public/locales/fr/finance.json';
import frSales from '../../public/locales/fr/sales.json';
import frVitrine from '../../public/locales/fr/vitrine.json';
import frReports from '../../public/locales/fr/reports.json';
import frMaintenance from '../../public/locales/fr/maintenance.json';
import frPharmacySettings from '../../public/locales/fr/pharmacy_settings.json';
import frSupplierStats from '../../public/locales/fr/supplier_stats.json';
import frMonthlyReport from '../../public/locales/fr/monthly_report.json';

const allTranslations = {
    clients: frClients,
    common: frCommon,
    stock: frStock,
    orders: frOrders,
    dashboard: frDashboard,
    facturation: frFacturation,
    users: frUsers,
    providers: frProviders,
    auth: frAuth,
    cash_journal: frCashJournal,
    caisse: frCaisse,
    creances: frCreances,
    products: frProducts,
    finance: frFinance,
    sales: frSales,
    vitrine: frVitrine,
    reports: frReports,
    maintenance: frMaintenance,
    pharmacy_settings: frPharmacySettings,
    supplier_stats: frSupplierStats,
    monthly_report: frMonthlyReport
};

// Global mock for AuthContext
const mockAuthValue = { 
    user: { 
        id: 1, 
        username: 'testuser', 
        role: 'PHARMACIEN', 
        first_name: 'Test', 
        last_name: 'User',
        can_do_returns: true,
        can_sell_negative_stock: true,
        can_cash_out: true,
        can_delete_product: true,
        can_adjust_stock: true,
        can_delete_fournisseur: true,
        can_delete_commande: true,
        can_close_commande: true,
        can_generate_coupon: true,
        is_superuser: true,
        is_terminal_account: false,
        profile: {
            max_discount_rate: 100,
            can_generate_coupon: true,
            can_close_commande: true,
            role: 'PHARMACIEN'
        }
    },
    getServerDate: () => new Date(),
    logout: vi.fn(),
    login: vi.fn(),
    isAuthenticated: true,
    loading: false
};

const MockAuthContext = createContext(mockAuthValue);

vi.mock('../../context/AuthContext', () => ({
    AuthContext: MockAuthContext,
    useAuth: () => mockAuthValue,
    AuthProvider: ({ children }: { children?: React.ReactNode }) => (
        React.createElement(MockAuthContext.Provider, { value: mockAuthValue }, children)
    )
}));

vi.mock('react-i18next', () => {
    const translationCache = new Map<string, { t: (key: string, options?: unknown) => string; i18n: { changeLanguage: () => Promise<void>; language: string } }>();

    return {
        useTranslation: (ns?: string | string[]) => {
            const defaultNs = Array.isArray(ns) ? ns[0] : ns;
            const cacheKey = Array.isArray(ns) ? ns.join(',') : (ns ?? '__default__');
            if (translationCache.has(cacheKey)) {
                return translationCache.get(cacheKey)!;
            }

            const resolve = (obj: unknown, path: unknown): unknown => {
                if (!obj || typeof path !== 'string') return null;
                const parts = path.split('.');
                let current: unknown = obj;
                for (const p of parts) {
                    if (current && typeof current === 'object' && p in (current as Record<string, unknown>)) {
                        current = (current as Record<string, unknown>)[p];
                    } else {
                        return null;
                    }
                }
                return current;
            };

            const t = (key: string, options?: unknown): string => {
                let result: unknown = null;
                const opts = options as Record<string, unknown> | undefined;
                const defaultValue = typeof options === 'string' ? options : opts?.defaultValue;

                // 1. Check if key has explicit namespace
                if (key.includes(':')) {
                    const [namespace, rest] = key.split(':');
                    result = resolve((allTranslations as Record<string, unknown>)[namespace], rest);
                }

                // 2. Try default namespace if provided
                if (!result && defaultNs) {
                    const namespaces = Array.isArray(defaultNs) ? defaultNs : [defaultNs];
                    for (const ns of namespaces) {
                        result = resolve((allTranslations as Record<string, unknown>)[ns], key);
                        if (result) break;
                    }
                }

                // 3. Try common namespace
                if (!result) {
                    result = resolve(allTranslations.common, key);
                }

                // 4. Final broad search across all registered namespaces
                if (!result) {
                    for (const nsKey of Object.keys(allTranslations)) {
                        result = resolve((allTranslations as Record<string, unknown>)[nsKey], key);
                        if (result) break;
                    }
                }

                if (result && typeof result === 'string') {
                    if (opts && typeof options === 'object') {
                        let s = result;
                        Object.keys(opts).forEach(optKey => {
                            if (optKey !== 'defaultValue') {
                                s = s.replace(`{{${optKey}}}`, String(opts[optKey]));
                            }
                        });
                        return s;
                    }
                    return result;
                }

                return String(result || defaultValue || key);
            };

            const i18n = {
                changeLanguage: () => Promise.resolve(),
                language: 'fr',
            };

            const translationResult = { t, i18n };
            translationCache.set(cacheKey, translationResult);
            return translationResult;
        },
        initReactI18next: {
            type: '3rdParty',
            init: () => { },
        },
    };
});

// Mock for Recharts
vi.mock('recharts', () => {
  return {
    ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => React.createElement('div', { className: 'recharts-responsive-container-mock' }, children),
    BarChart: ({ children }: { children?: React.ReactNode }) => React.createElement('div', { className: 'bar-chart-mock' }, children),
    LineChart: ({ children }: { children?: React.ReactNode }) => React.createElement('div', { className: 'line-chart-mock' }, children),
    PieChart: ({ children }: { children?: React.ReactNode }) => React.createElement('div', { className: 'pie-chart-mock' }, children),
    AreaChart: ({ children }: { children?: React.ReactNode }) => React.createElement('div', { className: 'area-chart-mock' }, children),
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    Legend: () => null,
    Bar: () => null,
    Line: () => null,
    Pie: () => null,
    Area: () => null,
    Cell: () => null,
  };
});

// Mock for window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock for ResizeObserver
window.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock for requestAnimationFrame (jsdom doesn't execute it automatically)
window.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
  callback(0);
  return 0;
});
window.cancelAnimationFrame = vi.fn();

// Mock for html2pdf/jspdf if needed for environment stability
vi.mock('jspdf', () => ({
  default: vi.fn().mockImplementation(() => ({
    addPage: vi.fn(),
    save: vi.fn(),
    text: vi.fn(),
    setFontSize: vi.fn(),
    autoTable: vi.fn(),
  })),
}));

// Mock for Barcode libs
vi.mock('jsbarcode', () => ({
  default: vi.fn(),
}));

vi.mock('react-barcode', () => ({
  default: () => React.createElement('div', { 'data-testid': 'barcode-mock' }),
}));

// Mock for PosteCaisseModeContext
vi.mock('../context/PosteCaisseModeContext', () => {
  const mockPosteCaisseModeValue = {
    activePoste: null,
    selectedPosteCaisseId: null,
    isPosMode: false,
    isLoading: false,
    refresh: vi.fn(),
    openPoste: vi.fn(),
    setActivePosteVente: vi.fn(),
    closePoste: vi.fn(),
    selectPoste: vi.fn(),
  };
  const MockPosteCaisseModeContext = React.createContext(mockPosteCaisseModeValue);
  return {
    PosteCaisseModeContext: MockPosteCaisseModeContext,
    PosteCaisseModeProvider: ({ children }: { children?: React.ReactNode }) => React.createElement(MockPosteCaisseModeContext.Provider, { value: mockPosteCaisseModeValue }, children),
    usePosteCaisseMode: () => mockPosteCaisseModeValue,
  };
});

// Mock for PharmacySettingsContext
vi.mock('../context/PharmacySettingsContext', () => {
  const mockPharmacySettingsValue = {
    settings: {},
    loading: false,
    error: null,
    updateSettings: vi.fn(),
    uploadLogo: vi.fn(),
    removeLogo: vi.fn(),
    refetch: vi.fn(),
  };
  const MockPharmacySettingsContext = React.createContext(mockPharmacySettingsValue);
  return {
    PharmacySettingsContext: MockPharmacySettingsContext,
    PharmacySettingsProvider: ({ children }: { children?: React.ReactNode }) => React.createElement(MockPharmacySettingsContext.Provider, { value: mockPharmacySettingsValue }, children),
    usePharmacySettings: () => mockPharmacySettingsValue,
  };
});

// Mock for react-datepicker
// Mock for LicenceContext
vi.mock('../context/LicenceContext', () => {
  const mockLicenceValue = {
    licence: { type: 'STANDARD', expiry_date: '2030-12-31', max_users: 10 },
    daysRemaining: 365,
    loading: false,
    refreshLicence: vi.fn(),
  };
  const MockLicenceContext = React.createContext(mockLicenceValue);
  return {
    LicenceContext: MockLicenceContext,
    LicenceProvider: ({ children }: { children?: React.ReactNode }) => React.createElement(MockLicenceContext.Provider, { value: mockLicenceValue }, children),
    useLicence: () => mockLicenceValue,
  };
});

vi.mock('react-datepicker', () => {
  return {
    default: ({ selected, onChange, placeholderText }: { selected?: Date | string; onChange: (d: Date) => void; placeholderText?: string }) => (
      React.createElement('input', {
        'data-testid': 'date-picker',
        placeholder: placeholderText,
        value: selected ? (selected instanceof Date ? selected.toISOString() : selected) : '',
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(new Date(e.target.value)),
      })
    ),
    registerLocale: vi.fn(),
  };
});
