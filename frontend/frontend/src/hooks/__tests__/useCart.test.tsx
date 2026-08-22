
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useCart } from '../useCart'
import { useAuth } from '../../context/AuthContext'
import { safeStorage } from '../../utils/storage'
import { generateUUID } from '../../utils/uuid'

// 1. Mocks
vi.mock('../../context/AuthContext', () => ({
    useAuth: vi.fn()
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
