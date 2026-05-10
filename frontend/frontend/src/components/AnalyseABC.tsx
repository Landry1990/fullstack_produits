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
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="alert alert-error max-w-md">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col p-6 bg-base-100 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-base-content flex items-center gap-2">
            📊 {t('stock:abc.title')}
          </h1>
          <p className="text-base-content/60 text-sm">
            {t('stock:abc.subtitle')}
          </p>
        </div>
        
        {/* Filtres */}
        <div className="flex flex-wrap gap-2">
          <select 
            className="select select-bordered select-sm"
            value={periode}
            onChange={(e) => setPeriode(Number(e.target.value))}
          >
            <option value={3}>{t('stock:abc.filters.months_3')}</option>
            <option value={6}>{t('stock:abc.filters.months_6')}</option>
            <option value={12}>{t('stock:abc.filters.months_12')}</option>
          </select>
          
          <select 
            className="select select-bordered select-sm"
            value={rayonId}
            onChange={(e) => setRayonId(e.target.value)}
          >
            <option value="">{t('stock:abc.filters.all_rayons')}</option>
            {rayons.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          
          <select 
            className="select select-bordered select-sm"
            value={fournisseurId}
            onChange={(e) => setFournisseurId(e.target.value)}
          >
            <option value="">{t('stock:abc.filters.all_suppliers')}</option>
            {fournisseurs.map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
          
          <button 
            className="btn btn-sm btn-outline gap-2"
            onClick={copyToClipboard}
            disabled={!data || produitsFiltrés.length === 0}
          >
            📋 {t('stock:abc.filters.copy')}
          </button>
        </div>
      </div>

      {/* Alertes */}
      {data && data.alertes_rupture_a > 0 && (
        <div className="alert alert-warning mb-4 shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <span className="font-bold">{t('stock:abc.alerts.shortage', { count: data.alertes_rupture_a })}</span>
            <span className="ml-2">{data.produits_a_en_rupture.join(', ')}</span>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 shrink-0">
          <div className="stat bg-base-100 rounded-lg shadow border border-base-200">
            <div className="stat-title">{t('stock:abc.stats.total_ca')}</div>
            <div className="stat-value text-primary text-2xl">{formatNumber(data.ca_total)} F</div>
            <div className="stat-desc">{t('stock:abc.stats.period_info', { count: data.periode_mois })}</div>
          </div>
          
          <div className="stat bg-red-50 rounded-lg shadow border border-red-200">
            <div className="stat-title text-red-600">🔴 {t('stock:abc.stats.category_a')}</div>
            <div className="stat-value text-red-600 text-2xl">{data.nb_produits_a}</div>
            <div className="stat-desc text-red-500">{formatNumber(data.ca_categorie_a)} F ({data.ca_total > 0 ? Math.round(data.ca_categorie_a / data.ca_total * 100) : 0}%)</div>
          </div>
          
          <div className="stat bg-yellow-50 rounded-lg shadow border border-yellow-200">
            <div className="stat-title text-yellow-600">🟡 {t('stock:abc.stats.category_b')}</div>
            <div className="stat-value text-yellow-600 text-2xl">{data.nb_produits_b}</div>
            <div className="stat-desc text-yellow-500">{formatNumber(data.ca_categorie_b)} F ({data.ca_total > 0 ? Math.round(data.ca_categorie_b / data.ca_total * 100) : 0}%)</div>
          </div>
          
          <div className="stat bg-green-50 rounded-lg shadow border border-green-200">
            <div className="stat-title text-green-600">🟢 {t('stock:abc.stats.category_c')}</div>
            <div className="stat-value text-green-600 text-2xl">{data.nb_produits_c}</div>
            <div className="stat-desc text-green-500">{formatNumber(data.ca_categorie_c)} F ({data.ca_total > 0 ? Math.round(data.ca_categorie_c / data.ca_total * 100) : 0}%)</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs tabs-boxed mb-4 shrink-0 bg-base-200 w-fit">
        <button 
          className={`tab ${activeTab === 'A' ? 'bg-red-500 text-white' : ''}`}
          onClick={() => setActiveTab('A')}
        >
          🔴 {t('stock:abc.tabs.vital')} ({data?.nb_produits_a || 0})
        </button>
        <button 
          className={`tab ${activeTab === 'B' ? 'bg-yellow-500 text-white' : ''}`}
          onClick={() => setActiveTab('B')}
        >
          🟡 {t('stock:abc.tabs.important')} ({data?.nb_produits_b || 0})
        </button>
        <button 
          className={`tab ${activeTab === 'C' ? 'bg-green-500 text-white' : ''}`}
          onClick={() => setActiveTab('C')}
        >
          🟢 {t('stock:abc.tabs.secondary')} ({data?.nb_produits_c || 0})
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 bg-base-100 rounded-lg shadow border border-base-200 overflow-hidden">
        <div className="overflow-auto h-full">
          <table className="table table-sm table-pin-rows w-full">
            <thead className="bg-base-100">
              <tr>
                <th>{t('stock:abc.table.product')}</th>
                <th>{t('stock:abc.table.cip')}</th>
                <th>{t('stock:abc.table.rayon')}</th>
                <th className="text-right">{t('stock:abc.table.stock')}</th>
                <th className="text-right">{t('stock:abc.table.qty_sold')}</th>
                <th className="text-right">{t('stock:abc.table.sale_price')}</th>
                <th className="text-right">{t('stock:abc.table.ca')}</th>
                <th className="text-right">{t('stock:abc.table.ca_percent')}</th>
                <th className="text-right">{t('stock:abc.table.cumulated_percent')}</th>
              </tr>
            </thead>
            <tbody>
              {produitsFiltrés.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-base-content/50">
                    {t('stock:abc.table.no_products')}
                  </td>
                </tr>
              ) : (
                produitsFiltrés.map((p) => (
                  <tr key={p.id} className={`hover ${p.en_rupture ? 'bg-red-50' : ''}`}>
                    <td className="font-medium">
                      {p.nom}
                      {p.en_rupture && <span className="badge badge-error badge-xs ml-2">{t('stock:abc.table.shortage_badge')}</span>}
                    </td>
                    <td className="font-mono text-xs text-base-content/60">{p.cip}</td>
                    <td className="text-sm">{p.rayon}</td>
                    <td className={`text-right font-bold ${p.stock <= 0 ? 'text-error' : p.stock <= 5 ? 'text-warning' : ''}`}>
                      {p.stock}
                    </td>
                    <td className="text-right font-semibold text-info">{formatNumber(p.quantite_vendue)}</td>
                    <td className="text-right">{formatNumber(p.prix_vente)} {t('common:currency_symbol', { defaultValue: 'F' })}</td>
                    <td className="text-right font-bold">{formatNumber(p.chiffre_affaires)} {t('common:currency_symbol', { defaultValue: 'F' })}</td>
                    <td className="text-right">{p.pourcentage_ca.toFixed(0)}%</td>
                    <td className="text-right text-base-content/60">{p.pourcentage_cumule.toFixed(1)}%</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 text-xs text-base-content/50 text-center shrink-0">
        {t('stock:abc.footer.analyzed_since', { date: data?.date_debut })} • {t('stock:abc.footer.total_products', { count: data?.produits.length || 0 })}
      </div>
    </div>
  )
}
