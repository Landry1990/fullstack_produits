import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-hot-toast'
import PremiumModal from '../common/PremiumModal'
import { cashSessionService, type PosteCaisse } from '../../services/cashSessionService'
import { Monitor, Unlock, Wallet, User } from 'lucide-react'

interface OpenCashSessionModalProps {
  isOpen: boolean
  onClose: () => void
  onSessionOpened: () => void
  autoOpen?: boolean
}

export const OpenCashSessionModal: React.FC<OpenCashSessionModalProps> = ({
  isOpen,
  onClose,
  onSessionOpened,
  autoOpen = false
}) => {
  const { t } = useTranslation('caisse')
  const [availablePostes, setAvailablePostes] = useState<PosteCaisse[]>([])
  const [selectedPosteId, setSelectedPosteId] = useState<number | null>(null)
  const [fondCaisse, setFondCaisse] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Charger les postes disponibles
  const loadPostes = useCallback(async () => {
    try {
      const postes = await cashSessionService.getAllPostes()
      const normalized = postes.map(p => ({
        ...p,
        est_ouvert: Boolean(p.est_ouvert)
      }))
      
      const closedPostes = normalized.filter(p => !p.est_ouvert)
      setAvailablePostes(closedPostes)
      
      // Auto-sélection si un seul poste disponible
      if (closedPostes.length === 1) {
        setSelectedPosteId(closedPostes[0].id)
      }
      
      // Mode auto-open : ouvre directement si un seul poste et autoOpen=true
      if (autoOpen && closedPostes.length === 1 && isOpen) {
        handleOpenSession(closedPostes[0].id)
      }
    } catch {
      toast.error(t('messages.error_loading_posts'))
    }
  }, [autoOpen, isOpen, t])

  useEffect(() => {
    if (isOpen) {
      setSelectedPosteId(null)
      setFondCaisse('')
      loadPostes()
    }
  }, [isOpen, loadPostes])

  // Ouvrir une session caisse
  const handleOpenSession = async (posteId: number) => {
    if (isLoading) return
    
    setIsLoading(true)
    try {
      await cashSessionService.openPoste(posteId, fondCaisse || undefined)
      toast.success(t('messages.session_opened'))
      onSessionOpened()
      onClose()
      setFondCaisse('')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t('messages.error_opening'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpen = () => {
    if (!selectedPosteId) {
      toast.error(t('messages.select_post'))
      return
    }
    handleOpenSession(selectedPosteId)
  }

  return (
    <PremiumModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('cash_session.open_title', { defaultValue: 'Ouvrir ma caisse' })}
      icon={<Monitor className="text-emerald-600 size-5" />}
      footer={
        <div className="flex justify-end gap-2 w-full">
          <button className="inline-flex items-center justify-center h-8 px-4 rounded-lg text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors" onClick={onClose} disabled={isLoading}>
            {t('common:actions.cancel', 'Annuler')}
          </button>
          <button
            className={`inline-flex items-center justify-center h-8 px-4 rounded-lg text-sm font-semibold transition-colors ${selectedPosteId ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
            onClick={handleOpen}
            disabled={isLoading || !selectedPosteId}
          >
            {isLoading ? (
              <div className="animate-spin rounded-full size-4 border-b-2 border-white"></div>
            ) : (
              <><Unlock className="size-4 mr-1" /> {t('cash_session.open_btn', { defaultValue: 'Ouvrir' })}</>
            )}
          </button>
        </div>
      }
    >
      <div className="p-5 space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full size-8 border-b-2 border-emerald-600"></div>
          </div>
        ) : (
          <>
            {/* Liste des postes disponibles */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {t('cash_session.select_post', { defaultValue: 'Sélectionnez votre poste' })}
              </label>

              {availablePostes.length === 0 ? (
                <div className="text-sm text-amber-600 text-center py-4 bg-amber-50 rounded border border-amber-200">
                  {t('cash_session.all_open', { defaultValue: 'Tous les postes sont déjà ouverts' })}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {availablePostes.map(poste => (
                    <button
                      key={poste.id}
                      type="button"
                      onClick={() => setSelectedPosteId(poste.id)}
                      className={`p-3 rounded-lg border text-left transition-all flex items-center gap-3 ${
                        selectedPosteId === poste.id
                          ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
                        <Unlock className="size-5 text-emerald-600" />
                      </div>
                      <div className="flex-1">
                        <span className="font-medium text-sm block text-slate-800">{poste.nom}</span>
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <User className="size-3" />
                          {t('cash_session.available', { defaultValue: 'Disponible' })}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Fond de caisse (optionnel) */}
            {availablePostes.length > 0 && (
              <div className="w-full">
                <label className="block py-1 text-xs font-semibold text-slate-700">
                  {t('cash_session.initial_amount', { defaultValue: 'Fond de caisse (optionnel)' })}
                </label>
                <div className="relative">
                  <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                  <input
                    type="number"
                    step="0.01"
                    className="w-full h-9 px-3 pl-10 rounded-lg border border-slate-200 bg-white text-right font-mono text-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm"
                    value={fondCaisse}
                    onChange={(e) => setFondCaisse(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <label className="block py-0 text-[10px] text-slate-400 mt-1">
                  {t('cash_session.amount_hint', { defaultValue: 'Laisser vide si pas de fond initial' })}
                </label>
              </div>
            )}
          </>
        )}
      </div>
    </PremiumModal>
  )
}
