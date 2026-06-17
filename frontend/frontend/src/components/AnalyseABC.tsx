import { useState, useEffect, useMemo } from 'react'
import api from '../services/api'
import { toast } from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { formatNumber as utilsFormatNumber } from '../utils/formatters'

interface ProduitABC {
  id: number
  nom: string
  cip: string
  rayon: string
  fournisseur: string
  stock: number
  prix_vente: number
  chiffre_affaires: number
  quantite_vendue: number
  pourcentage_ca: number
  pourcentage_cumule: number
  categorie: 'A' | 'B' | 'C'
  en_rupture: boolean
}

interface AnalyseABCData {
  periode_mois: number
  date_debut: string
  ca_total: number
  nb_produits_a: number
  nb_produits_b: number
  nb_produits_c: number
  ca_categorie_a: number
  ca_categorie_b: number
  ca_categorie_c: number
  alertes_rupture_a: number
  produits_a_en_rupture: string[]
  produits: ProduitABC[]
}

interface Rayon {
  id: number
  name: string
}

interface Fournisseur {
  id: number
  name: string
}

export default function AnalyseABC() {
  const { t } = useTranslation(['stock', 'common'])
  const [data, setData] = useState<AnalyseABCData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Filtres
  const [periode, setPeriode] = useState(6)
  const [rayonId, setRayonId] = useState<string>('')
  const [fournisseurId, setFournisseurId] = useState<string>('')
  
  // Options de filtres
  const [rayons, setRayons] = useState<Rayon[]>([])
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([])
  
  // Tab active
  const [activeTab, setActiveTab] = useState<'A' | 'B' | 'C'>('A')
  
  // Charger les options de filtres
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [rayonsRes, fournisseursRes] = await Promise.all([
          api.get('rayons/'),
          api.get('fournisseurs/')
        ])
        setRayons(rayonsRes.data.results || rayonsRes.data || [])
        setFournisseurs(fournisseursRes.data.results || fournisseursRes.data || [])
      } catch (err) {
        console.error('Erreur chargement filtres:', err)
      }
    }
    fetchOptions()
  }, [])

  // Charger les données ABC
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({ periode: periode.toString() })
        if (rayonId) params.append('rayon_id', rayonId)
        if (fournisseurId) params.append('fournisseur_id', fournisseurId)
        
        const response = await api.get(`produits/analyse_abc/?${params}`)
        setData(response.data)
      } catch (err: any) {
        setError(err.response?.data?.detail || t('stock:abc.error_loading'))
        console.error('Erreur analyse ABC:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [periode, rayonId, fournisseurId])

  const produitsFiltrés = useMemo(() => {
    if (!data) return []
    return data.produits.filter(p => p.categorie === activeTab)
  }, [data, activeTab])

  const formatNumber = (n: number) => utilsFormatNumber(Math.round(n))

  // Copier le tableau dans le presse-papier (format TSV pour Excel)
  const copyToClipboard = () => {
    if (!data) return
    
    // En-têtes
    const headers = [
      t('stock:abc.table.product'),
      t('stock:abc.table.cip'),
      t('stock:abc.table.rayon'),
      t('stock:abc.table.stock'),
      t('stock:abc.table.qty_sold'),
      t('stock:abc.table.sale_price'),
      t('stock:abc.table.ca'),
      t('stock:abc.table.ca_percent'),
      t('stock:abc.table.cumulated_percent'),
      t('stock:abc.table.category', { defaultValue: 'Catégorie' })
    ]
    
    // Lignes de données
    const rows = produitsFiltrés.map(p => [
      p.nom,
      p.cip,
      p.rayon,
      p.stock,
      p.quantite_vendue,
      p.prix_vente,
      Math.round(p.chiffre_affaires),
      p.pourcentage_ca.toFixed(0) + '%',
      p.pourcentage_cumule.toFixed(1) + '%',
      p.categorie
    ])
    
    // Construire le TSV
    const tsv = [headers.join('\t'), ...rows.map(r => r.join('\t'))].join('\n')
    
    // Modern clipboard API
    navigator.clipboard.writeText(tsv)
      .then(() => {
        toast.success(t('stock:abc.messages.copy_success', { count: produitsFiltrés.length }))
      })
      .catch((err) => {
        console.error('Failed to copy:', err)
        toast.error(t('stock:abc.messages.copy_error'))
      })
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <span className="size-12 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin inline-block"></span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-2xl px-6 py-4 max-w-md">
          <svg xmlns="http://www.w3.org/2000/svg" className="shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col p-6 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            📊 {t('stock:abc.title')}
          </h1>
          <p className="text-slate-500 text-sm">
            {t('stock:abc.subtitle')}
          </p>
        </div>
        
        {/* Filtres */}
        <div className="flex flex-wrap gap-2">
          <select 
            className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none"
            value={periode}
            onChange={(e) => setPeriode(Number(e.target.value))}
          >
            <option value={3}>{t('stock:abc.filters.months_3')}</option>
            <option value={6}>{t('stock:abc.filters.months_6')}</option>
            <option value={12}>{t('stock:abc.filters.months_12')}</option>
          </select>
          
          <select 
            className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none"
            value={rayonId}
            onChange={(e) => setRayonId(e.target.value)}
          >
            <option value="">{t('stock:abc.filters.all_rayons')}</option>
            {rayons.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          
          <select 
            className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none"
            value={fournisseurId}
            onChange={(e) => setFournisseurId(e.target.value)}
          >
            <option value="">{t('stock:abc.filters.all_suppliers')}</option>
            {fournisseurs.map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
          
          <button 
            className="inline-flex items-center gap-2 h-9 px-4 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-40"
            onClick={copyToClipboard}
            disabled={!data || produitsFiltrés.length === 0}
          >
            📋 {t('stock:abc.filters.copy')}
          </button>
        </div>
      </div>

      {/* Alertes */}
      {data && data.alertes_rupture_a > 0 && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl px-5 py-4 mb-4 shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" className="shrink-0 h-5 w-5 text-amber-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <span className="font-bold">{t('stock:abc.alerts.shortage', { count: data.alertes_rupture_a })}</span>
            <span className="ml-2 text-sm">{data.produits_a_en_rupture.join(', ')}</span>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 shrink-0">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{t('stock:abc.stats.total_ca')}</div>
            <div className="text-2xl font-black text-blue-600">{formatNumber(data.ca_total)} F</div>
            <div className="text-xs text-slate-400 mt-1">{t('stock:abc.stats.period_info', { count: data.periode_mois })}</div>
          </div>
          
          <div className="bg-red-50 rounded-xl border border-red-200 shadow-sm p-4">
            <div className="text-xs font-bold text-red-400 uppercase tracking-widest mb-1">🔴 {t('stock:abc.stats.category_a')}</div>
            <div className="text-2xl font-black text-red-600">{data.nb_produits_a}</div>
            <div className="text-xs text-red-400 mt-1">{formatNumber(data.ca_categorie_a)} F ({data.ca_total > 0 ? Math.round(data.ca_categorie_a / data.ca_total * 100) : 0}%)</div>
          </div>
          
          <div className="bg-yellow-50 rounded-xl border border-yellow-200 shadow-sm p-4">
            <div className="text-xs font-bold text-yellow-600 uppercase tracking-widest mb-1">🟡 {t('stock:abc.stats.category_b')}</div>
            <div className="text-2xl font-black text-yellow-600">{data.nb_produits_b}</div>
            <div className="text-xs text-yellow-500 mt-1">{formatNumber(data.ca_categorie_b)} F ({data.ca_total > 0 ? Math.round(data.ca_categorie_b / data.ca_total * 100) : 0}%)</div>
          </div>
          
          <div className="bg-green-50 rounded-xl border border-green-200 shadow-sm p-4">
            <div className="text-xs font-bold text-green-600 uppercase tracking-widest mb-1">🟢 {t('stock:abc.stats.category_c')}</div>
            <div className="text-2xl font-black text-green-600">{data.nb_produits_c}</div>
            <div className="text-xs text-green-500 mt-1">{formatNumber(data.ca_categorie_c)} F ({data.ca_total > 0 ? Math.round(data.ca_categorie_c / data.ca_total * 100) : 0}%)</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex bg-slate-100 p-1 rounded-xl mb-4 shrink-0 w-fit gap-1">
        <button 
          className={`h-8 px-4 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'A' ? 'bg-red-500 text-white shadow' : 'text-slate-500 hover:bg-slate-200'
          }`}
          onClick={() => setActiveTab('A')}
        >
          🔴 {t('stock:abc.tabs.vital')} ({data?.nb_produits_a || 0})
        </button>
        <button 
          className={`h-8 px-4 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'B' ? 'bg-yellow-500 text-white shadow' : 'text-slate-500 hover:bg-slate-200'
          }`}
          onClick={() => setActiveTab('B')}
        >
          🟡 {t('stock:abc.tabs.important')} ({data?.nb_produits_b || 0})
        </button>
        <button 
          className={`h-8 px-4 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'C' ? 'bg-green-500 text-white shadow' : 'text-slate-500 hover:bg-slate-200'
          }`}
          onClick={() => setActiveTab('C')}
        >
          🟢 {t('stock:abc.tabs.secondary')} ({data?.nb_produits_c || 0})
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-auto h-full">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="bg-slate-50 text-[11px] font-black text-slate-400 uppercase tracking-[0.12em]">
                <th className="sticky top-0 bg-slate-50 py-3 pl-6 text-left border-b border-slate-200">{t('stock:abc.table.product')}</th>
                <th className="sticky top-0 bg-slate-50 py-3 text-left border-b border-slate-200">{t('stock:abc.table.cip')}</th>
                <th className="sticky top-0 bg-slate-50 py-3 text-left border-b border-slate-200">{t('stock:abc.table.rayon')}</th>
                <th className="sticky top-0 bg-slate-50 py-3 text-right border-b border-slate-200 pr-4">{t('stock:abc.table.stock')}</th>
                <th className="sticky top-0 bg-slate-50 py-3 text-right border-b border-slate-200">{t('stock:abc.table.qty_sold')}</th>
                <th className="sticky top-0 bg-slate-50 py-3 text-right border-b border-slate-200">{t('stock:abc.table.sale_price')}</th>
                <th className="sticky top-0 bg-slate-50 py-3 text-right border-b border-slate-200">{t('stock:abc.table.ca')}</th>
                <th className="sticky top-0 bg-slate-50 py-3 text-right border-b border-slate-200">{t('stock:abc.table.ca_percent')}</th>
                <th className="sticky top-0 bg-slate-50 py-3 text-right border-b border-slate-200 pr-6">{t('stock:abc.table.cumulated_percent')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {produitsFiltrés.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-400">
                    {t('stock:abc.table.no_products')}
                  </td>
                </tr>
              ) : (
                produitsFiltrés.map((p) => (
                  <tr key={p.id} className={`hover:bg-blue-50/30 transition-colors ${p.en_rupture ? 'bg-red-50/50' : ''}`}>
                    <td className="py-2.5 pl-6 font-medium text-slate-700">
                      {p.nom}
                      {p.en_rupture && <span className="inline-flex items-center ml-2 px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 text-[10px] font-bold">{t('stock:abc.table.shortage_badge')}</span>}
                    </td>
                    <td className="py-2.5 font-mono text-xs text-slate-400">{p.cip}</td>
                    <td className="py-2.5 text-sm text-slate-600">{p.rayon}</td>
                    <td className={`py-2.5 text-right font-bold pr-4 ${
                      p.stock <= 0 ? 'text-red-500' : p.stock <= 5 ? 'text-amber-500' : 'text-slate-700'
                    }`}>{p.stock}</td>
                    <td className="py-2.5 text-right font-semibold text-blue-600">{formatNumber(p.quantite_vendue)}</td>
                    <td className="py-2.5 text-right text-slate-600">{formatNumber(p.prix_vente)} {t('common:currency_symbol', { defaultValue: 'F' })}</td>
                    <td className="py-2.5 text-right font-bold text-slate-800">{formatNumber(p.chiffre_affaires)} {t('common:currency_symbol', { defaultValue: 'F' })}</td>
                    <td className="py-2.5 text-right text-slate-600">{p.pourcentage_ca.toFixed(0)}%</td>
                    <td className="py-2.5 text-right text-slate-400 pr-6">{p.pourcentage_cumule.toFixed(1)}%</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 text-xs text-slate-400 text-center shrink-0">
        {t('stock:abc.footer.analyzed_since', { date: data?.date_debut })} • {t('stock:abc.footer.total_products', { count: data?.produits.length || 0 })}
      </div>
    </div>
  )
}
