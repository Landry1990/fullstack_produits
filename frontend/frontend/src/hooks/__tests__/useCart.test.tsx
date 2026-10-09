
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useCart } from '../useCart'
import { useAuth } from '../../context/AuthContext'
import { safeStorage } from '../../utils/storage'
import { generateUUID } from '../../utils/uuid'
import api from '../../services/api'

// 1. Mocks
vi.mock('../../context/AuthContext', () => ({
    useAuth: vi.fn()
}))

vi.mock('../../services/api', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
    }
}))

vi.mock('goey-toast', () => ({
    gooeyToast: Object.assign(vi.fn(), {
        error: vi.fn(),
        success: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
    }),
    GooeyToaster: () => null
}))

vi.mock('../../utils/storage', () => ({
    safeStorage: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn()
    }
}))

vi.mock('react-hot-toast', () => ({
    toast: {
        error: vi.fn(),
        success: vi.fn()
    }
}))

vi.mock('axios', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
        create: vi.fn(() => ({
            get: vi.fn(),
            post: vi.fn(),
            put: vi.fn(),
            delete: vi.fn(),
            interceptors: {
                request: { use: vi.fn(), eject: vi.fn() },
                response: { use: vi.fn(), eject: vi.fn() }
            }
        }))
    }
}))

describe('useCart Hook - Persistance Multi-Utilisateur', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // Reset localStorage mock behavior
        const store: Record<string, string> = {}
        vi.mocked(safeStorage.getItem).mockImplementation((key) => store[key] || null)
        vi.mocked(safeStorage.setItem).mockImplementation((key, value) => { store[key] = value })
        vi.mocked(safeStorage.removeItem).mockImplementation((key) => { delete store[key] })
    })

    it('devrait être vide initialement sans utilisateur', () => {
        vi.mocked(useAuth).mockReturnValue({ user: null } as unknown)
        const { result } = renderHook(() => useCart())
        expect(result.current.lignesFacture).toEqual([])
    })

    it('devrait hydrater le panier depuis la clé spécifique à l\'utilisateur', () => {
        const userId = 123
        const mockCart = [{ produit: { id: 1, name: 'Test' }, quantite: 1, total_ligne: 100 }]
        
        // Simuler des données existantes pour cet utilisateur
        vi.mocked(safeStorage.getItem).mockImplementation((key) => {
            if (key === `activeCartLignes_${userId}`) return JSON.stringify(mockCart)
            return null
        })
        
        vi.mocked(useAuth).mockReturnValue({ user: { id: userId } } as unknown)
        
        const { result } = renderHook(() => useCart())
        
        // L'hydratation se fait dans un useEffect, donc on attend le prochain cycle
        expect(result.current.lignesFacture).toEqual(mockCart)
        expect(safeStorage.getItem).toHaveBeenCalledWith(`activeCartLignes_${userId}`, 'local')
    })

    it('devrait isoler les paniers entre deux utilisateurs différents', () => {
        // Utilisateur 1
        const userId1 = 1
        const cart1 = [{ produit: { id: 10, name: 'Prod 1' }, quantite: 1 }]
        
        // Utilisateur 2
        const userId2 = 2
        const cart2 = [{ produit: { id: 20, name: 'Prod 2' }, quantite: 5 }]

        const store: Record<string, string> = {
            [`activeCartLignes_${userId1}`]: JSON.stringify(cart1),
            [`activeCartLignes_${userId2}`]: JSON.stringify(cart2)
        }

        vi.mocked(safeStorage.getItem).mockImplementation((key) => store[key] || null)

        // Test avec User 1
        vi.mocked(useAuth).mockReturnValue({ user: { id: userId1 } } as unknown)
        const { result: res1 } = renderHook(() => useCart())
        expect(res1.current.lignesFacture).toEqual(cart1)

        // Test avec User 2
        vi.mocked(useAuth).mockReturnValue({ user: { id: userId2 } } as unknown)
        const { result: res2 } = renderHook(() => useCart())
        expect(res2.current.lignesFacture).toEqual(cart2)
        
        expect(res2.current.lignesFacture).not.toEqual(res1.current.lignesFacture)
    })

    it('devrait nettoyer l\'ancienne clé globale lors de la première connexion', () => {
        vi.mocked(useAuth).mockReturnValue({ user: { id: 99 } } as unknown)
        
        renderHook(() => useCart())
        
        expect(safeStorage.removeItem).toHaveBeenCalledWith('activeCartLignes', 'local')
    })

    it('devrait sauvegarder les changements dans la clé spécifique utilisateur', () => {
        const userId = 456
        vi.mocked(useAuth).mockReturnValue({ user: { id: userId } } as unknown)
        
        const { result } = renderHook(() => useCart())

        // Simuler l'ajout d'un produit (on utilise setLignesFacture directement pour simplifier le test unitaire du hook)
        act(() => {
            result.current.setLignesFacture([{ produit: { id: 1 } } as unknown])
        })

        expect(safeStorage.setItem).toHaveBeenCalledWith(
            `activeCartLignes_${userId}`,
            expect.stringContaining('"id":1'),
            'local'
        )
    })

    it('devrait gerer le multi-lot : 2 allocations creent 2 lignes distinctes avec lineId differents', () => {
        const userId = 789
        vi.mocked(useAuth).mockReturnValue({ user: { id: userId } } as unknown)

        const { result } = renderHook(() => useCart())

        const produit = { id: 5, name: 'Cifran 500mg', selling_price: '7000', cost_price: '3000', tva: 0 }

        // Simule le comportement de handleLotSelect multi-lot : une ligne par allocation
        const lineId1 = generateUUID()
        const lineId2 = generateUUID()
        act(() => {
            result.current.setLignesFacture([
                {
                    lineId: lineId1,
                    produit,
                    quantite: 3,
                    prix_unitaire: '5100',
                    remise_produit: '0',
                    total_ligne: 15300,
                    lotId: 'lot-1',
                    lotText: 'LOT-A',
                    lotExpiration: '2025-06-01',
                    lotSellingPrice: '5100',
                    lotAllocations: [{ lotId: 'lot-1', lotText: 'LOT-A', lotExpiration: '2025-06-01', quantity: 3, sellingPrice: '5100' }],
                    lotMaxQuantity: 3,
                } as unknown,
                {
                    lineId: lineId2,
                    produit,
                    quantite: 2,
                    prix_unitaire: '7000',
                    remise_produit: '0',
                    total_ligne: 14000,
                    lotId: 'lot-2',
                    lotText: 'LOT-B',
                    lotExpiration: '2026-06-01',
                    lotSellingPrice: '7000',
                    lotAllocations: [{ lotId: 'lot-2', lotText: 'LOT-B', lotExpiration: '2026-06-01', quantity: 2, sellingPrice: '7000' }],
                    lotMaxQuantity: 10,
                } as unknown,
            ])
        })

        const lignes = result.current.lignesFacture
        expect(lignes).toHaveLength(2)
        // lineId distincts
        expect(lignes[0].lineId).not.toBe(lignes[1].lineId)
        expect(lignes[0].lineId).toBe(lineId1)
        expect(lignes[1].lineId).toBe(lineId2)
        // Chaque ligne a son propre lotId
        expect(lignes[0].lotId).toBe('lot-1')
        expect(lignes[1].lotId).toBe('lot-2')
        // Quantites et prix unitaires distincts
        expect(lignes[0].quantite).toBe(3)
        expect(lignes[1].quantite).toBe(2)
        expect(lignes[0].prix_unitaire).toBe('5100')
        expect(lignes[1].prix_unitaire).toBe('7000')
        // cartStats reflete les 2 lignes
        expect(result.current.cartStats.totalLines).toBe(2)
        expect(result.current.cartStats.totalQty).toBe(5)
    })
})

