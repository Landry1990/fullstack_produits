import { describe, it, expect, vi, afterEach } from 'vitest';
import { isExpiryMMYYExpired } from '../parseDataMatrix';

describe('isExpiryMMYYExpired', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    const setNow = (year: number, month0: number) => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(year, month0, 15));
    };

    it('rejette un mois antérieur au mois en cours', () => {
        setNow(2026, 10); // novembre 2026
        expect(isExpiryMMYYExpired('10/26')).toBe(true);
        expect(isExpiryMMYYExpired('01/26')).toBe(true);
        expect(isExpiryMMYYExpired('12/25')).toBe(true);
        expect(isExpiryMMYYExpired('01/20')).toBe(true);
    });

    it('accepte le mois en cours', () => {
        setNow(2026, 10);
        expect(isExpiryMMYYExpired('11/26')).toBe(false);
    });

    it('accepte les mois futurs', () => {
        setNow(2026, 10);
        expect(isExpiryMMYYExpired('12/26')).toBe(false);
        expect(isExpiryMMYYExpired('01/27')).toBe(false);
        expect(isExpiryMMYYExpired('06/30')).toBe(false);
    });

    it('gère le changement d\'année', () => {
        setNow(2027, 0); // janvier 2027
        expect(isExpiryMMYYExpired('12/26')).toBe(true);
        expect(isExpiryMMYYExpired('01/27')).toBe(false);
    });

    it('retourne false pour les formats invalides ou incomplets', () => {
        setNow(2026, 10);
        expect(isExpiryMMYYExpired('')).toBe(false);
        expect(isExpiryMMYYExpired(null)).toBe(false);
        expect(isExpiryMMYYExpired(undefined)).toBe(false);
        expect(isExpiryMMYYExpired('1')).toBe(false);
        expect(isExpiryMMYYExpired('11/')).toBe(false);
        expect(isExpiryMMYYExpired('13/26')).toBe(false);
        expect(isExpiryMMYYExpired('00/26')).toBe(false);
        expect(isExpiryMMYYExpired('abc')).toBe(false);
    });
});
