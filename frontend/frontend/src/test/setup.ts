import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Global mock for react-i18next
import frTranslations from '../../public/locales/fr/translation.json';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => {
            const value = key.split('.').reduce((o: any, i) => (o ? o[i] : null), frTranslations);
            return value || key;
        },
        i18n: {
            changeLanguage: () => Promise.resolve(),
            language: 'fr',
        },
    }),
    initReactI18next: {
        type: '3rdParty',
        init: () => { },
    },
}));

