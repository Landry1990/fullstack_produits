import { describe, it, expect } from 'vitest';
import { formatPrice, formatCurrency, safeFormatNumber, normalizeNumberInput } from '../formatters';

describe('formatPrice / formatCurrency', () => {
    it('formate les entiers avec séparateur de milliers', () => {
        const result = formatCurrency(150000);
        // En fr-FR, le séparateur de milliers est un espace insécable
        expect(result).toMatch(/150\s?000/);
    });

    it('arrondit les décimales (pas de virgule)', () => {
        const result = formatCurrency(150000.75);
        expect(result).toMatch(/150\s?001/);
    });

    it('formate zéro', () => {
        expect(formatCurrency(0)).toBe('0 F');
    });

    it('formate les petits nombres', () => {
        expect(formatCurrency(42)).toBe('42 F');
    });

    it('formate les grands nombres', () => {
        const result = formatCurrency(2500000);
        expect(result).toMatch(/2\s?500\s?000/);
    });

});

describe('safeFormatNumber', () => {
    it('gère null', () => {
        expect(safeFormatNumber(null)).toBe('0 F');
    });

    it('gère undefined', () => {
        expect(safeFormatNumber(undefined)).toBe('0 F');
    });

    it('gère les strings numériques', () => {
        const result = safeFormatNumber('1500');
        expect(result).toMatch(/1\s?500/);
    });

    it('gère les strings non-numériques', () => {
        expect(safeFormatNumber('abc')).toBe('0 F');
    });

    it('gère les nombres normaux', () => {
        const result = safeFormatNumber(5000);
        expect(result).toMatch(/5\s?000/);
    });
});

describe('normalizeNumberInput', () => {
    it('convertit un nombre directement', () => {
        expect(normalizeNumberInput(42)).toBe(42);
    });

    it('convertit une string avec virgule en nombre', () => {
        expect(normalizeNumberInput('1500,50')).toBe(1500.5);
    });

    it('convertit une string avec point en nombre', () => {
        expect(normalizeNumberInput('1500.50')).toBe(1500.5);
    });

    it('retourne 0 pour une string invalide', () => {
        expect(normalizeNumberInput('abc')).toBe(0);
    });

    it('applique le minimum', () => {
        expect(normalizeNumberInput(-5, { min: 0 })).toBe(0);
    });

    it('applique le maximum', () => {
        expect(normalizeNumberInput(150, { max: 100 })).toBe(100);
    });

    it('applique min et max ensemble', () => {
        expect(normalizeNumberInput(150, { min: 0, max: 100 })).toBe(100);
        expect(normalizeNumberInput(-5, { min: 0, max: 100 })).toBe(0);
        expect(normalizeNumberInput(50, { min: 0, max: 100 })).toBe(50);
    });
});
