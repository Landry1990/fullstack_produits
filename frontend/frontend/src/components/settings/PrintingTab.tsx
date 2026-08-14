import { MessageSquare, ChevronRight, Printer, Smartphone } from 'lucide-react'
import { Checkbox } from '../shadcn/checkbox'
import { Select } from '../ui/Select'
import type { PrintingTabProps } from './types'

export function PrintingTab({ formData, handleChange, t, invSettings, updateInvSettings }: PrintingTabProps) {
  return (
    <>
      {/* Section: Messages Ticket */}
      <div className="bg-white shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden rounded-2xl">
        <div className="p-0">
          <div className="px-8 py-5 border-b border-slate-200 bg-slate-50/50">
            <h2 className="font-bold text-xl flex items-center gap-3">
              <div className="p-2 bg-indigo-50 rounded-lg">
                <MessageSquare className="h-5 w-5 text-indigo-600" />
              </div>
              {t('sections.ticket')}
            </h2>
          </div>
          <div className="p-8 space-y-6">
            <div className="flex flex-col gap-1">
              <label>
                <span className="text-sm font-bold text-slate-500">{t('labels.receipt_header')}</span>
              </label>
              <textarea
                value={formData.receipt_header || ''}
                onChange={(e) => handleChange('receipt_header', e.target.value)}
                className="w-full rounded-xl p-4 transition-all leading-relaxed"
                rows={4}
                placeholder={t('placeholders.receipt_header')}
              />
              <label>
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <ChevronRight className="size-3" /> {t('hints.receipt_header')}
                </span>
              </label>
            </div>

            <div className="flex flex-col gap-1">
              <label>
                <span className="text-sm font-bold text-slate-500">{t('labels.ticket_footer')}</span>
              </label>
              <textarea
                value={formData.ticket_footer_message || ''}
                onChange={(e) => handleChange('ticket_footer_message', e.target.value)}
                className="w-full rounded-xl p-4 transition-all"
                rows={3}
                placeholder={t('placeholders.ticket_footer')}
              />
              <label>
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <ChevronRight className="size-3" /> {t('hints.ticket_footer')}
                </span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Section: Format & Multi-Caisse */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white shadow-xl border border-slate-200 rounded-2xl">
          <div className="p-6 p-8">
            <h3 className="font-bold text-lg flex items-center gap-3 mb-6">
              <Printer className="size-6 text-indigo-600" />
              {t('sections.printing_format')}
            </h3>
            <div className="flex flex-col gap-1">
              <label>
                <span className="text-sm font-bold text-slate-500">{t('labels.paper_width')}</span>
              </label>
              <Select
                size="lg"
                value={formData.ticket_paper_width || 80}
                onChange={(e) => handleChange('ticket_paper_width', parseInt(e.target.value))}
                className="rounded-xl"
              >
                <option value={80}>{t('labels.paper_standard')}</option>
                <option value={58}>{t('labels.paper_small')}</option>
              </Select>
            </div>
          </div>
        </div>

        <div className="bg-white shadow-xl border border-slate-200 rounded-2xl">
          <div className="p-6 p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg flex items-center gap-3">
                <Smartphone className="size-6 text-indigo-600" />
                {t('sections.multi_pos')}
              </h3>
              <Checkbox
                checked={invSettings?.is_multi_caisse || false}
                onCheckedChange={(checked) => updateInvSettings({ is_multi_caisse: !!checked })}
                className="ml-2"
              />
            </div>
            <p className="text-sm text-slate-500 italic leading-relaxed">
              {t('hints.multi_pos')}
            </p>
            
            {invSettings?.is_multi_caisse && (
              <div className="mt-6 p-5 bg-indigo-50/50 rounded-xl space-y-4 border border-indigo-100 animate-in zoom-in-95 duration-300">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold">{t('labels.centralized_cash_register')}</span>
                  <Checkbox
                    checked={invSettings?.centralized_cash_register || false}
                    onCheckedChange={(checked) => updateInvSettings({ centralized_cash_register: !!checked })}
                  />
                </div>
                <p className="text-xs text-slate-500">
                  {t('hints.centralized_cash_register')}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
