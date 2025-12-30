import { useState, useEffect } from 'react'
import axios from 'axios'
import type { StockLot } from '../types'

export function useStockLots(produitId: number | null) {
    const [lots, setLots] = useState<StockLot[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!produitId) {
            setLots([])
            return
        }

        const fetchLots = async () => {
            setLoading(true)
            setError(null)
            try {
                const apiBaseUrl = import.meta.env.VITE_API_BASE_URL
                const endpoint = apiBaseUrl ? `${apiBaseUrl}/api/stock-lots/` : '/api/stock-lots/'

                // Fetch valid lots with remaining quantity
                const response = await axios.get(endpoint, {
                    params: {
                        produit: produitId,
                        include_empty: 'false'
                    }
                })

                const data = Array.isArray(response.data) ? response.data : (response.data.results || [])
                setLots(data)
            } catch (err) {
                console.error('Error fetching stock lots:', err)
                setError('Impossible de charger les lots du produit')
            } finally {
                setLoading(false)
            }
        }

        fetchLots()
    }, [produitId])

    return { lots, loading, error }
}
