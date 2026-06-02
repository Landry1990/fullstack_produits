import React, { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-hot-toast'
import PremiumModal from '../common/PremiumModal'
import { cashSessionService, type PosteCaisse } from '../../services/cashSessionService'
import { Monitor, Lock, Unlock, Wallet } from 'lucide-react'

interface OpenCashSessionModalProps {
  isOpen: boolean
  onClose: () => void
  onSessionOpened: () => void
}

export const OpenCashSessionModal: React.FC<OpenCashSessionModalProps> = ({
  isOpen,
  onClose,
  onSessionOpened
}) => {
  const { t } = useTranslation('caisse')
  const [allPostes, setAllPostes] = useState<PosteCaisse[]>([])
  const [selectedPosteId, setSelectedPosteId] = useState<number | null>(null)
  const [fondCaisse, setFondCaisse] = useState('')
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Charger les postes disponibles quand le modal s'ouvre
  useEffect(() => {
    if (!isOpen) return
    const fetchPostes = async () => {
      setFetching(true)
      try {
        const postes = await cashSessionService.getAllPostes()
        setAllPostes(postes)
        // Sélectionner le premier poste fermé par défaut
        const firstClosed = postes.find(p => !p.est_ouvert)
        if (firstClosed) {
          setSelectedPosteId(firstClosed.id)
        }
      } catch (err) {
        toast.error(t('messages.error_loading_posts'))
      } finally {
        setFetching(false)
      }
    }
    fetchPostes()
    // Focus sur le fond de caisse après ouverture
    const timer = setTimeout(() => {
      inputRef.current?.focus()
    }, 200)
    return () => clearTimeout(timer)
  }, [isOpen, t])

  const handleOpen = async () => {
    if (!selectedPosteId) {
      toast.error(t('messages.select_post'))
      return
    }
    setLoading(true)
    try {
      await cashSessionService.openPoste(
        selectedPosteId,
        fondCaisse || undefined
      )
      toast.success(t('messages.session_opened'))
      onSessionOpened()
      onClose()
      setFondCaisse('')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t('messages.error_opening'))
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleOpen()
    }
    if (e.key === 'Escape') {
      onClose()
    }
  }

  return (
    <PremiumModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('cash_session.open_title', { defaultValue: 'Ouvrir ma caisse' })}
      icon={<Monitor className="text-primary size-5" />}
      footer={
        <div className="flex justify-end gap-2 w-full">
          <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={loading}>
            {t('common:actions.cancel', 'Annuler')}
          </button>
          <button
            className={`btn btn-sm ${selectedPosteId ? 'btn-primary' : 'btn-disabled'}`}
            onClick={handleOpen}
            disabled={loading || !selectedPosteId}
          >
            {loading ? (
              <span className="loading loading-spinner loading-sm" />
            ) : (
              <><Unlock className="size-4 mr-1" /> {t('cash_session.open_btn', { defaultValue: 'Ouvrir' })}</>
            )}
          </button>
        </div>
      }
    >
      <div className="p-5 space-y-4">
        {fetching ? (
          <div className="flex justify-center py-4">
            <span className="loading loading-spinner loading-md text-primary" />
          </div>
        ) : (
          <>
            {/* Sélection du poste */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-base-content/50">
                {t('cash_session.select_post', { defaultValue: 'Poste de caisse' })}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {allPostes.map(poste => (
                  <button
                    key={poste.id}
                    type="button"
                    disabled={poste.est_ouvert}
                    onClick={() => setSelectedPosteId(poste.id)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      selectedPosteId === poste.id
                        ? 'border-primary bg-primary/10 ring-1 ring-primary'
                        : poste.est_ouvert
                        ? 'border-base-200 bg-base-100 opacity-50 cursor-not-allowed'
                        : 'border-base-300 bg-base-100 hover:bg-base-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {poste.est_ouvert ? (
                        <Lock className="size-4 text-warning" />
                      ) : (
                        <Unlock className="size-4 text-success" />
                      )}
                      <span className="font-medium text-sm">{poste.nom}</span>
                    </div>
                    {poste.est_ouvert && poste.session_active && (
                      <div className="text-[10px] text-base-content/50 mt-1 pl-6">
                        {t('cash_session.opened_by', { defaultValue: 'Ouvert par' })} {poste.session_active.ouvert_par_name}
                      </div>
                    )}
                  </button>
                ))}
              </div>
              {allPostes.length === 0 && (
                <div className="text-sm text-base-content/50 text-center py-2">
                  {t('cash_session.no_posts', { defaultValue: 'Aucun poste configuré' })}
                </div>
              )}
            </div>

            {/* Fond de caisse (optionnel) */}
            <div className="form-control">
              <label className="label py-1">
                <span className="label-text text-xs font-semibold">
                  {t('cash_session.initial_amount', { defaultValue: 'Fond de caisse (optionnel)' })}
                </span>
              </label>
              <div className="relative">
                <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-base-content/40" />
                <input
                  ref={inputRef}
                  type="number"
                  step="0.01"
                  className="input input-bordered input-sm w-full pl-10 text-right font-mono"
                  value={fondCaisse}
                  onChange={(e) => setFondCaisse(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="0"
                />
              </div>
              <label className="label py-0">
                <span className="label-text-alt text-[10px] text-base-content/40">
                  {t('cash_session.amount_hint', { defaultValue: 'Laisser vide si pas de fond initial' })}
                </span>
              </label>
            </div>
          </>
        )}
      </div>
    </PremiumModal>
  )
}
