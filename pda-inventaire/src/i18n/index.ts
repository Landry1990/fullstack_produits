import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import secureStore from '../utils/secureStore';
import fr from './fr';
import en from './en';

export const LANGUAGE_STORAGE_KEY = 'pda.settings.language';
export type AppLanguage = 'fr' | 'en';

const resources = {
  fr: { translation: fr },
  en: { translation: en },
};

const defaultLng = getLocales()[0]?.languageCode === 'en' ? 'en' : 'fr';

i18n.use(initReactI18next).init({
  resources,
  lng: defaultLng,
  fallbackLng: 'fr',
  interpolation: { escapeValue: false },
});

export const loadStoredLanguage = async () => {
  try {
    const stored = await secureStore.getItemAsync(LANGUAGE_STORAGE_KEY);
    if (stored === 'en' || stored === 'fr') {
      await i18n.changeLanguage(stored);
    }
  } catch {}
};

export default i18n;
