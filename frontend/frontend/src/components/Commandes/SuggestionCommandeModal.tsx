import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../../services/api'
import { toast } from 'react-hot-toast'
import { formatPrice } from '../../utils/formatters'
import type { Fournisseur, ProduitModel, CommandeProduit } from '../../types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../shadcn/dialog'
import { Button } from '../shadcn/button'
import { Badge } from '../shadcn/badge'
import { cn } from '../../lib/utils'
import {
  Brain,
  Calendar,
  CheckSquare,
  Square,
  Clock,
  DollarSign,
  Info,
  Package,
  Search,
  ChevronLeft,
  ShoppingCart,
  ArrowUpRight,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react'

interface SuggestionItem {
  produit_id: number
  produit_nom: string
  produit_ref: string
  stock_actuel: number
  ventes_periode: number
  quantite_suggeree: number
  prix_achat: number
  prix_vente?: number
  montant_ht?: number
  tva?: string
  taux_marge?: string
  score_urgence: number
  raison: string
  fournisseur_id?: number
  is_supplier_exclusive?: boolean
  promis_count?: number
  en_rupture_fournisseur?: boolean
}

interface SuggestionParams {
  periode: number
  fournisseurId: string
  mode: string
  budgetMax: string
  dateDebut: string
  dateFin: string
  abcAOnly: boolean
}

interface SuggestionCommandeModalProps {
  onClose: () => void
  onApply: (products: CommandeProduit[], fournisseurId: string) => void
  fournisseurs: Fournisseur[]
  produitsList: ProduitModel[]
}

export default function SuggestionCommandeModal({
  onClose,
  onApply,
  fournisseurs,
  produitsList,
}: SuggestionCommandeModalProps) {
  const { t } = useTranslation(['orders', 'common'])

  const now = new Date()
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const [suggestionParams, setSuggestionParams] = useState<SuggestionParams>({
    periode: 30,
    fournisseurId: '',
    mode: 'optimise',
    budgetMax: '',
    dateDebut: yesterday.toISOString().slice(0, 16),
    dateFin: now.toISOString().slice(0, 16),
    abcAOnly: false,
  })

  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([])
  const [totalHt, setTotalHt] = useState<number>(0)
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [stepSuggestion, setStepSuggestion] = useState<1 | 2>(1)
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set())

  async function fetchSuggestions() {
    setLoadingSuggestions(true)
    try {
      const basePayload = {
        mode: suggestionParams.mode,
        fournisseur_id: suggestionParams.fournisseurId ? parseInt(suggestionParams.fournisseurId) : null,
        abc_a_only: suggestionParams.abcAOnly,
      }
      const payload =
        suggestionParams.mode === 'ventes_horaire'
          ? { ...basePayload, date_debut: suggestionParams.dateDebut, date_fin: suggestionParams.dateFin }
          : { ...basePayload, periode: Number(suggestionParams.periode), budget_max: suggestionParams.budgetMax ? Number(suggestionParams.budgetMax) : null }

      const response = await api.post('generer-suggestions/', payload)
      const items: SuggestionItem[] = response.data.suggestions || []
      setSuggestions(items)
      setTotalHt(response.data.total_ht || 0)
      setSelectedSuggestions(new Set(items.map((_, i) => i)))
      setStepSuggestion(2)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string }
      toast.error(e.response?.data?.message || e.message || t('orders:suggestion_modal.generation_error'))
    } finally {
      setLoadingSuggestions(false)
    }
  }

  function handleApply() {
    const selectedItems = suggestions.filter((_, i) => selectedSuggestions.has(i))
    if (selectedItems.length === 0) {
      toast(t('orders:suggestion_modal.no_selection'), { icon: '⚠️' })
      return
    }

    const newLines: CommandeProduit[] = selectedItems.map((item, index) => {
      const realProduct = produitsList.find(p => p.id === item.produit_id)
      const productStub: ProduitModel = realProduct ?? ({
        id: item.produit_id,
        name: item.produit_nom,
        cip1: item.produit_ref,
        stock: item.stock_actuel,
        cost_price: String(item.prix_achat),
        selling_price: String(item.prix_vente ?? item.prix_achat * 1.3),
        tva: item.tva ?? '0',
        taux_marge: item.taux_marge ?? '1.3',
      } as unknown as ProduitModel)

      return {
        id: Date.now() + index,
        produit: productStub,
        quantity: item.quantite_suggeree,
        unites_gratuites: 0,
        price: String(item.prix_achat || productStub.cost_price || 0),
        tva: item.tva ?? productStub.tva ?? '0',
        marge: item.taux_marge ?? productStub.taux_marge ?? '1.3',
        selling_price: String(item.prix_vente ?? productStub.selling_price ?? 0),
        lot: '',
        date_expiration: '',
      }
    })

    const supplierId = suggestionParams.fournisseurId || (selectedItems[0]?.fournisseur_id ? String(selectedItems[0].fournisseur_id) : '')
    onApply(newLines, supplierId)
  }

  function toggleSuggestionSelection(index: number) {
    setSelectedSuggestions(prev => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const periodOptions = [
    { label: t('orders:suggestion_modal.period_guard'), value: 3 },
    { label: t('orders:suggestion_modal.period_week'), value: 7 },
    { label: t('orders:suggestion_modal.period_decade'), value: 10 },
    { label: t('orders:suggestion_modal.period_fortnight'), value: 15 },
    { label: t('orders:suggestion_modal.period_month'), value: 30 },
  ]

  const modes = [
    {
      key: 'simple',
      icon: <Package className="size-5" />,
      title: t('orders:suggestion_modal.mode_simple_title'),
      desc: t('orders:suggestion_modal.mode_simple_desc'),
    },
    {
      key: 'optimise',
      icon: <Brain className="size-5" />,
      title: t('orders:suggestion_modal.mode_smart_title'),
      desc: t('orders:suggestion_modal.mode_smart_desc'),
    },
    {
      key: 'ventes_horaire',
      icon: <Clock className="size-5" />,
      title: t('orders:suggestion_modal.mode_hourly_title'),
      desc: t('orders:suggestion_modal.mode_hourly_desc'),
    },
  ]

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent
        className="max-w-4xl w-full p-0 overflow-hidden rounded-2xl border border-slate-200 shadow-2xl shadow-emerald-900/10 bg-white"
        aria-labelledby="suggestion-modal-title"
        aria-describedby="suggestion-modal-desc"
      >
        {/* ── Header ── */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100 bg-gradient-to-br from-emerald-50 to-white">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-600/25">
              <Sparkles className="size-5 text-white" />
            </div>
            <div>
              <DialogTitle id="suggestion-modal-title" className="text-lg font-bold text-slate-900">
                {t('orders:suggestion_modal.title')}
              </DialogTitle>
              <DialogDescription id="suggestion-modal-desc" className="text-sm text-slate-500 mt-0.5">
                {stepSuggestion === 1
                  ? t('orders:suggestion_modal.subtitle_config')
                  : t('orders:suggestion_modal.subtitle_results', { count: suggestions.length })}
              </DialogDescription>
            </div>
            {stepSuggestion === 2 && (
              <Badge className="ml-auto bg-emerald-100 text-emerald-700 border-emerald-200 font-semibold">
                {suggestions.length} {t('orders:suggestion_modal.results_unit', 'articles')}
              </Badge>
            )}
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mt-4">
            {[1, 2].map(s => (
              <div key={s} className="flex items-center gap-2">
                <div className={cn(
                  'size-6 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                  s < stepSuggestion ? 'bg-emerald-600 text-white' :
                  s === stepSuggestion ? 'bg-emerald-600 text-white ring-4 ring-emerald-100' :
                  'bg-slate-200 text-slate-400'
                )}>
                  {s < stepSuggestion ? <CheckCircle2 className="size-4" /> : s}
                </div>
                <span className={cn(
                  'text-xs font-medium',
                  s === stepSuggestion ? 'text-emerald-700' : 'text-slate-400'
                )}>
                  {s === 1 ? t('orders:suggestion_modal.step_config', 'Paramètres') : t('orders:suggestion_modal.step_results', 'Résultats')}
                </span>
                {s < 2 && <div className="w-8 h-px bg-slate-200 mx-1" />}
              </div>
            ))}
          </div>
        </DialogHeader>

        {/* ── Body ── */}
        <div className="flex flex-col overflow-hidden" style={{ minHeight: '320px', maxHeight: '520px' }}>
          {stepSuggestion === 1 ? (
            /* ── STEP 1 : CONFIG ── */
            <div className="overflow-auto p-6 space-y-5">
              {/* Mode Selection */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                  {t('orders:suggestion_modal.mode_label', 'Mode d\'analyse')}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {modes.map(m => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setSuggestionParams(prev => ({ ...prev, mode: m.key }))}
                      className={cn(
                        'relative flex flex-col gap-2 p-4 rounded-xl border-2 text-left transition-all cursor-pointer',
                        suggestionParams.mode === m.key
                          ? 'border-emerald-500 bg-emerald-50 shadow-md shadow-emerald-100'
                          : 'border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/40'
                      )}
                    >
                      <div className={cn(
                        'size-9 rounded-lg flex items-center justify-center transition-colors',
                        suggestionParams.mode === m.key ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'
                      )}>
                        {m.icon}
                      </div>
                      <span className="font-semibold text-sm text-slate-800">{m.title}</span>
                      <p className="text-xs text-slate-500 leading-relaxed">{m.desc}</p>
                      {suggestionParams.mode === m.key && (
                        <span className="absolute top-3 right-3 size-2 rounded-full bg-emerald-500 ring-2 ring-emerald-200" />
                      )}
                    </button>
                  ))}
                </div>

                {suggestionParams.mode === 'optimise' && (
                  <button
                    type="button"
                    onClick={() => setSuggestionParams(prev => ({ ...prev, abcAOnly: !prev.abcAOnly }))}
                    className={cn(
                      'mt-3 flex items-center gap-2 text-sm font-medium transition-colors',
                      suggestionParams.abcAOnly ? 'text-emerald-700' : 'text-slate-600 hover:text-emerald-600'
                    )}
                  >
                    {suggestionParams.abcAOnly ? (
                      <CheckSquare className="size-5 text-emerald-600" />
                    ) : (
                      <Square className="size-5 text-slate-400" />
                    )}
                    {t('orders:suggestion_modal.abc_a_only_label')}
                  </button>
                )}
              </div>

              {/* Filters */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Supplier */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Package className="size-3 text-emerald-600" />
                      {t('orders:suggestion_modal.supplier_label')}
                    </label>
                    <select
                      className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors cursor-pointer"
                      value={suggestionParams.fournisseurId}
                      onChange={(e) => setSuggestionParams(prev => ({ ...prev, fournisseurId: e.target.value }))}
                    >
                      <option value="">{t('orders:suggestion_modal.all_suppliers')}</option>
                      {fournisseurs.map(f => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Budget */}
                  {suggestionParams.mode !== 'ventes_horaire' && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                        <DollarSign className="size-3 text-emerald-600" />
                        {t('orders:suggestion_modal.budget_label')}
                        <span title={t('orders:suggestion_modal.budget_tooltip')} className="cursor-help"><Info className="size-3 text-slate-300" /></span>
                      </label>
                      <div className="flex">
                        <input
                          type="number"
                          placeholder={t('orders:suggestion_modal.budget_placeholder')}
                          className="flex-1 h-10 px-3 rounded-l-lg border border-slate-300 border-r-0 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                          value={suggestionParams.budgetMax}
                          onChange={(e) => setSuggestionParams(prev => ({ ...prev, budgetMax: e.target.value }))}
                        />
                        <span className="h-10 px-3 flex items-center bg-slate-100 border border-slate-300 rounded-r-lg text-sm font-semibold text-slate-500">
                          {t('common:currency_symbol', 'F')}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Period / Date range */}
                {suggestionParams.mode === 'ventes_horaire' ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                        <Clock className="size-3 text-emerald-600" />
                        {t('orders:suggestion_modal.hourly_range_label')}
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="text-[10px] uppercase font-bold text-emerald-600 hover:text-emerald-700 hover:underline transition-colors"
                          onClick={() => {
                            const d = new Date(new Date().getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
                            setSuggestionParams(p => ({ ...p, dateDebut: d, dateFin: new Date().toISOString().slice(0, 16) }))
                          }}
                        >24h</button>
                        <button
                          type="button"
                          className="text-[10px] uppercase font-bold text-emerald-600 hover:text-emerald-700 hover:underline transition-colors"
                          onClick={() => {
                            const d = new Date().toISOString().slice(0, 10) + 'T00:00'
                            setSuggestionParams(p => ({ ...p, dateDebut: d, dateFin: new Date().toISOString().slice(0, 16) }))
                          }}
                        >{t('common:today', "Aujourd'hui")}</button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <span className="text-xs text-slate-500">{t('orders:suggestion_modal.date_from')}</span>
                        <input
                          type="datetime-local"
                          className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
                          value={suggestionParams.dateDebut}
                          onChange={(e) => setSuggestionParams(prev => ({ ...prev, dateDebut: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs text-slate-500">{t('orders:suggestion_modal.date_to')}</span>
                        <input
                          type="datetime-local"
                          className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
                          value={suggestionParams.dateFin}
                          onChange={(e) => setSuggestionParams(prev => ({ ...prev, dateFin: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar className="size-3 text-emerald-600" />
                      {t('orders:suggestion_modal.period_label')}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {periodOptions.map(p => (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() => setSuggestionParams(prev => ({ ...prev, periode: p.value }))}
                          className={cn(
                            'px-3 py-1.5 rounded-full text-xs font-semibold transition-all border cursor-pointer',
                            suggestionParams.periode === p.value
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                              : 'bg-white text-slate-600 border-slate-300 hover:border-emerald-400 hover:text-emerald-700'
                          )}
                        >
                          {p.label}
                        </button>
                      ))}
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-300 rounded-full ml-auto">
                        <input
                          type="number"
                          className="w-10 bg-transparent border-none focus:outline-none text-right text-xs font-bold text-emerald-700"
                          value={suggestionParams.periode}
                          min={1}
                          max={365}
                          onChange={(e) => setSuggestionParams(prev => ({ ...prev, periode: parseInt(e.target.value) || 0 }))}
                        />
                        <span className="text-xs text-slate-400">{t('orders:suggestion_modal.days_unit')}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ── STEP 2 : RÉSULTATS ── */
            <div className="flex flex-col flex-1 overflow-hidden gap-3 p-4">
              {/* Summary bar */}
              <div className="flex items-center justify-between gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-lg bg-emerald-600 flex items-center justify-center">
                    <TrendingUp className="size-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">{t('orders:suggestion_modal.analysis_done')}</p>
                    <p className="text-xs text-slate-500">{t('orders:suggestion_modal.results_count', { count: suggestions.length })}</p>
                  </div>
                </div>
                <div className="text-right bg-emerald-700 text-white rounded-xl px-4 py-2.5">
                  <div className="text-[10px] uppercase font-semibold text-emerald-200 flex items-center gap-1 justify-end mb-0.5">
                    <DollarSign className="size-3" />
                    {t('orders:suggestion_modal.total_estimated')}
                  </div>
                  <div className="text-lg font-bold font-mono tabular-nums">
                    {formatPrice(totalHt)} <span className="text-xs font-normal text-emerald-200">{t('common:currency_symbol')}</span>
                  </div>
                </div>
              </div>

              {/* Table */}
              {suggestions.length > 0 ? (
                <div className="flex-1 overflow-auto rounded-xl border border-slate-200 bg-white">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-3 w-10">
                          <input
                            type="checkbox"
                            className="size-4 rounded accent-emerald-600 cursor-pointer"
                            checked={selectedSuggestions.size === suggestions.length && suggestions.length > 0}
                            onChange={() => {
                              if (selectedSuggestions.size === suggestions.length) setSelectedSuggestions(new Set())
                              else setSelectedSuggestions(new Set(suggestions.map((_, i) => i)))
                            }}
                          />
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('orders:suggestion_modal.table_designation')}</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('orders:suggestion_modal.table_stock')}</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('orders:suggestion_modal.table_sales')}</th>
                        <th className="px-3 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('orders:suggestion_modal.table_qty')}</th>
                        <th className="px-3 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('orders:suggestion_modal.table_total_ht')}</th>
                        <th className="px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('orders:suggestion_modal.table_priority')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {suggestions.map((item, index) => (
                        <tr
                          key={item.produit_id}
                          className={cn(
                            'transition-colors cursor-pointer group',
                            selectedSuggestions.has(index)
                              ? 'bg-emerald-50 hover:bg-emerald-100/80'
                              : 'bg-white hover:bg-slate-50'
                          )}
                          onClick={() => toggleSuggestionSelection(index)}
                        >
                          <td className="px-3 py-2.5 w-10">
                            <input
                              type="checkbox"
                              className="size-4 rounded accent-emerald-600 cursor-pointer"
                              checked={selectedSuggestions.has(index)}
                              onClick={(e) => e.stopPropagation()}
                              onChange={() => toggleSuggestionSelection(index)}
                            />
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex flex-col gap-1">
                              <div className="font-semibold text-slate-800 flex items-center gap-1.5 flex-wrap text-sm">
                                {item.produit_nom}
                                {item.is_supplier_exclusive && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-700">{t('orders:suggestion_modal.exclusive_badge')}</span>
                                )}
                                {(item.promis_count ?? 0) > 0 && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-700">{t('orders:suggestion_modal.promis_badge', { count: item.promis_count })}</span>
                                )}
                                {item.en_rupture_fournisseur && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-600 animate-pulse">{t('orders:suggestion_modal.rupture_badge')}</span>
                                )}
                              </div>
                              <span className="text-[11px] text-slate-400 font-mono">REF: {item.produit_ref}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className={cn(
                              'px-2 py-0.5 rounded-full text-xs font-bold',
                              item.stock_actuel <= 0
                                ? 'bg-red-100 text-red-600'
                                : 'bg-slate-100 text-slate-600'
                            )}>
                              {item.stock_actuel}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-center text-sm font-medium text-slate-500">
                            {item.ventes_periode}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <div className="flex flex-col items-end">
                              <span className="text-base font-bold text-emerald-600">{item.quantite_suggeree}</span>
                              <span className="text-[10px] text-slate-400">
                                {formatPrice(item.prix_achat)} {t('common:currency_symbol', 'F')}/{t('common:units_short', 'u')}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-700 tabular-nums text-sm">
                            {formatPrice(item.montant_ht ?? (item.prix_achat * item.quantite_suggeree))} {t('common:currency_symbol', 'F')}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1.5">
                              {item.score_urgence > 50 ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-600">
                                  <AlertTriangle className="size-2.5" />
                                  {t('orders:suggestion_modal.critical_badge')}
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 uppercase">
                                  {t('orders:suggestion_modal.standard_badge')}
                                </span>
                              )}
                              <span title={item.raison} className="cursor-help"><ArrowUpRight className="size-3.5 text-slate-300 group-hover:text-emerald-500 transition-colors" /></span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 p-12 text-center bg-slate-50">
                  <div className="size-14 bg-slate-200 rounded-full flex items-center justify-center mb-4">
                    <Search className="size-7 text-slate-400" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-700">{t('orders:suggestion_modal.no_results_title')}</h3>
                  <p className="text-sm text-slate-500 max-w-xs mx-auto mt-1">{t('orders:suggestion_modal.no_results_desc')}</p>
                  <Button variant="ghost" size="sm" className="mt-4 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" onClick={() => setStepSuggestion(1)}>
                    {t('orders:suggestion_modal.modify_params')}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
          {stepSuggestion === 2 ? (
            <Button variant="ghost" size="sm" className="gap-2 text-slate-600 hover:text-slate-800" onClick={() => setStepSuggestion(1)}>
              <ChevronLeft className="size-4" />
              {t('orders:suggestion_modal.back_to_params')}
            </Button>
          ) : (
            <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-700" onClick={onClose}>
              {t('orders:suggestion_modal.close')}
            </Button>
          )}

          {stepSuggestion === 1 ? (
            <Button
              onClick={fetchSuggestions}
              disabled={loadingSuggestions}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 min-w-[160px]"
            >
              {loadingSuggestions ? (
                <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Search className="size-4" />
              )}
              {t('orders:suggestion_modal.launch_analysis')}
            </Button>
          ) : (
            <Button
              onClick={handleApply}
              disabled={selectedSuggestions.size === 0}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 min-w-[180px]"
            >
              <ShoppingCart className="size-4" />
              {t('orders:suggestion_modal.create_order', { count: selectedSuggestions.size })}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
