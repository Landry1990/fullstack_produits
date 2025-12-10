import { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import type { StockLot } from '../types'

export default function Perimes() {
  const [lots, setLots] = useState<StockLot[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filterDays, setFilterDays] = useState<number>(30) // Default: expiring in 30 days
  const [showExpiredOnly, setShowExpiredOnly] = useState<boolean>(true)

  const apiBaseUrl = useMemo(() => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL ?? ''
    return baseUrl ? String(baseUrl).replace(/\/$/, '') : ''
  }, [])

  const stockLotsEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/stock-lots/` : '/api/stock-lots/'

  useEffect(() => {
    fetchLots()
  }, [filterDays, showExpiredOnly])

  const fetchLots = async () => {
    setLoading(true)
    setError(null)
    try {
      // Calculate date threshold
      const today = new Date()
      const thresholdDate = new Date()
      thresholdDate.setDate(today.getDate() + filterDays)
      
      const dateStr = thresholdDate.toISOString().split('T')[0]
      
      const response = await axios.get<StockLot[]>(stockLotsEndpoint, {
        params: {
          date_expiration_lte: dateStr,
          include_empty: 'false'
        }
      })
      
      let fetchedLots = response.data
      
      if (showExpiredOnly) {
         const todayStr = new Date().toISOString().split('T')[0]
         fetchedLots = fetchedLots.filter(l => l.date_expiration && l.date_expiration < todayStr)
      }
      
      setLots(fetchedLots)
    } catch (err) {
      console.error('Erreur chargement lots:', err)
      setError('Impossible de charger les lots')
    } finally {
      setLoading(false)
    }
  }

  const handleSortirStock = async (lot: StockLot) => {
    const quantity = prompt(`Combien d'unités voulez-vous sortir du stock pour le lot ${lot.lot} ? (Max: ${lot.quantity_remaining})`, String(lot.quantity_remaining))
    
    if (!quantity) return
    
    const qty = parseInt(quantity, 10)
    if (isNaN(qty) || qty <= 0 || qty > lot.quantity_remaining) {
      alert('Quantité invalide.')
      return
    }
    
    if (!confirm(`Confirmer la sortie de ${qty} unités du produit ${lot.produit_nom} ?`)) return

    try {
      await axios.post(`${stockLotsEndpoint}${lot.id}/sortir_perimes/`, {
        quantity: qty,
        reason: 'Périmé / Avarie'
      })
      alert('Sortie de stock effectuée.')
      fetchLots()
    } catch (err) {
      console.error('Erreur sortie stock:', err)
      alert('Erreur lors de la sortie de stock.')
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('fr-FR')
  }

  const isExpired = (dateString: string) => {
    if (!dateString) return false
    return new Date(dateString) < new Date()
  }

  return (
    <div className="h-full flex flex-col bg-base-100 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-base-200 bg-white shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-base-content">Gestion des Périmés</h1>
          <p className="text-sm text-base-content/60 mt-1">Lots périmés ou bientôt périmés</p>
        </div>
        <button onClick={fetchLots} className="btn btn-sm btn-ghost gap-2" disabled={loading}>
          {loading ? <span className="loading loading-spinner loading-xs"></span> : '🔄'}
          Actualiser
        </button>
      </div>

      {error && (
        <div className="px-6 pt-4 shrink-0">
          <div role="alert" className="alert alert-error">
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        </div>
      )}

      <div className="px-6 py-4 bg-base-50 border-b border-base-200 shrink-0 flex gap-4 items-center">
        <div className="form-control">
          <label className="label cursor-pointer gap-2">
            <span className="label-text font-medium">Uniquement déjà périmés</span> 
            <input 
              type="checkbox" 
              className="toggle toggle-error" 
              checked={showExpiredOnly} 
              onChange={(e) => setShowExpiredOnly(e.target.checked)}
            />
          </label>
        </div>
        
        {!showExpiredOnly && (
          <div className="flex items-center gap-2">
            <span className="text-sm">Expire dans les</span>
            <select 
              className="select select-bordered select-sm" 
              value={filterDays} 
              onChange={(e) => setFilterDays(parseInt(e.target.value))}
            >
              <option value={30}>30 jours</option>
              <option value={60}>60 jours</option>
              <option value={90}>90 jours</option>
              <option value={180}>6 mois</option>
            </select>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        ) : lots.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-base-content/40">
            <p className="text-lg">Aucun lot trouvé</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-base-200 overflow-hidden">
            <table className="table table-zebra w-full">
              <thead>
                <tr className="bg-base-200">
                  <th>Produit</th>
                  <th>Lot</th>
                  <th>Date Expiration</th>
                  <th>Fournisseur</th>
                  <th>Stock Restant</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {lots.map((lot) => (
                  <tr key={lot.id} className="hover">
                    <td className="font-bold">{lot.produit_nom}</td>
                    <td className="font-mono">{lot.lot || '-'}</td>
                    <td>
                      <span className={`badge ${lot.date_expiration && isExpired(lot.date_expiration) ? 'badge-error' : 'badge-warning'}`}>
                        {formatDate(lot.date_expiration || '')}
                      </span>
                    </td>
                    <td>{lot.fournisseur_nom}</td>
                    <td className="font-bold">{lot.quantity_remaining}</td>
                    <td>
                      <button 
                        className="btn btn-xs btn-error btn-outline"
                        onClick={() => handleSortirStock(lot)}
                      >
                        🗑️ Sortir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
