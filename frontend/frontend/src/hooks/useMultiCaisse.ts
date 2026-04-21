import { useState, useEffect, useCallback, useMemo } from 'react'
import axios from 'axios'

export interface UseMultiCaisseOptions {
    apiBaseUrl: string
}

export interface UseMultiCaisseReturn {
    isMultiCaisse: boolean
    setIsMultiCaisse: (v: boolean) => void
    centralizedCashRegister: boolean
    setCentralizedCashRegister: (v: boolean) => void
    postesCaisses: any[]
    setPostesCaisses: (v: any[]) => void
    selectedPosteCaisseId: number | null
    setSelectedPosteCaisseId: (v: number | null) => void
    multiCaisseLoading: boolean
}

export function useMultiCaisse({ apiBaseUrl }: UseMultiCaisseOptions): UseMultiCaisseReturn {
    const [centralizedCashRegister, setCentralizedCashRegister] = useState<boolean>(true)
    const [isMultiCaisse, setIsMultiCaisse] = useState<boolean>(false)
    const [postesCaisses, setPostesCaisses] = useState<any[]>([])
    const [selectedPosteCaisseId, setSelectedPosteCaisseId] = useState<number | null>(null)
    const [multiCaisseLoading, setMultiCaisseLoading] = useState(false)

    const handleApiError = useCallback((err: unknown, msg: string) => {
        console.error(msg, err)
    }, [])

    // Initial settings fetch
    useEffect(() => {
        const fetchSettings = async () => {
            setMultiCaisseLoading(true)
            try {
                const settingsEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/invoice-settings/` : '/api/invoice-settings/'
                const postesEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/postes-caisses/active/` : '/api/postes-caisses/active/'

                const [settingsRes, postesRes] = await Promise.all([
                    axios.get(settingsEndpoint),
                    axios.get(postesEndpoint).catch(() => ({ data: [] }))
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
            } catch (err) {
                handleApiError(err, 'Erreur lors du chargement des paramètres.')
            } finally {
                setMultiCaisseLoading(false)
            }
        }
        fetchSettings()
    }, [apiBaseUrl, handleApiError])

    // Polling for multi-caisse updates
    useEffect(() => {
        const fetchMultiCaisseSettings = async () => {
            try {
                const settingsUrl = `${apiBaseUrl}/api/invoice-settings/`
                const { data } = await axios.get(settingsUrl)
                setIsMultiCaisse(data.is_multi_caisse)
                setCentralizedCashRegister(data.centralized_cash_register)

                if (data.is_multi_caisse && data.centralized_cash_register) {
                    const postesUrl = `${apiBaseUrl}/api/postes-caisses/active/`
                    const { data: postes } = await axios.get(postesUrl)
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
    }, [apiBaseUrl, selectedPosteCaisseId])

    return {
        isMultiCaisse, setIsMultiCaisse,
        centralizedCashRegister, setCentralizedCashRegister,
        postesCaisses, setPostesCaisses,
        selectedPosteCaisseId, setSelectedPosteCaisseId,
        multiCaisseLoading
    }
}
