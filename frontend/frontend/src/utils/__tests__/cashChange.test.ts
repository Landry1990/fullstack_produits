import { describe, expect, it } from 'vitest';
import { suggestCashChange } from '../cashChange';

describe('suggestCashChange', () => {
    it.each([
        [600, 1000, 100, 500],
        [750, 1000, 250, 500],
        [700, 1000, 200, 500],
        [650, 1000, 150, 500],
        [1500, 5000, 1500, 5000],
        [2500, 5000, 2500, 5000],
        [5500, 10000, 500, 5000],
        [1600, 2000, 100, 500],
        [61500, 100000, 1500, 40000],
    ])('due %i, tendered %i: asks %i and returns %i', (due, received, additional, newChange) => {
        const result = suggestCashChange(due, received);
        expect(result).toMatchObject({ additional, newChange, newAmountReceived: received + additional, originalChange: received - due });
        expect(result!.newPieces).toBeLessThan(result!.originalPieces);
    });

    it.each([
        [1000, 1000], [1000, 500], [0, 1000], [-100, 1000], [600, -1000],
        [500, 1000], [1000, 2000], [1000, 5000], [5000, 10000],
        [600.5, 1000], [600, 1000.5], [624, 1000], [NaN, 1000], [600, Infinity],
        [600, Number.MAX_SAFE_INTEGER + 1],
    ])('does not suggest a change for due %s / received %s', (due, received) => {
        expect(suggestCashChange(due, received)).toBeNull();
    });

    it('preserves the net payment, caps the extra and always reduces the number of pieces', () => {
        for (let change = 25; change <= 30000; change += 25) {
            const due = 600;
            const received = due + change;
            const result = suggestCashChange(due, received);
            if (!result) continue;
            expect(result.newAmountReceived - result.newChange).toBe(due);
            expect(result.additional).toBeGreaterThan(0);
            expect(result.additional).toBeLessThanOrEqual(Math.min(2500, received));
            expect(result.newPieces).toBeLessThan(result.originalPieces);
        }
    });
});
