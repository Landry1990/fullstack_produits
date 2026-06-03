import { useState, useEffect, useCallback } from 'react'
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

            // Multicaisse auto-détecté : > 1 poste actif
            const hasMulti = activePostes.length > 1
            setIsMultiCaisse(hasMulti)

            // Auto-select la caisse de l'utilisateur si ouverte, sinon le seul poste actif
            if (!selectedPosteCaisseId) {
                if (myPoste) {
                    // L'utilisateur a sa propre caisse ouverte → la pré-sélectionner
                    setSelectedPosteCaisseId(myPoste.id)
                } else if (activePostes.length === 1) {
                    // Un seul poste ouvert (pas le sien) → le sélectionner
                    setSelectedPosteCaisseId(activePostes[0].id)
                }
                // Si multi-postes et pas la sienne → laisser l'utilisateur choisir
            }
        } catch (err) {
            console.error('Erreur chargement postes caisses:', err)
        } finally {
            setMultiCaisseLoading(false)
        }
    }, [selectedPosteCaisseId])

    // Initial fetch
    useEffect(() => {
        refreshPostes()
    }, [refreshPostes])

    // Polling toutes les 30s
    useEffect(() => {
        const interval = setInterval(refreshPostes, 30000)
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
