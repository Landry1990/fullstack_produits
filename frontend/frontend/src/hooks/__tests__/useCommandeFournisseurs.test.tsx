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

    it('should correctly separate divers and non-divers in a mixed list with interleaved entries', async () => {
        const mockFournisseurs = [
            { id: 1, name: 'Normal A', is_divers: false },
            { id: 2, name: 'DIVERS 1', is_divers: true },
            { id: 3, name: 'Normal B', is_divers: false },
            { id: 4, name: 'DIVERS 2', is_divers: true },
            { id: 5, name: 'Normal C', is_divers: false },
        ]

        vi.mocked(api.get).mockResolvedValue({ data: mockFournisseurs })

        const { result } = renderHook(() => useCommandeFournisseurs(), { wrapper })

        await waitFor(() => {
            expect(result.current.data).toHaveLength(5)
        })

        // Filter divers and non-divers (simulating useCommandesState filtering logic)
        const allData = result.current.data || []
        const nonDivers = allData.filter(f => !f.is_divers)
        const divers = allData.filter(f => f.is_divers)

        // Verify counts
        expect(nonDivers).toHaveLength(3)
        expect(divers).toHaveLength(2)

        // Verify all non-divers have is_divers=false
        expect(nonDivers.every(f => !f.is_divers)).toBe(true)
        // Verify all divers have is_divers=true
        expect(divers.every(f => f.is_divers)).toBe(true)

        // Verify exact IDs to ensure filtering preserves order
        expect(nonDivers.map(f => f.id)).toEqual([1, 3, 5])
        expect(divers.map(f => f.id)).toEqual([2, 4])

        // Verify combined list equals original (no data loss)
        expect([...nonDivers, ...divers].sort((a, b) => a.id - b.id)).toEqual(allData)
    })

    it('should return all fournisseurs without client-side pagination truncation', async () => {
        // Simulate a large dataset (50 items) to verify no pagination is applied
        const largeList = Array.from({ length: 50 }, (_, i) => ({
            id: i + 1,
            name: `Fournisseur ${i + 1}`,
            is_divers: i % 10 === 0,
        }))

        vi.mocked(api.get).mockResolvedValue({ data: largeList })

        const { result } = renderHook(() => useCommandeFournisseurs(), { wrapper })

        await waitFor(() => {
            expect(result.current.data).toHaveLength(50)
        })

        // Verify all items are returned (no truncation)
        const data = result.current.data || []
        expect(data[0].id).toBe(1)
        expect(data[49].id).toBe(50)

        // Verify the API was called without pagination params
        expect(api.get).toHaveBeenCalledWith('fournisseurs/')

        // Verify divers/non-divers counts in the large list
        const diversCount = data.filter(f => f.is_divers).length
        const nonDiversCount = data.filter(f => !f.is_divers).length
        // Every 10th item (0, 10, 20, 30, 40) is divers = 5 items
        expect(diversCount).toBe(5)
        expect(nonDiversCount).toBe(45)
    })
})
