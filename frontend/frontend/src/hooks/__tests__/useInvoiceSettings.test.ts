import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '../../services/api';
import { useInvoiceSettings } from '../useInvoiceSettings';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), put: vi.fn() } }));
vi.mock('goey-toast', () => ({ gooeyToast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: translate }) }));
const translate = (key: string) => key;

const initialSettings = { id: 1, auto_print_ticket: true, ticket_copies: 1 };

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockResolvedValue({ data: initialSettings });
    vi.mocked(api.put).mockResolvedValue({ data: { ...initialSettings, ticket_copies: 2 } });
});

describe('useInvoiceSettings', () => {
    it('updates an already mounted checkout when settings change elsewhere', async () => {
        const checkout = renderHook(() => useInvoiceSettings());
        const settingsPage = renderHook(() => useInvoiceSettings());
        await waitFor(() => expect(checkout.result.current.settings?.ticket_copies).toBe(1));
        await waitFor(() => expect(settingsPage.result.current.loading).toBe(false));

        await act(async () => { await settingsPage.result.current.updateSettings({ ticket_copies: 2 }); });

        await waitFor(() => expect(checkout.result.current.settings?.ticket_copies).toBe(2));
    });

    it('ignores an older GET finishing after the new settings were saved', async () => {
        let resolveGet!: (response: { data: typeof initialSettings }) => void;
        vi.mocked(api.get).mockImplementationOnce(() => new Promise(resolve => { resolveGet = resolve; }));
        const { result } = renderHook(() => useInvoiceSettings());

        await act(async () => { await result.current.updateSettings({ ticket_copies: 2 }); });
        await act(async () => { resolveGet({ data: initialSettings }); });

        expect(result.current.settings?.ticket_copies).toBe(2);
    });

    it('bypasses previously cached HTTP settings', async () => {
        const { result } = renderHook(() => useInvoiceSettings());
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(api.get).toHaveBeenCalledWith('invoice-settings/', expect.objectContaining({
            params: { _fresh: expect.any(Number) },
        }));
    });

    it('refreshes settings when returning to a checkout tab', async () => {
        const { result } = renderHook(() => useInvoiceSettings());
        await waitFor(() => expect(result.current.settings?.ticket_copies).toBe(1));
        vi.mocked(api.get).mockResolvedValue({ data: { ...initialSettings, ticket_copies: 2 } });

        act(() => { window.dispatchEvent(new Event('focus')); });

        await waitFor(() => expect(result.current.settings?.ticket_copies).toBe(2));
    });
});
