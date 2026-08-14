import { Package, ChevronRight, Lock, Settings } from 'lucide-react'
import { Input } from '../shadcn/input'
import { Checkbox } from '../shadcn/checkbox'
import type { SettingsTabProps } from './types'

export function StocksTab({ formData, handleChange, t }: SettingsTabProps) {
  return (
    <>
      <div className="bg-white shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden rounded-2xl">
        <div className="p-0">
          <div className="px-8 py-5 border-b border-slate-200 bg-slate-50/50">
            <h2 className="font-bold text-xl flex items-center gap-3">
              <div className="p-2 bg-indigo-50 rounded-lg">
                <Package className="h-5 w-5 text-indigo-600" />
              </div>
              {t('sections.alerts_system')}
            </h2>
          </div>
          <div className="p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="flex flex-col gap-1">
                <label>
                  <span className="text-sm font-bold text-slate-500">{t('labels.low_stock_days')}</span>
                </label>
                <Input
                  type="number"
                  value={formData.low_stock_threshold_days || 15}
                  onChange={(e) => handleChange('low_stock_threshold_days', parseInt(e.target.value))}
                  className="w-full h-12 rounded-xl"
                />
                <label>
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                      <ChevronRight className="size-3" /> {t('hints.low_stock')}
                  </span>
                </label>
              </div>
              <div className="flex flex-col gap-1">
                <label>
                  <span className="text-sm font-bold text-slate-500">{t('labels.dormant_stock_days')}</span>
                </label>
                <Input
                  type="number"
                  value={formData.dormant_stock_days || 90}
                  onChange={(e) => handleChange('dormant_stock_days', parseInt(e.target.value))}
                  className="w-full h-12 rounded-xl"
                />
                <label>
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                      <ChevronRight className="size-3" /> {t('hints.dormant_stock')}
                  </span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="flex flex-col gap-1">
                <label>
                  <span className="text-sm font-bold text-slate-500">{t('labels.debt_threshold')}</span>
                </label>
                <Input
                  type="number"
                  value={formData.debt_alert_threshold || '100000'}
                  onChange={(e) => handleChange('debt_alert_threshold', e.target.value)}
                  className="w-full h-12 rounded-xl"
                />
                <label>
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                      <ChevronRight className="size-3" /> {t('hints.debt')}
                  </span>
                </label>
              </div>
              <div className="flex flex-col gap-1">
                <label>
                  <span className="text-sm font-bold text-slate-500">{t('labels.auto_logout')}</span>
                </label>
                <Input
                  type="number"
                  min="0"
                  value={formData.auto_logout_timeout !== undefined ? formData.auto_logout_timeout : 15}
                  onChange={(e) => handleChange('auto_logout_timeout', parseInt(e.target.value) || 0)}
                  className="w-full h-12 rounded-xl"
                />
                <label>
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                      <ChevronRight className="size-3" /> {t('hints.auto_logout')}
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section: Paramètres Caisse (Sécurité) */}
      <div className="bg-white shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden rounded-2xl">
        <div className="p-0">
          <div className="px-8 py-5 border-b border-slate-200 bg-slate-50/50">
            <h2 className="font-bold text-xl flex items-center gap-3">
              <div className="p-2 bg-amber-50 rounded-lg">
                <Lock className="h-5 w-5 text-amber-600" />
              </div>
              {t('sections.cash_security')}
            </h2>
          </div>
          <div className="p-8 space-y-6">
            <div className="flex items-start gap-4">
              <Checkbox
                id="hide_cash_totals"
                checked={formData.hide_cash_totals || false}
                onCheckedChange={(checked) => handleChange('hide_cash_totals', !!checked)}
                className="mt-1"
              />
              <div className="flex-1">
                <label htmlFor="hide_cash_totals" className="font-medium text-slate-800 cursor-pointer">
                  {t('labels.hide_cash_totals')}
                </label>
                <p className="text-sm text-slate-500 mt-1">
                  {t('hints.hide_cash_totals')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden rounded-2xl">
        <div className="p-0">
          <div className="px-8 py-5 border-b border-slate-200 bg-slate-50/50">
            <h2 className="font-bold text-xl flex items-center gap-3">
              <div className="p-2 bg-indigo-50 rounded-lg">
                <Settings className="h-5 w-5 text-indigo-600" />
              </div>
              {t('sections.orders')}
            </h2>
          </div>
          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="flex flex-col gap-1">
                <label>
                  <span className="text-sm font-bold text-slate-500">{t('labels.coeff_direct')}</span>
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="1"
                  value={formData.coefficient_direct_commande || ''}
                  onChange={(e) => handleChange('coefficient_direct_commande', e.target.value)}
                  className="w-full font-bold text-indigo-600 h-12 rounded-xl"
                  placeholder={t('placeholders.coeff_direct')}
                />
                <label>
                  <span className="text-xs text-slate-400 flex flex-col gap-1 mt-1">
                    <span className="flex items-center gap-1 font-medium"><ChevronRight className="size-3" /> {t('hints.coeff_direct')}</span>
                    <span className="flex items-center gap-1 italic"><ChevronRight className="size-3" /> {t('hints.coeff_formula')}</span>
                  </span>
                </label>
              </div>

              <div className="flex flex-col gap-1">
                <label>
                  <span className="text-sm font-bold text-slate-500">{t('labels.taux_change')}</span>
                </label>
                <Input
                  type="number"
                  step="0.001"
                  min="1"
                  value={formData.taux_change_actif || ''}
                  onChange={(e) => handleChange('taux_change_actif', e.target.value)}
                  className="w-full font-bold text-indigo-600 h-12 rounded-xl"
                  placeholder={t('placeholders.taux_change')}
                />
                <label>
                  <span className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                    <ChevronRight className="size-3" /> {t('hints.taux_change')}
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
