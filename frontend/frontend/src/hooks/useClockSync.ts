/**
 * Détecte le décalage entre l'horloge du poste client et l'heure du serveur.
 * Compare l'heure locale avec l'heure du serveur via l'endpoint /api/users/server-time/.
 *
 * Si le décalage dépasse le seuil (par défaut 2 minutes), alerte l'utilisateur.
 */
import { useState, useEffect, useCallback } from 'react'
import api from '../services/api'

const DRIFT_THRESHOLD_MS = 2 * 60 * 1000 // 2 minutes
const CHECK_INTERVAL_MS = 5 * 60 * 1000  // vérifie toutes les 5 minutes

export interface ClockSyncState {
  driftMs: number | null       // décalage en ms (positif = client en avance, négatif = client en retard)
  isSynced: boolean            // true si décalage < seuil
  lastChecked: Date | null
  checkNow: () => Promise<void>
}

export function useClockSync(): ClockSyncState {
  const [driftMs, setDriftMs] = useState<number | null>(null)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  const check = useCallback(async () => {
    try {
      const t0 = Date.now()
      const res = await api.get('users/server-time/')
      const t1 = Date.now()
      const serverTimestamp = res.data.timestamp as number
      // Compensation latence réseau : on suppose que le serveur a répondu à mi-chemin
      const rtt = t1 - t0
      const localTimeAtServerResponse = t0 + rtt / 2
      const drift = localTimeAtServerResponse - serverTimestamp * 1000
      setDriftMs(drift)
      setLastChecked(new Date())
    } catch {
      // silencieux — pas de connexion ou pas authentifié
    }
  }, [])

  useEffect(() => {
    // Vérifier au montage (après un court délai pour laisser l'auth se faire)
    const initialTimer = setTimeout(check, 3000)
    const interval = setInterval(check, CHECK_INTERVAL_MS)
    return () => {
      clearTimeout(initialTimer)
      clearInterval(interval)
    }
  }, [check])

  return {
    driftMs,
    isSynced: driftMs === null || Math.abs(driftMs) < DRIFT_THRESHOLD_MS,
    lastChecked,
    checkNow,
  }
}
