import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { AyantDroit } from '../../types'
import { Button } from '../shadcn/button'

interface AyantDroitSectionProps {
  ayantsDroitList: AyantDroit[]
  selectedAyantDroit: number | null
  setSelectedAyantDroit: (id: number | null) => void
  showNewAyantDroit: boolean
  setShowNewAyantDroit: (v: boolean) => void
  ayantDroitNom: string
  setAyantDroitNom: (v: string) => void
  ayantDroitMatricule: string
  setAyantDroitMatricule: (v: string) => void
  ayantDroitSociete: string
  setAyantDroitSociete: (v: string) => void
}

export default function AyantDroitSection({
  ayantsDroitList,
  selectedAyantDroit,
  setSelectedAyantDroit,
  showNewAyantDroit,
  setShowNewAyantDroit,
  ayantDroitNom,
  setAyantDroitNom,
  ayantDroitMatricule,
  setAyantDroitMatricule,
  ayantDroitSociete,
  setAyantDroitSociete,
}: AyantDroitSectionProps) {
  const { t } = useTranslation(['facturation', 'common'])

  const selectedData = useMemo(() =>
    ayantsDroitList.find(ad => ad.id === selectedAyantDroit),
  [ayantsDroitList, selectedAyantDroit])

  const handleSelectFromList = (id: number | null) => {
    const ad = ayantsDroitList.find(a => a.id === id)
    if (ad) {
      setSelectedAyantDroit(ad.id ?? null)
      setAyantDroitNom(ad.nom)
      setAyantDroitMatricule(ad.matricule)
      setAyantDroitSociete(ad.societe || '')
      setShowNewAyantDroit(false)
    } else {
      setSelectedAyantDroit(null)
      setAyantDroitNom('')
      setAyantDroitMatricule('')
      setAyantDroitSociete('')
    }
  }

  const startNewAyantDroit = () => {
    setShowNewAyantDroit(true)
    setSelectedAyantDroit(null)
    setAyantDroitNom('')
    setAyantDroitMatricule('')
    setAyantDroitSociete('')
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider py-0">
          {t('facturation:client.ayant_droit.label')}
        </label>
        {ayantsDroitList.length > 0 && !showNewAyantDroit && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={startNewAyantDroit}
            className="h-7 text-xs font-medium"
            title={t('facturation:client.ayant_droit.new_tooltip')}
          >
            {t('facturation:client.ayant_droit.new_button')}
          </Button>
        )}
      </div>

      {showNewAyantDroit || ayantsDroitList.length === 0 ? (
        <div className="grid grid-cols-3 gap-2 relative">
          <input
            type="text"
            value={ayantDroitNom}
            onChange={(e) => {
              setAyantDroitNom(e.target.value)
              setSelectedAyantDroit(null)
              setShowNewAyantDroit(true)
            }}
            placeholder={t('facturation:client.ayant_droit.name_placeholder')}
            className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:bg-white focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-all"
          />
          <input
            type="text"
            value={ayantDroitMatricule}
            onChange={(e) => setAyantDroitMatricule(e.target.value)}
            placeholder={t('facturation:client.ayant_droit.matricule_placeholder')}
            className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:bg-white focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-all"
          />
          <input
            type="text"
            value={ayantDroitSociete}
            onChange={(e) => setAyantDroitSociete(e.target.value)}
            placeholder={t('facturation:client.ayant_droit.societe_placeholder')}
            className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:bg-white focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-all"
          />
          {ayantsDroitList.length > 0 && (
            <button
              type="button"
              onClick={() => setShowNewAyantDroit(false)}
              className="text-[10px] text-slate-500 hover:text-emerald-600 underline col-span-3"
            >
              {t('facturation:client.ayant_droit.existing_button')}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2">
            <select
              value={selectedAyantDroit !== null ? String(selectedAyantDroit) : ''}
              onChange={(e) => handleSelectFromList(e.target.value ? Number(e.target.value) : null)}
              className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:bg-white focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-all"
            >
              <option value="">{t('facturation:client.ayant_droit.select_placeholder')}</option>
              {Array.isArray(ayantsDroitList) && ayantsDroitList.map((ad) => (
                <option key={ad?.id ?? `ad-${ad?.nom}-${ad?.matricule}`} value={String(ad?.id ?? '')}>
                  {ad?.nom || 'N/A'} ({ad?.matricule || 'N/A'}){ad?.societe ? ` - ${ad.societe}` : ''}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={startNewAyantDroit}
              className="h-8 text-xs font-medium px-2 shrink-0"
              title={t('facturation:client.ayant_droit.new_tooltip')}
            >
              {t('facturation:client.ayant_droit.new_button')}
            </Button>
          </div>

          {selectedData && (
            <div className="mt-2 p-2 rounded-lg bg-emerald-50 border border-emerald-100 text-xs grid grid-cols-2 gap-x-4 gap-y-1">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">{t('facturation:client.ayant_droit.name_placeholder')}</span>
                <span className="font-medium text-slate-800">{selectedData.nom}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">{t('facturation:client.ayant_droit.matricule_placeholder')}</span>
                <span className="font-medium text-slate-800">{selectedData.matricule}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">{t('facturation:client.ayant_droit.societe_placeholder')}</span>
                <span className="font-medium text-slate-800">{selectedData.societe || '—'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">{t('facturation:client.label')}</span>
                <span className="font-medium text-emerald-700">{selectedData.client_name}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
