import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { useDebounce } from 'use-debounce'
import { gooeyToast } from 'goey-toast'
import i18n from '../i18n'
import api from '../services/api'
import { useQuery } from '@tanstack/react-query'
import type { ProduitModel, PaginatedResponse } from '../types'
import { useProductSearchIndex } from './useProductSearchIndex'
import { normalizeCip } from './useProductSearchIndex'
import { parseGS1Datamatrix, isDatamatrix } from '../utils/gs1Parser'

interface UseProductSearchOptions {
    minSearchLength?: number
    debounceMs?: number
    autoLoad?: boolean
    pageSize?: number
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
    /** True if the last search was a DataMatrix 2D scan */
    wasDatamatrixScanned: boolean
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
        pageSize = 20,
        onBarcodeMatch,
        minBarcodeLength = 7
    } = options

    const [searchQuery, setSearchQuery] = useState('')
    const [wasBarcodeScanned, setWasBarcodeScanned] = useState(false)
    const [wasDatamatrixScanned, setWasDatamatrixScanned] = useState(false)

    // Index de recherche en mémoire — précharge tous les produits une fois
    const { search: searchInIndex, isReady: indexReady, isLoading: indexLoading } = useProductSearchIndex()

    // Debounce court quand l'index local est prêt (recherche instantanée < 1ms)
    // Debounce normal seulement pour le fallback API
    const effectiveDebounce = indexReady ? 50 : debounceMs
    const [debouncedSearch] = useDebounce(searchQuery, effectiveDebounce)

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
        let cleanedQuery = query

        // Si c'est un DataMatrix, extraire le CIP pour la recherche
        if (isDatamatrix(query)) {
            const parsed = parseGS1Datamatrix(query)
            if (parsed.cip) {
                cleanedQuery = normalizeCip(parsed.cip)
            }
        }

        const looksLikeBarcode = detectBarcodeInput(cleanedQuery)
        setWasDatamatrixScanned(isDatamatrix(query))
        setWasBarcodeScanned(looksLikeBarcode || cleanedQuery !== query)
        setSearchQuery(cleanedQuery)
    }, [detectBarcodeInput])

    // Reset datamatrix flag when search changes
    useEffect(() => {
        if (!debouncedSearch) {
            setWasDatamatrixScanned(false)
            setWasBarcodeScanned(false)
        }
    }, [debouncedSearch])

    // Notify user when a DataMatrix scan is detected
    const lastNotifiedCip = useRef<string | null>(null)
    useEffect(() => {
        if (wasDatamatrixScanned && debouncedSearch && debouncedSearch.length >= 7 && lastNotifiedCip.current !== debouncedSearch) {
            lastNotifiedCip.current = debouncedSearch
            gooeyToast.info(
                i18n.t('common:messages.datamatrix_detected', { cip: debouncedSearch, defaultValue: `Scan DataMatrix : ${debouncedSearch}` }),
                { duration: 1500, id: 'datamatrix-scan' }
            )
        }
    }, [wasDatamatrixScanned, debouncedSearch])
    const localResults = useMemo(() => {
        if (!indexReady || !debouncedSearch || debouncedSearch.length < minSearchLength) {
            return null // null = pas de recherche locale, fallback vers API
        }
        return searchInIndex(debouncedSearch, pageSize)
    }, [indexReady, debouncedSearch, minSearchLength, searchInIndex, pageSize])

    // Fetch function for React Query — utilisé uniquement si l'index n'est pas prêt
    const fetchProducts = async (search: string, auto: boolean): Promise<ProduitModel[]> => {
        if (!auto && (!search || search.length < minSearchLength)) {
            return []
        }

        const params = search ? { search, page_size: pageSize } : { page_size: pageSize }
        const response = await api.get('produits/', { params })
        const produitsData = response.data as ProduitModel[] | PaginatedResponse<ProduitModel>
        return Array.isArray(produitsData) ? produitsData : (produitsData.results || [])
    }

    // Détermine si on doit faire un appel API (fallback quand l'index n'est pas prêt)
    const shouldFetch = !indexReady && (autoLoad || (!!debouncedSearch && debouncedSearch.length >= minSearchLength))

    const { data: apiProduits = [], isLoading: apiLoading, isFetching, error, refetch } = useQuery({
        queryKey: ['products', 'search', debouncedSearch, autoLoad, pageSize],
        queryFn: () => fetchProducts(debouncedSearch, autoLoad),
        enabled: shouldFetch,
        staleTime: 1000 * 30, // 30 secondes — réduit les requêtes lors de la navigation rapide
        gcTime: 1000 * 60 * 5,
    })

    // Utiliser les résultats locaux si disponibles, sinon les résultats API
    const produits = localResults ?? apiProduits
    const loading = indexLoading || (shouldFetch && apiLoading)

    // Handle Barcode matching effect
    // We use a separate effect to trigger the callback when data arrives
    // This replaces the logic inside the previous fetch function
    const hasHandledBarcode = useRef<string>('')

    if (onBarcodeMatch && wasBarcodeScanned && !loading && !isFetching && produits.length === 1) {
        // Prevent duplicate firing for the same search query
        if (hasHandledBarcode.current !== debouncedSearch) {
            const product = produits[0]
            const isNumericSearch = /^\d+$/.test(debouncedSearch)

            if (isNumericSearch) {
                // Verify exact CIP match
                const cipMatch =
                    normalizeCip(product.cip1) === debouncedSearch ||
                    normalizeCip(product.cip2) === debouncedSearch ||
                    normalizeCip(product.cip3) === debouncedSearch

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
        wasBarcodeScanned,
        wasDatamatrixScanned
    }
}

