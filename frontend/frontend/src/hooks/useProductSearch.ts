import { useState, useEffect, useRef, useCallback } from 'react'
import { useDebounce } from 'use-debounce'
import axios from 'axios'
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
    error: string | null
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

    const [produits, setProduits] = useState<ProduitModel[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
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

    const refetch = () => {
        setSearchQuery(prev => prev)
    }

    useEffect(() => {
        const searchProducts = async () => {
            // If autoLoad is false and search is empty, don't fetch
            if (!autoLoad && (!debouncedSearch || debouncedSearch.length < minSearchLength)) {
                setProduits([])
                setLoading(false)
                setError(null)
                return
            }

            // If autoLoad is true and search is empty, load all products
            const shouldFetchAll = autoLoad && !debouncedSearch

            setLoading(true)
            setError(null)

            try {
                let endpoint = apiBaseUrl
                    ? `${apiBaseUrl}/api/produits/`
                    : '/api/produits/'

                if (debouncedSearch) {
                    endpoint += `?search=${encodeURIComponent(debouncedSearch)}`
                }

                const response = await axios.get(endpoint)
                const produitsData: any = response.data
                const results = Array.isArray(produitsData)
                    ? produitsData
                    : (produitsData.results || [])

                setProduits(results)

                // Barcode auto-match: if exactly one product and looks like CIP scan
                const isNumericSearch = /^\d+$/.test(debouncedSearch)
                if (onBarcodeMatch && isNumericSearch && results.length === 1) {
                    const product = results[0]
                    // Verify exact CIP match
                    const cipMatch =
                        product.cip1 === debouncedSearch ||
                        product.cip2 === debouncedSearch ||
                        product.cip3 === debouncedSearch

                    if (cipMatch) {
                        onBarcodeMatch(product)
                        setSearchQuery('') // Clear after match
                        setProduits([])
                    }
                }
            } catch (err) {
                console.error('Erreur recherche produits:', err)
                setError('Erreur lors de la recherche des produits')
                setProduits([])
            } finally {
                setLoading(false)
            }
        }

        searchProducts()
    }, [debouncedSearch, apiBaseUrl, autoLoad, minSearchLength, onBarcodeMatch])

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

