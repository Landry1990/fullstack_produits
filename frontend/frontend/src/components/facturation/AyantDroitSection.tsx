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

  return (
    <div className="mt-3 pt-3 border-t border-slate-200">
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider py-0">
          {t('facturation:client.ayant_droit.label')} <span className="text-red-500">*</span>
        </label>
        {ayantsDroitList.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setShowNewAyantDroit(!showNewAyantDroit)
              if (!showNewAyantDroit) {
                setSelectedAyantDroit(null)
                setAyantDroitNom('')
                setAyantDroitMatricule('')
                setAyantDroitSociete('')
              }
            }}
            className="h-7 text-xs font-medium"
            title={showNewAyantDroit ? t('facturation:client.ayant_droit.select_existing_tooltip') : t('facturation:client.ayant_droit.new_tooltip')}
          >
            {showNewAyantDroit ? t('facturation:client.ayant_droit.existing_button') : t('facturation:client.ayant_droit.new_button')}
          </Button>
        )}
      </div>

      {showNewAyantDroit || ayantsDroitList.length === 0 ? (
        <div className="space-y-2">
          <input
            type="text"
            value={ayantDroitNom}
            onChange={(e) => setAyantDroitNom(e.target.value)}
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
        </div>
      ) : (
        <select
          value={selectedAyantDroit !== null ? String(selectedAyantDroit) : ''}
          onChange={(e) => setSelectedAyantDroit(e.target.value ? Number(e.target.value) : null)}
          className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:bg-white focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-all"
        >
          <option value="">{t('facturation:client.ayant_droit.select_placeholder')}</option>
          {Array.isArray(ayantsDroitList) && ayantsDroitList.map((ad, _idx) => (
            <option key={ad?.id ?? `ad-${ad?.nom}-${ad?.matricule}`} value={String(ad?.id ?? '')}>
              {ad?.nom || 'N/A'} ({ad?.matricule || 'N/A'}){ad?.societe ? ` - ${ad.societe}` : ''}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}
