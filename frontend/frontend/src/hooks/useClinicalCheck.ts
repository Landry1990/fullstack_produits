
import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import type { ClinicalAlert } from '../components/clinical/ClinicalAlerts'
import type { LigneFacture } from '../types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

export function useClinicalCheck(lignesFacture: LigneFacture[]) {
    const [alerts, setAlerts] = useState<ClinicalAlert[]>([])
    const [loading, setLoading] = useState(false)

    const checkInteractions = useCallback(async () => {
        // Only check if we have at least 2 items
        if (lignesFacture.length < 2) {
            setAlerts([])
            return
        }

        const productIds = lignesFacture.map(l => l.produit.id)

        try {
            setLoading(true)
            const response = await axios.post(`${API_BASE_URL}/api/clinical/check/`, {
                produits: productIds
            })
            setAlerts(response.data.alerts || [])
        } catch (error) {
            console.error("Clinical check failed", error)
            // Silently fail or minimal log? Don't block sales for this.
        } finally {
            setLoading(false)
        }
    }, [lignesFacture])

    // Debounce the check
    useEffect(() => {
        const timer = setTimeout(() => {
            checkInteractions()
        }, 800) // 800ms debounce

        return () => clearTimeout(timer)
    }, [checkInteractions])

    return { alerts, loading, checkInteractions }
}
