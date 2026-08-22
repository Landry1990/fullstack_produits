import { describe, it, expect } from 'vitest';
import { sortLotsByFEFO, allocateLotsFEFO } from '../fefo';
import type { StockLot } from '../../types';

const makeLot = (overrides: Partial<StockLot>): StockLot => ({
    id: 1,
    produit: 1,
    produit_nom: 'Test',
    fournisseur: 1,
    fournisseur_nom: 'F1',
    quantity_initial: 100,
    quantity_remaining: 10,
    price_cost: '500',
    selling_price: '7000',
    lot: 'LOT-A',
    date_expiration: '2025-12-31',
    date_reception: '2025-01-01',
    ...overrides,
});

describe('fefo utilities', () => {
    describe('sortLotsByFEFO', () => {
        it('trie par date_expiration croissante', () => {
            const lots: StockLot[] = [
                makeLot({ id: 1, lot: 'L1', date_expiration: '2026-12-31', date_reception: '2025-01-01' }),
                makeLot({ id: 2, lot: 'L2', date_expiration: '2025-06-01', date_reception: '2025-02-01' }),
                makeLot({ id: 3, lot: 'L3', date_expiration: '2025-03-01', date_reception: '2025-03-01' }),
            ];
            const sorted = sortLotsByFEFO(lots);
            expect(sorted.map(l => l.id)).toEqual([3, 2, 1]);
        });

        it('met les lots sans date_expiration a la fin', () => {
            const lots: StockLot[] = [
                makeLot({ id: 1, lot: 'L1', date_expiration: null, date_reception: '2025-01-01' }),
                makeLot({ id: 2, lot: 'L2', date_expiration: '2025-06-01', date_reception: '2025-02-01' }),
                makeLot({ id: 3, lot: 'L3', date_expiration: null, date_reception: '2025-03-01' }),
            ];
            const sorted = sortLotsByFEFO(lots);
            expect(sorted[0].id).toBe(2);
            expect(sorted.map(s => s.id)).toContain(1);
            expect(sorted.map(s => s.id)).toContain(3);
            // Les deux lots sans expiration sont apres le lot avec expiration
            const idxWithExp = sorted.findIndex(l => l.id === 2);
            expect(sorted.findIndex(l => l.id === 1)).toBeGreaterThan(idxWithExp);
            expect(sorted.findIndex(l => l.id === 3)).toBeGreaterThan(idxWithExp);
        });

        it('tie-break par date_reception quand les dates d\'expiration sont egales', () => {
            const lots: StockLot[] = [
                makeLot({ id: 1, lot: 'L1', date_expiration: '2025-06-01', date_reception: '2025-03-01' }),
                makeLot({ id: 2, lot: 'L2', date_expiration: '2025-06-01', date_reception: '2025-01-01' }),
            ];
            const sorted = sortLotsByFEFO(lots);
            expect(sorted.map(l => l.id)).toEqual([2, 1]);
        });

        it('ne modifie pas le tableau original', () => {
            const lots: StockLot[] = [
                makeLot({ id: 1, lot: 'L1', date_expiration: '2026-01-01' }),
                makeLot({ id: 2, lot: 'L2', date_expiration: '2025-01-01' }),
            ];
            const originalOrder = lots.map(l => l.id);
            sortLotsByFEFO(lots);
            expect(lots.map(l => l.id)).toEqual(originalOrder);
        });
    });

    describe('allocateLotsFEFO', () => {
        it('un lot suffit -> une seule allocation avec la quantite complete', () => {
            const lots: StockLot[] = [
                makeLot({ id: 1, lot: 'L1', quantity_remaining: 50, selling_price: '5100', date_expiration: '2025-06-01' }),
            ];
            const allocations = allocateLotsFEFO(lots, 5);
            expect(allocations).toHaveLength(1);
            expect(allocations[0].lotId).toBe(1);
            expect(allocations[0].quantity).toBe(5);
            expect(allocations[0].sellingPrice).toBe('5100');
        });

        it('deux lots necessaires -> deux allocations (qty > available du premier)', () => {
            const lots: StockLot[] = [
                makeLot({ id: 1, lot: 'L1', quantity_remaining: 3, selling_price: '5100', date_expiration: '2025-06-01' }),
                makeLot({ id: 2, lot: 'L2', quantity_remaining: 10, selling_price: '7000', date_expiration: '2026-06-01' }),
            ];
            const allocations = allocateLotsFEFO(lots, 7);
            expect(allocations).toHaveLength(2);
            expect(allocations[0].lotId).toBe(1);
            expect(allocations[0].quantity).toBe(3);
            expect(allocations[1].lotId).toBe(2);
            expect(allocations[1].quantity).toBe(4);
        });

        it('qty > stock total -> allocations couvrent tout le stock disponible', () => {
            const lots: StockLot[] = [
                makeLot({ id: 1, lot: 'L1', quantity_remaining: 3, date_expiration: '2025-06-01' }),
                makeLot({ id: 2, lot: 'L2', quantity_remaining: 5, date_expiration: '2026-06-01' }),
            ];
            const allocations = allocateLotsFEFO(lots, 100);
            expect(allocations).toHaveLength(2);
            expect(allocations[0].quantity).toBe(3);
            expect(allocations[1].quantity).toBe(5);
            const totalAlloue = allocations.reduce((sum, a) => sum + a.quantity, 0);
            expect(totalAlloue).toBe(8);
        });

        it('ignore les lots avec quantity_remaining = 0', () => {
            const lots: StockLot[] = [
                makeLot({ id: 1, lot: 'L1', quantity_remaining: 0, date_expiration: '2025-06-01' }),
                makeLot({ id: 2, lot: 'L2', quantity_remaining: 5, date_expiration: '2026-06-01' }),
            ];
            const allocations = allocateLotsFEFO(lots, 3);
            expect(allocations).toHaveLength(1);
            expect(allocations[0].lotId).toBe(2);
            expect(allocations[0].quantity).toBe(3);
        });

        it('trie les lots par FEFO avant allocation (le lot le plus perissable est consomme en premier)', () => {
            const lots: StockLot[] = [
                makeLot({ id: 1, lot: 'L1', quantity_remaining: 10, date_expiration: '2026-06-01' }),
                makeLot({ id: 2, lot: 'L2', quantity_remaining: 10, date_expiration: '2025-06-01' }),
            ];
            const allocations = allocateLotsFEFO(lots, 5);
            expect(allocations).toHaveLength(1);
            expect(allocations[0].lotId).toBe(2);
            expect(allocations[0].quantity).toBe(5);
        });
    });
});
