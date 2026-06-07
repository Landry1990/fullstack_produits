import { useState, useEffect, useCallback, useRef } from 'react'
import { cashSessionService } from '../services/cashSessionService'
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
    myActivePoste: PosteCaisse | null
    refreshPostes: () => Promise<void>
}

export function useMultiCaisse(_options: UseMultiCaisseOptions = {}): UseMultiCaisseReturn {
    const [centralizedCashRegister, setCentralizedCashRegister] = useState<boolean>(true)
    const [isMultiCaisse, setIsMultiCaisse] = useState<boolean>(false)
    const [postesCaisses, setPostesCaisses] = useState<PosteCaisse[]>([])
    const [selectedPosteCaisseId, setSelectedPosteCaisseId] = useState<number | null>(null)
    const [multiCaisseLoading, setMultiCaisseLoading] = useState(false)
    const [myActivePoste, setMyActivePoste] = useState<PosteCaisse | null>(null)

    // Ref pour lire selectedPosteCaisseId sans en faire une dépendance de refreshPostes
    const selectedPosteCaisseIdRef = useRef<number | null>(null)
    selectedPosteCaisseIdRef.current = selectedPosteCaisseId

    const refreshPostes = useCallback(async () => {
        setMultiCaisseLoading(true)
        try {
            const [activePostes, myPostes] = await Promise.all([
                cashSessionService.getActivePostes().catch(() => []),
                cashSessionService.getMyActiveSessions().catch(() => [])
            ])

            setPostesCaisses(activePostes)
            const myPoste = myPostes.length > 0 ? myPostes[0] : null
            setMyActivePoste(myPoste)

            const hasMulti = activePostes.length > 1
            setIsMultiCaisse(hasMulti)

            // Auto-select uniquement si aucun poste n'est déjà sélectionné
            if (!selectedPosteCaisseIdRef.current) {
                if (myPoste) {
                    setSelectedPosteCaisseId(myPoste.id)
                } else if (activePostes.length === 1) {
                    setSelectedPosteCaisseId(activePostes[0].id)
                }
            }
        } catch (err) {
            console.error('Erreur chargement postes caisses:', err)
        } finally {
            setMultiCaisseLoading(false)
        }
    }, []) // Pas de dépendances → fonction stable, pas de boucle

    // Initial fetch
    useEffect(() => {
        refreshPostes()
    }, [refreshPostes])

    // Polling toutes les 60s (les sessions de caisse changent rarement)
    useEffect(() => {
        const interval = setInterval(refreshPostes, 60000)
        return () => clearInterval(interval)
    }, [refreshPostes])

    return {
        isMultiCaisse, setIsMultiCaisse,
        centralizedCashRegister, setCentralizedCashRegister,
        postesCaisses, setPostesCaisses,
        selectedPosteCaisseId, setSelectedPosteCaisseId,
        multiCaisseLoading,
        myActivePoste,
        refreshPostes
    }
}
