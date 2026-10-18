import { useEffect, useState, useCallback, useRef } from 'react'
import api from '../services/api'
import { logger } from '../utils/logger'

export interface PosologyBlock {
  raw: string
  fields: Record<string, string>
}

export interface PharmaInteraction {
  substance_a: string
  substance_b: string
  other: string
  gravity: string
  description: string
}

export interface PharmaData {
  product: {
    id: number
    name: string
    cip1: string
    code_atc: string
  }
  mq_form: { id: string; name: string }
  monog: { code: string; name: string }
  active_principles: string[]
  posology_blocks: PosologyBlock[]
  conservation_texts: string[]
  indication_items: string[]
  interactions: PharmaInteraction[]
  therapeutic_classes: { code: string; label: string }[]
  generiques: { id: number; name: string; selling_price: string; stock: number }[]
}

export function useProductPharmaData(productId: number | null) {
  const [data, setData] = useState<PharmaData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    if (!productId) {
      setData(null)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const response = await api.get<PharmaData>(`produits/${productId}/pharma_data/`, {
        signal,
      })
      setData(response.data)
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError') return
      logger.error('Erreur chargement données pharmaco', err)
      setError('load_error')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [productId])

  useEffect(() => {
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    const timer = setTimeout(() => {
      fetchData(abortRef.current?.signal)
    }, 120)
    return () => {
      clearTimeout(timer)
      abortRef.current?.abort()
    }
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}
