import { useState, useEffect } from 'react'
import api from '../services/api'
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

        const controller = new AbortController()

        const fetchLots = async () => {
            setLoading(true)
            setError(null)
            try {
                const response = await api.get('stock-lots/', {
                    params: { produit: produitId, include_empty: 'false' },
                    signal: controller.signal,
                })
                const data = Array.isArray(response.data) ? response.data : (response.data.results || [])
                setLots(data)
            } catch (err: any) {
                if (err?.code === 'ERR_CANCELED') return
                console.error('Error fetching stock lots:', err)
                setError('Impossible de charger les lots du produit')
            } finally {
                setLoading(false)
            }
        }

        fetchLots()
        return () => controller.abort()
    }, [produitId])

    return { lots, loading, error }
}
