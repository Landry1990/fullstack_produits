import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useDevisLoader } from '../useDevisLoader'
import { safeStorage } from '../../utils/storage'

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => `${k} ${JSON.stringify(o ?? '')}` }),
}))
vi.mock('../../services/api', () => ({
    default: { post: vi.fn(async () => ({ data: [] })), get: vi.fn(async () => ({ data: [] })) },
}))
vi.mock('goey-toast', () => ({
    gooeyToast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), loading: vi.fn(), dismiss: vi.fn() },
}))

const makeHooks = () => ({
    clientsHook: {
        setSelectedClient: vi.fn(), setUseManualClient: vi.fn(), setManualClientName: vi.fn(),
        setSelectedAyantDroit: vi.fn(),
    },
    cart: { setLignesFacture: vi.fn() },
    ui: {
        setRemiseGlobale: vi.fn(), setRemiseMode: vi.fn(), setIsAvoirClient: vi.fn(),
        setIsModificationMode: vi.fn(), setModificationInvoiceId: vi.fn(),
        setModificationInvoiceStatus: vi.fn(), setOriginalTotalTtc: vi.fn(),
    },
})

const devisPayload = {
    id: 42, numero_facture: 'DEV-000001', status: 'PROF', client: 7, ayant_droit: null,
    client_name_override: null, remise: '0', is_avoir_client: false, total_ttc: '1000.00',
    produits: [
        { id: 1, produit: 99, produit_nom: 'TEST PRODUIT', quantity: 2, selling_price: '500.00', stock_lot: null, lot: null, date_expiration: null, treatment_duration_days: null },
    ],
}

describe('useDevisLoader', () => {
    beforeEach(() => {
        localStorage.clear()
        vi.clearAllMocks()
    })

    it('hydrate le panier et active le mode modification pour un devis PROF', async () => {
        const hooks = makeHooks()
        safeStorage.setItem('devis_to_load', JSON.stringify(devisPayload), 'local')
        renderHook(() => useDevisLoader(hooks as never))

        await waitFor(() => expect(hooks.cart.setLignesFacture).toHaveBeenCalled())
        expect(hooks.ui.setIsModificationMode).toHaveBeenCalledWith(true)
        expect(hooks.ui.setModificationInvoiceId).toHaveBeenCalledWith(42)
        expect(hooks.ui.setModificationInvoiceStatus).toHaveBeenCalledWith('PROF')
        expect(safeStorage.getItem('devis_to_load', 'local')).toBeNull()
    })

    it('ne restaure pas de lot pour un devis (AUTO/FEFO à la conversion)', async () => {
        const hooks = makeHooks()
        const payload = { ...devisPayload, produits: [{ ...devisPayload.produits[0], stock_lot: 123 }] }
        safeStorage.setItem('devis_to_load', JSON.stringify(payload), 'local')
        renderHook(() => useDevisLoader(hooks as never))

        await waitFor(() => expect(hooks.cart.setLignesFacture).toHaveBeenCalled())
        const lignes = hooks.cart.setLignesFacture.mock.calls[0][0]
        expect(lignes[0].lotId).toBeNull()
    })
})
