import { useState, useEffect } from 'react'
import { useDebounce } from 'use-debounce'
import axios from 'axios'
import type { ProduitModel } from '../types'

interface UseProductSearchOptions {
    minSearchLength?: number
    debounceMs?: number
    autoLoad?: boolean
}

interface UseProductSearchReturn {
    produits: ProduitModel[]
    loading: boolean
    error: string | null
    searchQuery: string
    setSearchQuery: (query: string) => void
    refetch: () => void
}

/**
 * Custom hook for product search with debouncing and API integration
 * Optimized for large product catalogs (6000-7000+ products)
 * 
 * @param options Configuration options
 * @returns Search state and control functions
 */
export function useProductSearch(options: UseProductSearchOptions = {}): UseProductSearchReturn {
    const {
        minSearchLength = 2,
        debounceMs = 200,
        autoLoad = false
    } = options

    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || ''

    const [produits, setProduits] = useState<ProduitModel[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [debouncedSearch] = useDebounce(searchQuery, debounceMs)

    const refetch = () => {
        // Trigger a refetch by setting a dummy state change
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
            } catch (err) {
                console.error('Erreur recherche produits:', err)
                setError('Erreur lors de la recherche des produits')
                setProduits([])
            } finally {
                setLoading(false)
            }
        }

        searchProducts()
    }, [debouncedSearch, apiBaseUrl, autoLoad, minSearchLength])

    return {
        produits,
        loading,
        error,
        searchQuery,
        setSearchQuery,
        refetch
    }
}
