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

  const apiBaseUrl = useMemo(() => (import.meta.env.VITE_API_BASE_URL ?? ''), [])
  const adjustmentsEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/stock-adjustments/` : '/api/stock-adjustments/'

  const fetchAdjustments = async () => {
    setLoading(true)
    try {
      const response = await axios.get(adjustmentsEndpoint)
      const data: StockAdjustment[] = Array.isArray(response.data) 
        ? response.data 
        : (response.data?.results ?? [])
      setAdjustments(data)
    } catch (err) {
      toast.error('Erreur lors du chargement des ajustements')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAdjustments()
  }, [])

  // Filtrage
  const filteredAdjustments = useMemo(() => {
    return adjustments.filter(adj => {
      const matchSearch = !searchQuery || 
        adj.produit_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        adj.produit_cip?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        adj.user_name?.toLowerCase().includes(searchQuery.toLowerCase())
      
      const matchReason = !filterReasonType || adj.reason_type === filterReasonType
      
      // Filtre par date
      const adjDate = new Date(adj.created_at)
      const matchDateStart = !dateStart || adjDate >= new Date(dateStart)
      const matchDateEnd = !dateEnd || adjDate <= new Date(dateEnd + 'T23:59:59')
      
      return matchSearch && matchReason && matchDateStart && matchDateEnd
    })
  }, [adjustments, searchQuery, filterReasonType, dateStart, dateEnd])

  // Stats rapides
  const stats = useMemo(() => {
    const total = adjustments.length
    const positiveChanges = adjustments.filter(a => a.quantity_change > 0).reduce((s, a) => s + a.quantity_change, 0)
    const negativeChanges = adjustments.filter(a => a.quantity_change < 0).reduce((s, a) => s + a.quantity_change, 0)
    return { total, positiveChanges, negativeChanges }
  }, [adjustments])

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">📋 Journal des Ajustements de Stock</h1>
        <button className="btn btn-sm btn-ghost" onClick={fetchAdjustments}>
          🔄 Actualiser
        </button>
      </div>

      {/* Stats */}
      <div className="stats shadow mb-6 w-full">
        <div className="stat">
          <div className="stat-title">Total ajustements</div>
          <div className="stat-value text-primary">{stats.total}</div>
        </div>
        <div className="stat">
          <div className="stat-title">Entrées (+)</div>
          <div className="stat-value text-success">+{stats.positiveChanges}</div>
        </div>
        <div className="stat">
          <div className="stat-title">Sorties (-)</div>
          <div className="stat-value text-error">{stats.negativeChanges}</div>
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
              {filteredAdjustments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-base-content/50">
                    Aucun ajustement trouvé
                  </td>
                </tr>
              ) : (
                filteredAdjustments.map(adj => (
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
      )}

      <div className="mt-4 text-sm text-base-content/60 text-right">
        {filteredAdjustments.length} ajustement(s) affiché(s)
      </div>
    </div>
  )
}
