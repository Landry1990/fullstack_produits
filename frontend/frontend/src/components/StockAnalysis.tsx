import { useState, useEffect, useMemo } from 'react'
import axios from 'axios'

interface StockAnalysisItem {
  id: number
  name: string
  stock: number
  rotation?: number
  threshold?: number
  excess_qty?: number
  value: number
  cost_price: number
  selling_price: number
  fournisseur_name: string
  created_at?: string
}

interface StockAnalysisResponse {
  type: string
  fournisseur: string
  total_items: number
  total_value: number
  items: StockAnalysisItem[]
}

interface Fournisseur {
  id: number
  name: string
}

const StockAnalysis = () => {
  const apiBaseUrl = useMemo(() => (import.meta.env.VITE_API_BASE_URL ?? ''), [])
  const [activeTab, setActiveTab] = useState<'unsold' | 'overstock'>('unsold')
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([])
  const [selectedFournisseur, setSelectedFournisseur] = useState<string>('')
  // days filter removed as per new requirements
  const [data, setData] = useState<StockAnalysisResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Charger les fournisseurs
  useEffect(() => {
    const fetchFournisseurs = async () => {
      try {
        const response = await axios.get(`${apiBaseUrl}/api/fournisseurs/`)
        
        // Robust extraction
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

  // Charger les données
  useEffect(() => {
    fetchData()
  }, [activeTab, selectedFournisseur])

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const params: any = {}
      if (selectedFournisseur) params.fournisseur = selectedFournisseur
      
      const response = await axios.get(
        `${apiBaseUrl}/api/stock-analysis/${activeTab}/`,
        { params }
      )
      setData(response.data)
    } catch (err: any) {
      console.error(err);
      setError('Erreur lors du chargement des données. Vérifiez que le serveur est accessible.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-full flex flex-col bg-base-100">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-base-200 bg-white">
        <div>
          <h1 className="text-2xl font-bold text-base-content">📊 Analyse des Stocks</h1>
          <p className="text-sm text-base-content/60 mt-1">
            {activeTab === 'unsold' ? 'Produits en stock mais sans ventes (Rotation = 0)' : 'Produits en surstock (Stock > 1.7x Rotation)'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs tabs-boxed bg-white border-b border-base-200 px-6 pt-4">
        <button 
          className={`tab tab-lg ${activeTab === 'unsold' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('unsold')}
        >
          💤 Invendus
        </button>
        <button 
          className={`tab tab-lg ${activeTab === 'overstock' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('overstock')}
        >
          📈 Surstock
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white px-6 py-4 border-b border-base-200">
        <div className="flex gap-4 items-end">
          <div className="form-control w-64">
            <label className="label">
              <span className="label-text font-semibold">Fournisseur</span>
            </label>
            <select 
              className="select select-bordered"
              value={selectedFournisseur}
              onChange={(e) => setSelectedFournisseur(e.target.value)}
            >
              <option value="">Tous les fournisseurs</option>
              {fournisseurs.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>

          <button 
            className="btn btn-primary"
            onClick={fetchData}
            disabled={loading}
          >
            {loading ? <span className="loading loading-spinner"></span> : '🔄 Actualiser'}
          </button>
        </div>
      </div>

      {/* Statistics */}
      {data && (
        <div className="bg-base-100 px-6 py-4 border-b border-base-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="stat bg-white border border-base-200 rounded-lg shadow-sm">
              <div className="stat-title">Fournisseur</div>
              <div className="stat-value text-xl truncate" title={data.fournisseur}>{data.fournisseur}</div>
            </div>
            <div className="stat bg-white border border-base-200 rounded-lg shadow-sm">
              <div className="stat-title">Nombre d'articles</div>
              <div className="stat-value text-warning">{data.total_items}</div>
            </div>
            <div className="stat bg-white border border-base-200 rounded-lg shadow-sm">
              <div className="stat-title">Valeur estimée {activeTab === 'overstock' ? 'du surstock' : ''}</div>
              <div className="stat-value text-error">
                {Math.round(data.total_value).toLocaleString()} F
              </div>
            </div>
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
          <div className="bg-white rounded-xl shadow-sm border border-base-200 overflow-hidden">
            <table className="table table-zebra leading-relaxed">
              <thead>
                <tr className="bg-base-200">
                  <th>Produit</th>
                  <th>Fournisseur</th>
                  <th>Stock Actuel</th>
                  {activeTab === 'unsold' ? (
                    <>
                      <th>Créé le</th>
                      <th>Prix Achat</th>
                      <th>Valeur Stock</th>
                    </>
                  ) : (
                    <>
                      <th>Rotation Moy.</th>
                      <th>Seuil (1.7x)</th>
                      <th>Qté Excès</th>
                      <th>Valeur Excès</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {data.items.map(item => (
                  <tr key={item.id} className="hover">
                    <td className="font-semibold uppercase">{item.name}</td>
                    <td><div className="badge badge-ghost badge-sm">{item.fournisseur_name}</div></td>
                    <td>
                      <span className="font-bold text-lg">{item.stock}</span>
                    </td>
                    
                    {activeTab === 'unsold' ? (
                      <>
                        <td className="font-mono text-sm">
                           {item.created_at ? new Date(item.created_at).toLocaleDateString('fr-FR') : '-'}
                        </td>
                        <td>{Math.round(item.cost_price).toLocaleString()} F</td>
                        <td className="font-bold text-error">
                          {Math.round(item.value).toLocaleString()} F
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{Number(item.rotation || 0).toFixed(2)} /mois</td>
                        <td>{item.threshold}</td>
                        <td className="font-bold text-error">+{item.excess_qty}</td>
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
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-base-content/40 bg-base-50 rounded-xl border border-dashed border-base-300">
            <div className="bg-base-200 p-4 rounded-full mb-4">
               {activeTab === 'unsold' ? '💤' : '📈'}
            </div>
            <p className="text-lg font-semibold">Aucun produit {activeTab === 'unsold' ? 'invendu' : 'en surstock'}</p>
            <p className="text-sm mt-1">Tout semble en ordre !</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default StockAnalysis
