import { describe, it, expect } from 'vitest';
import { validateSaleData, validateProfessionalClient } from '../validation';
import type { SaleCompletionParams, Client } from '../../types';

describe('validation utilities', () => {
    describe('validateSaleData', () => {
        const baseParams: Partial<SaleCompletionParams> = {
            selectedClient: 1,
            useManualClient: false,
            lignesFacture: [{ id: 1 }] as any,
            totals: { totalTtc: 1000, partPatient: 1000, tauxCouverture: 0 } as any,
            montantPaye: '1000',
            paiements: []
        };

        it('should return null for valid data', () => {
            const error = validateSaleData(baseParams as SaleCompletionParams);
            expect(error).toBeNull();
        });

        it('should require a client', () => {
            const params = { ...baseParams, selectedClient: null, useManualClient: false };
            const error = validateSaleData(params as SaleCompletionParams);
            expect(error).toBe('Veuillez sélectionner un client');
        });

        it('should require products', () => {
            const params = { ...baseParams, lignesFacture: [] };
            const error = validateSaleData(params as SaleCompletionParams);
            expect(error).toBe('Veuillez ajouter au moins un produit');
        });

        it('should validate insufficient amount', () => {
            const params = { ...baseParams, montantPaye: '500' };
            const error = validateSaleData(params as SaleCompletionParams);
            expect(error).toContain('insuffisant');
        });
    });

    describe('validateProfessionalClient', () => {
        const clientPro: Client = {
            id: 1,
            client_type: 'PROFESSIONNEL',
            plafond: '5000',
            current_debt: '4500'
        } as any;

        const params: Partial<SaleCompletionParams> = {
            useManualClient: false,
            showNewAyantDroit: false,
            ayantsDroitList: [{ id: 1, matricule: '123' }] as any,
            selectedAyantDroit: 1,
            totals: { totalTtc: 1000 } as any,
            montantPaye: '0',
            paiements: []
        };

        it('should detect credit limit exceeded', () => {
            const error = validateProfessionalClient(params as SaleCompletionParams, clientPro);
            expect(error).toContain('PLAFOND DÉPASSÉ');
        });

        it('should allow if payment covers the increment', () => {
            const paramsWithPayment = { ...params, montantPaye: '1000' };
            const error = validateProfessionalClient(paramsWithPayment as SaleCompletionParams, clientPro);
            expect(error).toBeNull();
        });
    });
});
