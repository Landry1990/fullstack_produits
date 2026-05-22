import { useState, useEffect, useCallback } from 'react'
import api from '../services/api'
import { toast } from 'react-hot-toast'
import { fr } from 'date-fns/locale'
import 'react-datepicker/dist/react-datepicker.css'
import DatePicker, { registerLocale } from 'react-datepicker'
import { generateClotureTemplate } from '../utils/print/printTemplates'
import BestCashierMetric from './BestCashierMetric'
import { format } from 'date-fns'
import { formatCurrency, normalizeNumberInput } from '../utils/formatters'
import { useTranslation } from 'react-i18next'
import { usePharmacySettings } from '../hooks/usePharmacySettings'

registerLocale('fr', fr)

import { 
  CheckCircle,
  XCircle,
  Banknote,
  Eye,
  Printer,
  Monitor
} from 'lucide-react'

interface ClotureCaisse {
  id: number
  date: string
  montant_reel: string
  montant_theorique: string
  ecart_caisse: string
  total_ventes: string | number
  total_entrees: string | number
  total_sorties: string | number
  details_paiement: Record<string, any>
  date_debut: string | null
  date_fin: string | null
  user: number | null
  user_name: string
  cloture_par_name?: string
  username: string
  observation: string | null
}

export default function HistoriqueClotures() {
  const { t } = useTranslation(['cash_closings', 'common'])
  const { settings: pharmacySettings } = usePharmacySettings()
  const currentLocale = t('common:locale', { defaultValue: 'fr-FR' })
  const currencySymbol = t(['common:currency_symbol', 'currency_symbol'], 'F')
  const [clotures, setClotures] = useState<ClotureCaisse[]>([])
  const [loading, setLoading] = useState(false)
  
  // Utilisateurs pour le filtrage
  const [users, setUsers] = useState<any[]>([])
  const [selectedUser, setSelectedUser] = useState<string>('')
  
  // Filtres — par défaut : mois en cours
  const [dateDebut, setDateDebut] = useState<Date | null>(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [dateFin, setDateFin] = useState<Date | null>(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth() + 1, 0)
  })
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(31)
  const [totalItems, setTotalItems] = useState(0)
  
  // Totaux globaux de la période
  const [globalTotals, setGlobalTotals] = useState<any>(null)

  // Multi-Caisse
  const [postesCaisses, setPostesCaisses] = useState<any[]>([])
  const [selectedPosteCaisse, setSelectedPosteCaisse] = useState<string>('')
  const [isMultiCaisse, setIsMultiCaisse] = useState(false)
  
  // Sélection
  const [selectedCloture, setSelectedCloture] = useState<ClotureCaisse | null>(null)
  // const { settings: pharmacySettings } = usePharmacySettings()

  // Metric month/year (default to now)
  const [metricMonth, setMetricMonth] = useState<string>(() => format(new Date(), 'MM'))
  const [metricYear, setMetricYear] = useState<string>(() => format(new Date(), 'yyyy'))
  const [showMetric, setShowMetric] = useState(false)


  // Récupérer les données initiales (utilisateurs, réglages, postes)
  useEffect(() => {
    const initPage = async () => {
      try {
        const [usersRes, settingsRes, postesRes] = await Promise.all([
          api.get('caisse/page_init/'),
          api.get('invoice-settings/'),
          api.get('postes-caisses/')
        ])
        
        setUsers(usersRes.data.users || [])
        setIsMultiCaisse(settingsRes.data.is_multi_caisse ?? false)
        setPostesCaisses(postesRes.data.results || postesRes.data || [])
      } catch (err) {
        console.error('Erreur initialisation HistoriqueClotures:', err)
      }
    }
    initPage()
  }, [])

  // Helper pour formater la date en YYYY-MM-DD
  const formatDateForApi = (date: Date): string => {
    const pad = (num: number) => num.toString().padStart(2, '0')
    const year = date.getFullYear()
    const month = pad(date.getMonth() + 1)
    const day = pad(date.getDate())
    return `${year}-${month}-${day}`
  }

  const fetchClotures = useCallback(async (page = currentPage) => {
    setLoading(true)
    try {
      const params: Record<string, any> = {
        page,
        page_size: pageSize
      }
      
      if (dateDebut) params.date_debut = formatDateForApi(dateDebut)
      if (dateFin) params.date_fin = formatDateForApi(dateFin)
      if (selectedUser) params.user = selectedUser
      if (selectedPosteCaisse) params.poste_caisse = selectedPosteCaisse
      
      const response = await api.get('clotures-caisse/', { params })
      
      const { results, count, totals } = response.data
      setClotures(results || [])
      setTotalItems(count || 0)
      setGlobalTotals(totals || null)
    } catch (err) {
      console.error('Erreur chargement clôtures:', err)
      toast.error(t('table.loading_error') || 'Erreur lors du chargement des clôtures')
    } finally {
      setLoading(false)
    }
  }, [pageSize, dateDebut, dateFin, selectedUser, selectedPosteCaisse, t])

  // Fetch data whenever filters or page change
  useEffect(() => {
    fetchClotures(currentPage)
  }, [fetchClotures, currentPage, dateDebut, dateFin, selectedUser, selectedPosteCaisse])

  const handleSearch = () => {
    setCurrentPage(1)
    fetchClotures(1)
  }

  const resetFilters = () => {
    const now = new Date()
    setDateDebut(new Date(now.getFullYear(), now.getMonth(), 1))
    setDateFin(new Date(now.getFullYear(), now.getMonth() + 1, 0))
    setSelectedUser('')
    setSelectedPosteCaisse('')
    setCurrentPage(1)
  }

  const totalPages = Math.ceil(totalItems / pageSize)

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString(currentLocale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatMoney = (value: string | number) => {
    return formatCurrency(normalizeNumberInput(value), currentLocale, currencySymbol)
  }

  const getModeLabel = (mode: string) => {
    return t(`common:payment_modes.${mode}`, { defaultValue: mode })
  }

  const handlePrint = (cloture: ClotureCaisse) => {
    const win = window.open('', '', 'height=600,width=400')
    if (win) {
      const htmlContent = generateClotureTemplate({
        ...cloture,
        montant_reel: cloture.montant_reel,
        montant_theorique: cloture.montant_theorique,
        ecart_caisse: cloture.ecart_caisse,
        total_ventes: cloture.total_ventes,
        total_entrees: cloture.total_entrees,
        total_sorties: cloture.total_sorties,
        details_paiement: cloture.details_paiement,
        pharmacy_name: pharmacySettings.pharmacy_name
      });
      
      win.document.write(`
        <html>
          <head>
            <title>Clôture Caisse #${cloture.id}</title>
            <style>
              @media print {
                body { margin: 0; padding: 0; }
                @page { margin: 0; }
              }
              body { margin: 0; padding: 2mm; width: 80mm; background: white; }
            </style>
          </head>
          <body>
            ${htmlContent}
          </body>
        </html>
      `)
      win.document.close()
      
      // Wait for resources if any (none in this template currently but good practice)
      win.onload = () => {
        win.print();
        // win.close(); // Optionnel: fermer après impression
      };
      
      // Fallback if onload doesn't trigger
      setTimeout(() => {
        if (win) win.print();
      }, 500);
    }
  }

  return (
    <div className="h-full flex flex-col bg-base-200/50">
      {/* Header and Filters Card */}
      <div className="bg-base-100 border-b border-base-200 shrink-0 p-6">
        <div className="flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-end">
          <div>
            <h1 className="text-2xl font-bold text-base-content flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <Banknote className="size-6" />
              </div>
              {t('title')}
            </h1>
            <p className="text-base-content/60 mt-1 pl-12 text-sm">
              {t('description')}
            </p>
          </div>

          <div className="flex flex-wrap lg:flex-nowrap gap-3 items-end w-full lg:w-auto">
            <div className="form-control flex-1 lg:w-48">
              <label className="label py-1">
                <span className="label-text text-xs font-bold uppercase tracking-wider text-base-content/70">{t('filters.date_start')}</span>
              </label>
              <DatePicker
                selected={dateDebut}
                onChange={(date: Date | null) => {
                  const now = new Date()
                  setDateDebut(date ?? new Date(now.getFullYear(), now.getMonth(), 1))
                  setCurrentPage(1)
                }}
                dateFormat="dd/MM/yyyy"
                placeholderText={t('filters.select_placeholder')}
                locale="fr"
                className="input input-bordered input-sm w-full bg-base-50"
                isClearable
              />
            </div>

            <div className="form-control flex-1 lg:w-48">
              <label className="label py-1">
                <span className="label-text text-xs font-bold uppercase tracking-wider text-base-content/70">{t('filters.date_end')}</span>
              </label>
              <DatePicker
                selected={dateFin}
                onChange={(date: Date | null) => {
                  const now = new Date()
                  setDateFin(date ?? new Date(now.getFullYear(), now.getMonth() + 1, 0))
                  setCurrentPage(1)
                }}
                dateFormat="dd/MM/yyyy"
                placeholderText={t('filters.select_placeholder')}
                locale="fr"
                className="input input-bordered input-sm w-full bg-base-50"
                isClearable
                minDate={dateDebut || undefined}
              />
            </div>

            <div className="form-control flex-1 lg:w-48">
                <label className="label py-1">
                    <span className="label-text text-xs font-bold uppercase tracking-wider text-base-content/70">{t('filters.cashier')}</span>
                </label>
                <select
                    value={selectedUser}
                    onChange={(e) => {
                        setSelectedUser(e.target.value)
                        setCurrentPage(1)
                    }}
                    className="select select-bordered select-sm w-full bg-base-50 font-medium"
                >
                    <option value="">👤 {t('filters.all_cashiers') || 'Tous les caissiers'}</option>
                    {users.map((u: any) => (
                        <option key={u.id} value={u.id}>
                            {u.first_name ? `${u.first_name} ${u.last_name || ''}` : u.username}
                        </option>
                    ))}
                </select>
            </div>

            {isMultiCaisse && (
                <div className="form-control flex-1 lg:w-48">
                    <label className="label py-1">
                        <span className="label-text text-xs font-bold uppercase tracking-wider text-base-content/70">Poste de Caisse</span>
                    </label>
                    <select
                        value={selectedPosteCaisse}
                        onChange={(e) => {
                            setSelectedPosteCaisse(e.target.value)
                            setCurrentPage(1)
                        }}
                        className="select select-bordered select-sm w-full bg-base-50 font-medium"
                    >
                        <option value="">🖥️ Tous les postes</option>
                        {postesCaisses.map((p: any) => (
                            <option key={p.id} value={p.id}>{p.nom}</option>
                        ))}
                    </select>
                </div>
            )}

            <div className="flex gap-2">
              <button 
                onClick={handleSearch} 
                className="btn btn-sm btn-primary lg:px-6"
                disabled={loading}
              >
                {loading ? <span className="loading loading-spinner loading-xs"></span> : t('filters.filter_btn')}
              </button>

              {(dateDebut || dateFin) && (
                <button 
                  onClick={resetFilters}
                  className="btn btn-sm btn-ghost"
                  title={t('filters.reset_title')}
                  disabled={loading}
                >
                  ✕ {t('filters.reset_btn')}
                </button>
              )}
{/* 
              <button 
                onClick={exportExcel}
                className="btn btn-sm btn-outline btn-success gap-2"
                disabled={loading || clotures.length === 0}
              >
                <Download className="size-4" />
                Excel
              </button> */}
            </div>
          </div>
        </div>
      </div>

      {/* Best Cashier Ranking Section */}
      <div className="px-3 sm:px-6 pt-4 sm:pt-6">
        <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 overflow-hidden">
          <div className="p-4 border-b border-base-200 flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center bg-base-100/50">
            <h2 className="font-black text-sm uppercase tracking-widest text-base-content/60 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
              {t('performance.title')}
            </h2>
            <div className="flex flex-wrap gap-2 items-center justify-end w-full sm:w-auto">
              <select 
                className="select select-bordered select-xs h-8 font-bold"
                value={metricMonth}
                onChange={(e) => {
                  const m = e.target.value
                  setMetricMonth(m)
                  const y = parseInt(metricYear)
                  const mo = parseInt(m) - 1
                  setDateDebut(new Date(y, mo, 1))
                  setDateFin(new Date(y, mo + 1, 0))
                }}
              >
                <option value="01">{t('performance.months.01')}</option>
                <option value="02">{t('performance.months.02')}</option>
                <option value="03">{t('performance.months.03')}</option>
                <option value="04">{t('performance.months.04')}</option>
                <option value="05">{t('performance.months.05')}</option>
                <option value="06">{t('performance.months.06')}</option>
                <option value="07">{t('performance.months.07')}</option>
                <option value="08">{t('performance.months.08')}</option>
                <option value="09">{t('performance.months.09')}</option>
                <option value="10">{t('performance.months.10')}</option>
                <option value="11">{t('performance.months.11')}</option>
                <option value="12">{t('performance.months.12')}</option>
              </select>
              <select 
                className="select select-bordered select-xs h-8 font-bold"
                value={metricYear}
                onChange={(e) => {
                  const y = e.target.value
                  setMetricYear(y)
                  const mo = parseInt(metricMonth) - 1
                  setDateDebut(new Date(parseInt(y), mo, 1))
                  setDateFin(new Date(parseInt(y), mo + 1, 0))
                }}
              >
                {[2024, 2025, 2026, 2027].map(y => (
                    <option key={y} value={y.toString()}>{y}</option>
                ))}
              </select>
              <button 
                onClick={() => setShowMetric(!showMetric)}
                className="btn btn-ghost btn-xs h-8 px-3 font-bold"
              >
                {showMetric ? t('performance.hide') : t('performance.show')}
              </button>
            </div>
          </div>
          {showMetric && (
            <div className="p-6 bg-base-200/30">
              <BestCashierMetric month={metricMonth} year={metricYear} userId={selectedUser || undefined} />
            </div>
          )}
        </div>
      </div>

      {/* Global Stats Cards */}
      {globalTotals && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6 shrink-0">
          <div className="bg-base-100 rounded-xl p-5 border border-base-200 shadow-sm flex flex-col justify-center">
             <div className="flex justify-between items-start">
               <div>
                  <h3 className="text-base-content/60 text-xs font-bold uppercase tracking-wider">{t('stats.theoretical_total')}</h3>
                  <p className="text-2xl font-bold mt-1">{formatMoney(globalTotals.montant_theorique)}</p>
               </div>
               <div className="p-3 bg-base-200/50 rounded-lg text-base-content">
                 <Banknote className="size-6" />
               </div>
             </div>
          </div>

          <div className="bg-base-100 rounded-xl p-5 border border-base-200 shadow-sm flex flex-col justify-center">
             <div className="flex justify-between items-start">
               <div>
                  <h3 className="text-base-content/60 text-xs font-bold uppercase tracking-wider">{t('stats.real_total')}</h3>
                  <p className="text-2xl font-bold mt-1 text-primary">{formatMoney(globalTotals.montant_reel)}</p>
               </div>
               <div className="p-3 bg-primary/10 rounded-lg text-primary">
                 <CheckCircle className="size-6" />
               </div>
             </div>
          </div>

          <div className="bg-base-100 rounded-xl p-5 border border-base-200 shadow-sm flex flex-col justify-center">
             <div className="flex justify-between items-start">
               <div>
                  <h3 className="text-base-content/60 text-xs font-bold uppercase tracking-wider">{t('stats.global_gap')}</h3>
                  <p className={`text-2xl font-bold mt-1 ${normalizeNumberInput(globalTotals.ecart_caisse) < 0 ? 'text-error' : normalizeNumberInput(globalTotals.ecart_caisse) > 0 ? 'text-success' : 'text-base-content/50'}`}>
                    {normalizeNumberInput(globalTotals.ecart_caisse) > 0 ? '+' : ''}{formatMoney(globalTotals.ecart_caisse)}
                  </p>
               </div>
                <div className={`p-3 rounded-lg ${normalizeNumberInput(globalTotals.ecart_caisse) < 0 ? 'bg-error/10 text-error' : normalizeNumberInput(globalTotals.ecart_caisse) > 0 ? 'bg-success/10 text-success' : 'bg-base-200/50 text-base-content'}`}>
                 <XCircle className="size-6" />
               </div>
             </div>
          </div>
        </div>
      )}

      {/* Table Section */}
      <div className="flex-1 px-3 sm:px-6 pb-4 sm:pb-6 overflow-hidden flex flex-col">
        <div className="bg-base-100 border border-base-200 rounded-xl shadow-sm flex-1 flex flex-col overflow-hidden">
          <div className="overflow-x-auto flex-1">
            <table className="table table-sm w-full">
              <thead className="bg-base-200 sticky top-0 z-10 opacity-100">
                <tr>
                  <th className="py-4 text-xs tracking-wider uppercase">{t('table.header_date')}</th>
                  {isMultiCaisse && <th className="py-4 text-xs tracking-wider uppercase">Poste</th>}
                  <th className="py-4 text-xs tracking-wider uppercase">{t('table.header_cashier')}</th>
                  <th className="py-4 text-xs tracking-wider uppercase">{t('table.header_done_by')}</th>
                  <th className="text-right py-4 text-xs tracking-wider uppercase">{t('table.header_theoretical')}</th>
                  <th className="text-right py-4 text-xs tracking-wider uppercase">{t('table.header_real')}</th>
                  <th className="text-right py-4 text-xs tracking-wider uppercase">{t('table.header_gap')}</th>
                  <th className="text-center py-4 text-xs tracking-wider uppercase">{t('table.header_actions')}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="h-64 text-center">
                      <span className="loading loading-spinner loading-lg text-primary"></span>
                    </td>
                  </tr>
                ) : clotures.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="h-64 text-center text-base-content/50">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <Banknote className="size-12 text-base-content/20" />
                        <p className="text-lg">{t('table.no_cloture')}</p>
                        <p className="text-sm">{t('table.no_cloture_desc')}</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  clotures.map((cloture) => (
                    <tr key={cloture.id} className="hover:bg-base-200/30 transition-colors">
                      <td className="py-3">
                        <div className="font-semibold text-sm">{formatDate(cloture.date)}</div>
                        <div className="text-xs text-base-content/50 mt-0.5">
                          {t('table.period_desc', { 
                            start: cloture.date_debut ? formatDate(cloture.date_debut) : '...', 
                            end: cloture.date_fin ? formatDate(cloture.date_fin) : '...' 
                          })}
                        </div>
                      </td>
                      {isMultiCaisse && (
                         <td className="py-3">
                           <div className="badge badge-sm badge-outline font-bold text-base-content/70">
                             {(cloture as any).poste_caisse_nom || '-'}
                           </div>
                         </td>
                      )}
                      <td className="py-3">
                         <div className="font-medium">{cloture.user_name || cloture.username || 'N/A'}</div>
                      </td>
                      <td className="py-3">
                         <div className="text-xs font-semibold text-base-content/70">{cloture.cloture_par_name || '-'}</div>
                      </td>
                      <td className="text-right py-3 text-base-content/80 font-medium">
                        {formatMoney(cloture.montant_theorique)}
                      </td>
                      <td className="text-right py-3 font-bold text-primary">
                        {formatMoney(cloture.montant_reel)}
                      </td>
                      <td className="text-right py-3">
                        <div className={`badge badge-sm ${normalizeNumberInput(cloture.ecart_caisse) < 0 ? 'badge-error' : normalizeNumberInput(cloture.ecart_caisse) > 0 ? 'badge-success' : 'badge-ghost'} font-bold px-3 py-3`}>
                          {normalizeNumberInput(cloture.ecart_caisse) > 0 ? '+' : ''}{formatMoney(cloture.ecart_caisse)}
                        </div>
                      </td>
                      <td className="text-center py-3">
                        <div className="flex justify-center gap-2">
                          <button 
                            onClick={() => setSelectedCloture(cloture)}
                            className="btn btn-sm btn-ghost btn-square text-primary"
                            title={t('table.view_details')}
                          >
                            <Eye className="size-5" />
                          </button>
                          <button 
                            onClick={() => handlePrint(cloture)}
                            className="btn btn-sm btn-ghost btn-square text-base-content/70"
                            title={t('table.print')}
                          >
                            <Printer className="size-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              
              {/* Footer Totaux Période */}
              {globalTotals && clotures.length > 0 && (
                <tfoot className="bg-base-200/40 border-t-2 border-base-300">
                  <tr className="text-base-content font-bold">
                    <td className="py-4 whitespace-nowrap" colSpan={2}>
                      <span className="uppercase text-[10px] tracking-tight">{t('table.period_total', { count: totalItems })}</span>
                    </td>
                    <td className="text-right py-4 text-base-content/80 text-lg">{formatMoney(globalTotals.montant_theorique)}</td>
                    <td className="text-right py-4 text-primary text-lg">{formatMoney(globalTotals.montant_reel)}</td>
                    <td className={`text-right py-4 text-lg ${normalizeNumberInput(globalTotals.ecart_caisse) < 0 ? 'text-error' : normalizeNumberInput(globalTotals.ecart_caisse) > 0 ? 'text-success' : ''}`}>
                      {normalizeNumberInput(globalTotals.ecart_caisse) > 0 ? '+' : ''}{formatMoney(globalTotals.ecart_caisse)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="bg-base-100 border-t border-base-200 p-4 flex items-center justify-between shrink-0">
            <span className="text-sm text-base-content/60">
              {t('pagination.showing', { 
                start: totalItems > 0 ? (currentPage - 1) * pageSize + 1 : 0, 
                end: Math.min(currentPage * pageSize, totalItems), 
                total: totalItems 
              })}
              <span className="badge badge-sm badge-ghost ml-2">{pageSize} {t('pagination.per_page')}</span>
            </span>
            <div className="join">
              <button 
                className="join-item btn btn-sm" 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1 || loading}
              >
                {t('pagination.prev')}
              </button>
              <button className="join-item btn btn-sm bg-base-200 no-animation pointer-events-none w-24">
                {totalPages > 0 ? t('pagination.page', { current: currentPage, total: totalPages }) : '-'}
              </button>
              <button 
                className="join-item btn btn-sm" 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || totalPages === 0 || loading}
              >
                {t('pagination.next')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal détails (Inchangé d'aspect mais on conserve l'existant car il dépend de DaisyUI) */}
      {selectedCloture && (
        <dialog className="modal modal-open bg-black/40 backdrop-blur-sm">
          <div className="modal-box max-w-xl p-0 overflow-hidden">
            <div className="bg-primary p-6 text-primary-content">
              <h3 className="font-bold text-xl flex items-center gap-3">
                <Banknote className="size-6" />
                {t('modal.title')}
              </h3>
              <p className="opacity-80 text-sm mt-1 pb-1">
                {t('modal.cash_of', { name: selectedCloture.user_name || selectedCloture.username || t('common:unknown') })}
                {selectedCloture.cloture_par_name && t('modal.closed_by', { name: selectedCloture.cloture_par_name })}
              </p>
            </div>

            <div className="p-6 space-y-6">
              {/* En-tête Date / Période */}
              <div className="bg-base-100 rounded-xl border border-base-200 p-4 shadow-sm flex items-center gap-4">
                 <div className="flex-1">
                   <p className="text-xs uppercase font-bold text-base-content/50">{t('modal.date_label')}</p>
                   <p className="font-mono text-lg">{formatDate(selectedCloture.date)}</p>
                 </div>
                 <div className="w-px h-10 bg-base-200"></div>
                 <div className="flex-1 text-right">
                   <p className="text-xs uppercase font-bold text-base-content/50">{t('modal.period_label')}</p>
                   <p className="text-sm">{t('modal.period_from', { date: selectedCloture.date_debut ? formatDate(selectedCloture.date_debut) : '...' })}</p>
                   <p className="text-sm">{t('modal.period_to', { date: selectedCloture.date_fin ? formatDate(selectedCloture.date_fin) : '...' })}</p>
                 </div>
              </div>

              {/* Stats principales */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-base-100 p-4 rounded-xl border border-base-200">
                  <div className="text-xs uppercase font-bold text-base-content/50 mb-1">{t('modal.theoretical_label')}</div>
                  <div className="text-2xl font-bold">{formatMoney(selectedCloture.montant_theorique)}</div>
                </div>
                <div className="bg-primary/5 p-4 rounded-xl border border-primary/20">
                  <div className="text-xs uppercase font-bold text-primary mb-1">{t('modal.real_label')}</div>
                  <div className="text-2xl font-bold text-primary">{formatMoney(selectedCloture.montant_reel)}</div>
                </div>
              </div>

              {/* Écart */}
              <div className={`p-4 rounded-xl flex items-center justify-between ${normalizeNumberInput(selectedCloture.ecart_caisse) === 0 ? 'bg-success/10 text-success' : normalizeNumberInput(selectedCloture.ecart_caisse) > 0 ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
                <div className="font-bold uppercase tracking-wider text-sm">{t('modal.gap_label')}</div>
                <div className="font-bold text-xl">
                  {normalizeNumberInput(selectedCloture.ecart_caisse) > 0 ? '+' : ''}{formatMoney(selectedCloture.ecart_caisse)}
                </div>
              </div>

              {/* Flux financiers */}
              <div className="space-y-3">
                <h4 className="font-bold uppercase tracking-wider text-xs text-base-content/50 border-b border-base-200 pb-2">{t('modal.flows_summary')}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-base-100 border border-base-200 p-3 rounded-lg text-center flex flex-col justify-center relative">
                    <div className="text-xs opacity-60 font-bold">{t('modal.ventes')} : {formatMoney(selectedCloture.total_ventes)}</div>
                    <div className="text-[10px] mt-1 text-base-content/60">Pharmacie: {formatMoney(selectedCloture.details_paiement?.__meta__?.total_ca_pharmacie ?? selectedCloture.total_ventes)}</div>
                    {(selectedCloture.details_paiement?.__meta__?.total_ca_divers ?? 0) > 0 && (
                      <div className="text-[10px] text-base-content/60">Diverses: {formatMoney(selectedCloture.details_paiement?.__meta__?.total_ca_divers)}</div>
                    )}
                  </div>
                  <div className="bg-success/5 border border-success/20 p-3 rounded-lg text-center">
                    <div className="text-xs opacity-60 text-success uppercase">{t('modal.entries')}</div>
                    <div className="font-bold text-success">{formatMoney(selectedCloture.total_entrees)}</div>
                  </div>
                  <div className="bg-error/5 border border-error/20 p-3 rounded-lg text-center">
                    <div className="text-xs opacity-60 text-error uppercase">{t('modal.exits')}</div>
                    <div className="font-bold text-error">{formatMoney(selectedCloture.total_sorties)}</div>
                  </div>
                </div>
              </div>

              {/* Détails Paiement */}
              {selectedCloture.details_paiement && Object.keys(selectedCloture.details_paiement).length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-bold uppercase tracking-wider text-xs text-base-content/50 border-b border-base-200 pb-2">{t('modal.mode_details')}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {Object.entries(selectedCloture.details_paiement).filter(([mode]) => mode !== '__meta__').map(([mode, montant]) => (
                      <div key={mode} className="flex justify-between p-2 bg-base-50 rounded text-sm">
                        <span className="flex items-center gap-2">
                          {mode === 'especes' && '💵'}
                          {mode === 'carte' && '💳'}
                          {mode === 'cheque' && '📝'}
                          {mode === 'virement' && '🏦'}
                          {mode === 'coupon' && '🎟️'}
                          {(mode === 'om' || mode === 'momo') && '📱'}
                          {getModeLabel(mode)}
                        </span>
                        <span className="font-semibold">{formatMoney(montant)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedCloture.observation && (
                <div className="space-y-2">
                  <h4 className="font-bold uppercase tracking-wider text-xs text-base-content/50">{t('modal.observations')}</h4>
                  <p className="text-sm bg-base-50 p-3 rounded-lg border border-base-200 italic">"{selectedCloture.observation}"</p>
                </div>
              )}
            </div>

            <div className="modal-action border-t border-base-200 p-4 bg-base-50 m-0">
              <button onClick={() => handlePrint(selectedCloture)} className="btn btn-primary btn-outline gap-2 mr-auto">
                <Printer className="size-5" />
                {t('modal.print')}
              </button>
              <button 
                onClick={() => setSelectedCloture(null)} 
                className="btn btn-ghost"
              >
                {t('modal.close')}
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setSelectedCloture(null)}></div>
        </dialog>
      )}
    </div>
  )
}

