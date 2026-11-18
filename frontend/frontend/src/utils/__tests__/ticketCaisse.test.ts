import { describe, it, expect } from 'vitest';
import { buildTicketCaisse } from '../ticketCaisse';
import type { Facture } from '../../types';

const makeFacture = (overrides: Partial<Facture> = {}): Facture => ({
    id: 42,
    client: 1,
    numero_facture: 'FAC-00042',
    date: '2026-11-18T10:00:00Z',
    status: 'PAY',
    status_display: 'Payée',
    total_ht: '9000',
    remise: '0',
    tva: '0',
    total_tva: '0',
    total_ttc: '10000',
    montant_paye: '10000',
    produits: [],
    ...overrides,
});

describe('buildTicketCaisse', () => {
    it('construit un ticket de vente directe (paiements saisis)', () => {
        const facture = makeFacture({ client_name: 'Mme Test' });
        const ticket = buildTicketCaisse(facture, {
            fallbackClientName: 'Client de passage',
            extraClientNames: ['Manuel Saisi'],
            enteredPayments: [{ mode: 'especes', montant: 10000 }],
            fallbackMontantVerse: 10000,
            fallbackRendu: 0,
            defaultModePaiement: 'N/A',
        });

        expect(ticket.id).toBe(42);
        expect(ticket.facture).toBe(facture);
        expect(ticket.facture_numero).toBe('FAC-00042');
        expect(ticket.client_name).toBe('Mme Test');
        expect(ticket.mode_paiement).toBe('especes');
        expect(ticket.montant).toBe('10000');
        expect(ticket.montant_verse).toBe('10000');
        expect(ticket.rendu).toBe('0');
        expect(ticket.statut).toBe('completee');
        expect(ticket.paiements_details).toEqual([{ mode: 'especes', montant: 10000 }]);
        expect(ticket.is_duplicate).toBeUndefined();
    });

    it('priorise client_name_override puis les noms supplémentaires', () => {
        const ticket = buildTicketCaisse(
            makeFacture({ client_name: 'Mme Test', client_name_override: 'Override Nom' }),
            { fallbackClientName: 'Client de passage', extraClientNames: ['Manuel'] }
        );
        expect(ticket.client_name).toBe('Override Nom');

        const ticket2 = buildTicketCaisse(makeFacture(), {
            fallbackClientName: 'Client de passage',
            extraClientNames: [undefined, 'Manuel'],
        });
        expect(ticket2.client_name).toBe('Manuel');

        const ticket3 = buildTicketCaisse(makeFacture(), { fallbackClientName: 'Client de passage' });
        expect(ticket3.client_name).toBe('Client de passage');
    });

    it('marque Mixte pour plusieurs paiements saisis', () => {
        const ticket = buildTicketCaisse(makeFacture(), {
            fallbackClientName: 'X',
            enteredPayments: [
                { mode: 'especes', montant: 5000 },
                { mode: 'mobile_money', montant: 5000 },
            ],
        });
        expect(ticket.mode_paiement).toBe('Mixte');
    });

    it('reconstruit depuis facture.paiements (réimpression)', () => {
        const facture = makeFacture({
            session_ticket_number: 7,
            montant_verse: '12000',
            montant_rendu: '2000',
            paiements: [{
                id: 9,
                mode_paiement: 'especes',
                mode_paiement_display: 'Espèces',
                montant: '12000',
                statut: 'completee',
                date_paiement: '2026-11-18T11:00:00Z',
                part_patient: null,
                part_assurance: null,
            }],
        });
        const ticket = buildTicketCaisse(facture, {
            ticketId: facture.session_ticket_number || facture.id,
            fallbackClientName: 'Client de passage',
            datePaiement: facture.paiements?.[0]?.date_paiement || facture.date,
            isDuplicate: true,
        });

        expect(ticket.id).toBe(7);
        expect(ticket.is_duplicate).toBe(true);
        expect(ticket.mode_paiement).toBe('especes');
        expect(ticket.montant_verse).toBe('12000');
        expect(ticket.rendu).toBe('2000');
        expect(ticket.date_paiement).toBe('2026-11-18T11:00:00Z');
        // Conversion mode_paiement -> mode pour éviter le "[N/A]" du ticket
        expect(ticket.paiements_details).toEqual([
            { mode: 'especes', montant: 12000, part_patient: null, part_assurance: null },
        ]);
    });

    it('mode_paiement inconnu en facture -> Mixte', () => {
        const facture = makeFacture({
            paiements: [{
                id: 1, mode_paiement: 'crypto_bidule', mode_paiement_display: '?',
                montant: '1000', statut: 'completee', date_paiement: '',
            }],
        });
        const ticket = buildTicketCaisse(facture, { fallbackClientName: 'X' });
        expect(ticket.mode_paiement).toBe('Mixte');
    });

    it('peut utiliser les paiements saisis pour le mode et ceux persistés pour les détails (caisse)', () => {
        const facture = makeFacture({
            paiements: [{
                id: 5, mode_paiement: 'coupon', mode_paiement_display: 'Coupon',
                montant: '8000', statut: 'completee', date_paiement: '2026-11-18T12:00:00Z',
                part_patient: 8000, part_assurance: null,
            }],
        });
        const ticket = buildTicketCaisse(facture, {
            fallbackClientName: 'X',
            enteredPayments: [{ mode: 'especes', montant: 10000 }],
            paiementsDetailsSource: 'facture',
        });
        expect(ticket.mode_paiement).toBe('especes'); // depuis la saisie
        expect(ticket.paiements_details).toEqual([
            { mode: 'coupon', montant: 8000, part_patient: 8000, part_assurance: null },
        ]); // depuis la facture
    });

    it('user_details par défaut = validated_by_name puis created_by_name', () => {
        const ticket = buildTicketCaisse(
            makeFacture({ validated_by_name: 'Sudo Admin', created_by_name: 'Vendeur' }),
            { fallbackClientName: 'X' }
        );
        expect(ticket.user_details).toEqual({ id: 0, username: 'Sudo Admin' });

        const ticket2 = buildTicketCaisse(
            makeFacture({ created_by_name: 'Vendeur' }),
            { fallbackClientName: 'X' }
        );
        expect(ticket2.user_details).toEqual({ id: 0, username: 'Vendeur' });
    });
});
