import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Store, Plus, Loader2, Trash2, AlertCircle, Power } from 'lucide-react'
import { Button } from '../ui/Button'
import { Input } from '../shadcn/input'
import { Badge } from '../shadcn/badge'
import { EmptyState } from '../ui/EmptyState'
import { Skeleton } from '../ui/Skeleton'
import { gooeyToast } from 'goey-toast'
import {
  cashSessionService,
  type PosteVente,
  type PosteCaisse,
} from '../../services/cashSessionService'
import { getApiErrorDetail } from '../../utils/errorHandling'
import { useConfirm } from '../../hooks/useConfirm'

function formatDate(value: string | null, locale: string): string {
  if (!value) return '-'
  try {
    return new Date(value).toLocaleString(locale)
  } catch {
    return value
  }
}

export default function PosteVenteSettingsSection() {
  const { t, i18n } = useTranslation('pharmacy_settings')
  const confirm = useConfirm()
  const [postes, setPostes] = useState<PosteVente[]>([])
  const [caisses, setCaisses] = useState<PosteCaisse[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [newNom, setNewNom] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [data, caissesList] = await Promise.all([
        cashSessionService.getPostesVente().catch(() => []),
        cashSessionService.getAllCaisses().catch(() => [])
      ])
      setPostes(data)
      setCaisses(caissesList)
    } catch (err) {
      gooeyToast.error(getApiErrorDetail(err, t('messages.pos_load_error')))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleCreate = async () => {
    const nom = newNom.trim()
    if (!nom) {
      gooeyToast.error(t('messages.pos_name_required'))
      return
    }
    setSubmitting(true)
    try {
      await cashSessionService.createPosteVente({ nom })
      gooeyToast.success(t('messages.pos_created'))
      setNewNom('')
      await loadData()
    } catch (err) {
      gooeyToast.error(getApiErrorDetail(err, t('messages.pos_create_error')))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    const confirmedDelete = await confirm({
      title: t('common:confirmation'),
      message: t('messages.pos_confirm_delete', { defaultValue: 'Supprimer ce point de vente ?' }),
      confirmText: t('common:confirm'),
      variant: 'danger'
    })
    if (!confirmedDelete) return
    try {
      await cashSessionService.deletePosteVente(id)
      gooeyToast.success(t('messages.pos_deleted'))
      await loadData()
    } catch (err) {
      gooeyToast.error(getApiErrorDetail(err, t('messages.pos_delete_error')))
    }
  }

  const handleToggleCaisse = async (caisse: PosteCaisse) => {
    const nouvelEtat = caisse.actif === false
    const confirmed = await confirm({
      title: t('common:confirmation'),
      message: nouvelEtat
        ? t('messages.caisse_confirm_activate', { nom: caisse.nom, defaultValue: `Réactiver la caisse ${caisse.nom} ?` })
        : t('messages.caisse_confirm_deactivate', { nom: caisse.nom, defaultValue: `Désactiver la caisse ${caisse.nom} ? Elle ne pourra plus être ouverte, mais son historique est conservé.` }),
      confirmText: t('common:confirm'),
      variant: nouvelEtat ? 'info' : 'danger'
    })
    if (!confirmed) return
    try {
      await cashSessionService.updateCaisse(caisse.id, { actif: nouvelEtat })
      gooeyToast.success(nouvelEtat
        ? t('messages.caisse_activated', { defaultValue: 'Caisse réactivée.' })
        : t('messages.caisse_deactivated', { defaultValue: 'Caisse désactivée.' }))
      await loadData()
    } catch (err) {
      gooeyToast.error(getApiErrorDetail(err, t('messages.caisse_toggle_error', { defaultValue: "Erreur changement d'état caisse" })))
    }
  }

  const handleDeleteCaisse = async (caisse: PosteCaisse) => {
    const confirmedDelete = await confirm({
      title: t('common:confirmation'),
      message: t('messages.caisse_confirm_delete', { nom: caisse.nom, defaultValue: `Supprimer la caisse ${caisse.nom} ?` }),
      confirmText: t('common:confirm'),
      variant: 'danger'
    })
    if (!confirmedDelete) return
    try {
      await cashSessionService.deleteCaisse(caisse.id)
      gooeyToast.success(t('messages.caisse_deleted', { defaultValue: 'Caisse supprimée.' }))
      await loadData()
    } catch (err) {
      gooeyToast.error(getApiErrorDetail(err, t('messages.caisse_delete_error', { defaultValue: 'Erreur suppression caisse' })))
    }
  }

  const handleClose = async (id: number) => {
    const confirmedClose = await confirm({
      title: t('common:confirmation'),
      message: t('messages.pos_confirm_close', { defaultValue: 'Fermer ce point de vente ?' }),
      confirmText: t('common:confirm'),
      variant: 'danger'
    })
    if (!confirmedClose) return
    try {
      await cashSessionService.forcerFermeturePosteVente(id)
      gooeyToast.success(t('messages.pos_closed'))
      await loadData()
    } catch (err) {
      gooeyToast.error(getApiErrorDetail(err, t('messages.pos_close_error')))
    }
  }

  // Points de vente (mode POS, ouverts depuis Facturation, sans caisse physique)
  const definitionsActives = postes.filter((p) => p.mode_pos && p.est_actif)
  const definitionsDisponibles = postes.filter((p) => !p.caisse && !p.est_actif)

  // Postes créés depuis une caisse physique (ouverture depuis Caisse Centrale)
  const caisseActives = postes.filter((p) => !!p.caisse && p.est_actif)

  // Nombre de caisses physiques actives — la dernière ne doit jamais être
  // désactivée ni supprimée (protection contre les erreurs utilisateur).
  const nbCaissesActives = caisses.filter((c) => c.actif !== false).length

  return (
    <div className="bg-white shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden rounded-2xl">
      <div className="px-8 py-5 border-b border-slate-200 bg-slate-50/50">
        <h2 className="font-bold text-xl flex items-center gap-3">
          <div className="p-2 bg-emerald-50 rounded-lg">
            <Store className="h-5 w-5 text-emerald-600" />
          </div>
          {t('postes_vente.title', { defaultValue: 'Points de vente' })}
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          {t('postes_vente.subtitle', { defaultValue: 'Créez les points de vente de votre pharmacie. Ils apparaîtront dans le modal d\'ouverture de session.' })}
        </p>
      </div>

      <div className="p-8 space-y-8">
        {/* Formulaire création */}
        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 space-y-4">
          <h3 className="font-bold text-lg flex items-center gap-2 text-slate-800">
            <Plus className="size-5 text-emerald-600" />
            {t('postes_vente.add', { defaultValue: 'Créer un point de vente' })}
          </h3>
          <div className="flex items-center gap-3">
            <Input
              type="text"
              value={newNom}
              onChange={(e) => setNewNom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleCreate()
                }
              }}
              placeholder={t('postes_vente.name_placeholder', { defaultValue: 'Ex: Mobile 1, Mobile 2...' })}
              className="flex-1 h-12 rounded-xl"
            />
            <Button
              type="button"
              onClick={handleCreate}
              disabled={submitting || !newNom.trim()}
              className="h-12 px-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20"
            >
              {submitting ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <>
                  <Plus className="size-5 mr-2" />
                  {t('postes_vente.create_btn', { defaultValue: 'Créer' })}
                </>
              )}
            </Button>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500 bg-blue-50 px-4 py-2 rounded-xl border border-blue-100">
            <AlertCircle className="size-4 text-blue-500" />
            {t('postes_vente.hint', { defaultValue: 'Les caisses Principale et Secondaire restent inchangées.' })}
          </div>
        </div>

        {/* Liste */}
        {loading ? (
          <div className="space-y-3" aria-busy="true">
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        ) : (
          <div className="space-y-8">
            {/* Points de vente créés dans les paramètres */}
            <div>
              <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                {t('postes_vente.available', { defaultValue: 'Points de vente disponibles' })}
                <Badge className="bg-slate-400 text-white">{definitionsDisponibles.length}</Badge>
              </h4>
              {definitionsDisponibles.length === 0 ? (
                <EmptyState
                  compact
                  icon={<Store className="size-6" />}
                  title={t('postes_vente.no_available', { defaultValue: 'Aucun point de vente disponible. Créez-en un ci-dessus.' })}
                />
              ) : (
                <div className="rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100 text-slate-500">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold">{t('postes_vente.table.name', { defaultValue: 'Nom' })}</th>
                        <th className="px-4 py-3 text-right font-semibold">{t('postes_vente.table.actions', { defaultValue: 'Actions' })}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {definitionsDisponibles.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-800">{p.nom}</td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(p.id)}
                              className="text-red-600 hover:bg-red-50 hover:text-red-600"
                              title={t('postes_vente.delete', { defaultValue: 'Supprimer' })}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Points de vente actifs (définitions) */}
            {definitionsActives.length > 0 && (
              <div>
                <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                  {t('postes_vente.active', { defaultValue: 'Points de vente actifs' })}
                  <Badge className="bg-emerald-500 text-white">{definitionsActives.length}</Badge>
                </h4>
                <div className="rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100 text-slate-500">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold">{t('postes_vente.table.name', { defaultValue: 'Nom' })}</th>
                        <th className="px-4 py-3 text-left font-semibold">{t('postes_vente.table.vendeur', { defaultValue: 'Vendeur' })}</th>
                        <th className="px-4 py-3 text-left font-semibold">{t('postes_vente.table.opened', { defaultValue: 'Ouvert' })}</th>
                        <th className="px-4 py-3 text-right font-semibold">{t('postes_vente.table.actions', { defaultValue: 'Actions' })}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {definitionsActives.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-800">{p.nom}</td>
                          <td className="px-4 py-3 text-slate-600">{p.vendeur_name || '-'}</td>
                          <td className="px-4 py-3 text-slate-500">{formatDate(p.date_ouverture, i18n.language)}</td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleClose(p.id)}
                              className="text-red-600 hover:bg-red-50 hover:text-red-600"
                              title={t('postes_vente.close', { defaultValue: 'Fermer' })}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Caisses physiques */}
            {caisses.length > 0 && (
              <div>
                <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                  {t('postes_vente.caisse_available', { defaultValue: 'Points de caisse' })}
                  <Badge className="bg-slate-400 text-white">{caisses.length}</Badge>
                </h4>
                <div className="rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100 text-slate-500">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold">{t('postes_vente.table.name', { defaultValue: 'Nom' })}</th>
                        <th className="px-4 py-3 text-left font-semibold">{t('postes_vente.table.status', { defaultValue: 'Statut' })}</th>
                        <th className="px-4 py-3 text-right font-semibold">{t('postes_vente.table.actions', { defaultValue: 'Actions' })}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {caisses.map((caisse: PosteCaisse) => {
                        const desactivee = caisse.actif === false
                        const enCours = caisse.est_actif === true
                        const derniereActive = !desactivee && nbCaissesActives <= 1
                        return (
                          <tr key={caisse.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-medium text-slate-800">{caisse.nom}</td>
                            <td className="px-4 py-3">
                              {desactivee ? (
                                <Badge variant="outline" className="text-slate-500 border-slate-300">
                                  {t('postes_vente.status_disabled', { defaultValue: 'Désactivée' })}
                                </Badge>
                              ) : enCours ? (
                                <Badge className="bg-amber-500 text-white hover:bg-amber-500">
                                  {t('postes_vente.status_in_use', { defaultValue: 'En cours' })}
                                </Badge>
                              ) : (
                                <Badge className="bg-emerald-500 text-white hover:bg-emerald-500">
                                  {t('postes_vente.status_active', { defaultValue: 'Active' })}
                                </Badge>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleToggleCaisse(caisse)}
                                  disabled={(enCours && !desactivee) || derniereActive}
                                  className={desactivee
                                    ? 'text-emerald-600 hover:bg-emerald-50 hover:text-emerald-600'
                                    : 'text-amber-600 hover:bg-amber-50 hover:text-amber-600'}
                                  title={derniereActive
                                    ? t('postes_vente.last_active_hint', { defaultValue: 'Dernière caisse active : impossible à désactiver' })
                                    : desactivee
                                      ? t('postes_vente.reactivate', { defaultValue: 'Réactiver' })
                                      : t('postes_vente.deactivate', { defaultValue: 'Désactiver' })}
                                >
                                  <Power className="size-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteCaisse(caisse)}
                                  disabled={enCours || derniereActive}
                                  className="text-red-600 hover:bg-red-50 hover:text-red-600"
                                  title={derniereActive
                                    ? t('postes_vente.last_active_hint', { defaultValue: 'Dernière caisse active : impossible à supprimer' })
                                    : t('postes_vente.delete', { defaultValue: 'Supprimer' })}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Caisses physiques actives */}
            {caisseActives.length > 0 && (
              <div>
                <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                  {t('postes_vente.caisse_active', { defaultValue: 'Points de caisse actifs' })}
                  <Badge className="bg-emerald-500 text-white">{caisseActives.length}</Badge>
                </h4>
                <div className="rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100 text-slate-500">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold">{t('postes_vente.table.name', { defaultValue: 'Nom' })}</th>
                        <th className="px-4 py-3 text-left font-semibold">{t('postes_vente.table.vendeur', { defaultValue: 'Vendeur' })}</th>
                        <th className="px-4 py-3 text-left font-semibold">{t('postes_vente.table.opened', { defaultValue: 'Ouvert' })}</th>
                        <th className="px-4 py-3 text-right font-semibold">{t('postes_vente.table.actions', { defaultValue: 'Actions' })}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {caisseActives.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-800">{p.nom}</td>
                          <td className="px-4 py-3 text-slate-600">{p.vendeur_name || '-'}</td>
                          <td className="px-4 py-3 text-slate-500">{formatDate(p.date_ouverture, i18n.language)}</td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleClose(p.id)}
                              className="text-red-600 hover:bg-red-50 hover:text-red-600"
                              title={t('postes_vente.close', { defaultValue: 'Fermer' })}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
