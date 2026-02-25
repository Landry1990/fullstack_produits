import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useTranslation } from 'react-i18next'

interface StockAnalysisItem {
  id: number
  name: string
  stock: number
  rotation?: number
  threshold?: number
  excess_qty?: number
  avg_daily_sales?: number
  days_until_stockout?: number
  urgency?: 'critical' | 'warning' | 'caution'
  value: number
  cost_price: number
  selling_price: number
  fournisseur_name: string
  created_at?: string
  dernier_achat?: string
  derniere_vente?: string
  days_since_sale?: number
}

interface StockAnalysisResponse {
  type: string
  fournisseur: string
  total_items: number
  total_value: number
  critical_count?: number
  warning_count?: number
  items: StockAnalysisItem[]
}

interface Fournisseur {
  id: number
  name: string
}

const StockAnalysis = () => {
  const apiBaseUrl = useMemo(() => (import.meta.env.VITE_API_BASE_URL ?? ''), [])
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<'unsold' | 'overstock' | 'shortage'>('unsold')
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([])
  const [selectedFournisseur, setSelectedFournisseur] = useState<string>('')
  const [data, setData] = useState<StockAnalysisResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set())
  const [unsoldDays, setUnsoldDays] = useState<number>(30)
  const navigate = useNavigate()

  // Charger les fournisseurs
  useEffect(() => {
    const fetchFournisseurs = async () => {
      try {
        const response = await axios.get(`${apiBaseUrl}/api/fournisseurs/`)
        
        let data = [];
        if (Array.isArray(response.data)) {
            data = response.data;
        } else if (response.data.results && Array.isArray(response.data.results)) {
            data = response.data.results;
        }
        
        setFournisseurs(data)
      } catch (err) {
        console.error('Erreur chargement fournisseurs:', err)
        setFournisseurs([]) 
      }
    }
    fetchFournisseurs()
  }, [apiBaseUrl])

  // Clear selection when tab changes
  useEffect(() => {
    setSelectedItems(new Set())
  }, [activeTab])

  // Charger les données
  useEffect(() => {
    fetchData()
  }, [activeTab, selectedFournisseur, unsoldDays])

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const params: any = {}
      if (selectedFournisseur) params.fournisseur = selectedFournisseur
      if (activeTab === 'unsold') params.days = unsoldDays
      
      const response = await axios.get(
        `${apiBaseUrl}/api/stock-analysis/${activeTab}/`,
        { params }
      )
      setData(response.data)
    } catch (err: any) {
      console.error(err);
      setError(t('stockAnalysis.error'))
    } finally {
      setLoading(false)
    }
  }

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'critical':
        return <span className="badge badge-error gap-1 text-white">🔴 {t('stockAnalysis.shortage.urgency.critical')}</span>
      case 'warning':
        return <span className="badge badge-warning gap-1">🟠 {t('stockAnalysis.shortage.urgency.warning')}</span>
      case 'caution':
        return <span className="badge badge-info gap-1">🟡 {t('stockAnalysis.shortage.urgency.caution')}</span>
      default:
        return null
    }
  }

  const getTabDescription = () => {
    switch (activeTab) {
      case 'unsold': return t('stockAnalysis.tabs.unsold_desc')
      case 'overstock': return t('stockAnalysis.tabs.overstock_desc')
      case 'shortage': return t('stockAnalysis.tabs.shortage_desc')
    }
  }

  const getEmptyIcon = () => {
    switch (activeTab) {
      case 'unsold': return '💤'
      case 'overstock': return '📈'
      case 'shortage': return '✅'
    }
  }

  const getEmptyText = () => {
    switch (activeTab) {
      case 'unsold': return t('stockAnalysis.empty.unsold')
      case 'overstock': return t('stockAnalysis.empty.overstock')
      case 'shortage': return t('stockAnalysis.empty.shortage')
    }
  }

  const toggleSelectItem = (id: number) => {
    setSelectedItems(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (!data) return
    if (selectedItems.size === data.items.length) {
      setSelectedItems(new Set())
    } else {
      setSelectedItems(new Set(data.items.map(i => i.id)))
    }
  }

  const handleGenerateOrder = () => {
    if (!data || selectedItems.size === 0) return
    const products = data.items
      .filter(item => selectedItems.has(item.id))
      .map(item => ({ id: item.id, name: item.name, stock: item.stock, avg_daily_sales: item.avg_daily_sales }))

    navigate('/app/commandes/locales', {
      state: {
        createFromStockAlert: { products }
      }
    })
  }

  return (
    <div className="h-full flex flex-col bg-base-100">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-base-200 bg-white">
        <div>
          <h1 className="text-2xl font-bold text-base-content">📊 {t('stockAnalysis.title')}</h1>
          <p className="text-sm text-base-content/60 mt-1">
            {getTabDescription()}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs tabs-boxed bg-white border-b border-base-200 px-6 pt-4">
        <button 
          className={`tab tab-lg ${activeTab === 'unsold' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('unsold')}
        >
          💤 {t('stockAnalysis.tabs.unsold')}
        </button>
        <button 
          className={`tab tab-lg ${activeTab === 'overstock' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('overstock')}
        >
          📈 {t('stockAnalysis.tabs.overstock')}
        </button>
        <button 
          className={`tab tab-lg ${activeTab === 'shortage' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('shortage')}
        >
          ⚠️ {t('stockAnalysis.tabs.shortage')}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white px-6 py-4 border-b border-base-200">
        <div className="flex gap-4 items-end">
          <div className="form-control w-64">
            <label className="label">
              <span className="label-text font-semibold">{t('stockAnalysis.filters.supplier')}</span>
            </label>
            <select 
              className="select select-bordered"
              value={selectedFournisseur}
              onChange={(e) => setSelectedFournisseur(e.target.value)}
            >
              <option value="">{t('stockAnalysis.filters.all_suppliers')}</option>
              {fournisseurs.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>

          {activeTab === 'unsold' && (
            <div className="form-control w-48">
              <label className="label">
                <span className="label-text font-semibold">{t('stockAnalysis.filters.days_threshold')}</span>
              </label>
              <select 
                className="select select-bordered"
                value={unsoldDays}
                onChange={(e) => setUnsoldDays(Number(e.target.value))}
              >
                <option value={30}>30 {t('stockAnalysis.days')}</option>
                <option value={60}>60 {t('stockAnalysis.days')}</option>
                <option value={90}>90 {t('stockAnalysis.days')}</option>
                <option value={180}>180 {t('stockAnalysis.days')}</option>
                <option value={365}>365 {t('stockAnalysis.days')}</option>
              </select>
            </div>
          )}

          <button 
            className="btn btn-primary"
            onClick={fetchData}
            disabled={loading}
          >
            {loading ? <span className="loading loading-spinner"></span> : `🔄 ${t('stockAnalysis.filters.refresh')}`}
          </button>
        </div>
      </div>

      {/* Statistics */}
      {data && (
        <div className="bg-base-100 px-6 py-4 border-b border-base-200">
          <div className={`grid grid-cols-1 gap-4 ${activeTab === 'shortage' ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
            <div className="stat bg-white border border-base-200 rounded-lg shadow-sm">
              <div className="stat-title">{t('stockAnalysis.stats.supplier')}</div>
              <div className="stat-value text-xl truncate" title={data.fournisseur}>{data.fournisseur}</div>
            </div>
            <div className="stat bg-white border border-base-200 rounded-lg shadow-sm">
              <div className="stat-title">{t('stockAnalysis.stats.item_count')}</div>
              <div className="stat-value text-warning">{data.total_items}</div>
            </div>
            <div className="stat bg-white border border-base-200 rounded-lg shadow-sm">
              <div className="stat-title">
                {activeTab === 'shortage' ? t('stockAnalysis.stats.value_at_risk') :
                 activeTab === 'overstock' ? t('stockAnalysis.stats.overstock_value') :
                 t('stockAnalysis.stats.estimated_value')}
              </div>
              <div className="stat-value text-error">
                {Math.round(data.total_value).toLocaleString()} F
              </div>
            </div>
            {activeTab === 'shortage' && (
              <div className="stat bg-white border border-base-200 rounded-lg shadow-sm">
                <div className="stat-title">{t('stockAnalysis.stats.critical_alerts')}</div>
                <div className="stat-value text-error">{data.critical_count || 0}</div>
                <div className="stat-desc text-warning font-semibold">
                  + {data.warning_count || 0} {t('stockAnalysis.shortage.warnings')}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {error && (
          <div className="alert alert-error mb-4">
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center h-full">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        ) : data && data.items.length > 0 ? (
          <>
          <div className="bg-white rounded-xl shadow-sm border border-base-200 overflow-hidden">
            <table className="table table-zebra leading-relaxed">
              <thead>
                <tr className="bg-base-200">
                  {activeTab === 'shortage' && (
                    <th>
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm"
                        checked={data ? selectedItems.size === data.items.length && data.items.length > 0 : false}
                        onChange={toggleSelectAll}
                      />
                    </th>
                  )}
                  <th>{t('stockAnalysis.columns.product')}</th>
                  <th>{t('stockAnalysis.columns.current_stock')}</th>
                  {activeTab === 'unsold' ? (
                    <>
                      <th>Dernier Achat</th>
                      <th>Dernière Vente</th>
                      <th>Jours sans vente</th>
                      <th>{t('stockAnalysis.columns.cost_price')}</th>
                      <th>{t('stockAnalysis.columns.stock_value')}</th>
                    </>
                  ) : activeTab === 'overstock' ? (
                    <>
                      <th>{t('stockAnalysis.columns.avg_rotation')}</th>
                      <th>{t('stockAnalysis.columns.threshold')}</th>
                      <th>{t('stockAnalysis.columns.excess_qty')}</th>
                      <th>{t('stockAnalysis.columns.excess_value')}</th>
                    </>
                  ) : (
                    <>
                      <th>{t('stockAnalysis.columns.avg_daily_sales')}</th>
                      <th>{t('stockAnalysis.columns.days_until_stockout')}</th>
                      <th>{t('stockAnalysis.columns.urgency')}</th>
                      <th>{t('stockAnalysis.columns.value_at_risk')}</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {data.items.map(item => (
                  <tr key={item.id} className={`hover ${selectedItems.has(item.id) ? 'bg-primary/5' : ''}`}>
                    {activeTab === 'shortage' && (
                      <td>
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm checkbox-primary"
                          checked={selectedItems.has(item.id)}
                          onChange={() => toggleSelectItem(item.id)}
                        />
                      </td>
                    )}
                    <td className="font-semibold uppercase">{item.name}</td>
                    <td>
                      <span className="font-bold text-lg">{item.stock}</span>
                    </td>
                    
                    {activeTab === 'unsold' ? (
                      <>
                        <td className="font-mono text-sm">
                           {item.dernier_achat ? new Date(item.dernier_achat).toLocaleDateString('fr-FR') : '-'}
                        </td>
                        <td className="font-mono text-sm">
                           {item.derniere_vente ? new Date(item.derniere_vente).toLocaleDateString('fr-FR') : <span className="text-error font-semibold">Jamais</span>}
                        </td>
                        <td className="font-mono font-bold text-warning">
                           {item.days_since_sale ?? '-'}j
                        </td>
                        <td>{Math.round(item.cost_price).toLocaleString()} F</td>
                        <td className="font-bold text-error">
                          {Math.round(item.value).toLocaleString()} F
                        </td>
                      </>
                    ) : activeTab === 'overstock' ? (
                      <>
                        <td>{Number(item.rotation || 0).toFixed(2)} /{t('stockAnalysis.per_month')}</td>
                        <td>{item.threshold}</td>
                        <td className="font-bold text-error">+{item.excess_qty}</td>
                        <td className="font-bold text-error">
                          {Math.round(item.value).toLocaleString()} F
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="font-mono">{item.avg_daily_sales} /{t('stockAnalysis.per_day')}</td>
                        <td>
                          <span className={`font-bold text-lg ${
                            (item.days_until_stockout || 0) < 7 ? 'text-error' :
                            (item.days_until_stockout || 0) < 14 ? 'text-warning' : 'text-info'
                          }`}>
                            {item.days_until_stockout} {t('stockAnalysis.days')}
                          </span>
                        </td>
                        <td>{getUrgencyBadge(item.urgency || '')}</td>
                        <td className="font-bold text-error">
                          {Math.round(item.value).toLocaleString()} F
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Floating Action Bar for Selection */}
          {activeTab === 'shortage' && selectedItems.size > 0 && (
            <div className="sticky bottom-4 mt-4 flex justify-center">
              <div className="bg-primary text-primary-content px-6 py-3 rounded-full shadow-xl flex items-center gap-4">
                <span className="font-semibold">
                  {selectedItems.size} {t('stockAnalysis.shortage.selected')}
                </span>
                <button
                  className="btn btn-sm btn-accent gap-2"
                  onClick={handleGenerateOrder}
                >
                  📦 {t('stockAnalysis.shortage.generate_order')}
                </button>
                <button
                  className="btn btn-sm btn-ghost text-primary-content"
                  onClick={() => setSelectedItems(new Set())}
                >
                  ✕
                </button>
              </div>
            </div>
          )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-base-content/40 bg-base-50 rounded-xl border border-dashed border-base-300">
            <div className="bg-base-200 p-4 rounded-full mb-4">
               {getEmptyIcon()}
            </div>
            <p className="text-lg font-semibold">{getEmptyText()}</p>
            <p className="text-sm mt-1">{t('stockAnalysis.empty.all_good')}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default StockAnalysis
