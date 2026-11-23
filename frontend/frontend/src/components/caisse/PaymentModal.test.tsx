import { type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PaymentModal } from './PaymentModal';
import type { CouponMonnaie, Facture } from '../../types';

vi.mock('../../hooks/usePharmacySettings', () => ({ usePharmacySettings: () => ({ settings: {} }) }));
vi.mock('../common/PremiumModal', () => ({
    default: ({ isOpen, children, footer }: { isOpen: boolean; children: ReactNode; footer: ReactNode }) => isOpen ? <div role="dialog">{children}{footer}</div> : null,
}));

const confirm = vi.fn();
const facture = { id: 1, numero_facture: 'TEST-1', total_ttc: '600', part_client: null } as Facture;
const props = { isOpen: true, onClose: vi.fn(), facture, onConfirm: confirm, loading: false };
const preference = 'zenith.cash-change-assistance.enabled';
const enterReceived = (value: string) => fireEvent.change(screen.getByRole('spinbutton'), { target: { value } });

beforeEach(() => {
    localStorage.removeItem(preference);
    confirm.mockReset();
});
afterEach(cleanup);

describe('Cash payment with optional change assistance', () => {
    it('only updates the input on confirmation, then uses the unchanged add-and-validate flow', () => {
        render(<PaymentModal {...props} />);
        enterReceived('1000');
        fireEvent.click(screen.getByRole('checkbox', { name: 'Aide au rendu de monnaie' }));
        expect(screen.getByRole('spinbutton')).toHaveValue(1000);
        expect(confirm).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: '100 F supplémentaires effectivement reçus' }));
        expect(screen.getByRole('spinbutton')).toHaveValue(1100);
        expect(screen.getByText(/^500 (?:F|FCFA)$/)).toBeInTheDocument();
        expect(confirm).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
        expect(confirm).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: "Valider l'encaissement" }));
        expect(confirm).toHaveBeenCalledExactlyOnceWith([{ mode: 'especes', montant: 1100 }]);
    });

    it('does not change a payment when disabled or when a suggestion is declined', () => {
        render(<PaymentModal {...props} />);
        enterReceived('1000');
        expect(screen.getByRole('checkbox')).not.toBeChecked();
        fireEvent.click(screen.getByRole('checkbox'));
        fireEvent.click(screen.getByRole('button', { name: 'Sans complément' }));
        expect(screen.getByRole('spinbutton')).toHaveValue(1000);
        fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
        fireEvent.click(screen.getByRole('button', { name: "Valider l'encaissement" }));
        expect(confirm).toHaveBeenCalledExactlyOnceWith([{ mode: 'especes', montant: 1000 }]);
    });

    it('uses the patient share after a coupon, without changing either discount or insurer share', () => {
        render(<PaymentModal {...props} facture={{ ...facture, total_ttc: '2000', part_client: '700' }} coupon={{ id: 1, numero: 'C1', montant: '100' } as CouponMonnaie} />);
        expect(screen.getByRole('spinbutton')).toHaveValue(600);
        enterReceived('1000');
        fireEvent.click(screen.getByRole('checkbox'));
        fireEvent.click(screen.getByRole('button', { name: '100 F supplémentaires effectivement reçus' }));
        expect(screen.getByRole('spinbutton')).toHaveValue(1100);
        expect(confirm).not.toHaveBeenCalled();
    });

    it('calculates the extra from the remaining cash installment after a partial payment', () => {
        render(<PaymentModal {...props} facture={{ ...facture, total_ttc: '1600' }} />);
        enterReceived('1000');
        fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
        expect(screen.getByRole('spinbutton')).toHaveValue(600);
        enterReceived('1000');
        fireEvent.click(screen.getByRole('checkbox'));
        fireEvent.click(screen.getByRole('button', { name: '100 F supplémentaires effectivement reçus' }));
        expect(screen.getByRole('spinbutton')).toHaveValue(1100);
        fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
        fireEvent.click(screen.getByRole('button', { name: "Valider l'encaissement" }));
        expect(confirm).toHaveBeenCalledExactlyOnceWith([{ mode: 'especes', montant: 1000 }, { mode: 'especes', montant: 1100 }]);
    });

    it('does not display cash suggestions for card payments', () => {
        render(<PaymentModal {...props} />);
        enterReceived('300');
        fireEvent.click(screen.getByRole('button', { name: 'Carte Bancaire' }));
        expect(screen.queryByRole('checkbox', { name: 'Aide au rendu de monnaie' })).not.toBeInTheDocument();
        expect(confirm).not.toHaveBeenCalled();
    });
});
