import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import i18next from 'i18next';
import InvoiceTemplate, { type InvoiceData } from './InvoiceTemplate';
import { TicketTemplate } from './TicketTemplate';
import { buildTicketEscpos } from '../../utils/escpos/ticketEscpos';
import type { Facture, PharmacySettings, TicketCaisse } from '../../types';
import printing from '../../../public/locales/fr/printing.json';
import common from '../../../public/locales/fr/common.json';

vi.mock('../../context/PharmacySettingsContext', () => ({ useDocumentLocale: () => ({ lang: 'fr', locale: 'fr-FR' }) }));
vi.mock('../../utils/documentLang', () => ({ getDocumentLocale: () => 'fr-FR', getDocumentLanguage: () => 'fr' }));
vi.mock('react-barcode', () => ({ default: () => null }));

const settings = { pharmacy_name: 'Test', address: '', phone: '', ticket_footer_message: '', ticket_paper_width: 80 };
const facture = { id: 1, numero_facture: 'T1', total_ht: '15226', total_tva: '0', total_ttc: '15228.20', part_client: '4570', ecart_arrondi: '2.20', arrondi_5f: true, client_type: 'PROFESSIONNEL', produits: [], remise: '0' } as Facture;
const ticket = { id: 1, facture, montant: facture.total_ttc, date_paiement: '2026-11-23T12:00:00', mode_paiement: 'especes', paiements_details: [{ mode: 'especes', montant: 4570, part_patient: 4570 }, { mode: 'en_compte', montant: 10658.20, part_assurance: 10658.20 }] } as TicketCaisse;

beforeAll(async () => { await i18next.init({ lng: 'fr', resources: { fr: { printing, common } } }); });
afterEach(cleanup);

describe('Recorded invoice rounding on documents', () => {
    it('shows exact invoice and insurer amounts, adjustment and rounded patient amount on HTML tickets', () => {
        render(<TicketTemplate ticket={ticket} settings={settings as PharmacySettings} />);
        expect(screen.getByText('Arrondi à 5 F')).toBeInTheDocument();
        expect(screen.getByText('+2,20')).toBeInTheDocument();
        expect(screen.getByText('15.228,20')).toBeInTheDocument();
        expect(screen.getAllByText('4.570').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('10.658,20')).toBeInTheDocument();
    });

    it('shows the same exact amounts and adjustment on the A4 invoice', () => {
        const data = { id: 1, numero_facture: 'T1', date: '2026-11-23', client: null, produits: [], total_ht: 15226, total_tva: 0, total_ttc: 15228.20, part_client: 4570, part_assurance: 10658.20, remise: 0, arrondi_5f: true, ecart_arrondi: 2.20, type: 'STD', status: 'VAL' } satisfies InvoiceData;
        render(<InvoiceTemplate settings={settings} data={data} />);
        expect(screen.getByText('Arrondi à 5 F')).toBeInTheDocument();
        expect(screen.getByText('+2,20 F')).toBeInTheDocument();
        expect(screen.getByText('15.228,20 F')).toBeInTheDocument();
        expect(screen.getByText('4.570 F')).toBeInTheDocument();
    });

    it('includes exact cents and adjustment on ESC/POS tickets', () => {
        const output = buildTicketEscpos(ticket, settings as PharmacySettings);
        expect(output).toContain('+2,20');
        expect(output).toContain('15.228,20');
        expect(output).toContain('10.658,20');
        expect(output).toContain('4.570');
    });

    it('does not add an adjustment row to legacy invoices', () => {
        render(<TicketTemplate ticket={{ ...ticket, facture: { ...facture, arrondi_5f: false, ecart_arrondi: '0', total_ttc: '15226', part_client: '4567.80' }, montant: '15226' }} settings={settings as PharmacySettings} />);
        expect(screen.queryByText('Arrondi à 5 F')).not.toBeInTheDocument();
        expect(screen.getByText('15.226')).toBeInTheDocument();
    });
});
