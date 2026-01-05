import { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import { toast } from 'react-hot-toast'

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
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [selectedCloture, setSelectedCloture] = useState<ClotureCaisse | null>(null)

  const apiBaseUrl = useMemo(() => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL ?? ''
    return baseUrl ? String(baseUrl).replace(/\/$/, '') : ''
  }, [])

  const fetchClotures = async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (dateDebut) params.date_debut = dateDebut
      if (dateFin) params.date_fin = dateFin
      
      const response = await axios.get(`${apiBaseUrl}/api/clotures-caisse/`, { params })
      setClotures(response.data.results || response.data || [])
    } catch (err) {
      console.error('Erreur chargement clôtures:', err)
      toast.error('Erreur lors du chargement des clôtures')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchClotures()
  }, [])

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
      especes: '💵 Espèces',
      cheque: '📝 Chèque',
      carte: '💳 Carte',
      virement: '🏦 Virement',
      om: '🟧 Orange Money',
      momo: '📱 Mobile Money'
    }
    return labels[mode] || mode
  }

  const handlePrint = (cloture: ClotureCaisse) => {
    const win = window.open('', '', 'height=600,width=400')
    if (win) {
      const content = `
        <div style="font-family: monospace; width: 80mm; margin: 0 auto; padding: 10px; color: black;">
          <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid black; padding-bottom: 10px;">
            <h2 style="margin: 0; font-size: 1.2em; font-weight: bold;">PHARMA STOCK</h2>
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
    <div className="h-full flex flex-col bg-base-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-base-200 bg-white shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-base-content">Historique des Clôtures</h1>
          <p className="text-sm text-base-content/60 mt-1">Consultez l'historique de toutes les clôtures de caisse</p>
        </div>
        <button onClick={fetchClotures} className="btn btn-sm btn-ghost gap-2" disabled={loading}>
          {loading ? <span className="loading loading-spinner loading-xs"></span> : '🔄'}
          Actualiser
        </button>
      </div>

      {/* Filtres */}
      <div className="px-6 py-4 bg-base-50 border-b border-base-200 shrink-0">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="form-control">
            <label className="label py-1">
              <span className="label-text text-xs font-bold uppercase">Date début</span>
            </label>
            <input
              type="date"
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
              className="input input-bordered input-sm"
            />
          </div>

          <div className="form-control">
            <label className="label py-1">
              <span className="label-text text-xs font-bold uppercase">Date fin</span>
            </label>
            <input
              type="date"
              value={dateFin}
              onChange={(e) => setDateFin(e.target.value)}
              className="input input-bordered input-sm"
            />
          </div>

          <button onClick={fetchClotures} className="btn btn-sm btn-primary">
            🔍 Rechercher
          </button>

          {(dateDebut || dateFin) && (
            <button 
              onClick={() => { setDateDebut(''); setDateFin(''); fetchClotures(); }}
              className="btn btn-sm btn-ghost"
            >
              ✕ Réinitialiser
            </button>
          )}
        </div>
      </div>

      {/* Tableau */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        ) : clotures.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-base-content/40">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-lg">Aucune clôture enregistrée</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-base-200 overflow-hidden">
            <table className="table table-zebra w-full">
              <thead>
                <tr className="bg-base-200">
                  <th className="text-xs uppercase">Date</th>
                  <th className="text-xs uppercase">Caissier</th>
                  <th className="text-xs uppercase text-right">Théorique</th>
                  <th className="text-xs uppercase text-right">Réel</th>
                  <th className="text-xs uppercase text-right">Écart</th>
                  <th className="text-xs uppercase text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clotures.map((cloture) => (
                  <tr key={cloture.id} className="hover">
                    <td className="font-mono text-sm">{formatDate(cloture.date)}</td>
                    <td>{cloture.user_name || cloture.username || 'N/A'}</td>
                    <td className="text-right font-bold">{formatMoney(cloture.montant_theorique)} F</td>
                    <td className="text-right font-bold">{formatMoney(cloture.montant_reel)} F</td>
                    <td className={`text-right font-bold ${parseFloat(cloture.ecart_caisse) < 0 ? 'text-error' : parseFloat(cloture.ecart_caisse) > 0 ? 'text-success' : ''}`}>
                      {parseFloat(cloture.ecart_caisse) > 0 ? '+' : ''}{formatMoney(cloture.ecart_caisse)} F
                    </td>
                    <td className="text-center">
                      <div className="flex justify-center gap-2">
                        <button 
                          onClick={() => setSelectedCloture(cloture)}
                          className="btn btn-xs btn-ghost"
                          title="Voir détails"
                        >
                          👁️
                        </button>
                        <button 
                          onClick={() => handlePrint(cloture)}
                          className="btn btn-xs btn-ghost"
                          title="Imprimer"
                        >
                          🖨️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-3 border-t border-base-200 bg-base-50 shrink-0">
        <p className="text-sm text-base-content/60">
          {clotures.length} clôture{clotures.length > 1 ? 's' : ''} enregistrée{clotures.length > 1 ? 's' : ''}
        </p>
      </div>

      {/* Modal détails */}
      {selectedCloture && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-lg">
            <h3 className="font-bold text-lg mb-4">
              Détails - Clôture du {formatDate(selectedCloture.date)}
            </h3>

            <div className="space-y-4">
              <div className="stats shadow w-full">
                <div className="stat">
                  <div className="stat-title">Montant Théorique</div>
                  <div className="stat-value text-primary text-2xl">{formatMoney(selectedCloture.montant_theorique)} F</div>
                </div>
                <div className="stat">
                  <div className="stat-title">Montant Réel</div>
                  <div className="stat-value text-2xl">{formatMoney(selectedCloture.montant_reel)} F</div>
                </div>
              </div>

              <div className={`alert ${parseFloat(selectedCloture.ecart_caisse) === 0 ? 'alert-success' : 'alert-warning'}`}>
                <span className="font-bold">
                  Écart: {parseFloat(selectedCloture.ecart_caisse) > 0 ? '+' : ''}{formatMoney(selectedCloture.ecart_caisse)} F
                </span>
              </div>

              <div className="divider">Détails par mode de paiement</div>

              <div className="grid grid-cols-2 gap-2">
                {Object.entries(selectedCloture.details_paiement || {}).map(([mode, montant]) => (
                  <div key={mode} className="flex justify-between p-2 bg-base-100 rounded">
                    <span>{getModeLabel(mode)}</span>
                    <span className="font-bold">{formatMoney(montant)} F</span>
                  </div>
                ))}
              </div>

              <div className="divider">Mouvements</div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-base-100 p-3 rounded">
                  <div className="text-xs opacity-60">Ventes</div>
                  <div className="font-bold">{formatMoney(selectedCloture.total_ventes)} F</div>
                </div>
                <div className="bg-success/10 p-3 rounded">
                  <div className="text-xs opacity-60">+ Entrées</div>
                  <div className="font-bold text-success">{formatMoney(selectedCloture.total_entrees)} F</div>
                </div>
                <div className="bg-error/10 p-3 rounded">
                  <div className="text-xs opacity-60">- Sorties</div>
                  <div className="font-bold text-error">{formatMoney(selectedCloture.total_sorties)} F</div>
                </div>
              </div>

              {selectedCloture.observation && (
                <>
                  <div className="divider">Observations</div>
                  <p className="text-sm">{selectedCloture.observation}</p>
                </>
              )}
            </div>

            <div className="modal-action">
              <button onClick={() => handlePrint(selectedCloture)} className="btn btn-outline gap-2">
                🖨️ Imprimer
              </button>
              <button onClick={() => setSelectedCloture(null)} className="btn btn-primary">
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
