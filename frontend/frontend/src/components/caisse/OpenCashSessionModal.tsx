import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { gooeyToast } from 'goey-toast'
import { cashSessionService, type PosteCaisse, type PosteVente } from '../../services/cashSessionService'
import { usePosteCaisseMode } from '../../context/PosteCaisseModeContext'
import { Monitor, Unlock, Wallet, Check, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../shadcn/dialog'
import { Card } from '../shadcn/card'
import { Badge } from '../shadcn/badge'
import { Button } from '../shadcn/button'

interface OpenCashSessionModalProps {
  isOpen: boolean
  onClose: () => void
  onSessionOpened: (poste?: PosteVente) => void
  autoOpen?: boolean
}

export const OpenCashSessionModal: React.FC<OpenCashSessionModalProps> = ({
  isOpen,
  onClose,
  onSessionOpened,
  autoOpen = false
}) => {
  const { t } = useTranslation('caisse')
  const { setActivePosteVente } = usePosteCaisseMode()
  const [allCaisses, setAllCaisses] = useState<PosteCaisse[]>([])
  const [selectedPosteId, setSelectedPosteId] = useState<number | null>(null)
  const [fondCaisse, setFondCaisse] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [loadingCaisses, setLoadingCaisses] = useState(false)

  const loadCaisses = useCallback(async () => {
    setLoadingCaisses(true)
    try {
      const caisses = await cashSessionService.getAllCaisses()
      setAllCaisses(caisses)

      const available = caisses.filter((c) => !c.est_actif)
      if (available.length === 1) {
        setSelectedPosteId(available[0].id)
      }

      if (autoOpen && available.length === 1 && isOpen) {
        handleOpenSession(available[0].id)
      }
    } catch {
      gooeyToast.error(t('messages.error_loading_posts', { defaultValue: 'Erreur chargement postes de caisse' }))
    } finally {
      setLoadingCaisses(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpen, isOpen, t])

  useEffect(() => {
    if (isOpen) {
      setSelectedPosteId(null)
      setFondCaisse('')
      loadCaisses()
    }
  }, [isOpen, loadCaisses])

  const handleOpenSession = async (caisseId?: number) => {
    const id = caisseId ?? selectedPosteId
    if (!id || isLoading) return

    const caisse = allCaisses.find((c) => c.id === id)
    if (caisse?.est_actif) {
      gooeyToast.error(t('messages.caisse_already_open', { defaultValue: 'Ce poste de caisse est déjà ouvert.' }))
      return
    }

    setIsLoading(true)
    try {
      const poste = await cashSessionService.openPosteVente(id, fondCaisse || undefined)
      setActivePosteVente(poste)
      gooeyToast.success(t('messages.session_opened', { defaultValue: 'Caisse ouverte.' }))
      onSessionOpened(poste)
      onClose()
      setFondCaisse('')
    } catch (err: unknown) {
      gooeyToast.error(err.response?.data?.detail || t('messages.error_opening', { defaultValue: 'Erreur ouverture.' }))
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpen = () => {
    if (!selectedPosteId) {
      gooeyToast.error(t('messages.select_post', { defaultValue: 'Veuillez sélectionner un poste de caisse.' }))
      return
    }
    handleOpenSession(selectedPosteId)
  }

  const selectedCaisse = allCaisses.find((c) => c.id === selectedPosteId)
  const canOpenSelected = selectedCaisse && !selectedCaisse.est_actif

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Monitor className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-slate-900">
                {t('cash_session.open_title', { defaultValue: 'Ouvrir ma caisse' })}
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-500 mt-1">
                {t('cash_session.select_post', { defaultValue: 'Sélectionnez un poste de caisse' })}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-5">
          {loadingCaisses ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="size-8 text-emerald-600 animate-spin" />
              <p className="text-sm text-slate-500">{t('cash_session.loading', { defaultValue: 'Chargement des postes de caisse...' })}</p>
            </div>
          ) : allCaisses.length === 0 ? (
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-8 text-center">
              <div className="size-14 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
                <Monitor className="size-7" />
              </div>
              <p className="text-base font-semibold text-slate-700">
                {t('cash_session.no_caisse', { defaultValue: 'Aucun poste de caisse configuré.' })}
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {allCaisses.map((caisse) => {
                  const isSelected = selectedPosteId === caisse.id
                  const isActive = caisse.est_actif

                  return (
                    <Card
                      key={caisse.id}
                      onClick={() => !isActive && setSelectedPosteId(caisse.id)}
                      className={`
                        relative p-4 cursor-pointer transition-all duration-200
                        ${isSelected ? 'ring-2 ring-emerald-500 border-emerald-500 bg-emerald-50/40' : 'border-slate-200 hover:border-emerald-300 hover:shadow-md'}
                        ${isActive ? 'opacity-60 cursor-not-allowed' : ''}
                      `}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`
                          size-12 rounded-xl flex items-center justify-center shrink-0
                          ${isSelected ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}
                          ${isActive ? 'bg-amber-100 text-amber-600' : ''}
                        `}>
                          {isActive ? <Monitor className="size-6" /> : <Unlock className="size-6" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-bold text-slate-900 truncate">{caisse.nom}</p>
                            {isSelected && (
                              <div className="size-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                                <Check className="size-3" />
                              </div>
                            )}
                          </div>
                          <div className="mt-2 flex items-center gap-2 flex-wrap">
                            {isActive ? (
                              <Badge variant="default" className="bg-amber-500 hover:bg-amber-500">
                                {t('cash_session.open', { defaultValue: 'Ouvert' })}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-slate-600 border-slate-300">
                                {t('cash_session.available', { defaultValue: 'Disponible' })}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>

              <div className="w-full">
                <label className="block py-1 text-xs font-semibold text-slate-700">
                  {t('cash_session.initial_amount', { defaultValue: 'Fond de caisse (optionnel)' })}
                </label>
                <div className="relative">
                  <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                  <input
                    type="number"
                    step="0.01"
                    className="w-full h-10 px-3 pl-10 rounded-lg border border-slate-200 bg-white text-right font-mono text-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm"
                    value={fondCaisse}
                    onChange={(e) => setFondCaisse(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <label className="block py-0 text-[10px] text-slate-400 mt-1">
                  {t('cash_session.amount_hint', { defaultValue: 'Laisser vide si pas de fond initial' })}
                </label>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="p-6 pt-2 border-t border-slate-100 gap-3">
          <Button type="button" variant="outline" onClick={onClose} className="rounded-xl" disabled={isLoading}>
            {t('common:actions.cancel', 'Annuler')}
          </Button>
          <Button
            type="button"
            onClick={handleOpen}
            disabled={isLoading || !selectedPosteId || !canOpenSelected || allCaisses.length === 0}
            className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isLoading ? (
              <Loader2 className="size-4 mr-2 animate-spin" />
            ) : (
              <><Unlock className="size-4 mr-2" /> {t('cash_session.open_btn', { defaultValue: 'Ouvrir' })}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
