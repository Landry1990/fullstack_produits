import { useState, useRef, useCallback } from 'react'
import { useDebounce } from 'use-debounce'
import axios from 'axios'
import { useQuery } from '@tanstack/react-query'
import type { ProduitModel } from '../types'

interface UseProductSearchOptions {
    minSearchLength?: number
    debounceMs?: number
    autoLoad?: boolean
    /** Callback when a barcode scan is detected and matches exactly one product */
    onBarcodeMatch?: (product: ProduitModel) => void
    /** Minimum length for barcode detection (default: 7 for CIP codes) */
    minBarcodeLength?: number
}

interface UseProductSearchReturn {
    produits: ProduitModel[]
    loading: boolean
    error: Error | null
    searchQuery: string
    setSearchQuery: (query: string) => void
    refetch: () => void
    /** True if the last search was detected as a barcode scan */
    wasBarcodeScanned: boolean
}

/**
 * Custom hook for product search with debouncing and API integration
 * Optimized for large product catalogs (6000-7000+ products)
 * 
 * Enhanced with barcode scanner detection:
 * - Detects rapid input (< 100ms between chars) as scan
 * - Auto-matches CIP codes and triggers callback
 * 
 * @param options Configuration options
 * @returns Search state and control functions
 */
export function useProductSearch(options: UseProductSearchOptions = {}): UseProductSearchReturn {
    const {
        minSearchLength = 2,
        debounceMs = 200,
        autoLoad = false,
        onBarcodeMatch,
        minBarcodeLength = 7
    } = options

    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || ''

    const [searchQuery, setSearchQuery] = useState('')
    const [debouncedSearch] = useDebounce(searchQuery, debounceMs)
    const [wasBarcodeScanned, setWasBarcodeScanned] = useState(false)

    // Barcode scan detection
    const lastInputTime = useRef<number>(0)
    const inputSpeedBuffer = useRef<number[]>([])
    const scanThreshold = 50 // ms between chars for scan detection

    // Detect if input looks like a barcode scan (rapid numeric input)
    const detectBarcodeInput = useCallback((query: string) => {
        const now = Date.now()
        const timeSinceLastInput = now - lastInputTime.current
        lastInputTime.current = now

        // Track input speed
        if (timeSinceLastInput < 200) {
            inputSpeedBuffer.current.push(timeSinceLastInput)
        } else {
            inputSpeedBuffer.current = []
        }

        // Detect scan: rapid input of numeric characters
        const isNumeric = /^\d+$/.test(query)
        const isLongEnough = query.length >= minBarcodeLength
        const avgSpeed = inputSpeedBuffer.current.length > 3
            ? inputSpeedBuffer.current.reduce((a, b) => a + b, 0) / inputSpeedBuffer.current.length
            : 999

        return isNumeric && isLongEnough && avgSpeed < scanThreshold
    }, [minBarcodeLength])

    // Enhanced setSearchQuery that detects barcode scans
    const handleSetSearchQuery = useCallback((query: string) => {
        const looksLikeBarcode = detectBarcodeInput(query)
        setWasBarcodeScanned(looksLikeBarcode)
        setSearchQuery(query)
    }, [detectBarcodeInput])

    // Fetch function for React Query
    const fetchProducts = async (search: string, auto: boolean): Promise<ProduitModel[]> => {
        // If autoLoad is false and search is empty/short, don't fetch (handled by enabled query option normally, but double check)
        if (!auto && (!search || search.length < minSearchLength)) {
            return []
        }

        let endpoint = apiBaseUrl
            ? `${apiBaseUrl}/api/produits/`
            : '/api/produits/'

        if (search) {
            endpoint += `?search=${encodeURIComponent(search)}`
        }

        const response = await axios.get(endpoint)
        const produitsData = response.data as any // Temporary cast to handle varied response structure safely
        const results = Array.isArray(produitsData)
            ? produitsData
            : (produitsData.results || [])

        return results
    }

    // Determine if query should run
    const shouldFetch = autoLoad || (!!debouncedSearch && debouncedSearch.length >= minSearchLength)

    const { data: produits = [], isLoading: loading, error, refetch } = useQuery({
        queryKey: ['products', 'search', debouncedSearch, autoLoad],
        queryFn: () => fetchProducts(debouncedSearch, autoLoad),
        enabled: shouldFetch,
        staleTime: 1000 * 60 * 5, // Cache results for 5 minutes
        placeholderData: (previousData) => previousData, // Keep showing previous results while fetching new ones
    })

    // Handle Barcode matching effect
    // We use a separate effect to trigger the callback when data arrives
    // This replaces the logic inside the previous fetch function
    const hasHandledBarcode = useRef<string>('')

    if (onBarcodeMatch && wasBarcodeScanned && !loading && produits.length === 1) {
        // Prevent duplicate firing for the same search query
        if (hasHandledBarcode.current !== debouncedSearch) {
            const product = produits[0]
            const isNumericSearch = /^\d+$/.test(debouncedSearch)

            if (isNumericSearch) {
                // Verify exact CIP match
                const cipMatch =
                    product.cip1 === debouncedSearch ||
                    product.cip2 === debouncedSearch ||
                    product.cip3 === debouncedSearch

                if (cipMatch) {
                    hasHandledBarcode.current = debouncedSearch;
                    // setTimeout to avoid update-during-render warning if callback updates state synchronously
                    setTimeout(() => {
                        onBarcodeMatch(product)
                        setSearchQuery('')
                        setWasBarcodeScanned(false)
                    }, 0)
                }
            }
        }
    } else if (debouncedSearch !== hasHandledBarcode.current) {
        // Reset when search changes
        hasHandledBarcode.current = ''
    }

    return {
        produits,
        loading,
        error,
        searchQuery,
        setSearchQuery: handleSetSearchQuery,
        refetch,
        wasBarcodeScanned
    }
}

