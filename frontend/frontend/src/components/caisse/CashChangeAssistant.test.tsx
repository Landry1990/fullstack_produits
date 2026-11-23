import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import CashChangeAssistant from './CashChangeAssistant';

const preference = 'zenith.cash-change-assistance.enabled';
const changed = vi.fn();
const props = { amountDue: 600, amountReceived: 1000, onAmountReceivedChange: changed };

beforeEach(() => {
    localStorage.removeItem(preference);
    changed.mockReset();
});
afterEach(cleanup);

function enable() {
    fireEvent.click(screen.getByRole('checkbox', { name: 'Aide au rendu de monnaie' }));
}

describe('CashChangeAssistant', () => {
    it('is opt-in and never changes an amount merely by enabling it', () => {
        render(<CashChangeAssistant {...props} />);
        expect(screen.getByRole('checkbox')).not.toBeChecked();
        expect(screen.queryByRole('button', { name: /effectivement reçus/ })).not.toBeInTheDocument();
        enable();
        expect(screen.getByRole('checkbox')).toBeChecked();
        expect(screen.getByRole('button', { name: '100 F supplémentaires effectivement reçus' })).toBeInTheDocument();
        expect(changed).not.toHaveBeenCalled();
    });

    it('only applies cash after confirmation, protects against double clicks, and displays the new change', () => {
        const { rerender } = render(<CashChangeAssistant {...props} />);
        enable();
        const confirm = screen.getByRole('button', { name: /effectivement reçus/ });
        fireEvent.click(confirm);
        fireEvent.click(confirm);
        expect(changed).toHaveBeenCalledExactlyOnceWith(1100);
        rerender(<CashChangeAssistant {...props} amountReceived={1100} />);
        expect(screen.getByText(/Complément de 100 F pris en compte/)).toHaveTextContent(/500 F à rendre/);
        expect(screen.queryByRole('button', { name: /effectivement reçus/ })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('checkbox'));
        expect(changed).toHaveBeenCalledTimes(1);
    });

    it('does not ask for another complement after one has already been received', () => {
        const { rerender } = render(<CashChangeAssistant {...props} amountReceived={1850} />);
        enable();
        fireEvent.click(screen.getByRole('button', { name: '250 F supplémentaires effectivement reçus' }));
        expect(changed).toHaveBeenCalledExactlyOnceWith(2100);
        rerender(<CashChangeAssistant {...props} amountReceived={2100} />);
        expect(screen.queryByRole('button', { name: /effectivement reçus/ })).not.toBeInTheDocument();
        expect(screen.getByText(/Complément de 250 F pris en compte/)).toBeInTheDocument();
    });

    it('can decline a suggestion without changing the amount and recomputes when the amount changes', () => {
        const { rerender } = render(<CashChangeAssistant {...props} />);
        enable();
        fireEvent.click(screen.getByRole('button', { name: 'Sans complément' }));
        expect(changed).not.toHaveBeenCalled();
        expect(screen.queryByRole('button', { name: /effectivement reçus/ })).not.toBeInTheDocument();
        rerender(<CashChangeAssistant {...props} amountDue={5500} amountReceived={10000} />);
        expect(screen.getByRole('button', { name: '500 F supplémentaires effectivement reçus' })).toBeInTheDocument();
    });

    it('remembers both enabled and disabled preferences without automatically applying money', () => {
        const first = render(<CashChangeAssistant {...props} />);
        enable();
        expect(localStorage.getItem(preference)).toBe('true');
        first.unmount();
        const second = render(<CashChangeAssistant {...props} />);
        expect(screen.getByRole('checkbox')).toBeChecked();
        fireEvent.click(screen.getByRole('checkbox'));
        expect(localStorage.getItem(preference)).toBe('false');
        second.unmount();
        render(<CashChangeAssistant {...props} />);
        expect(screen.getByRole('checkbox')).not.toBeChecked();
        expect(changed).not.toHaveBeenCalled();
    });

    it('disables the checkbox and all suggestion actions while processing a payment', () => {
        localStorage.setItem(preference, 'true');
        render(<CashChangeAssistant {...props} disabled />);
        expect(screen.getByRole('checkbox')).toBeDisabled();
        expect(screen.getByRole('button', { name: /effectivement reçus/ })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Sans complément' })).toBeDisabled();
        fireEvent.click(screen.getByRole('button', { name: /effectivement reçus/ }));
        expect(changed).not.toHaveBeenCalled();
    });

    it('does not offer extra cash for insufficient, exact, decimal or simple payments', () => {
        localStorage.setItem(preference, 'true');
        const { rerender } = render(<CashChangeAssistant {...props} amountReceived={500} />);
        for (const amountReceived of [500, 600, 600.5, 1100]) {
            rerender(<CashChangeAssistant {...props} amountReceived={amountReceived} />);
            expect(screen.queryByRole('button', { name: /effectivement reçus/ })).not.toBeInTheDocument();
        }
        expect(changed).not.toHaveBeenCalled();
    });
});
