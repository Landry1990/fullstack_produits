import {
  FileText,
  Bell,
  Clock,
  Mail,
  Smartphone,
  MessageSquare,
  BarChart3,
  TrendingUp,
  DollarSign,
  Package,
  PackageX,
  AlertTriangle,
  Users,
} from 'lucide-react'
import { Input } from '../shadcn/input'
import { Checkbox } from '../shadcn/checkbox'
import type { SettingsTabProps } from './types'

export function ReportsTab({ formData, handleChange, t }: SettingsTabProps) {
  return (
    <>
      {/* Section: Activation et Configuration Générale */}
      <div className="bg-white shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden rounded-2xl">
        <div className="p-6 space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
            <div className="p-3 bg-indigo-50 rounded-xl">
              <FileText className="size-6 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">{t('sections.monthly_report')}</h3>
              <p className="text-sm text-slate-500">{t('hints.monthly_report')}</p>
            </div>
          </div>

          {/* Activation */}
          <div className="flex items-center justify-between p-4 bg-slate-100 rounded-xl">
            <div className="flex items-center gap-3">
              <Bell className="size-5 text-indigo-600" />
              <div>
                <p className="font-medium text-slate-800">{t('labels.monthly_report_enabled')}</p>
                <p className="text-xs text-slate-500">{t('hints.monthly_report_enabled')}</p>
              </div>
            </div>
            <Checkbox
              checked={formData.monthly_report_enabled || false}
              onCheckedChange={(checked) => handleChange('monthly_report_enabled', !!checked)}
            />
          </div>

          {/* Jour d'envoi */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label>
                <span className="font-medium text-slate-800 flex items-center gap-2">
                  <Clock className="size-4 text-slate-400" />
                  {t('labels.monthly_report_day')}
                </span>
              </label>
              <Input
                type="number"
                min={1}
                max={28}
                value={formData.monthly_report_day || 1}
                onChange={(e) => handleChange('monthly_report_day', parseInt(e.target.value))}
                className="w-full h-12 rounded-xl"
                disabled={!formData.monthly_report_enabled}
              />
              <label>
                <span className="text-xs text-slate-400">{t('hints.monthly_report_day')}</span>
              </label>
            </div>

            <div>
              <label>
                <span className="font-medium text-slate-800 flex items-center gap-2">
                  <Mail className="size-4 text-slate-400" />
                  {t('labels.report_recipients')}
                </span>
              </label>
              <textarea
                value={formData.report_recipients_email || ''}
                onChange={(e) => handleChange('report_recipients_email', e.target.value)}
                className="w-full rounded-xl min-h-[48px]"
                placeholder={t('placeholders.report_recipients')}
                disabled={!formData.monthly_report_enabled}
              />
              <label>
                <span className="text-xs text-slate-400">{t('hints.report_recipients')}</span>
              </label>
            </div>
          </div>

          {/* Options d'envoi */}
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={formData.report_send_whatsapp || false}
                onCheckedChange={(checked) => handleChange('report_send_whatsapp', !!checked)}
                disabled={!formData.monthly_report_enabled}
              />
              <span className="text-sm text-slate-800 flex items-center gap-1">
                <Smartphone className="size-4 text-emerald-600" />
                {t('labels.report_send_whatsapp')}
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={formData.report_send_telegram || false}
                onCheckedChange={(checked) => handleChange('report_send_telegram', !!checked)}
                disabled={!formData.monthly_report_enabled}
              />
              <span className="text-sm text-slate-800 flex items-center gap-1">
                <MessageSquare className="size-4 text-blue-500" />
                {t('labels.report_send_telegram')}
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Section: Éléments du Rapport */}
      <div className="bg-white shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden rounded-2xl">
        <div className="p-6 space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
            <div className="p-3 bg-emerald-50 rounded-xl">
              <BarChart3 className="size-6 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">{t('sections.report_items')}</h3>
              <p className="text-sm text-slate-500">{t('hints.report_items')}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Ventes */}
            <label className="flex items-start gap-3 p-4 bg-slate-100 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
              <Checkbox
                checked={formData.report_include_sales || false}
                onCheckedChange={(checked) => handleChange('report_include_sales', !!checked)}
                className="mt-0.5"
                disabled={!formData.monthly_report_enabled}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <TrendingUp className="size-4 text-emerald-600" />
                  <span className="font-medium text-slate-800">{t('report_items.sales.title')}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">{t('report_items.sales.hint')}</p>
              </div>
            </label>

            {/* Marges */}
            <label className="flex items-start gap-3 p-4 bg-slate-100 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
              <Checkbox
                checked={formData.report_include_margin || false}
                onCheckedChange={(checked) => handleChange('report_include_margin', !!checked)}
                className="mt-0.5"
                disabled={!formData.monthly_report_enabled}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <DollarSign className="size-4 text-emerald-600" />
                  <span className="font-medium text-slate-800">{t('report_items.margins.title')}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">{t('report_items.margins.hint')}</p>
              </div>
            </label>

            {/* Santé stock */}
            <label className="flex items-start gap-3 p-4 bg-slate-100 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
              <Checkbox
                checked={formData.report_include_stock_health || false}
                onCheckedChange={(checked) => handleChange('report_include_stock_health', !!checked)}
                className="mt-0.5"
                disabled={!formData.monthly_report_enabled}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Package className="size-4 text-blue-500" />
                  <span className="font-medium text-slate-800">{t('report_items.stock_health.title')}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">{t('report_items.stock_health.hint')}</p>
              </div>
            </label>

            {/* Ruptures */}
            <label className="flex items-start gap-3 p-4 bg-slate-100 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
              <Checkbox
                checked={formData.report_include_ruptures || false}
                onCheckedChange={(checked) => handleChange('report_include_ruptures', !!checked)}
                className="mt-0.5"
                disabled={!formData.monthly_report_enabled}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <PackageX className="size-4 text-red-600" />
                  <span className="font-medium text-slate-800">{t('report_items.ruptures.title')}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">{t('report_items.ruptures.hint')}</p>
              </div>
            </label>

            {/* Péremption */}
            <label className="flex items-start gap-3 p-4 bg-slate-100 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
              <Checkbox
                checked={formData.report_include_expiration || false}
                onCheckedChange={(checked) => handleChange('report_include_expiration', !!checked)}
                className="mt-0.5"
                disabled={!formData.monthly_report_enabled}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-4 text-amber-600" />
                  <span className="font-medium text-slate-800">{t('report_items.expiration.title')}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">{t('report_items.expiration.hint')}</p>
              </div>
            </label>

            {/* Top produits */}
            <label className="flex items-start gap-3 p-4 bg-slate-100 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
              <Checkbox
                checked={formData.report_include_top_products || false}
                onCheckedChange={(checked) => handleChange('report_include_top_products', !!checked)}
                className="mt-0.5"
                disabled={!formData.monthly_report_enabled}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <BarChart3 className="size-4 text-purple-600" />
                  <span className="font-medium text-slate-800">{t('report_items.top_products.title')}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">{t('report_items.top_products.hint')}</p>
              </div>
            </label>

            {/* Rotation lente */}
            <label className="flex items-start gap-3 p-4 bg-slate-100 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
              <Checkbox
                checked={formData.report_include_slow_moving || false}
                onCheckedChange={(checked) => handleChange('report_include_slow_moving', !!checked)}
                className="mt-0.5"
                disabled={!formData.monthly_report_enabled}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Clock className="size-4 text-slate-600" />
                  <span className="font-medium text-slate-800">{t('report_items.slow_moving.title')}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">{t('report_items.slow_moving.hint')}</p>
              </div>
            </label>

            {/* Dettes */}
            <label className="flex items-start gap-3 p-4 bg-slate-100 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
              <Checkbox
                checked={formData.report_include_debt || false}
                onCheckedChange={(checked) => handleChange('report_include_debt', !!checked)}
                className="mt-0.5"
                disabled={!formData.monthly_report_enabled}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Users className="size-4 text-indigo-600" />
                  <span className="font-medium text-slate-800">{t('report_items.debt.title')}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">{t('report_items.debt.hint')}</p>
              </div>
            </label>

            {/* Résumé financier */}
            <label className="flex items-start gap-3 p-4 bg-slate-100 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
              <Checkbox
                checked={formData.report_include_financial_summary || false}
                onCheckedChange={(checked) => handleChange('report_include_financial_summary', !!checked)}
                className="mt-0.5"
                disabled={!formData.monthly_report_enabled}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <DollarSign className="size-4 text-emerald-600" />
                  <span className="font-medium text-slate-800">{t('report_items.financial.title')}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">{t('report_items.financial.hint')}</p>
              </div>
            </label>

            {/* Comparaison */}
            <label className="flex items-start gap-3 p-4 bg-slate-100 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors md:col-span-2 lg:col-span-3">
              <Checkbox
                checked={formData.report_include_comparison || false}
                onCheckedChange={(checked) => handleChange('report_include_comparison', !!checked)}
                className="mt-0.5"
                disabled={!formData.monthly_report_enabled}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <TrendingUp className="size-4 text-blue-500" />
                  <span className="font-medium text-slate-800">{t('report_items.comparison.title')}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">{t('report_items.comparison.hint')}</p>
              </div>
            </label>
          </div>
        </div>
      </div>
    </>
  )
}
