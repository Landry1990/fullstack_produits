import { DollarSign, Info } from 'lucide-react'
import { Input } from '../shadcn/input'
import { Select } from '../ui/Select'
import type { FiscalTabProps } from './types'

export function FiscalTab({ formData, handleChange, t, isMargeAdministree, isReel }: FiscalTabProps) {
  return (
    <div className="bg-white shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden rounded-2xl">
      <div className="px-8 py-5 border-b border-slate-200 bg-slate-50/50">
        <h2 className="font-bold text-xl flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <DollarSign className="h-5 w-5 text-indigo-600" />
          </div>
          {t('sections.fiscal')}
        </h2>
        <p className="text-sm text-slate-500 mt-2">
          {t('hints.fiscal_intro')}
        </p>
      </div>
      <div className="p-8 space-y-6">
        {/* Régime fiscal */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">{t('labels.regime_fiscal')}</label>
            <Select
              value={formData.regime_fiscal || 'REEL'}
              onChange={(e) => handleChange('regime_fiscal', e.target.value)}
            >
              <option value="REEL">{t('options.regime_reel')}</option>
              <option value="SIMPLIFIE">{t('options.regime_simplifie')}</option>
            </Select>
            <p className="text-xs text-slate-400 mt-1">
              {t('hints.regime_fiscal')}
            </p>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">{t('labels.mode_imposition')}</label>
            <Select
              value={formData.mode_imposition || 'MARGE_ADMINISTREE'}
              onChange={(e) => handleChange('mode_imposition', e.target.value)}
            >
              <option value="MARGE_ADMINISTREE">{t('options.imposition_marge')}</option>
              <option value="DROIT_COMMUN">{t('options.imposition_common')}</option>
            </Select>
            <p className="text-xs text-slate-400 mt-1">
              {t('hints.mode_imposition')}
            </p>
          </div>
        </div>

        {/* Taux d'accompte — actifs uniquement en Droit Commun */}
        <div className={`border-t border-slate-200 pt-6 transition-all duration-300 ${isMargeAdministree ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
          <div className="flex items-center gap-2 mb-4">
            <h3 className="font-bold text-sm text-slate-600 uppercase tracking-wide">{t('fiscal.acompte_title')}</h3>
            {isMargeAdministree && (
              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{t('hints.disabled_marge')}</span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`transition-all duration-300 ${isReel ? '' : 'opacity-40'}`}>
              <label className="block text-xs font-medium text-slate-500 mb-1">{t('labels.taux_acompte_reel')}</label>
              <Input
                type="number"
                step="0.01"
                value={formData.taux_accompte_reel ?? 2}
                onChange={(e) => handleChange('taux_accompte_reel', parseFloat(e.target.value))}
                className="font-bold"
                disabled={isMargeAdministree || !isReel}
              />
            </div>
            <div className={`transition-all duration-300 ${!isReel ? '' : 'opacity-40'}`}>
              <label className="block text-xs font-medium text-slate-500 mb-1">{t('labels.taux_acompte_simplifie')}</label>
              <Input
                type="number"
                step="0.01"
                value={formData.taux_accompte_simplifie ?? 5}
                onChange={(e) => handleChange('taux_accompte_simplifie', parseFloat(e.target.value))}
                className="font-bold"
                disabled={isMargeAdministree || isReel}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">{t('labels.taux_cac')}</label>
              <Input
                type="number"
                step="0.01"
                value={formData.taux_cac ?? 10}
                onChange={(e) => handleChange('taux_cac', parseFloat(e.target.value))}
                className="font-bold"
                disabled={isMargeAdministree}
              />
            </div>
          </div>
        </div>

        {/* Taux de précompte — actifs uniquement en Droit Commun */}
        <div className={`border-t border-slate-200 pt-6 transition-all duration-300 ${isMargeAdministree ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
          <div className="flex items-center gap-2 mb-4">
            <h3 className="font-bold text-sm text-slate-600 uppercase tracking-wide">{t('fiscal.precompte_title')}</h3>
            {isMargeAdministree && (
              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{t('hints.disabled_marge')}</span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={`transition-all duration-300 ${isReel ? '' : 'opacity-40'}`}>
              <label className="block text-xs font-medium text-slate-500 mb-1">{t('labels.taux_precompte_reel')}</label>
              <Input
                type="number"
                step="0.01"
                value={formData.taux_precompte_reel ?? 1}
                onChange={(e) => handleChange('taux_precompte_reel', parseFloat(e.target.value))}
                className="font-bold"
                disabled={isMargeAdministree || !isReel}
              />
            </div>
            <div className={`transition-all duration-300 ${!isReel ? '' : 'opacity-40'}`}>
              <label className="block text-xs font-medium text-slate-500 mb-1">{t('labels.taux_precompte_simplifie')}</label>
              <Input
                type="number"
                step="0.01"
                value={formData.taux_precompte_simplifie ?? 5}
                onChange={(e) => handleChange('taux_precompte_simplifie', parseFloat(e.target.value))}
                className="font-bold"
                disabled={isMargeAdministree || isReel}
              />
            </div>
          </div>
        </div>

        {/* Marge administrée — active uniquement en Marge Administrée */}
        <div className={`border-t border-slate-200 pt-6 transition-all duration-300 ${!isMargeAdministree ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
          <div className="flex items-center gap-2 mb-4">
            <h3 className="font-bold text-sm text-slate-600 uppercase tracking-wide">{t('fiscal.marge_brute_title')}</h3>
            {!isMargeAdministree && (
              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{t('hints.disabled_common')}</span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">{t('labels.taux_marge_brute')}</label>
              <Input
                type="number"
                step="0.01"
                value={formData.taux_marge_brute ?? 14}
                onChange={(e) => handleChange('taux_marge_brute', parseFloat(e.target.value))}
                className="font-bold"
                disabled={!isMargeAdministree}
              />
            </div>
          </div>
        </div>

        {/* Info box */}
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex gap-3">
          <Info className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
          <div className="text-sm text-slate-600 space-y-1">
            <p className="font-bold text-slate-700">{t('fiscal.info_title')}</p>
            <p>• <strong>{t('options.regime_reel')}</strong> : {t('fiscal.info_reel')}</p>
            <p>• <strong>{t('options.regime_simplifie')}</strong> : {t('fiscal.info_simplifie')}</p>
            <p>• <strong>{t('fiscal.marge_brute_title')}</strong> : {t('fiscal.info_marge')}</p>
            <p>• <strong>{t('options.imposition_common')}</strong> : {t('fiscal.info_common')}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
