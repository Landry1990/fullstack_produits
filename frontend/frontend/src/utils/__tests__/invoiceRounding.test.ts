import { describe, expect, it } from 'vitest';
import { calculateFactureTotals } from '../finance';
import { tiersPayantSplit } from '../../../../../mobile-facturation/src/utils/invoiceRounding';
import type { Client } from '../../types';

const totals = (amount: number, coverage = 0, discount = '0', mode: 'montant' | 'taux' = 'montant', active = true) =>
    calculateFactureTotals({ sousTotal: amount, totalTva: 0, totalTTC: amount, totalBuyHT: 0 },
        { taux_couverture: String(coverage) } as Client, discount, mode, active);

describe('Invoice rounding to nearest five francs', () => {
    it.each([[4566, 4565, -1], [4568, 4570, 2], [4565, 4565, 0], [2, 0, -2], [3, 5, 2]])(
        'rounds %s to %s with an explicit adjustment %s', (amount, expected, adjustment) => {
            const result = totals(amount);
            expect(result.totalTtc).toBe(expected);
            expect(result.partPatient).toBe(expected);
            expect(result.ecartArrondi).toBe(adjustment);
        });

    it.each(['montant', 'taux'] as const)('rounds the final amount, not the %s discount', mode => {
        const result = totals(5000, 0, mode === 'montant' ? '432' : '8.64', mode);
        expect(result.remiseMontant).toBe(432);
        expect(result.partPatient).toBe(4570);
        expect(result.ecartArrondi).toBe(2);
    });

    it('preserves the insurer share including cents and increases the invoice by the adjustment only', () => {
        const result = totals(15226, 70);
        expect(result.partPatient).toBe(4570);
        expect(result.partAssurance).toBe(10658.20);
        expect(result.ecartArrondi).toBe(2.20);
        expect(result.totalTtc).toBe(15228.20);
    });

    it('matches backend half-even cents and half-up five-franc ties', () => {
        expect(totals(1, 49.5).partAssurance).toBe(0.5);
        expect(totals(25, 90).partPatient).toBe(5);
        expect(totals(25, 90).partAssurance).toBe(22.5);
    });

    it('matches backend franc rounding for negative amounts without applying five-franc rounding', () => {
        const result = totals(-4568.5, 70);
        expect(result.totalTtc).toBe(-4569);
        expect(result.ecartArrondi).toBe(0);
        expect(tiersPayantSplit(-4568.5, 70)).toEqual({ partPatient: result.partPatient, partAssurance: result.partAssurance, totalTtc: result.totalTtc, ecartArrondi: 0 });
    });

    it('leaves legacy invoices and full coverage unchanged', () => {
        const legacy = totals(15226, 70, '0', 'montant', false);
        expect(legacy.partPatient).toBe(4567.8);
        expect(legacy.totalTtc).toBe(15226);
        expect(legacy.ecartArrondi).toBe(0);
        expect(totals(4568, 100).partPatient).toBe(0);
        expect(totals(4568, 100).totalTtc).toBe(4568);
    });

    it('keeps web and mobile consistent across amounts and coverage rates', () => {
        for (const amount of [0, 1, 2, 3, 25, 4566, 4568, 15226, 99999]) {
            for (const coverage of [0, 30, 49.5, 70, 80, 90, 99.99, 100]) {
                const web = totals(amount, coverage);
                const mobile = tiersPayantSplit(amount, coverage);
                expect(mobile).toEqual({ partPatient: web.partPatient, partAssurance: web.partAssurance, totalTtc: web.totalTtc, ecartArrondi: web.ecartArrondi });
                expect(web.partPatient % 5).toBe(0);
                expect(Math.abs(web.ecartArrondi ?? 0)).toBeLessThanOrEqual(2.5);
                expect(Math.round((web.partPatient + web.partAssurance) * 100)).toBe(Math.round(web.totalTtc * 100));
            }
        }
    });
});
