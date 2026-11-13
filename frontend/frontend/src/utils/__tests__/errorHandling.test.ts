import { describe, it, expect, beforeAll } from 'vitest';
import i18n from '../../i18n';
import frCommon from '../../../public/locales/fr/common.json';
import { getApiErrorDetail, extractErrorMessage } from '../errorHandling';

// errorHandling utilise l'instance i18n directe (pas useTranslation, mockée
// par le setup global). On la ré-initialise avec les ressources FR en ligne
// pour que t() renvoie les vraies traductions — sinon il rend la clé brute.
beforeAll(async () => {
    await i18n.init({
        resources: { fr: { common: frCommon } },
        lng: 'fr',
        fallbackLng: 'fr',
        defaultNS: 'common',
        ns: ['common'],
        interpolation: { escapeValue: false },
    });
});

describe('errorHandling utilities', () => {
    describe('getApiErrorDetail', () => {
        it('should extract detail from axios-like error', () => {
            const err = { response: { data: { detail: 'Not found' } } };
            expect(getApiErrorDetail(err, 'fallback')).toBe('Not found');
        });

        it('should return fallback when no response', () => {
            expect(getApiErrorDetail({ message: 'fail' }, 'fallback')).toBe('fallback');
        });

        it('should return fallback when response has no data', () => {
            const err = { response: { status: 500 } };
            expect(getApiErrorDetail(err, 'fallback')).toBe('fallback');
        });

        it('should return fallback when data has no detail', () => {
            const err = { response: { data: { other: 'x' } } };
            expect(getApiErrorDetail(err, 'fallback')).toBe('fallback');
        });

        it('should return fallback for null error', () => {
            expect(getApiErrorDetail(null, 'fallback')).toBe('fallback');
        });

        it('should return fallback for undefined error', () => {
            expect(getApiErrorDetail(undefined, 'fallback')).toBe('fallback');
        });

        it('should stringify non-string detail', () => {
            const err = { response: { data: { detail: 42 } } };
            expect(getApiErrorDetail(err, 'fallback')).toBe('42');
        });
    });

    describe('extractErrorMessage', () => {
        it('should return unknown error message for null', () => {
            expect(extractErrorMessage(null)).toBe('Une erreur inconnue est survenue.');
        });

        it('should return unknown error message for undefined', () => {
            expect(extractErrorMessage(undefined)).toBe('Une erreur inconnue est survenue.');
        });

        it('should return the string for string errors', () => {
            expect(extractErrorMessage('Something went wrong')).toBe('Something went wrong');
        });

        it('should extract DRF detail from response', () => {
            const err = { response: { status: 404, data: { detail: 'Not found' } } };
            expect(extractErrorMessage(err)).toBe('Not found');
        });

        it('should handle 500 with HTML response', () => {
            const err = { response: { status: 500, data: '<!DOCTYPE html><html></html>' } };
            expect(extractErrorMessage(err)).toContain('Erreur Serveur (500)');
            expect(extractErrorMessage(err)).toContain('support technique');
        });

        it('should handle 500 with JSON detail', () => {
            const err = { response: { status: 500, data: { detail: 'DB down' } } };
            expect(extractErrorMessage(err)).toBe('Erreur Serveur (500) : DB down');
        });

        it('should handle 500 without detail', () => {
            const err = { response: { status: 503, data: {} } };
            expect(extractErrorMessage(err)).toContain('Erreur Serveur (503)');
            expect(extractErrorMessage(err)).toContain('réessayer plus tard');
        });

        it('should handle non_field_errors', () => {
            const err = { response: { status: 400, data: { non_field_errors: ['Error A', 'Error B'] } } };
            expect(extractErrorMessage(err)).toBe('Error A | Error B');
        });

        it('should handle field errors with capitalization', () => {
            const err = { response: { status: 400, data: { client: ['Required'] } } };
            expect(extractErrorMessage(err)).toBe('Client: Required');
        });

        it('should handle multiple field errors', () => {
            const err = { response: { status: 400, data: { client: ['Required'], quantity: ['Invalid'] } } };
            const msg = extractErrorMessage(err);
            expect(msg).toContain('Client: Required');
            expect(msg).toContain('Quantity: Invalid');
            expect(msg).toContain(' | ');
        });

        it('should handle string field error', () => {
            const err = { response: { status: 400, data: { name: 'Too short' } } };
            expect(extractErrorMessage(err)).toBe('Name: Too short');
        });

        it('should handle Network Error', () => {
            const err = { message: 'Network Error' };
            expect(extractErrorMessage(err)).toContain('Erreur de connexion');
        });

        it('should translate axios timeout errors', () => {
            const err = { code: 'ECONNABORTED', message: 'timeout of 15000ms exceeded' };
            expect(extractErrorMessage(err)).toContain('Délai dépassé');
        });

        it('should return generic message for other errors', () => {
            const err = { message: 'Timeout' };
            expect(extractErrorMessage(err)).toBe('Timeout');
        });

        it('should fallback to generic message', () => {
            const err = { foo: 'bar' };
            expect(extractErrorMessage(err)).toBe('Une erreur inattendue est survenue.');
        });

        it('should handle field errors with underscores replaced by spaces', () => {
            const err = { response: { status: 400, data: { phone_number: ['Invalid'] } } };
            expect(extractErrorMessage(err)).toBe('Phone number: Invalid');
        });
    });
});
