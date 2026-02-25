import { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import { toast } from 'react-hot-toast'
import { fr } from 'date-fns/locale'
import 'react-datepicker/dist/react-datepicker.css'
import DatePicker, { registerLocale } from 'react-datepicker'
import { usePharmacySettings } from '../hooks/usePharmacySettings'

registerLocale('fr', fr)

import { 
  CheckCircle,
  XCircle,
  Banknote,
  Eye,
  Printer
} from 'lucide-react'

interface ClotureCaisse {
  id: number
  date: string
  montant_reel: string
  montant_theorique: string
  ecart_caisse: string
  total_ventes: string
  total_entrees: string
  total_sorties: string
  details_paiement: Record<string, number>
  date_debut: string | null
  date_fin: string | null
  user: number | null
  user_name: string
  username: string
  observation: string | null
}

export default function HistoriqueClotures() {
  const [clotures, setClotures] = useState<ClotureCaisse[]>([])
  const [loading, setLoading] = useState(false)
  
  // Filtres
  const [dateDebut, setDateDebut] = useState<Date | null>(null)
  const [dateFin, setDateFin] = useState<Date | null>(null)
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(31)
  const [totalItems, setTotalItems] = useState(0)
  
  // Totaux globaux de la période
  const [globalTotals, setGlobalTotals] = useState<any>(null)
  
  // Sélection
  const [selectedCloture, setSelectedCloture] = useState<ClotureCaisse | null>(null)
  const { settings: pharmacySettings } = usePharmacySettings()

  const apiBaseUrl = useMemo(() => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL ?? ''
    return baseUrl ? String(baseUrl).replace(/\/$/, '') : ''
  }, [])

  // Helper pour formater la date en YYYY-MM-DD
  const formatDateForApi = (date: Date): string => {
    const pad = (num: number) => num.toString().padStart(2, '0')
    const year = date.getFullYear()
    const month = pad(date.getMonth() + 1)
    const day = pad(date.getDate())
    return `${year}-${month}-${day}`
  }

  const fetchClotures = async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = {
        page: currentPage,
        page_size: pageSize
      }
      
      if (dateDebut) params.date_debut = formatDateForApi(dateDebut)
      if (dateFin) params.date_fin = formatDateForApi(dateFin)
      
      const response = await axios.get(`${apiBaseUrl}/api/clotures-caisse/`, { params })
      
      const { results, count, totals } = response.data
      setClotures(results || [])
      setTotalItems(count || 0)
      setGlobalTotals(totals || null)
    } catch (err) {
      console.error('Erreur chargement clôtures:', err)
      toast.error('Erreur lors du chargement des clôtures')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchClotures()
  }, [currentPage]) // Re-fetch quand la page change

  const handleSearch = () => {
    setCurrentPage(1)
    fetchClotures()
  }

  const resetFilters = () => {
    setDateDebut(null)
    setDateFin(null)
    setCurrentPage(1)
    setTimeout(() => handleSearch(), 0)
  }

  const totalPages = Math.ceil(totalItems / pageSize)

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatMoney = (value: string | number) => {
    return Math.round(parseFloat(String(value))).toLocaleString('fr-FR')
  }

  const getModeLabel = (mode: string) => {
    const labels: Record<string, string> = {
      especes: 'Espèces',
      cheque: 'Chèque',
      carte: 'Carte',
      virement: 'Virement',
      om: 'Orange Money',
      momo: 'Mobile Money',
      coupon: 'Coupon'
    }
    return labels[mode] || mode
  }

  const handlePrint = (cloture: ClotureCaisse) => {
    const win = window.open('', '', 'height=600,width=400')
    if (win) {
      const content = `
        <div style="font-family: monospace; width: 80mm; margin: 0 auto; padding: 10px; color: black;">
          <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid black; padding-bottom: 10px;">
            <h2 style="margin: 0; font-size: 1.2em; font-weight: bold;">${pharmacySettings.pharmacy_name}</h2>
            <div style="font-size: 0.9em;">HISTORIQUE CLÔTURE</div>
            <div style="font-size: 0.8em; margin-top: 5px;">Clôture #${cloture.id}</div>
          </div>

          <div style="font-size: 0.8em; margin-bottom: 15px;">
            <div style="display: flex; justify-content: space-between;">
              <span>Date clôture:</span>
              <span>${formatDate(cloture.date)}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>Caissier:</span>
              <span>${cloture.user_name || cloture.username || 'N/A'}</span>
            </div>
          </div>

          <div style="border-top: 1px dashed black; border-bottom: 1px dashed black; padding: 8px 0; margin-bottom: 15px;">
            <div style="font-weight: bold; text-align: center; margin-bottom: 5px; text-transform: uppercase;">Période Clôturée</div>
            <div style="display: flex; justify-content: space-between; font-size: 0.9em;">
              <span>Du:</span>
              <span>${cloture.date_debut ? formatDate(cloture.date_debut) : 'Début'}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.9em;">
              <span>Au:</span>
              <span>${cloture.date_fin ? formatDate(cloture.date_fin) : 'Maintenant'}</span>
            </div>
          </div>

          <div style="margin-bottom: 15px;">
            <div style="font-weight: bold; margin-bottom: 5px; border-bottom: 1px dashed black;">DÉTAILS</div>
            ${Object.entries(cloture.details_paiement || {}).map(([mode, montant]) => `
              <div style="display: flex; justify-content: space-between; font-size: 0.9em;">
                <span>${getModeLabel(mode)}</span>
                <span>${formatMoney(montant)} F</span>
              </div>
            `).join('')}
          </div>

          <div style="border-top: 1px dashed black; padding-top: 5px; margin-bottom: 10px;">
            <div style="display: flex; justify-content: space-between; font-size: 0.9em;">
              <span>Total Ventes:</span>
              <span>${formatMoney(cloture.total_ventes)} F</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.9em;">
              <span>+ Entrées:</span>
              <span>${formatMoney(cloture.total_entrees)} F</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.9em;">
              <span>- Sorties:</span>
              <span>${formatMoney(cloture.total_sorties)} F</span>
            </div>
          </div>

          <div style="border-top: 2px solid black; padding-top: 10px;">
            <div style="display: flex; justify-content: space-between; font-weight: bold;">
              <span>THÉORIQUE:</span>
              <span>${formatMoney(cloture.montant_theorique)} F</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-weight: bold;">
              <span>RÉEL:</span>
              <span>${formatMoney(cloture.montant_reel)} F</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 1.1em; margin-top: 5px; ${parseFloat(cloture.ecart_caisse) !== 0 ? 'color: red;' : ''}">
              <span>ÉCART:</span>
              <span>${formatMoney(cloture.ecart_caisse)} F</span>
            </div>
          </div>

          <div style="text-align: center; font-size: 0.7em; margin-top: 20px;">
            --- Fin du rapport ---
          </div>
        </div>
      `
      
      win.document.write('<html><head><title>Clôture Caisse</title>')
      win.document.write('<style>body { font-family: monospace; padding: 0; margin: 0; } @media print { body { padding: 0; margin: 0; } }</style>')
      win.document.write('</head><body>')
      win.document.write(content)
      win.document.write('</body></html>')
      win.document.close()
      win.print()
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
                <Banknote className="w-6 h-6" />
              </div>
              Historique des Clôtures
            </h1>
            <p className="text-base-content/60 mt-1 pl-12 text-sm">
              Consultez et exportez l'historique complet des clôtures de caisse enregistrées.
            </p>
          </div>

          <div className="flex flex-wrap lg:flex-nowrap gap-3 items-end w-full lg:w-auto">
            <div className="form-control flex-1 lg:w-48">
              <label className="label py-1">
                <span className="label-text text-xs font-bold uppercase tracking-wider text-base-content/70">Date début</span>
              </label>
              <DatePicker
                selected={dateDebut}
                onChange={(date: Date | null) => setDateDebut(date)}
                dateFormat="dd/MM/yyyy"
                placeholderText="Sélectionner..."
                locale="fr"
                className="input input-bordered input-sm w-full bg-base-50"
                isClearable
              />
            </div>

            <div className="form-control flex-1 lg:w-48">
              <label className="label py-1">
                <span className="label-text text-xs font-bold uppercase tracking-wider text-base-content/70">Date fin</span>
              </label>
              <DatePicker
                selected={dateFin}
                onChange={(date: Date | null) => setDateFin(date)}
                dateFormat="dd/MM/yyyy"
                placeholderText="Sélectionner..."
                locale="fr"
                className="input input-bordered input-sm w-full bg-base-50"
                isClearable
                minDate={dateDebut || undefined}
              />
            </div>

            <div className="flex gap-2">
              <button 
                onClick={handleSearch} 
                className="btn btn-sm btn-primary lg:px-6"
                disabled={loading}
              >
                {loading ? <span className="loading loading-spinner loading-xs"></span> : 'Filtrer'}
              </button>

              {(dateDebut || dateFin) && (
                <button 
                  onClick={resetFilters}
                  className="btn btn-sm btn-ghost"
                  title="Réinitialiser les filtres"
                  disabled={loading}
                >
                  ✕ Réinitialiser
                </button>
              )}
{/* 
              <button 
                onClick={exportExcel}
                className="btn btn-sm btn-outline btn-success gap-2"
                disabled={loading || clotures.length === 0}
              >
                <Download className="w-4 h-4" />
                Excel
              </button> */}
            </div>
          </div>
        </div>
      </div>

      {/* Global Stats Cards */}
      {globalTotals && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6 shrink-0">
          <div className="bg-base-100 rounded-xl p-5 border border-base-200 shadow-sm flex flex-col justify-center">
             <div className="flex justify-between items-start">
               <div>
                  <h3 className="text-base-content/60 text-xs font-bold uppercase tracking-wider">Total Théorique</h3>
                  <p className="text-2xl font-bold mt-1">{formatMoney(globalTotals.montant_theorique)} <span className="text-base font-normal text-base-content/50">F</span></p>
               </div>
               <div className="p-3 bg-base-200/50 rounded-lg text-base-content">
                 <Banknote className="w-6 h-6" />
               </div>
             </div>
          </div>

          <div className="bg-base-100 rounded-xl p-5 border border-base-200 shadow-sm flex flex-col justify-center">
             <div className="flex justify-between items-start">
               <div>
                  <h3 className="text-base-content/60 text-xs font-bold uppercase tracking-wider">Total Réel</h3>
                  <p className="text-2xl font-bold mt-1 text-primary">{formatMoney(globalTotals.montant_reel)} <span className="text-base font-normal text-primary/50">F</span></p>
               </div>
               <div className="p-3 bg-primary/10 rounded-lg text-primary">
                 <CheckCircle className="w-6 h-6" />
               </div>
             </div>
          </div>

          <div className="bg-base-100 rounded-xl p-5 border border-base-200 shadow-sm flex flex-col justify-center">
             <div className="flex justify-between items-start">
               <div>
                  <h3 className="text-base-content/60 text-xs font-bold uppercase tracking-wider">Écart Global</h3>
                  <p className={`text-2xl font-bold mt-1 ${globalTotals.ecart_caisse < 0 ? 'text-error' : globalTotals.ecart_caisse > 0 ? 'text-success' : 'text-base-content/50'}`}>
                    {globalTotals.ecart_caisse > 0 ? '+' : ''}{formatMoney(globalTotals.ecart_caisse)} <span className="text-base font-normal opacity-50">F</span>
                  </p>
               </div>
               <div className={`p-3 rounded-lg ${globalTotals.ecart_caisse < 0 ? 'bg-error/10 text-error' : globalTotals.ecart_caisse > 0 ? 'bg-success/10 text-success' : 'bg-base-200/50 text-base-content'}`}>
                 <XCircle className="w-6 h-6" />
               </div>
             </div>
          </div>
        </div>
      )}

      {/* Table Section */}
      <div className="flex-1 px-6 pb-6 overflow-hidden flex flex-col">
        <div className="bg-base-100 border border-base-200 rounded-xl shadow-sm flex-1 flex flex-col overflow-hidden">
          <div className="overflow-x-auto flex-1">
            <table className="table table-sm w-full">
              <thead className="bg-base-200/50 sticky top-0 z-10 backdrop-blur-sm">
                <tr>
                  <th className="py-4 text-xs tracking-wider uppercase">Date Clôture</th>
                  <th className="py-4 text-xs tracking-wider uppercase">Caissier</th>
                  <th className="text-right py-4 text-xs tracking-wider uppercase">Théorique</th>
                  <th className="text-right py-4 text-xs tracking-wider uppercase">Réel</th>
                  <th className="text-right py-4 text-xs tracking-wider uppercase">Écart</th>
                  <th className="text-center py-4 text-xs tracking-wider uppercase">Actions</th>
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
                        <Banknote className="w-12 h-12 opacity-20" />
                        <p className="text-lg">Aucune clôture trouvée</p>
                        <p className="text-sm">Essayez de modifier vos filtres de recherche.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  clotures.map((cloture) => (
                    <tr key={cloture.id} className="hover:bg-base-200/30 transition-colors">
                      <td className="py-3">
                        <div className="font-semibold text-sm">{formatDate(cloture.date)}</div>
                        <div className="text-xs text-base-content/50 mt-0.5">
                          Du {cloture.date_debut ? formatDate(cloture.date_debut) : '...'} au {cloture.date_fin ? formatDate(cloture.date_fin) : '...'}
                        </div>
                      </td>
                      <td className="py-3">
                         <div className="font-medium">{cloture.user_name || cloture.username || 'N/A'}</div>
                      </td>
                      <td className="text-right py-3 text-base-content/80 font-medium">
                        {formatMoney(cloture.montant_theorique)}
                      </td>
                      <td className="text-right py-3 font-bold text-primary">
                        {formatMoney(cloture.montant_reel)}
                      </td>
                      <td className="text-right py-3">
                        <div className={`badge badge-sm ${parseFloat(cloture.ecart_caisse) < 0 ? 'badge-error' : parseFloat(cloture.ecart_caisse) > 0 ? 'badge-success' : 'badge-ghost'} font-bold px-3 py-3`}>
                          {parseFloat(cloture.ecart_caisse) > 0 ? '+' : ''}{formatMoney(cloture.ecart_caisse)} F
                        </div>
                      </td>
                      <td className="text-center py-3">
                        <div className="flex justify-center gap-2">
                          <button 
                            onClick={() => setSelectedCloture(cloture)}
                            className="btn btn-sm btn-ghost btn-square text-primary"
                            title="Voir les détails"
                          >
                            <Eye className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={() => handlePrint(cloture)}
                            className="btn btn-sm btn-ghost btn-square text-base-content/70"
                            title="Imprimer"
                          >
                            <Printer className="w-5 h-5" />
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
                      <span className="uppercase text-[10px] tracking-tight">TOTAL PÉRIODE ({totalItems} clôtures)</span>
                    </td>
                    <td className="text-right py-4 text-base-content/80 text-lg">{formatMoney(globalTotals.montant_theorique)}</td>
                    <td className="text-right py-4 text-primary text-lg">{formatMoney(globalTotals.montant_reel)}</td>
                    <td className={`text-right py-4 text-lg ${globalTotals.ecart_caisse < 0 ? 'text-error' : globalTotals.ecart_caisse > 0 ? 'text-success' : ''}`}>
                      {globalTotals.ecart_caisse > 0 ? '+' : ''}{formatMoney(globalTotals.ecart_caisse)}
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
              Affichage {totalItems > 0 ? (currentPage - 1) * pageSize + 1 : 0} à {Math.min(currentPage * pageSize, totalItems)} sur {totalItems} résultats
              <span className="badge badge-sm badge-ghost ml-2">{pageSize} / page</span>
            </span>
            <div className="join">
              <button 
                className="join-item btn btn-sm" 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1 || loading}
              >
                « Précédent
              </button>
              <button className="join-item btn btn-sm bg-base-200 no-animation pointer-events-none w-24">
                {totalPages > 0 ? `Page ${currentPage} / ${totalPages}` : '-'}
              </button>
              <button 
                className="join-item btn btn-sm" 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || totalPages === 0 || loading}
              >
                Suivant »
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
                <Banknote className="w-6 h-6" />
                Détails de la Clôture
              </h3>
              <p className="opacity-80 text-sm mt-1 pb-1">Enregistrée par {selectedCloture.user_name || selectedCloture.username || 'Inconnu'}</p>
            </div>

            <div className="p-6 space-y-6">
              {/* En-tête Date / Période */}
              <div className="bg-base-100 rounded-xl border border-base-200 p-4 shadow-sm flex items-center gap-4">
                 <div className="flex-1">
                   <p className="text-xs uppercase font-bold text-base-content/50">Date Clôture</p>
                   <p className="font-mono text-lg">{formatDate(selectedCloture.date)}</p>
                 </div>
                 <div className="w-px h-10 bg-base-200"></div>
                 <div className="flex-1 text-right">
                   <p className="text-xs uppercase font-bold text-base-content/50">Période</p>
                   <p className="text-sm">Du {selectedCloture.date_debut ? formatDate(selectedCloture.date_debut) : '...'}</p>
                   <p className="text-sm">Au {selectedCloture.date_fin ? formatDate(selectedCloture.date_fin) : '...'}</p>
                 </div>
              </div>

              {/* Stats principales */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-base-100 p-4 rounded-xl border border-base-200">
                  <div className="text-xs uppercase font-bold text-base-content/50 mb-1">Montant Théorique</div>
                  <div className="text-2xl font-bold">{formatMoney(selectedCloture.montant_theorique)} F</div>
                </div>
                <div className="bg-primary/5 p-4 rounded-xl border border-primary/20">
                  <div className="text-xs uppercase font-bold text-primary mb-1">Montant Réel</div>
                  <div className="text-2xl font-bold text-primary">{formatMoney(selectedCloture.montant_reel)} F</div>
                </div>
              </div>

              {/* Écart */}
              <div className={`p-4 rounded-xl flex items-center justify-between ${parseFloat(selectedCloture.ecart_caisse) === 0 ? 'bg-success/10 text-success' : parseFloat(selectedCloture.ecart_caisse) > 0 ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
                <div className="font-bold uppercase tracking-wider text-sm">Écart constaté</div>
                <div className="font-bold text-xl">
                  {parseFloat(selectedCloture.ecart_caisse) > 0 ? '+' : ''}{formatMoney(selectedCloture.ecart_caisse)} F
                </div>
              </div>

              {/* Flux financiers */}
              <div className="space-y-3">
                <h4 className="font-bold uppercase tracking-wider text-xs text-base-content/50 border-b border-base-200 pb-2">Résumé des Flux</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-base-100 border border-base-200 p-3 rounded-lg text-center">
                    <div className="text-xs opacity-60">Ventes</div>
                    <div className="font-bold">{formatMoney(selectedCloture.total_ventes)}</div>
                  </div>
                  <div className="bg-success/5 border border-success/20 p-3 rounded-lg text-center">
                    <div className="text-xs opacity-60 text-success uppercase">+ Entrées</div>
                    <div className="font-bold text-success">{formatMoney(selectedCloture.total_entrees)}</div>
                  </div>
                  <div className="bg-error/5 border border-error/20 p-3 rounded-lg text-center">
                    <div className="text-xs opacity-60 text-error uppercase">- Sorties</div>
                    <div className="font-bold text-error">{formatMoney(selectedCloture.total_sorties)}</div>
                  </div>
                </div>
              </div>

              {/* Détails Paiement */}
              {selectedCloture.details_paiement && Object.keys(selectedCloture.details_paiement).length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-bold uppercase tracking-wider text-xs text-base-content/50 border-b border-base-200 pb-2">Détails par mode (Ventes)</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(selectedCloture.details_paiement).map(([mode, montant]) => (
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
                        <span className="font-semibold">{formatMoney(montant)} F</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedCloture.observation && (
                <div className="space-y-2">
                  <h4 className="font-bold uppercase tracking-wider text-xs text-base-content/50">Observations</h4>
                  <p className="text-sm bg-base-50 p-3 rounded-lg border border-base-200 italic">"{selectedCloture.observation}"</p>
                </div>
              )}
            </div>

            <div className="modal-action border-t border-base-200 p-4 bg-base-50 m-0">
              <button onClick={() => handlePrint(selectedCloture)} className="btn btn-primary btn-outline gap-2 mr-auto">
                <Printer className="w-5 h-5" />
                Imprimer
              </button>
              <button 
                onClick={() => setSelectedCloture(null)} 
                className="btn btn-ghost"
              >
                Fermer
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setSelectedCloture(null)}></div>
        </dialog>
      )}
    </div>
  )
}
