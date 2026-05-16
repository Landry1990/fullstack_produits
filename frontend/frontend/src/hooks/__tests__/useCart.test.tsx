
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useCart } from '../useCart'
import { useAuth } from '../../context/AuthContext'
import { safeStorage } from '../../utils/storage'

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
        vi.mocked(useAuth).mockReturnValue({ user: null } as any)
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
        
        vi.mocked(useAuth).mockReturnValue({ user: { id: userId } } as any)
        
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
        vi.mocked(useAuth).mockReturnValue({ user: { id: userId1 } } as any)
        const { result: res1 } = renderHook(() => useCart())
        expect(res1.current.lignesFacture).toEqual(cart1)

        // Test avec User 2
        vi.mocked(useAuth).mockReturnValue({ user: { id: userId2 } } as any)
        const { result: res2 } = renderHook(() => useCart())
        expect(res2.current.lignesFacture).toEqual(cart2)
        
        expect(res2.current.lignesFacture).not.toEqual(res1.current.lignesFacture)
    })

    it('devrait nettoyer l\'ancienne clé globale lors de la première connexion', () => {
        vi.mocked(useAuth).mockReturnValue({ user: { id: 99 } } as any)
        
        renderHook(() => useCart())
        
        expect(safeStorage.removeItem).toHaveBeenCalledWith('activeCartLignes', 'local')
    })

    it('devrait sauvegarder les changements dans la clé spécifique utilisateur', () => {
        const userId = 456
        vi.mocked(useAuth).mockReturnValue({ user: { id: userId } } as any)
        
        const { result } = renderHook(() => useCart())

        // Simuler l'ajout d'un produit (on utilise setLignesFacture directement pour simplifier le test unitaire du hook)
        act(() => {
            result.current.setLignesFacture([{ produit: { id: 1 } } as any])
        })

        expect(safeStorage.setItem).toHaveBeenCalledWith(
            `activeCartLignes_${userId}`,
            expect.stringContaining('"id":1'),
            'local'
        )
    })
})
