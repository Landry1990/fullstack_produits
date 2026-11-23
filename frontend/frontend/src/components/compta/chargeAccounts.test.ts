import { describe, expect, it } from 'vitest';
import { chargeAccounts } from './chargeAccounts';

describe('SYSCOHADA expense categories', () => {
    it('uses rentals and telecommunications rather than transport or rental accounts respectively', () => {
        expect(chargeAccounts.loyer).toBe('622200');
        expect(chargeAccounts.internet).toBe('628000');
    });

    it('uses personnel, other taxes and non-stocked office supplies accounts', () => {
        expect(chargeAccounts.salaires).toBe('661000');
        expect(chargeAccounts.impots).toBe('648000');
        expect(chargeAccounts.fournitures).toBe('605500');
    });

    it('retains the aggregated water and electricity account without inventing a breakdown', () => {
        expect(chargeAccounts.energie).toBe('605000');
    });
});
