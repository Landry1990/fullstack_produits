import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import axios from 'axios'
import { safeStorage } from '../../utils/storage'

vi.unmock('../../context/PosteCaisseModeContext')
// Le provider réel importe useAuth depuis './AuthContext' — s'assurer que le
// mock global s'applique aussi à cet import (le unmock ci-dessus recharge la
// chaîne d'imports du contexte).
vi.mock('../../context/AuthContext', () => ({
    useAuth: () => ({
        user: { id: 1, username: 'testuser', is_superuser: true, profile: { max_discount_rate: 100 } },
        isAuthenticated: true,
        loading: false,
        logout: vi.fn(),
    }),
}))
import { PosteCaisseModeProvider, usePosteCaisseMode } from '../../context/PosteCaisseModeContext'
import { SidebarProvider } from '../../context/SidebarContext'
import { ConfirmProvider } from '../../hooks/useConfirm'
import { useFacturationState } from '../useFacturationState'

const mockedAxios = vi.mocked(axios, true)

const devisPayload = {
    id: 99,
    numero_facture: 'DEV-000099',
    status: 'PROF',
    client: 7,
    remise: '0',
    produits: [
        {
            id: 1,
            produit: { id: 11, name: 'PROD A', stock: 50, selling_price: '2500' },
            quantity: 2,
            selling_price: '2500',
            produit_nom: 'PROD A',
        },
    ],
}

const activatedPoste = {
    id: 5,
    nom: 'POS 1',
    est_actif: true,
    caisse: null,
    vendeur: 1,
    vendeur_name: 'testuser',
    mode_pos: true,
    fond_de_caisse: null,
    date_ouverture: null,
    date_fermeture: null,
    montant_total_encaisse: null,
    caisse_nom: null,
    caisse_code: null,
    created_at: '',
    updated_at: '',
}

function wrapper({ children }: { children: React.ReactNode }) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return (
        <QueryClientProvider client={qc}>
            <MemoryRouter>
                <SidebarProvider>
                    <ConfirmProvider>
                        <PosteCaisseModeProvider>{children}</PosteCaisseModeProvider>
                    </ConfirmProvider>
                </SidebarProvider>
            </MemoryRouter>
        </QueryClientProvider>
    )
}

describe('Devis → poste open : le panier ne doit pas être effacé', () => {
    beforeEach(() => {
        window.localStorage.clear()
        window.sessionStorage.clear()
        vi.clearAllMocks()

        mockedAxios.get.mockImplementation((url: string) => {
            if (url.includes('clinical')) return Promise.resolve({ data: { alerts: [] } })
            return Promise.resolve({ data: [] })
        })
        mockedAxios.post.mockImplementation((url: string) => {
            if (url.includes('postes-ventes') && url.includes('activer')) {
                return Promise.resolve({ data: activatedPoste })
            }
            if (url.includes('clinical')) return Promise.resolve({ data: { alerts: [] } })
            return Promise.resolve({ data: {} })
        })
    })

    it('attend l\'ouverture du poste pour hydrater le devis', async () => {
        safeStorage.setItem('devis_to_load', JSON.stringify(devisPayload), 'local')

        const { result } = renderHook(() => {
            const facturation = useFacturationState()
            const posteCtx = usePosteCaisseMode()
            return { facturation, posteCtx }
        }, { wrapper })

        // 1. Sans poste actif (modal forcé ouvert), le devis NE s'hydrate PAS
        //    encore — sinon le flux d'ouverture l'écraserait.
        await act(async () => { await new Promise(r => setTimeout(r, 300)) })
        expect(result.current.facturation.lignesFacture).toHaveLength(0)
        // devis_to_load conservé en stockage tant que le poste n'est pas actif
        expect(safeStorage.getItem('devis_to_load', 'local')).not.toBeNull()

        // 2. Ouverture du point de vente (ce que fait le modal forcé)
        await act(async () => {
            await result.current.posteCtx.openPoste(5)
        })

        // 3. Le devis s'hydrate APRÈS l'ouverture → rien ne peut l'écraser
        await waitFor(() => expect(result.current.facturation.lignesFacture).toHaveLength(1), { timeout: 5000 })
        expect(result.current.facturation.ui.isModificationMode).toBe(true)
        expect(result.current.facturation.ui.modificationInvoiceId).toBe(99)
    })
})
