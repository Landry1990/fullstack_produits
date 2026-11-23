import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ImmobilisationsTab from './ImmobilisationsTab';
import api from '../../services/api';
import type { Compte } from '../../hooks/useAccounting';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 1, is_superuser: true } }) }));
vi.mock('react-i18next', async importOriginal => ({
    ...await importOriginal<typeof import('react-i18next')>(),
    useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'fr' } }),
}));
vi.mock('goey-toast', () => ({ gooeyToast: { success: vi.fn(), error: vi.fn() } }));

const asset = {
    id: 1, nom: 'Ordinateur', compte_immo: 10, compte_immo_numero: '244000', compte_amortissement: 20,
    date_acquisition: '2026-01-01', valeur_acquisition: '600000', duree_annees: 5, valeur_residuelle: '0',
    mode_paiement: 'banque', is_active: true, comptabilisee: true, dotation_annuelle: '120000',
    cumul_amortissements: '0', valeur_nette_comptable: '600000', dotations: [],
};
const comptes: Compte[] = [
    { id: 10, numero: '244000', libelle: 'Matériel', type: 'ACTIF', is_active: true },
    { id: 20, numero: '284000', libelle: 'Amortissement matériel', type: 'PASSIF', is_active: true },
    { id: 30, numero: '281000', libelle: 'Amortissement incorporel', type: 'PASSIF', is_active: true },
    { id: 40, numero: '221000', libelle: 'Terrains', type: 'ACTIF', is_active: true },
];
const page = (canWrite = true) => ({ results: [asset], count: 1, next: null, previous: null, can_write: canWrite });

function mount() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    return render(<QueryClientProvider client={client}><ImmobilisationsTab comptes={comptes} /></QueryClientProvider>);
}

beforeEach(() => {
    vi.mocked(api.get).mockReset().mockResolvedValue({ data: page() });
    vi.mocked(api.post).mockReset().mockResolvedValue({ data: asset });
    vi.mocked(api.patch).mockReset().mockResolvedValue({ data: asset });
});
afterEach(cleanup);

describe('ImmobilisationsTab', () => {
    it('creates a fixed asset with compatible accounts and financial parameters', async () => {
        mount();
        await screen.findByText('Ordinateur');
        await userEvent.click(screen.getByRole('button', { name: 'immos.create' }));
        const dialog = within(screen.getByRole('dialog'));
        await userEvent.type(dialog.getByLabelText('immos.nom'), 'Nouveau matériel');
        await userEvent.selectOptions(dialog.getByLabelText('immos.asset_account'), '10');
        expect(dialog.queryByRole('option', { name: /Terrains/ })).not.toBeInTheDocument();
        expect(dialog.queryByRole('option', { name: /Amortissement incorporel/ })).not.toBeInTheDocument();
        await userEvent.selectOptions(dialog.getByLabelText('immos.amort_account'), '20');
        await userEvent.type(dialog.getByLabelText('immos.valeur'), '250000');
        await userEvent.click(dialog.getByRole('button', { name: 'immos.save' }));
        await waitFor(() => expect(api.post).toHaveBeenCalledWith('compta/immobilisations/', expect.objectContaining({
            nom: 'Nouveau matériel', compte_immo: 10, compte_amortissement: 20, valeur_acquisition: '250000', duree_annees: 5,
        })));
    });

    it('locks posted financial data and only sends the name when editing', async () => {
        mount();
        await userEvent.click(await screen.findByRole('button', { name: 'immos.edit_named' }));
        const dialog = within(screen.getByRole('dialog'));
        expect(dialog.getByLabelText('immos.valeur')).toBeDisabled();
        expect(dialog.getByLabelText('immos.duration')).toBeDisabled();
        expect(dialog.getByLabelText('immos.asset_account')).toBeDisabled();
        await userEvent.clear(dialog.getByLabelText('immos.nom'));
        await userEvent.type(dialog.getByLabelText('immos.nom'), 'Ordinateur bureau');
        await userEvent.click(dialog.getByRole('button', { name: 'immos.save' }));
        await waitFor(() => expect(api.patch).toHaveBeenCalledWith('compta/immobilisations/1/', { nom: 'Ordinateur bureau' }));
    });

    it('requires confirmation before archiving and uses a non-destructive PATCH', async () => {
        mount();
        await userEvent.click(await screen.findByRole('button', { name: 'immos.archive_named' }));
        expect(api.patch).not.toHaveBeenCalled();
        await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'immos.confirm_archive' }));
        await waitFor(() => expect(api.patch).toHaveBeenCalledWith('compta/immobilisations/1/', { is_active: false }));
    });

    it('honours server read-only permissions even if local permissions are stale', async () => {
        vi.mocked(api.get).mockResolvedValue({ data: page(false) });
        mount();
        await screen.findByText('Ordinateur');
        expect(screen.queryByRole('button', { name: 'immos.create' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'immos.edit_named' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'immos.archive_named' })).not.toBeInTheDocument();
    });

    it('does not allow depreciation of archived assets', async () => {
        vi.mocked(api.get).mockResolvedValue({ data: { ...page(), results: [{ ...asset, is_active: false }] } });
        mount();
        expect(await screen.findByRole('button', { name: 'immos.doter' })).toBeDisabled();
        expect(screen.queryByRole('button', { name: 'immos.archive_named' })).not.toBeInTheDocument();
    });
});
