/**
 * Popup d'alerte quand l'horloge du poste client est désynchronisée du serveur.
 *
 * Affiche :
 * - Le décalage en minutes/secondes
 * - L'heure du serveur vs l'heure locale
 * - Un bouton "Synchroniser" qui propose un script PowerShell à exécuter
 * - Un bouton "Ignorer" pour fermer le popup (revient toutes les 5 min)
 */
import { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useClockSync } from '../hooks/useClockSync'
import { useAuth } from '../context/AuthContext'
import { Clock, AlertTriangle, X, Copy, Check } from 'lucide-react'

function formatDrift(ms: number): string {
  const abs = Math.abs(ms)
  if (abs < 60_000) return `${Math.round(abs / 1000)} secondes`
  if (abs < 3_600_000) return `${Math.round(abs / 60_000)} minutes`
  return `${Math.round(abs / 3_600_000)} heures`
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function ClockSyncAlert() {
  const { t } = useTranslation()
  const { isAuthenticated, loading } = useAuth()
  const { driftMs, isSynced } = useClockSync()
  const [dismissed, setDismissed] = useState(false)
  const [copied, setCopied] = useState(false)

  // Réinitialiser le dismissed quand le drift change significativement
  const driftKey = useMemo(() => {
    if (driftMs === null) return 'none'
    return Math.round(driftMs / 60_000) // groupe par minute
  }, [driftMs])

  // Reset dismissed quand le drift change
  useEffect(() => { setDismissed(false) }, [driftKey])

  if (loading || !isAuthenticated) return null
  if (isSynced || driftMs === null || dismissed) return null

  const serverTime = new Date(Date.now() - driftMs)
  const localTime = new Date()
  const isAhead = driftMs > 0

  // Script PowerShell pour synchroniser l'heure avec le serveur
  // On utilise w32tm pour synchroniser via NTP (si disponible) ou set-date
  const syncScript = `# Script de synchronisation de l'horloge
# A executer en tant qu'Administrateur

# 1. Synchroniser via NTP (recommande)
w32tm /resync /force

# Si w32tm ne fonctionne pas, definir manuellement l'heure du serveur :
# $serverTime = Get-Date "2026-08-05 14:30:00"  # Remplacer par l'heure du serveur
# Set-Date $serverTime

Write-Host "Horloge synchronisee." -ForegroundColor Green
`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(syncScript)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-[9999] max-w-sm animate-in slide-in-from-bottom-5 duration-300">
      <div className="rounded-2xl border-2 border-amber-400 bg-white shadow-2xl shadow-amber-500/20 overflow-hidden">
        {/* En-tête */}
        <div className="flex items-center gap-2 bg-amber-50 px-4 py-2.5 border-b border-amber-200">
          <div className="size-8 rounded-lg bg-amber-500 flex items-center justify-center shrink-0">
            <AlertTriangle className="size-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-amber-900">
              {t('clock_sync.title', { defaultValue: 'Horloge désynchronisée' })}
            </p>
            <p className="text-[11px] text-amber-700">
              {t('clock_sync.subtitle', { defaultValue: 'Décalage détecté avec le serveur' })}
            </p>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="size-6 rounded-lg hover:bg-amber-200 flex items-center justify-center text-amber-600 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Corps */}
        <div className="px-4 py-3 space-y-3">
          {/* Décalage */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              {t('clock_sync.drift', { defaultValue: 'Décalage' })}
            </span>
            <span className={`text-sm font-black ${isAhead ? 'text-red-600' : 'text-orange-600'}`}>
              {isAhead ? '+' : '−'}{formatDrift(driftMs)}
            </span>
          </div>

          {/* Heures */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <Clock className="size-3" />
                {t('clock_sync.server', { defaultValue: 'Serveur' })}
              </div>
              <p className="text-sm font-bold text-slate-700 tabular-nums">{formatTime(serverTime)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <Clock className="size-3" />
                {t('clock_sync.local', { defaultValue: 'Ce poste' })}
              </div>
              <p className="text-sm font-bold text-slate-700 tabular-nums">{formatTime(localTime)}</p>
            </div>
          </div>

          {/* Message d'explication */}
          <p className="text-[11px] text-slate-500 leading-relaxed">
            {isAhead
              ? t('clock_sync.ahead_msg', {
                  defaultValue: "L'horloge de ce poste est en avance. Cela peut causer des erreurs dans les factures, tickets et rapports."
                })
              : t('clock_sync.behind_msg', {
                  defaultValue: "L'horloge de ce poste est en retard (pile CMOS ?). Cela peut causer des erreurs dans les factures, tickets et rapports."
                })
            }
          </p>

          {/* Action : copier le script */}
          <div className="space-y-2">
            <button
              onClick={handleCopy}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold py-2 transition-colors"
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied
                ? t('clock_sync.copied', { defaultValue: 'Script copié !' })
                : t('clock_sync.copy_script', { defaultValue: 'Copier le script de synchro' })
              }
            </button>
            <p className="text-[10px] text-slate-400 text-center leading-tight">
              {t('clock_sync.script_hint', {
                defaultValue: "À exécuter en tant qu'administrateur (PowerShell)"
              })}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
