import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useCommandeFournisseurs } from '../useCommandes'
import api from '../../services/api'

// Mock the API
vi.mock('../../services/api', () => ({
    default: {
        get: vi.fn()
    }
}))

// Mock React Query
const createTestQueryClient = () => new QueryClient({
    defaultOptions: {
        queries: {
            retry: false,
        },
    },
})

const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={createTestQueryClient()}>
        {children}
    </QueryClientProvider>
)

describe('useCommandeFournisseurs', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('should fetch all fournisseurs', async () => {
        const mockFournisseurs = [
            { id: 1, name: 'Fournisseur A', is_divers: false },
            { id: 2, name: 'Fournisseur B', is_divers: false },
            { id: 3, name: 'DIVERS', is_divers: true }
        ]

        vi.mocked(api.get).mockResolvedValue({ data: mockFournisseurs })

        const { result } = renderHook(() => useCommandeFournisseurs(), { wrapper })

        await waitFor(() => {
            expect(result.current.data).toHaveLength(3)
        })

        expect(result.current.data).toEqual(mockFournisseurs)
        expect(api.get).toHaveBeenCalledWith('fournisseurs/')
    })

    it('should handle paginated response', async () => {
        const mockResponse = {
            results: [
                { id: 1, name: 'Fournisseur A', is_divers: false },
                { id: 2, name: 'DIVERS', is_divers: true }
            ],
            count: 2
        }

        vi.mocked(api.get).mockResolvedValue({ data: mockResponse })

        const { result } = renderHook(() => useCommandeFournisseurs(), { wrapper })

        await waitFor(() => {
            expect(result.current.data).toHaveLength(2)
        })

        expect(result.current.data?.[0].name).toBe('Fournisseur A')
    })

    it('should filter divers vs non-divers correctly', async () => {
        const mockFournisseurs = [
            { id: 1, name: 'Fournisseur Normal', is_divers: false },
            { id: 2, name: 'Fournisseur B', is_divers: false },
            { id: 3, name: 'DIVERS', is_divers: true },
            { id: 4, name: 'Fournisseur Divers 2', is_divers: true }
        ]

        vi.mocked(api.get).mockResolvedValue({ data: mockFournisseurs })

        const { result } = renderHook(() => useCommandeFournisseurs(), { wrapper })

        await waitFor(() => {
            expect(result.current.data).toHaveLength(4)
        })

        // Test filtering logic that would be used in useCommandesState
        const nonDivers = result.current.data?.filter(f => !f.is_divers) || []
        const divers = result.current.data?.filter(f => f.is_divers) || []

        expect(nonDivers).toHaveLength(2)
        expect(divers).toHaveLength(2)
        
        expect(nonDivers.every(f => !f.is_divers)).toBe(true)
        expect(divers.every(f => f.is_divers)).toBe(true)
    })

    it('should handle empty response', async () => {
        vi.mocked(api.get).mockResolvedValue({ data: [] })

        const { result } = renderHook(() => useCommandeFournisseurs(), { wrapper })

        await waitFor(() => {
            expect(result.current.data).toEqual([])
        })
    })

    it('should handle error gracefully', async () => {
        vi.mocked(api.get).mockRejectedValue(new Error('Network error'))

        const { result } = renderHook(() => useCommandeFournisseurs(), { wrapper })

        await waitFor(() => {
            expect(result.current.error).toBeDefined()
        })
    })
})
