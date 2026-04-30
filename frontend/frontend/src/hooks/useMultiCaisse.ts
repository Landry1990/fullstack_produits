import { useState, useEffect, useCallback } from 'react'
import api from '../services/api'
import type { PosteCaisse } from '../types'

export interface UseMultiCaisseOptions {
}

export interface UseMultiCaisseReturn {
    isMultiCaisse: boolean
    setIsMultiCaisse: (v: boolean) => void
    centralizedCashRegister: boolean
    setCentralizedCashRegister: (v: boolean) => void
    postesCaisses: PosteCaisse[]
    setPostesCaisses: (v: PosteCaisse[]) => void
    selectedPosteCaisseId: number | null
    setSelectedPosteCaisseId: (v: number | null) => void
    multiCaisseLoading: boolean
}

export function useMultiCaisse(_options: UseMultiCaisseOptions = {}): UseMultiCaisseReturn {
    const [centralizedCashRegister, setCentralizedCashRegister] = useState<boolean>(true)
    const [isMultiCaisse, setIsMultiCaisse] = useState<boolean>(false)
    const [postesCaisses, setPostesCaisses] = useState<PosteCaisse[]>([])
    const [selectedPosteCaisseId, setSelectedPosteCaisseId] = useState<number | null>(null)
    const [multiCaisseLoading, setMultiCaisseLoading] = useState(false)

    const handleApiError = useCallback((err: unknown, msg: string) => {
        console.error(msg, err)
    }, [])

    // Initial settings fetch
    useEffect(() => {
        const controller = new AbortController()
        const fetchSettings = async () => {
            setMultiCaisseLoading(true)
            try {
                const [settingsRes, postesRes] = await Promise.all([
                    api.get('invoice-settings/', { signal: controller.signal }),
                    api.get('postes-caisses/active/', { signal: controller.signal }).catch(() => ({ data: [] }))
                ])

                setCentralizedCashRegister(settingsRes.data?.centralized_cash_register ?? true)
                setIsMultiCaisse(settingsRes.data?.is_multi_caisse ?? false)

                if (settingsRes.data?.is_multi_caisse) {
                    const postesList = postesRes.data?.results || postesRes.data || []
                    setPostesCaisses(postesList)
                    // Auto-select the first register if there is only one open
                    if (postesList.length === 1) {
                        setSelectedPosteCaisseId(postesList[0].id)
                    }
                }
            } catch (err: any) {
                if (err?.name !== 'CanceledError') handleApiError(err, 'Erreur lors du chargement des paramètres.')
            } finally {
                setMultiCaisseLoading(false)
            }
        }
        fetchSettings()
        return () => controller.abort()
    }, [handleApiError])

    // Polling for multi-caisse updates
    useEffect(() => {
        const fetchMultiCaisseSettings = async () => {
            try {
                const { data } = await api.get('invoice-settings/')
                setIsMultiCaisse(data.is_multi_caisse)
                setCentralizedCashRegister(data.centralized_cash_register)

                if (data.is_multi_caisse && data.centralized_cash_register) {
                    const { data: postes } = await api.get('postes-caisses/active/')
                    setPostesCaisses(postes)

                    // Auto-select if only one is active and none selected
                    if (postes.length === 1 && !selectedPosteCaisseId) {
                        setSelectedPosteCaisseId(postes[0].id)
                    }
                }
            } catch (error) {
                console.error("Error fetching multi-caisse settings:", error)
            }
        }

        const interval = setInterval(fetchMultiCaisseSettings, 30000) // Refresh every 30s
        return () => clearInterval(interval)
    }, [selectedPosteCaisseId])

    return {
        isMultiCaisse, setIsMultiCaisse,
        centralizedCashRegister, setCentralizedCashRegister,
        postesCaisses, setPostesCaisses,
        selectedPosteCaisseId, setSelectedPosteCaisseId,
        multiCaisseLoading
    }
}
