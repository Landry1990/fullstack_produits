import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import { Platform } from 'react-native';
import Storage from 'expo-sqlite/kv-store';
import fr from './fr';
import en from './en';

// i18n mobile-facturation : langue = choix persisté par appareil
// (`settings.language` kv-store, FR/EN dans l'en-tête et au login),
// sinon locale de l'appareil, fallback fr (clientèle majoritairement
// francophone). Toute chaîne visible passe par t() — convention fr/en
// identique au frontend web.
export const LANGUAGE_STORAGE_KEY = 'settings.language';
export type AppLanguage = 'fr' | 'en';

const storedLanguage = (): AppLanguage | null => {
  if (Platform.OS === 'web') return null;
  try {
    const v = Storage.getItemSync(LANGUAGE_STORAGE_KEY);
    return v === 'en' || v === 'fr' ? v : null;
  } catch {
    return null;
  }
};

const lng = storedLanguage()
  ?? (getLocales()[0]?.languageCode === 'en' ? 'en' : 'fr');

void i18n.use(initReactI18next).init({
  resources: {
    fr: { translation: fr },
    en: { translation: en },
  },
  lng,
  fallbackLng: 'fr',
  interpolation: { escapeValue: false },
});

export default i18n;
