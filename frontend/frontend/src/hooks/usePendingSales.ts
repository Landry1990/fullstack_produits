import { useState, useCallback, useEffect } from 'react'
import type { LigneFacture } from '../types'

export type VenteEnAttente = {
    id: number
    timestamp: number
    client: number | null
    clientName: string | null
    useManualClient: boolean
    manualClientName: string
    lignes: LigneFacture[]
    remise: string
    remiseMode: 'montant' | 'taux'
    ayantDroit: {
        id: number | null
        nom: string
        matricule: string
        societe: string
        showNew: boolean
    } | null
}

export function usePendingSales() {
    const [ventesEnAttente, setVentesEnAttente] = useState<VenteEnAttente[]>(() => {
        try {
            const saved = localStorage.getItem('ventesEnAttente')
            return saved ? JSON.parse(saved) : []
        } catch {
            return []
        }
    })
    const [showPendingSales, setShowPendingSales] = useState(false)

    // Save pending sales to localStorage whenever they change
    useEffect(() => {
        localStorage.setItem('ventesEnAttente', JSON.stringify(ventesEnAttente))
    }, [ventesEnAttente])

    const savePendingSale = useCallback((sale: Omit<VenteEnAttente, 'id' | 'timestamp'>) => {
        const newVente: VenteEnAttente = {
            ...sale,
            id: Date.now(),
            timestamp: Date.now()
        }
        setVentesEnAttente(prev => [newVente, ...prev])
    }, [])

    const deletePendingSale = useCallback((id: number) => {
        setVentesEnAttente(prev => prev.filter(v => v.id !== id))
    }, [])

    const clearAllPendingSales = useCallback(() => {
        setVentesEnAttente([])
    }, [])

    return {
        ventesEnAttente,
        showPendingSales,
        setShowPendingSales,
        savePendingSale,
        deletePendingSale,
        clearAllPendingSales
    }
}
