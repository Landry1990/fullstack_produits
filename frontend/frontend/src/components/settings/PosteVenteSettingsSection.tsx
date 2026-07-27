import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Store, Plus, Loader2, Trash2, AlertCircle } from 'lucide-react'
import { Button } from '../ui/Button'
import { Input } from '../shadcn/input'
import { Badge } from '../shadcn/badge'
import { toast } from 'react-hot-toast'
import {
  cashSessionService,
  type PosteVente,
  type PosteCaisse,
} from '../../services/cashSessionService'
import { getApiErrorDetail } from '../../utils/errorHandling'

function formatDate(value: string | null): string {
  if (!value) return '-'
  try {
    return new Date(value).toLocaleString('fr-FR')
  } catch {
    return value
  }
}

export default function PosteVenteSettingsSection() {
  const { t } = useTranslation('pharmacy_settings')
  const [postes, setPostes] = useState<PosteVente[]>([])
  const [caissesDisponibles, setCaissesDisponibles] = useState<PosteCaisse[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [newNom, setNewNom] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [data, caisses] = await Promise.all([
        cashSessionService.getPostesVente().catch(() => []),
        cashSessionService.getCaissesDisponibles().catch(() => [])
      ])
      setPostes(data)
      setCaissesDisponibles(caisses)
    } catch (err) {
      toast.error(getApiErrorDetail(err, 'Erreur chargement points de vente'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleCreate = async () => {
    const nom = newNom.trim()
    if (!nom) {
      toast.error('Veuillez saisir un nom.')
      return
    }
    setSubmitting(true)
    try {
      await cashSessionService.createPosteVente({ nom })
      toast.success('Point de vente créé avec succès.')
      setNewNom('')
      await loadData()
    } catch (err) {
      toast.error(getApiErrorDetail(err, 'Erreur création point de vente'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm('Supprimer ce point de vente ?')) return
    try {
      await cashSessionService.deletePosteVente(id)
      toast.success('Point de vente supprimé.')
      await loadData()
    } catch (err) {
      toast.error(getApiErrorDetail(err, 'Erreur suppression'))
    }
  }

  const handleClose = async (id: number) => {
    if (!window.confirm('Fermer ce point de vente ?')) return
    try {
      await cashSessionService.forcerFermeturePosteVente(id)
      toast.success('Point de vente fermé.')
      await loadData()
    } catch (err) {
      toast.error(getApiErrorDetail(err, 'Erreur fermeture'))
    }
  }

  // Points de vente (mode POS, ouverts depuis Facturation, sans caisse physique)
  const definitionsActives = postes.filter((p) => p.mode_pos && p.est_actif)
  const definitionsDisponibles = postes.filter((p) => !p.caisse && !p.est_actif)

  // Postes créés depuis une caisse physique (ouverture depuis Caisse Centrale)
  const caisseActives = postes.filter((p) => !!p.caisse && p.est_actif)

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
              placeholder={t('postes_vente.name_placeholder', { defaultValue: 'Ex: Comptoir 1, Comptoir 2...' })}
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
          <div className="flex justify-center py-12">
            <Loader2 className="size-8 animate-spin text-indigo-600" />
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
                <p className="text-sm text-slate-400 italic">
                  {t('postes_vente.no_available', { defaultValue: 'Aucun point de vente disponible. Créez-en un ci-dessus.' })}
                </p>
              ) : (
                <div className="rounded-xl border border-slate-200 overflow-hidden">
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
                <div className="rounded-xl border border-slate-200 overflow-hidden">
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
                          <td className="px-4 py-3 text-slate-500">{formatDate(p.date_ouverture)}</td>
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

            {/* Caisses physiques disponibles */}
            {caissesDisponibles.length > 0 && (
              <div>
                <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                  {t('postes_vente.caisse_available', { defaultValue: 'Points de caisse disponibles' })}
                  <Badge className="bg-slate-400 text-white">{caissesDisponibles.length}</Badge>
                </h4>
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100 text-slate-500">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold">{t('postes_vente.table.name', { defaultValue: 'Nom' })}</th>
                        <th className="px-4 py-3 text-right font-semibold">{t('postes_vente.table.actions', { defaultValue: 'Actions' })}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {caissesDisponibles.map((caisse: PosteCaisse) => (
                        <tr key={caisse.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-800">{caisse.nom}</td>
                          <td className="px-4 py-3 text-right">—</td>
                        </tr>
                      ))}
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
                <div className="rounded-xl border border-slate-200 overflow-hidden">
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
                          <td className="px-4 py-3 text-slate-500">{formatDate(p.date_ouverture)}</td>
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
