import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-http-backend';

i18n
    // load translation using http -> see /public/locales (i.e. https://github.com/i18next/react-i18next/tree/master/example/react/public/locales)
    // learn more: https://github.com/i18next/i18next-http-backend
    .use(Backend)
    // detect user language
    // learn more: https://github.com/i18next/i18next-browser-languagedetector
    .use(LanguageDetector)
    // pass the i18n instance to react-i18next.
    .use(initReactI18next)
    // init i18next
    // for all options read: https://www.i18next.com/overview/configuration-options
    .init({
        fallbackLng: 'fr',
        debug: import.meta.env.DEV,
        ns: [
            'common',
            'sidebar',
            'auth',
            'dashboard',
            'audit',
            'finance',
            'sales',
            'sales_history',
            'cash_journal',
            'cash_closings',
            'stock',
            'products',
            'orders',
            'clients',
            'suppliers',
            'reports',
            'users',
            'settings',
            'prescriptions',
            'promotions',
            'facturation',
            'sellers',
            'vitrine',
            'caisse',
            'creances',
            'providers',
            'maintenance',
            'pharmacy_settings',
            'monthly_report',
            'supplier_stats',
            'labels',
            'config',
            'help',
            'clinical'
        ],
        defaultNS: 'common',
        interpolation: {
            escapeValue: false, // not needed for react as it escapes by default
        },

        // Options common to all backends
        backend: {
            loadPath: '/locales/{{lng}}/{{ns}}.json',
        },
        load: 'languageOnly' // Avoid fr-FR if we only have fr
    });

export default i18n;