describe('useCart - addProduit : fusion intelligente des scans répétés', () => {
    const produit = { id: 5, name: 'Cifran 500mg', selling_price: '7000', cost_price: '3000', stock: 20, tva: 0 }
    const lotA = { id: 11, lot: 'LOT-A', date_expiration: '2030-01-01', quantity_remaining: 2, selling_price: '5100' }
    const lotB = { id: 12, lot: 'LOT-B', date_expiration: '2031-01-01', quantity_remaining: 10, selling_price: '5200' }

    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(useAuth).mockReturnValue({ user: { id: 1 } } as unknown)
        // Store localStorage frais par test — sinon le panier persisté du test
        // précédent est réhydraté au renderHook (clé activeCartLignes_1).
        const store: Record<string, string> = {}
        vi.mocked(safeStorage.getItem).mockImplementation((key) => store[key] || null)
        vi.mocked(safeStorage.setItem).mockImplementation((key, value) => { store[key] = value })
        vi.mocked(safeStorage.removeItem).mockImplementation((key) => { delete store[key] })
    })

    const mockApiGet = (fullProduit: unknown, lots: unknown[] = []) => {
        vi.mocked(api.get).mockImplementation((url: string) => {
            if (url.startsWith('produits/')) return Promise.resolve({ data: fullProduit })
            if (url.startsWith('stock-lots/')) return Promise.resolve({ data: lots })
            return Promise.resolve({ data: {} })
        })
    }

    it('2 scans du même produit à prix par lot → 1 seule ligne, quantité 2, même lot', async () => {
        mockApiGet(produit, [lotA, lotB])
        const { result } = renderHook(() => useCart())

        await act(async () => { await result.current.addProduit(produit as never) })
        await act(async () => { await result.current.addProduit(produit as never) })

        const lignes = result.current.lignesFacture
        expect(lignes).toHaveLength(1)
        expect(lignes[0].quantite).toBe(2)
        expect(lignes[0].lotId).toBe('11')
        expect(lignes[0].lotAllocations).toEqual([
            { lotId: 11, lotText: 'LOT-A', lotExpiration: '2030-01-01', quantity: 2, sellingPrice: '5100' }
        ])
    })

    it('au-delà de la capacité du 1er lot FEFO, le scan bascule sur le lot suivant', async () => {
        mockApiGet(produit, [lotA, lotB])
        const { result } = renderHook(() => useCart())

        // lotA capacité 2 : scan1→A×1, scan2→A×2, scan3→B×1
        await act(async () => { await result.current.addProduit(produit as never) })
        await act(async () => { await result.current.addProduit(produit as never) })
        await act(async () => { await result.current.addProduit(produit as never) })

        const lignes = result.current.lignesFacture
        expect(lignes).toHaveLength(2)
        expect(lignes[0].lotId).toBe('11')
        expect(lignes[0].quantite).toBe(2)
        expect(lignes[1].lotId).toBe('12')
        expect(lignes[1].quantite).toBe(1)
        expect(lignes[1].prix_unitaire).toBe('5200')

        // scan4 → le lot B a encore de la capacité → fusion dans sa ligne
        await act(async () => { await result.current.addProduit(produit as never) })
        const lignes2 = result.current.lignesFacture
        expect(lignes2).toHaveLength(2)
        expect(lignes2[1].lotId).toBe('12')
        expect(lignes2[1].quantite).toBe(2)
        expect(lignes2[1].lotAllocations?.[0].quantity).toBe(2)
    })

    it('produit sans prix par lot : 2 scans → 1 ligne, quantité 2', async () => {
        // Des lots existent mais aucun n'a de selling_price → pas d'allocation auto
        const lotsSansPrix = [{ id: 20, lot: 'L1', date_expiration: '2030-01-01', quantity_remaining: 5, selling_price: null }]
        mockApiGet(produit, lotsSansPrix)
        const { result } = renderHook(() => useCart())

        await act(async () => { await result.current.addProduit(produit as never) })
        await act(async () => { await result.current.addProduit(produit as never) })

        const lignes = result.current.lignesFacture
        expect(lignes).toHaveLength(1)
        expect(lignes[0].quantite).toBe(2)
        expect(lignes[0].lotId).toBeNull()
    })

    it('produit sans prix par lot déjà au panier sur un lot manuel → incrémente cette ligne', async () => {
        mockApiGet(produit, [])
        const { result } = renderHook(() => useCart())

        act(() => {
            result.current.setLignesFacture([{
                lineId: 'line-manual',
                produit,
                quantite: 1,
                prix_unitaire: '6000',
                remise_produit: '0',
                total_ligne: 6000,
                lotId: '99',
                lotText: 'LOT-MANUEL',
                lotExpiration: null,
                lotSellingPrice: '6000',
                lotAllocations: [{ lotId: '99', lotText: 'LOT-MANUEL', quantity: 1, sellingPrice: '6000' }],
            } as unknown])
        })

        await act(async () => { await result.current.addProduit(produit as never) })

        const lignes = result.current.lignesFacture
        expect(lignes).toHaveLength(1)
        expect(lignes[0].lineId).toBe('line-manual')
        expect(lignes[0].quantite).toBe(2)
        expect(lignes[0].lotId).toBe('99')
        expect(lignes[0].lotAllocations?.[0].quantity).toBe(2)
        // Prix du lot manuel conservé
        expect(lignes[0].prix_unitaire).toBe('6000')
    })

    it('ne fusionne pas avec une ligne promis du même produit', async () => {
        mockApiGet(produit, [])
        const { result } = renderHook(() => useCart())

        act(() => {
            result.current.setLignesFacture([{
                lineId: 'line-promis',
                produit,
                quantite: 5,
                prix_unitaire: '7000',
                remise_produit: '0',
                total_ligne: 35000,
                lotId: null,
                isPromis: true,
                promisQuantity: 3,
            } as unknown])
        })

        await act(async () => { await result.current.addProduit(produit as never) })

        const lignes = result.current.lignesFacture
        expect(lignes).toHaveLength(2)
        expect(lignes[0].lineId).toBe('line-promis')
        expect(lignes[0].quantite).toBe(5)
        expect(lignes[1].quantite).toBe(1)
    })
})
