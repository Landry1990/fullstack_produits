import { useState, useEffect } from 'react'
import { MessageSquare, ChevronRight, Printer, RefreshCw, Smartphone } from 'lucide-react'
import { Checkbox } from '../shadcn/checkbox'
import { Select } from '../shadcn/select'
import { gooeyToast } from 'goey-toast'
import {
  getSavedPrinterName,
  getSavedLabelPrinterName,
  setLabelPrinterName as setSavedLabelPrinterName,
  setPrinterName as setSavedPrinterName,
  shouldOpenDrawer,
  setOpenDrawer as setSavedOpenDrawer,
  listPrinters,
  printTestTicket,
} from '../../services/qzPrinter'
import { logger } from '../../utils/logger'
import type { PrintingTabProps } from './types'

export function PrintingTab({ formData, handleChange, t, invSettings, updateInvSettings }: PrintingTabProps) {
  const [printerName, setPrinterName] = useState(getSavedPrinterName() || '')
  const [labelPrinterName, setLabelPrinterName] = useState(getSavedLabelPrinterName() || '')
  const [openDrawer, setOpenDrawer] = useState(shouldOpenDrawer())
  const [printers, setPrinters] = useState<string[]>([])
  const [detecting, setDetecting] = useState(false)
  const [testingPrint, setTestingPrint] = useState(false)

  useEffect(() => {
    setPrinterName(getSavedPrinterName() || '')
    setLabelPrinterName(getSavedLabelPrinterName() || '')
    setOpenDrawer(shouldOpenDrawer())
  }, [])

  const handlePrinterChange = (value: string) => {
    setPrinterName(value)
    setSavedPrinterName(value)
  }

  const handleOpenDrawerChange = (checked: boolean) => {
    setOpenDrawer(checked)
    setSavedOpenDrawer(checked)
  }

  const handleDetectPrinters = async () => {
    setDetecting(true)
    try {
      const list = await listPrinters()
      setPrinters(list)
      if (!printerName && list.length > 0) {
        handlePrinterChange(list[0])
      }
      gooeyToast.success(t('messages.qz_printers_found', { count: list.length, defaultValue: `${list.length} imprimante(s) détectée(s)` }))
    } catch (err) {
      logger.warn('Erreur détection imprimantes QZ Tray', err)
      const detail = err instanceof Error ? ` (${err.message})` : ''
      gooeyToast.error(t('messages.qz_not_found') + detail)
    } finally {
      setDetecting(false)
    }
  }

  const handleTestPrint = async () => {
    setTestingPrint(true)
    try {
      await printTestTicket(formData.pharmacy_name)
      gooeyToast.success(t('messages.print_test_sent'))
    } catch (err) {
      logger.warn('Erreur test impression QZ Tray', err)
      const detail = err instanceof Error ? ` (${err.message})` : ''
      gooeyToast.error(t('messages.qz_not_found') + detail)
    } finally {
      setTestingPrint(false)
    }
  }

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
                className="w-full rounded-xl p-4 transition-all leading-relaxed normal-case"
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
                className="w-full rounded-xl p-4 transition-all normal-case"
                rows={3}
                placeholder={t('placeholders.ticket_footer')}
              />
              <label>
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <ChevronRight className="size-3" /> {t('hints.ticket_footer')}
                </span>
              </label>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-500">{t('labels.show_pharmacist')}</span>
                <Checkbox
                  checked={formData.show_pharmacist_on_documents || false}
                  onCheckedChange={(checked) => handleChange('show_pharmacist_on_documents', !!checked)}
                />
              </div>
              <label>
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <ChevronRight className="size-3" /> {t('hints.show_pharmacist')}
                </span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {invSettings && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-2">
          <label className="flex items-center justify-between gap-4" htmlFor="auto-print-ticket">
            <span className="text-sm font-bold text-slate-500">{t('labels.auto_print_ticket')}</span>
            <Checkbox
              id="auto-print-ticket"
              checked={invSettings.auto_print_ticket ?? false}
              onCheckedChange={(checked) => updateInvSettings({ auto_print_ticket: !!checked })}
            />
          </label>
          <p className="text-xs text-slate-400">{t('hints.auto_print_ticket')}</p>
        </div>
      )}

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
                value={formData.ticket_paper_width || 80}
                onChange={(e) => handleChange('ticket_paper_width', parseInt(e.target.value))}
                className="h-12 text-base rounded-xl"
              >
                <option value={80}>{t('labels.paper_standard')}</option>
                <option value={58}>{t('labels.paper_small')}</option>
              </Select>
            </div>
            <div className="flex flex-col gap-1 mt-5">
              <label>
                <span className="text-sm font-bold text-slate-500">{t('labels.document_language')}</span>
              </label>
              <Select
                value={formData.locale || 'fr-FR'}
                onChange={(e) => handleChange('locale', e.target.value)}
                className="h-12 text-base rounded-xl"
              >
                <option value="fr-FR">{t('labels.document_language_fr')}</option>
                <option value="en-US">{t('labels.document_language_en')}</option>
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
                {invSettings?.centralized_cash_register && (
                  <>
                    <div className="flex items-center justify-between border-t border-indigo-100 pt-4">
                      <span className="text-sm font-bold">{t('labels.require_validator_password')}</span>
                      <Checkbox
                        checked={invSettings?.require_validator_password !== false}
                        onCheckedChange={(checked) => updateInvSettings({ require_validator_password: !!checked })}
                      />
                    </div>
                    <p className="text-xs text-slate-500">
                      {t('hints.require_validator_password')}
                    </p>
                    <div className="flex items-center justify-between border-t border-indigo-100 pt-4">
                      <span className="text-sm font-bold">{t('labels.sudo_session_minutes')}</span>
                      <input
                        type="number"
                        min={0}
                        max={480}
                        className="w-24 h-8 px-2 text-sm border rounded-lg text-right"
                        key={invSettings?.sudo_session_minutes ?? 10}
                        defaultValue={invSettings?.sudo_session_minutes ?? 10}
                        onBlur={(e) => {
                          const val = Math.min(480, Math.max(0, Number(e.target.value) || 0));
                          e.target.value = String(val);
                          if (val !== (invSettings?.sudo_session_minutes ?? 10)) {
                            updateInvSettings({ sudo_session_minutes: val });
                          }
                        }}
                      />
                    </div>
                    <p className="text-xs text-slate-500">
                      {t('hints.sudo_session_minutes')}
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section: Imprimante ESC/POS (QZ Tray) */}
      <div className="bg-white shadow-xl border border-slate-200 rounded-2xl">
        <div className="p-6 p-8">
          <h3 className="font-bold text-lg flex items-center gap-3 mb-6">
            <Printer className="size-6 text-indigo-600" />
            {t('sections.qz_tray')}
          </h3>
          <p className="text-sm text-slate-500 italic leading-relaxed mb-6">
            {t('hints.qz_tray')}
          </p>

          <div className="flex flex-col gap-1">
            <label>
              <span className="text-sm font-bold text-slate-500">{t('labels.qz_printer')}</span>
            </label>
            <div className="flex gap-2">
              <Select
                value={printerName}
                onChange={(e) => handlePrinterChange(e.target.value)}
                className="flex-1 h-12 text-base rounded-xl"
              >
                {/* Vide = imprimante par défaut du système (fallback QZ Tray) */}
                <option value="">{t('labels.qz_printer_auto')}</option>
                {/* Nom sauvegardé conservé même s'il n'est pas détecté (imprimante éteinte) */}
                {printerName && !printers.includes(printerName) && (
                  <option value={printerName}>{printerName}</option>
                )}
                {printers.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </Select>
              <button
                type="button"
                onClick={handleDetectPrinters}
                disabled={detecting}
                className="inline-flex items-center gap-1 rounded-xl bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-100 disabled:opacity-50"
              >
                <RefreshCw className={`size-4 ${detecting ? 'animate-spin' : ''}`} />
                {t('buttons.detect')}
              </button>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-1">
            <label htmlFor="qz-label-printer" className="text-sm font-bold text-slate-500">
              {t('labels.label_printer')}
            </label>
            <Select
              id="qz-label-printer"
              value={labelPrinterName}
              onChange={(e) => {
                setLabelPrinterName(e.target.value)
                setSavedLabelPrinterName(e.target.value)
              }}
              className="h-12 text-base rounded-xl"
            >
              <option value="">{t('labels.label_printer_browser')}</option>
              {labelPrinterName && !printers.includes(labelPrinterName) && (
                <option value={labelPrinterName}>{labelPrinterName}</option>
              )}
              {printers.map((p) => <option key={p} value={p}>{p}</option>)}
            </Select>
            <p className="text-xs text-slate-400">{t('hints.label_printer')}</p>
          </div>

          <div className="mt-5 flex items-center justify-between">
            <span className="text-sm font-bold text-slate-500">{t('labels.open_drawer')}</span>
            <Checkbox
              checked={openDrawer}
              onCheckedChange={(checked) => handleOpenDrawerChange(!!checked)}
            />
          </div>

          <div className="mt-6">
            <button
              type="button"
              onClick={handleTestPrint}
              disabled={testingPrint}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {t('buttons.test_print')}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
