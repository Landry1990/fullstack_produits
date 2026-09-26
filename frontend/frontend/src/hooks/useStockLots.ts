import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../services/api'
import type { StockLot } from '../types'
import { logger } from '../utils/logger'

export function useStockLots(produitId: number | null) {
    const { t } = useTranslation(['stock', 'common'])
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
            } catch (err) {
                if (err instanceof Error && err.name === 'AbortError') return;
                logger.error('Error fetching stock lots:', err)
                setError(t('stock:lots.load_error', { defaultValue: 'Impossible de charger les lots du produit' }))
            } finally {
                setLoading(false)
            }
        }

        fetchLots()
        return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [produitId])

    return { lots, loading, error }
}
