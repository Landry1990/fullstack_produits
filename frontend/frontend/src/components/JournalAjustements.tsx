import { useEffect, useState, useMemo } from 'react'
import axios from 'axios'
import { toast } from 'react-hot-toast'
import type { StockAdjustment } from '../types'

export default function JournalAjustements() {
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterReasonType, setFilterReasonType] = useState('')
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  // Stats State
  const [stats, setStats] = useState({
    total_count: 0,
    positive_sum: 0,
    negative_sum: 0
  })

  const apiBaseUrl = useMemo(() => (import.meta.env.VITE_API_BASE_URL ?? ''), [])
  const adjustmentsEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/stock-adjustments/` : '/api/stock-adjustments/'

  const fetchAdjustments = async (page = 1) => {
    setLoading(true)
    try {
      // Build filters
      const params: any = {
        page: page,
        page_size: 20 // Adjust page size as needed
      }
      
      if (searchQuery) params.search = searchQuery
      if (filterReasonType) params.reason_type = filterReasonType
      if (dateStart) params.created_at__gte = dateStart
      if (dateEnd) params.created_at__lte = dateEnd + 'T23:59:59' // Include full end day

      // 1. Fetch List
      const response = await axios.get(adjustmentsEndpoint, { params })
      
      // DRF PageNumberPagination returns { count, next, previous, results }
      if (response.data && Array.isArray(response.data.results)) {
        setAdjustments(response.data.results)
        setTotalCount(response.data.count)
        setTotalPages(Math.ceil(response.data.count / 20)) // Assuming page_size=20
      } else {
         // Fallback if no pagination configured (should not happen with generic setup but safe)
        setAdjustments(Array.isArray(response.data) ? response.data : [])
        setTotalCount(Array.isArray(response.data) ? response.data.length : 0)
        setTotalPages(1)
      }
      setCurrentPage(page)

      // 2. Fetch Stats (uses same filters minus pagination)
      // Remove pagination params for stats
      const statsParams = { ...params }
      delete statsParams.page
      delete statsParams.page_size
      
      const statsResponse = await axios.get(`${adjustmentsEndpoint}stats/`, { params: statsParams })
      if (statsResponse.data) {
        setStats(statsResponse.data)
      }

    } catch (err) {
      toast.error('Erreur lors du chargement des ajustements')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Effect to trigger fetch when filters change (Reset to page 1)
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAdjustments(1)
    }, 500) // Debounce search
    return () => clearTimeout(timer)
  }, [searchQuery, filterReasonType, dateStart, dateEnd])

  // Simple handler for page changes
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      fetchAdjustments(newPage)
    }
  }

  const handleExportExcel = async () => {
    try {
      const params: any = {}
      if (searchQuery) params.search = searchQuery
      if (filterReasonType) params.reason_type = filterReasonType
      if (dateStart) params.created_at__gte = dateStart
      if (dateEnd) params.created_at__lte = dateEnd + 'T23:59:59'

      const response = await axios.get(`${adjustmentsEndpoint}export_excel/`, {
        params,
        responseType: 'blob'
      })

      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      link.setAttribute('download', `ajustements_stock_${timestamp}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      
      toast.success('Export réussi')
    } catch (err) {
      toast.error('Erreur lors de l\'export')
      console.error(err)
    }
  }

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">📋 Journal des Ajustements de Stock</h1>
        <div className="flex gap-2">
          <button 
            className="btn btn-sm btn-success gap-2" 
            onClick={handleExportExcel}
            disabled={loading}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Exporter Excel
          </button>
          <button className="btn btn-sm btn-ghost" onClick={() => fetchAdjustments(currentPage)}>
            🔄 Actualiser
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="stats shadow mb-6 w-full">
        <div className="stat">
          <div className="stat-title">Total ajustements (Filtrés)</div>
          <div className="stat-value text-primary">{stats.total_count}</div>
        </div>
        <div className="stat">
          <div className="stat-title">Total Entrées (+)</div>
          <div className="stat-value text-success">+{stats.positive_sum}</div>
        </div>
        <div className="stat">
          <div className="stat-title">Total Sorties (-)</div>
          <div className="stat-value text-error">{stats.negative_sum}</div>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-4 mb-4">
        <input
          type="text"
          placeholder="🔍 Rechercher produit, CIP, utilisateur..."
          className="input input-bordered input-sm flex-1 min-w-[200px]"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <div className="flex items-center gap-2">
          <span className="text-sm text-base-content/70">Du:</span>
          <input
            type="date"
            className="input input-bordered input-sm"
            value={dateStart}
            onChange={(e) => setDateStart(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-base-content/70">Au:</span>
          <input
            type="date"
            className="input input-bordered input-sm"
            value={dateEnd}
            onChange={(e) => setDateEnd(e.target.value)}
          />
        </div>
        <select
          className="select select-bordered select-sm"
          value={filterReasonType}
          onChange={(e) => setFilterReasonType(e.target.value)}
        >
          <option value="">Tous les motifs</option>
          <option value="INVENTAIRE">Ajustement inventaire</option>
          <option value="CASSE">Cassé</option>
          <option value="VOL">Vol</option>
          <option value="CONFUSION">Confusion</option>
          <option value="ERR_ENTREE">Erreur d'entrée</option>
          <option value="AVARIE">Avarié</option>
          <option value="USAGE_INT">Usage interne</option>
          <option value="PERIME">Périmé</option>
        </select>
        {(dateStart || dateEnd || filterReasonType || searchQuery) && (
          <button 
            className="btn btn-sm btn-ghost text-error"
            onClick={() => {
              setSearchQuery('')
              setDateStart('')
              setDateEnd('')
              setFilterReasonType('')
            }}
          >
            ✕ Réinitialiser
          </button>
        )}
      </div>

      {/* Tableau */}
      {loading ? (
        <div className="flex justify-center py-8">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      ) : (
        <>
        <div className="overflow-x-auto bg-base-100 rounded-lg shadow">
          <table className="table table-zebra">
            <thead>
              <tr className="bg-base-200">
                <th>Date/Heure</th>
                <th>Produit</th>
                <th>CIP</th>
                <th>Utilisateur</th>
                <th className="text-right">Avant</th>
                <th className="text-right">Après</th>
                <th className="text-center">Diff</th>
                <th>Motif</th>
              </tr>
            </thead>
            <tbody>
              {adjustments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-base-content/50">
                    Aucun ajustement trouvé
                  </td>
                </tr>
              ) : (
                adjustments.map(adj => (
                  <tr key={adj.id}>
                    <td className="text-sm">
                      {new Date(adj.created_at).toLocaleDateString('fr-FR')}
                      <br />
                      <span className="text-xs text-base-content/60">
                        {new Date(adj.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td className="font-medium">{adj.produit_name}</td>
                    <td className="font-mono text-sm">{adj.produit_cip || '-'}</td>
                    <td>{adj.user_name || adj.username || '-'}</td>
                    <td className="text-right">{adj.quantity_before}</td>
                    <td className="text-right">{adj.quantity_after}</td>
                    <td className="text-center">
                      <span className={`badge ${adj.quantity_change > 0 ? 'badge-success' : adj.quantity_change < 0 ? 'badge-error' : 'badge-ghost'}`}>
                        {adj.quantity_change > 0 ? '+' : ''}{adj.quantity_change}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-outline">{adj.reason_type_display}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="flex justify-between items-center mt-4">
            <span className="text-sm text-base-content/60">
              Page {currentPage} sur {totalPages} ({totalCount} items)
            </span>
            <div className="join">
              <button 
                className="join-item btn btn-sm"
                disabled={currentPage <= 1}
                onClick={() => handlePageChange(currentPage - 1)}
              >
                « Précédent
              </button>
              <button className="join-item btn btn-sm pointer-events-none">
                {currentPage}
              </button>
              <button 
                className="join-item btn btn-sm"
                disabled={currentPage >= totalPages}
                onClick={() => handlePageChange(currentPage + 1)}
              >
                Suivant »
              </button>
            </div>
        </div>
        </>
      )}
    </div>
  )
}
