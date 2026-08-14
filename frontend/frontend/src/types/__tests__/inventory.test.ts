import { describe, it, expect } from 'vitest';
import { isProduitObject, getProduitId, getProduitName } from '../inventory';
import type { ProduitModel } from '../catalog';

describe('inventory type helpers', () => {
    const produit: ProduitModel = {
        id: 42,
        name: 'Paracétamol',
        description: '',
        stock: 10,
        cost_price: '5.00',
        selling_price: '8.00',
    };

    describe('isProduitObject', () => {
        it('returns true for a ProduitModel object', () => {
            expect(isProduitObject(produit)).toBe(true);
        });

        it('returns false for a numeric id', () => {
            expect(isProduitObject(42)).toBe(false);
        });

        it('returns false for null/undefined', () => {
            expect(isProduitObject(null)).toBe(false);
            expect(isProduitObject(undefined)).toBe(false);
        });
    });

    describe('getProduitId', () => {
        it('returns id from ProduitModel', () => {
            expect(getProduitId(produit)).toBe(42);
        });

        it('returns numeric id as-is', () => {
            expect(getProduitId(99)).toBe(99);
        });
    });

    describe('getProduitName', () => {
        it('returns name from ProduitModel', () => {
            expect(getProduitName(produit)).toBe('Paracétamol');
        });

        it('returns fallback for numeric id', () => {
            expect(getProduitName(99, 'Inconnu')).toBe('Inconnu');
        });

        it('returns empty fallback by default', () => {
            expect(getProduitName(99)).toBe('');
        });
    });
});
