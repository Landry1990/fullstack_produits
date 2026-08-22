import { describe, it, expect } from 'vitest';
import { getLotPrice } from '../lotPricing';

describe('lotPricing utilities', () => {
    describe('getLotPrice', () => {
        it('retourne le prix du lot quand il est valide (string)', () => {
            expect(getLotPrice('5100', '7000')).toBe('5100');
        });

        it('retourne le fallback quand sellingPrice est null', () => {
            expect(getLotPrice(null, '7000')).toBe('7000');
        });

        it('retourne le fallback quand sellingPrice est undefined', () => {
            expect(getLotPrice(undefined, '7000')).toBe('7000');
        });

        it('retourne le fallback quand sellingPrice est une chaine vide', () => {
            expect(getLotPrice('', '7000')).toBe('7000');
        });

        it('retourne "0" quand sellingPrice est 0 (0 est un prix valide)', () => {
            expect(getLotPrice(0, '7000')).toBe('0');
        });

        it('retourne le prix du lot quand il est un nombre', () => {
            expect(getLotPrice(5100, '7000')).toBe('5100');
        });
    });
});
