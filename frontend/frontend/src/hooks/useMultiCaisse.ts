import { useState, useEffect, useCallback, useRef } from 'react'
import { cashSessionService, type PosteCaisse, type PosteVente } from '../services/cashSessionService'
import { usePosteCaisseMode } from '../context/PosteCaisseModeContext'
import { logger } from '../utils/logger'

export type UseMultiCaisseOptions = Record<string, never>

export interface UseMultiCaisseReturn {
    isMultiCaisse: boolean
    setIsMultiCaisse: (v: boolean) => void
    centralizedCashRegister: boolean
    setCentralizedCashRegister: (v: boolean) => void
    postesCaisses: PosteCaisse[]
    setPostesCaisses: (v: PosteCaisse[]) => void
    activePostesVente: PosteVente[]
    setActivePostesVente: (v: PosteVente[]) => void
    selectedPosteCaisseId: number | null
    setSelectedPosteCaisseId: (v: number | null) => void
    multiCaisseLoading: boolean
    myActivePoste: PosteVente | null
    refreshPostes: () => Promise<void>
}

export function useMultiCaisse(_options: UseMultiCaisseOptions = {}): UseMultiCaisseReturn {
    const [centralizedCashRegister, setCentralizedCashRegister] = useState<boolean>(true)
    const [isMultiCaisse, setIsMultiCaisse] = useState<boolean>(false)
    const [postesCaisses, setPostesCaisses] = useState<PosteCaisse[]>([])
    const [activePostesVente, setActivePostesVente] = useState<PosteVente[]>([])
    const [multiCaisseLoading, setMultiCaisseLoading] = useState(false)

    const {
        activePoste,
        selectedPosteCaisseId,
        selectPoste,
        refresh: refreshActivePoste
    } = usePosteCaisseMode()

    const selectedPosteCaisseIdRef = useRef<number | null>(null)
    selectedPosteCaisseIdRef.current = selectedPosteCaisseId

    const refreshPostes = useCallback(async () => {
        setMultiCaisseLoading(true)
        try {
            const [allCaisses, activePostes, myPostes] = await Promise.all([
                cashSessionService.getAllCaisses().catch(() => []),
                cashSessionService.getActivePostesVente().catch(() => []),
                cashSessionService.getMyActivePostesVente().catch(() => [])
            ])

            setPostesCaisses(allCaisses)
            setActivePostesVente(activePostes)

            const hasMulti = activePostes.length > 1
            setIsMultiCaisse(hasMulti)

            if (!selectedPosteCaisseIdRef.current) {
                const myPoste = myPostes.length > 0 ? myPostes[0] : null
                if (myPoste) {
                    selectPoste(myPoste.caisse)
                }
            }

            await refreshActivePoste()
        } catch (err) {
            logger.error('Erreur chargement postes caisses:', err)
        } finally {
            setMultiCaisseLoading(false)
        }
    }, [selectPoste, refreshActivePoste])

    useEffect(() => {
        refreshPostes()
    }, [refreshPostes])

    useEffect(() => {
        const interval = setInterval(refreshPostes, 60000)
        return () => clearInterval(interval)
    }, [refreshPostes])

    return {
        isMultiCaisse, setIsMultiCaisse,
        centralizedCashRegister, setCentralizedCashRegister,
        postesCaisses, setPostesCaisses,
        activePostesVente, setActivePostesVente,
        selectedPosteCaisseId, setSelectedPosteCaisseId: selectPoste,
        multiCaisseLoading,
        myActivePoste: activePoste,
        refreshPostes
    }
}
