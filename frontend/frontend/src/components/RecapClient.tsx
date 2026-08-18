import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { gooeyToast } from 'goey-toast'
import { FileText, Plus, X, Search, Printer, Loader2, AlertTriangle } from 'lucide-react'
import api from '../services/api'
import { Button } from './shadcn/button'
import { Input } from './shadcn/input'
import { Badge } from './shadcn/badge'
import { formatNumber } from '../utils/formatters'

interface RecapFacture {
  id: number
  numero_facture: string
  date: string
  total_ht: string | number
  total_tva: string | number
  total_ttc: string | number
  remise: string | number
  status: string
  created_by_name?: string
  client_name?: string
  produits?: RecapProduit[]
}

interface RecapProduit {
  produit_name?: string
  produit_nom?: string
  quantity?: number
  quantite?: number
  selling_price?: string | number
  prix_vente?: string | number
  total?: string | number
}

interface RecapResponse {
  factures: RecapFacture[]
  recap: {
    nombre_factures: number
    total_ht: number
    total_tva: number
    total_ttc: number
    total_remise: number
    periode: { debut: string | null; fin: string | null }
  }
  not_found: string[]
  client_name: string
}

export default function RecapClient() {
  const { t } = useTranslation(['recap', 'common'])
  const inputRef = useRef<HTMLInputElement>(null)

  const [numeros, setNumeros] = useState<string[]>([])
  const [numerosStatus, setNumerosStatus] = useState<Record<string, 'checking' | 'found' | 'cancelled' | 'not_found'>>({})
  const [currentInput, setCurrentInput] = useState('')
  const [clientName, setClientName] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<RecapResponse | null>(null)

  const fmt = (val: number | string | null | undefined) => {
    if (val == null || val === '') return '0'
    const num = Number(val)
    if (isNaN(num)) return '0'
    return formatNumber(Math.round(num))
  }

  const checkNumero = async (numero: string) => {
    setNumerosStatus(prev => ({ ...prev, [numero]: 'checking' }))
    try {
      const { data } = await api.get('factures/', {
        params: { numero_facture: numero, page_size: 1 }
      })
      const found = data.results && data.results.length > 0
      if (!found) {
        setNumerosStatus(prev => ({ ...prev, [numero]: 'not_found' }))
        gooeyToast.error(t('recap:errors.ticket_not_found', { numero }))
      } else {
        const facture = data.results[0]
        if (facture.status === 'ANN' || facture.status === 'ANNULEE') {
          setNumerosStatus(prev => ({ ...prev, [numero]: 'cancelled' }))
          gooeyToast(t('recap:errors.ticket_cancelled', { numero }), { icon: <AlertTriangle className="h-4 w-4 text-amber-600" /> })
        } else {
          setNumerosStatus(prev => ({ ...prev, [numero]: 'found' }))
        }
      }
    } catch {
      setNumerosStatus(prev => ({ ...prev, [numero]: 'not_found' }))
    }
  }

  const addNumero = () => {
    const trimmed = currentInput.trim().toUpperCase()
    if (trimmed && !numeros.includes(trimmed)) {
      setNumeros(prev => [...prev, trimmed])
      setCurrentInput('')
      inputRef.current?.focus()
      checkNumero(trimmed)
    }
  }

  const removeNumero = (idx: number) => {
    const removed = numeros[idx]
    setNumeros(prev => prev.filter((_, i) => i !== idx))
    setNumerosStatus(prev => {
      const next = { ...prev }
      delete next[removed]
      return next
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addNumero()
    }
  }

  const handleSearch = async () => {
    if (numeros.length === 0) {
      gooeyToast.error(t('recap:errors.no_numbers'))
      return
    }
    setLoading(true)
    setResult(null)
    try {
      const { data } = await api.post<RecapResponse>('factures/recap-multi/', {
        numeros,
        client_name: clientName.trim()
      })
      setResult(data)
      if (data.not_found.length > 0) {
        gooeyToast.error(t('recap:errors.some_not_found', { count: data.not_found.length }))
      } else {
        gooeyToast.success(t('recap:messages.found', { count: data.recap.nombre_factures }))
      }
    } catch {
      gooeyToast.error(t('recap:errors.fetch_error'))
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => {
    if (!result) return

    // Stocker les données dans sessionStorage pour la page d'impression
    sessionStorage.setItem('recap_print_data', JSON.stringify({
      factures: result.factures,
      recap: result.recap,
      client_name: clientName.trim()
    }))

    // Ouvrir la page d'impression avec le même template que les factures
    const w = window.open('/app/print-invoice/recap?type=RECAP', '_blank')
    if (!w) gooeyToast.error(t('common:popup_blocked'))
  }

  return (
    <div className="h-screen bg-slate-100 p-6 font-sans overflow-auto">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-50 rounded-xl">
            <FileText className="size-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{t('recap:title')}</h1>
            <p className="text-sm text-slate-500">{t('recap:subtitle')}</p>
          </div>
        </div>

        {/* Formulaire de saisie */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">
          {/* Nom client (optionnel) */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              {t('recap:form.client_name')}
            </label>
            <Input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder={t('recap:form.client_placeholder')}
              className="h-10 max-w-sm"
            />
          </div>

          {/* Saisie numéros de tickets */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              {t('recap:form.ticket_numbers')} <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              <Input
                ref={inputRef}
                type="text"
                value={currentInput}
                onChange={(e) => setCurrentInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('recap:form.ticket_placeholder')}
                className="h-10 flex-1 max-w-sm font-mono"
                autoFocus
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 px-3"
                onClick={addNumero}
                disabled={!currentInput.trim()}
              >
                <Plus className="size-4" />
              </Button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">{t('recap:form.hint')}</p>
          </div>

          {/* Tags des numéros ajoutés avec indicateur de statut */}
          {numeros.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {numeros.map((num, idx) => {
                const status = numerosStatus[num]
                const badgeClass = status === 'found'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : status === 'cancelled'
                  ? 'bg-amber-50 border-amber-200 text-amber-700 line-through'
                  : status === 'not_found'
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : 'bg-slate-100 border-slate-200 text-slate-700'
                return (
                  <Badge key={idx} variant="outline" className={`px-3 py-1.5 text-sm font-mono flex items-center gap-1.5 ${badgeClass}`}>
                    {status === 'checking' && <Loader2 className="size-3 animate-spin" />}
                    {status === 'found' && <span className="size-2 rounded-full bg-emerald-500" />}
                    {status === 'cancelled' && <span className="size-2 rounded-full bg-amber-500" />}
                    {status === 'not_found' && <span className="size-2 rounded-full bg-red-500" />}
                    {num}
                    {status === 'cancelled' && <span className="text-[9px] font-sans no-underline">{t('recap:status.cancelled')}</span>}
                    <button onClick={() => removeNumero(idx)} className="text-slate-400 hover:text-red-500 ml-1 no-underline">
                      <X className="size-3" />
                    </button>
                  </Badge>
                )
              })}
            </div>
          )}

          {/* Bouton rechercher */}
          <div className="flex gap-3">
            <Button
              onClick={handleSearch}
              disabled={loading || numeros.length === 0}
              className="h-10 px-6 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : <Search className="size-4 mr-2" />}
              {t('recap:form.search')}
            </Button>
            {result && (
              <Button
                onClick={handlePrint}
                variant="outline"
                className="h-10 px-6"
              >
                <Printer className="size-4 mr-2" />
                {t('recap:form.print')}
              </Button>
            )}
          </div>
        </div>

        {/* Résultats */}
        {result && (
          <div className="space-y-4">
            {/* Avertissement numéros non trouvés */}
            {result.not_found.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                <AlertTriangle className="size-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-700">{t('recap:results.not_found_title')}</p>
                  <p className="text-xs text-amber-600 mt-1">
                    {result.not_found.join(', ')}
                  </p>
                </div>
              </div>
            )}

            {/* Résumé */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
              <h3 className="font-bold text-slate-800 mb-3">{t('recap:results.summary')}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-emerald-600">{result.recap.nombre_factures}</div>
                  <div className="text-[10px] text-slate-500 uppercase font-bold">{t('recap:results.tickets')}</div>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-slate-800">{fmt(result.recap.total_ht)} F</div>
                  <div className="text-[10px] text-slate-500 uppercase font-bold">{t('recap:results.total_ht')}</div>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-slate-800">{fmt(result.recap.total_tva)} F</div>
                  <div className="text-[10px] text-slate-500 uppercase font-bold">{t('recap:results.total_tva')}</div>
                </div>
                <div className="bg-emerald-50 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-emerald-700">{fmt(result.recap.total_ttc)} F</div>
                  <div className="text-[10px] text-emerald-600 uppercase font-bold">{t('recap:results.total_ttc')}</div>
                </div>
              </div>
            </div>

            {/* Détails par facture */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100">
                <h3 className="font-bold text-slate-800">{t('recap:results.details')}</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {result.factures.map(facture => {
                  const isCancelled = facture.status === 'ANN' || facture.status === 'ANNULEE'
                  return (
                  <div key={facture.id} className={`p-4 ${isCancelled ? 'opacity-50 bg-amber-50/50' : ''}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className={`font-mono text-sm font-bold ${isCancelled ? 'text-amber-600 line-through' : 'text-emerald-600'}`}>{facture.numero_facture}</span>
                        {isCancelled && (
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">{t('recap:status.cancelled')}</span>
                        )}
                        <span className="text-xs text-slate-500">
                          {new Date(facture.date).toLocaleDateString('fr-FR')} {new Date(facture.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {facture.created_by_name && (
                          <span className="text-xs text-slate-400">• {facture.created_by_name}</span>
                        )}
                      </div>
                      <span className={`font-bold text-sm ${isCancelled ? 'line-through text-slate-400' : ''}`}>{fmt(facture.total_ttc)} F</span>
                    </div>
                    {facture.produits && facture.produits.length > 0 && (
                      <div className="ml-4 space-y-0.5">
                        {facture.produits.map((p, idx) => {
                          const name = p.produit_nom || p.produit_name || '?'
                          const qty = p.quantity || p.quantite || 1
                          const price = Number(p.selling_price || p.prix_vente || 0)
                          return (
                            <div key={idx} className="flex items-center justify-between text-xs text-slate-600">
                              <span>{name} <span className="text-slate-400">x{qty}</span></span>
                              <span className="font-mono">{fmt(qty * price)} F</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
