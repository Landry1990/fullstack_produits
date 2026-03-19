import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Global mock for axios to prevent crashes during module initialization
// Global mock for axios to prevent crashes during module initialization
const mockAxios: any = {
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
  isAxiosError: vi.fn((err: any) => !!err?.isAxiosError),
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
import React, { createContext } from 'react';

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
    AuthProvider: ({ children }: any) => (
        React.createElement(MockAuthContext.Provider, { value: mockAuthValue }, children)
    )
}));

vi.mock('react-i18next', () => {
    return {
        useTranslation: (ns?: string | string[]) => {
            const defaultNs = Array.isArray(ns) ? ns[0] : ns;
            
            const resolve = (obj: any, path: string): any => {
                if (!obj) return null;
                const parts = path.split('.');
                let current = obj;
                for (const p of parts) {
                    if (current && typeof current === 'object' && p in current) {
                        current = current[p];
                    } else {
                        return null;
                    }
                }
                return current;
            };

            return {
                t: (key: string, options?: any) => {
                    let result: any = null;
                    const defaultValue = typeof options === 'string' ? options : options?.defaultValue;

                    // 1. Check if key has explicit namespace
                    if (key.includes(':')) {
                        const [namespace, rest] = key.split(':');
                        result = resolve((allTranslations as any)[namespace], rest);
                    } 
                    
                    // 2. Try default namespace if provided
                    if (!result && defaultNs) {
                        const namespaces = Array.isArray(defaultNs) ? defaultNs : [defaultNs];
                        for (const ns of namespaces) {
                            result = resolve((allTranslations as any)[ns], key);
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
                            result = resolve((allTranslations as any)[nsKey], key);
                            if (result) break;
                        }
                    }

                    if (result && typeof result === 'string') {
                        if (options && typeof options === 'object') {
                            let s = result;
                            Object.keys(options).forEach(optKey => {
                                if (optKey !== 'defaultValue') {
                                    s = s.replace(`{{${optKey}}}`, options[optKey]);
                                }
                            });
                            return s;
                        }
                        return result;
                    }

                    return result || defaultValue || key;
                },
                i18n: {
                    changeLanguage: () => Promise.resolve(),
                    language: 'fr',
                },
            };
        },
        initReactI18next: {
            type: '3rdParty',
            init: () => { },
        },
    };
});

