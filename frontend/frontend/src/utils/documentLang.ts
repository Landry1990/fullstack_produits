/**
 * Langue des documents générés (tickets, factures, rapports, bons...).
 *
 * Découplée de la langue de l'interface utilisateur (i18n.language) :
 * la source de vérité est `PharmacySettings.locale` ('fr-FR', 'en-US', ...),
 * synchronisée ici par le `PharmacySettingsProvider` afin d'être accessible
 * aux helpers non-React (génération de HTML d'impression dans utils/print).
 *
 * Pendant ce temps, les composants React doivent préférer le hook
 * `useDocumentLocale()` du PharmacySettingsContext.
 */

export type DocumentLang = 'fr' | 'en';

let documentLang: DocumentLang = 'fr';
let documentLocale = 'fr-FR';

/**
 * Appelé par le PharmacySettingsProvider à chaque changement de `settings.locale`.
 * Toute valeur commençant par 'en' bascule en anglais, sinon français (défaut).
 */
export const setDocumentLanguage = (locale?: string | null): void => {
  documentLang = locale && locale.toLowerCase().startsWith('en') ? 'en' : 'fr';
  documentLocale = locale || 'fr-FR';
};

/** 'fr' | 'en' — langue à passer à i18n.getFixedT() / useTranslation({ lng }). */
export const getDocumentLanguage = (): DocumentLang => documentLang;

/** 'fr-FR' | 'en-US' — locale à passer à toLocaleString/Intl.NumberFormat. */
export const getDocumentLocale = (): string => documentLocale;
