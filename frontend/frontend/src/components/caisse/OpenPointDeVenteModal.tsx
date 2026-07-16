import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-hot-toast'
import { cashSessionService, type PosteVente } from '../../services/cashSessionService'
import { usePosteCaisseMode } from '../../context/PosteCaisseModeContext'
import { useAuth } from '../../context/AuthContext'
import { Store, Check, Loader2 } from 'lucide-react'
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
import { getApiErrorDetail } from '../../utils/errorHandling'

interface OpenPointDeVenteModalProps {
  isOpen: boolean
  onClose: () => void
  onSessionOpened?: () => void
  autoOpen?: boolean
}

export const OpenPointDeVenteModal: React.FC<OpenPointDeVenteModalProps> = ({
  isOpen,
  onClose,
  onSessionOpened,
  autoOpen = false
}) => {
  const { t } = useTranslation('caisse')
  const { openPoste, setActivePosteVente, activePoste } = usePosteCaisseMode()
  const { user } = useAuth()
  const [allPostes, setAllPostes] = useState<PosteVente[]>([])
  const [selectedPosteId, setSelectedPosteId] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingPostes, setLoadingPostes] = useState(false)

  const loadPostes = useCallback(async () => {
    setLoadingPostes(true)
    try {
      const postes = await cashSessionService.getAllPostesVente()
      setAllPostes(postes)

      const available = postes.filter((p) => !p.est_actif)
      const myActivePoste = postes.find((p) =>
        p.est_actif && (
          p.vendeur === user?.id ||
          p.vendeur_name === (user?.username || '') ||
          user?.is_superuser
        )
      )

      // S'il y a un POS déjà actif pour l'utilisateur, le pré-sélectionner pour réactivation
      if (myActivePoste) {
        setSelectedPosteId(myActivePoste.id)
      } else if (available.length === 1) {
        setSelectedPosteId(available[0].id)
      }

      if (autoOpen && available.length === 1 && isOpen && !myActivePoste) {
        handleOpenSession(available[0].id)
      }
    } catch {
      toast.error(t('messages.error_loading_posts', { defaultValue: 'Erreur chargement points de vente' }))
    } finally {
      setLoadingPostes(false)
    }
  }, [autoOpen, isOpen, t, user])

  useEffect(() => {
    if (isOpen) {
      setSelectedPosteId(activePoste?.id ?? null)
      loadPostes()
    }
  }, [isOpen, loadPostes, activePoste])

  const handleOpenSession = async (posteId?: number) => {
    const id = posteId ?? selectedPosteId
    if (!id) {
      toast.error(t('messages.select_poste', { defaultValue: 'Veuillez sélectionner un point de vente.' }))
      return
    }

    const poste = allPostes.find((p) => p.id === id)
    if (!poste) {
      toast.error(t('messages.select_poste', { defaultValue: 'Veuillez sélectionner un point de vente.' }))
      return
    }

    const isMyActivePoste = poste.est_actif && (poste.vendeur === user?.id || poste.vendeur_name === (user?.username || '') || user?.is_superuser)
    if (poste.est_actif && !isMyActivePoste) {
      toast.error(t('messages.poste_occupied', { defaultValue: 'Ce point de vente est déjà ouvert par un autre utilisateur.' }))
      return
    }

    setIsLoading(true)
    try {
      if (isMyActivePoste) {
        // Réactivation locale: le poste est déjà actif côté backend, on le rattache à cet onglet
        setActivePosteVente(poste)
        toast.success(t('messages.session_reactivated', { defaultValue: 'Point de vente réactivé.' }))
      } else {
        await openPoste(id)
        toast.success(t('messages.session_opened', { defaultValue: 'Point de vente ouvert.' }))
      }
      onSessionOpened?.()
      onClose()
    } catch (err) {
      toast.error(getApiErrorDetail(err, t('messages.error_opening', { defaultValue: 'Erreur ouverture.' })))
    } finally {
      setIsLoading(false)
    }
  }

  const selectedPoste = allPostes.find((p) => p.id === selectedPosteId)
  const isSelectedMine = selectedPoste && selectedPoste.est_actif &&
    (selectedPoste.vendeur === user?.id || selectedPoste.vendeur_name === (user?.username || '') || user?.is_superuser)
  const canOpenSelected = selectedPoste && (!selectedPoste.est_actif || isSelectedMine)

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Store className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-slate-900">
                {t('open_point_vente.title', { defaultValue: 'Ouvrir un point de vente' })}
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-500 mt-1">
                {t('open_point_vente.subtitle', { defaultValue: 'Sélectionnez un point de vente pour commencer à facturer.' })}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6">
          {loadingPostes ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="size-8 text-indigo-600 animate-spin" />
              <p className="text-sm text-slate-500">{t('open_point_vente.loading', { defaultValue: 'Chargement des points de vente...' })}</p>
            </div>
          ) : allPostes.length === 0 ? (
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-8 text-center">
              <div className="size-14 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
                <Store className="size-7" />
              </div>
              <p className="text-base font-semibold text-slate-700">
                {t('open_point_vente.no_points', { defaultValue: 'Aucun point de vente disponible.' })}
              </p>
              <p className="text-sm text-slate-500 mt-2">
                {t('open_point_vente.create_hint', { defaultValue: 'Créez-en un dans Paramètres > Points de vente.' })}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {allPostes.map((poste) => {
                const isSelected = selectedPosteId === poste.id
                const isActive = poste.est_actif
                const isMine = poste.vendeur === user?.id || poste.vendeur_name === (user?.username || '') || user?.is_superuser
                const isOccupied = isActive && !isMine

                return (
                  <Card
                    key={poste.id}
                    onClick={() => !isOccupied && setSelectedPosteId(poste.id)}
                    className={`
                      relative p-4 cursor-pointer transition-all duration-200
                      ${isSelected ? 'ring-2 ring-indigo-500 border-indigo-500 bg-indigo-50/40' : 'border-slate-200 hover:border-indigo-300 hover:shadow-md'}
                      ${isOccupied ? 'opacity-60 cursor-not-allowed' : ''}
                    `}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`
                        size-12 rounded-xl flex items-center justify-center shrink-0
                        ${isSelected ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}
                        ${isActive ? 'bg-emerald-100 text-emerald-600' : ''}
                      `}>
                        <Store className="size-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-bold text-slate-900 truncate">{poste.nom}</p>
                          {isSelected && (
                            <div className="size-5 rounded-full bg-indigo-500 text-white flex items-center justify-center shrink-0">
                              <Check className="size-3" />
                            </div>
                          )}
                        </div>
                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                          {isActive ? (
                            <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-500">
                              {t('open_point_vente.open', { defaultValue: 'Ouvert' })}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-slate-600 border-slate-300">
                              {t('open_point_vente.available', { defaultValue: 'Disponible' })}
                            </Badge>
                          )}
                        </div>
                        {isActive && poste.vendeur_name && (
                          <p className="text-xs text-slate-500 mt-2 truncate">
                            {isMine
                              ? t('open_point_vente.your_post', { defaultValue: 'Votre poste actif' })
                              : t('open_point_vente.opened_by', { defaultValue: 'Ouvert par {{name}}', name: poste.vendeur_name })}
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>

        <DialogFooter className="p-6 pt-2 border-t border-slate-100 gap-3">
          <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">
            {t('open_point_vente.cancel', { defaultValue: 'Annuler' })}
          </Button>
          <Button
            type="button"
            onClick={() => handleOpenSession()}
            disabled={isLoading || !selectedPosteId || !canOpenSelected || allPostes.length === 0}
            className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {isLoading ? (
              <Loader2 className="size-4 mr-2 animate-spin" />
            ) : (
              <Store className="size-4 mr-2" />
            )}
            {selectedPoste?.est_actif && isSelectedMine
              ? t('open_point_vente.reactivate', { defaultValue: 'Réactiver' })
              : t('open_point_vente.open', { defaultValue: 'Ouvrir' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
