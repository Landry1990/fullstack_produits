import { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import type { CaisseTransaction } from '../types'

export default function JournalCaisse() {
  const [transactions, setTransactions] = useState<CaisseTransaction[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterMode, setFilterMode] = useState<string>('all')
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')

  const apiBaseUrl = useMemo(() => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL ?? ''
    return baseUrl ? String(baseUrl).replace(/\/$/, '') : ''
  }, [])

  const caisseEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/caisse/` : '/api/caisse/'

  useEffect(() => {
    fetchTransactions()
  }, [])

  const fetchTransactions = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await axios.get<CaisseTransaction[]>(caisseEndpoint)
      setTransactions(response.data)
    } catch (err) {
      setError('Erreur lors du chargement des transactions')
      console.error('Erreur:', err)
    } finally {
      setLoading(false)
    }
  }

  // Filtrer les transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter(transaction => {
      // Filtre par recherche (client ou numéro facture)
      const matchesSearch = searchQuery === '' || 
        transaction.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        transaction.facture_numero?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        transaction.user_details?.full_name.toLowerCase().includes(searchQuery.toLowerCase())

      // Filtre par mode de paiement
      const matchesMode = filterMode === 'all' || transaction.mode_paiement === filterMode

      // Filtre par date
      let matchesDate = true
      if (dateDebut && dateFin) {
        const transactionDate = new Date(transaction.date_paiement)
        const debut = new Date(dateDebut)
        const fin = new Date(dateFin)
        fin.setHours(23, 59, 59, 999) // Inclure toute la journée de fin
        matchesDate = transactionDate >= debut && transactionDate <= fin
      }

      return matchesSearch && matchesMode && matchesDate
    })
  }, [transactions, searchQuery, filterMode, dateDebut, dateFin])

  // Calculer les totaux par mode de paiement
  const totauxParMode = useMemo(() => {
    const totaux: Record<string, number> = {
      especes: 0,
      cheque: 0,
      carte: 0,
      virement: 0,
      om: 0,
      momo: 0,
      en_compte: 0,
      total: 0
    }

    filteredTransactions.forEach(transaction => {
      if (transaction.statut === 'completee') {
        const montant = parseFloat(transaction.montant)
        totaux[transaction.mode_paiement] += montant
        totaux.total += montant
      }
    })

    return totaux
  }, [filteredTransactions])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const [isClosingModalOpen, setIsClosingModalOpen] = useState(false)
  const [closingTotals, setClosingTotals] = useState<{
    start_date: string | null,
    end_date?: string | null,
    total_theorique: number,
    details: Record<string, number>,
    user?: string
  } | null>(null)
  const [actualAmount, setActualAmount] = useState<string>('')

  const fetchClosingTotals = async () => {
    try {
      const params: any = {}
      if (dateDebut) params.date_debut = dateDebut
      if (dateFin) params.date_fin = dateFin
      
      const response = await axios.get(`${caisseEndpoint}get_totals/`, { params })
      setClosingTotals(response.data)
      setActualAmount(response.data.total_theorique.toString()) // Default to theoretical
      setIsClosingModalOpen(true)
    } catch (err) {
      console.error('Erreur chargement totaux:', err)
      setError('Impossible de charger les totaux pour la clôture')
    }
  }

  const handleCloseCaisse = async () => {
    if (!actualAmount) return
    
    try {
      await axios.post(`${caisseEndpoint}cloturer/`, {
        montant_reel: parseFloat(actualAmount),
        date_debut: dateDebut || undefined,
        date_fin: dateFin || undefined
      })
      setIsClosingModalOpen(false)
      alert('Caisse clôturée avec succès !')
      fetchTransactions() // Refresh list
    } catch (err) {
      console.error('Erreur clôture:', err)
      setError('Erreur lors de la clôture de caisse')
    }
  }

  const handleImprimerCloture = () => {
    if (!closingTotals) return
    
    const win = window.open('', '', 'height=600,width=400');
    if (win) {
      const formatDateLong = (d: string) => {
        return new Date(d).toLocaleString('fr-FR', { 
          day: 'numeric', month: 'numeric', year: 'numeric', 
          hour: '2-digit', minute: '2-digit' 
        });
      };

      const startStr = closingTotals.start_date ? formatDateLong(closingTotals.start_date) : 'Début';
      const endStr = dateFin ? formatDateLong(dateFin) : 'Maintenant';

      const content = `
        <div style="font-family: monospace; width: 80mm; margin: 0 auto; padding: 10px; color: black;">
            <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid black; padding-bottom: 10px;">
                <h2 style="margin: 0; font-size: 1.2em; font-weight: bold;">PHARMA STOCK</h2>
                <div style="font-size: 0.9em;">Douala, Cameroun</div>
                <div style="font-size: 0.9em;">CLÔTURE DE CAISSE</div>
            </div>

            <div style="font-size: 0.8em; margin-bottom: 15px;">
                <div style="display: flex; justify-content: space-between;">
                    <span>Date:</span>
                    <span>${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>Caissier:</span>
                    <span>${closingTotals.user || 'Admin'}</span>
                </div>
            </div>

            <div style="border-top: 1px dashed black; border-bottom: 1px dashed black; padding: 8px 0; margin-bottom: 15px;">
                <div style="font-weight: bold; text-align: center; margin-bottom: 5px; text-transform: uppercase;">Période (Tranche)</div>
                <div style="display: flex; justify-content: space-between; font-size: 0.9em;">
                    <span>Du:</span>
                    <span>${startStr}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.9em;">
                    <span>Au:</span>
                    <span>${endStr}</span>
                </div>
            </div>

            <div style="margin-bottom: 15px;">
                <div style="font-weight: bold; margin-bottom: 5px; border-bottom: 1px dashed black; padding-bottom: 2px;">DÉTAILS ENCAISSEMENTS</div>
                ${Object.entries(closingTotals.details).map(([mode, montant]) => `
                    <div style="display: flex; justify-content: space-between; font-size: 0.9em; margin-bottom: 3px;">
                        <span>${getModeIcon(mode)} ${mode.toUpperCase()}</span>
                        <span>${Math.round(montant)} F</span>
                    </div>
                `).join('')}
            </div>

            <div style="border-top: 2px solid black; padding-top: 10px; margin-top: 10px;">
                <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 1.1em; margin-bottom: 5px;">
                    <span>TOTAL THÉORIQUE</span>
                    <span>${Math.round(closingTotals.total_theorique)} F</span>
                </div>
                 <div style="display: flex; justify-content: space-between; font-size: 0.9em; border-top: 1px dashed black; padding-top: 5px; margin-top: 5px;">
                    <span>Montant Réel (Compté)</span>
                    <span>${actualAmount ? Math.round(parseFloat(actualAmount)) + ' F' : '_________'}</span>
                </div>
                 <div style="display: flex; justify-content: space-between; font-size: 0.9em; margin-top: 5px;">
                    <span>Ecart Caisse</span>
                    <span>${actualAmount ? Math.round(parseFloat(actualAmount) - closingTotals.total_theorique) + ' F' : '_________'}</span>
                </div>
            </div>

            <div style="display: flex; justify-content: space-between; margin-top: 40px; font-size: 0.8em;">
                <div style="text-align: center;">
                    <p style="margin-bottom: 40px; text-decoration: underline;">Signature Caissier</p>
                </div>
                <div style="text-align: center;">
                    <p style="margin-bottom: 40px; text-decoration: underline;">Signature Responsable</p>
                </div>
            </div>
            
            <div style="text-align: center; font-size: 0.7em; margin-top: 20px;">
                --- Fin du rapport de clôture ---
            </div>
        </div>
      `;
      
      win.document.write('<html><head><title>Clôture Caisse</title>');
      win.document.write('<style>body { font-family: monospace; padding: 0; margin: 0; } @media print { body { padding: 0; margin: 0; } }</style>');
      win.document.write('</head><body>');
      win.document.write(content);
      win.document.write('</body></html>');
      win.document.close();
      win.print();
    }
  }

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'especes': return '💵'
      case 'cheque': return '📝'
      case 'carte': return '💳'
      case 'virement': return '🏦'
      case 'om': return '🟧'
      case 'momo': return '📱'
      case 'en_compte': return '📊'
      default: return '💰'
    }
  }

  return (
    <div className="h-full flex flex-col bg-base-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-base-200 bg-white shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-base-content">Journal de Caisse</h1>
          <p className="text-sm text-base-content/60 mt-1">Historique de toutes les transactions</p>
        </div>
        <button
          onClick={fetchTransactions}
          className="btn btn-sm btn-ghost gap-2"
          disabled={loading}
        >
          {loading ? <span className="loading loading-spinner loading-xs"></span> : '🔄'}
          Actualiser
        </button>
        <button
          onClick={fetchClosingTotals}
          className="btn btn-sm btn-primary gap-2 ml-2"
          disabled={loading}
        >
          🔒 Clôturer la Caisse
        </button>
      </div>

      {/* Filtres */}
      <div className="px-6 py-4 bg-base-50 border-b border-base-200 shrink-0">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Recherche */}
          <div className="form-control">
            <label className="label py-1">
              <span className="label-text text-xs font-bold uppercase">Rechercher</span>
            </label>
            <input
              type="text"
              placeholder="Client, facture, opérateur..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input input-bordered input-sm"
            />
          </div>

          {/* Mode de paiement */}
          <div className="form-control">
            <label className="label py-1">
              <span className="label-text text-xs font-bold uppercase">Mode de paiement</span>
            </label>
            <select
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value)}
              className="select select-bordered select-sm"
            >
              <option value="all">Tous</option>
              <option value="especes">Espèces</option>
              <option value="cheque">Chèque</option>
              <option value="carte">Carte</option>
              <option value="virement">Virement</option>
              <option value="om">Orange Money</option>
              <option value="momo">Mobile Money</option>
              <option value="en_compte">En compte</option>
            </select>
          </div>

          {/* Date début */}
          <div className="form-control">
            <label className="label py-1">
              <span className="label-text text-xs font-bold uppercase">Début (Date & Heure)</span>
            </label>
            <input
              type="datetime-local"
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
              className="input input-bordered input-sm"
            />
          </div>

          {/* Date fin */}
          <div className="form-control">
            <label className="label py-1">
              <span className="label-text text-xs font-bold uppercase">Fin (Date & Heure)</span>
            </label>
            <input
              type="datetime-local"
              value={dateFin}
              onChange={(e) => setDateFin(e.target.value)}
              className="input input-bordered input-sm"
            />
          </div>
        </div>

        {/* Bouton reset filtres */}
        {(searchQuery || filterMode !== 'all' || dateDebut || dateFin) && (
          <div className="mt-3">
            <button
              onClick={() => {
                setSearchQuery('')
                setFilterMode('all')
                setDateDebut('')
                setDateFin('')
              }}
              className="btn btn-xs btn-ghost"
            >
              ✕ Réinitialiser les filtres
            </button>
          </div>
        )}
      </div>

      {/* Totaux */}
      <div className="px-6 py-3 bg-white border-b border-base-200 shrink-0">
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="badge badge-lg badge-ghost gap-2">
            💵 Espèces: <span className="font-bold">{Math.round(totauxParMode.especes)} F</span>
          </div>
          <div className="badge badge-lg badge-ghost gap-2">
            📝 Chèque: <span className="font-bold">{Math.round(totauxParMode.cheque)} F</span>
          </div>
          <div className="badge badge-lg badge-ghost gap-2">
            💳 Carte: <span className="font-bold">{Math.round(totauxParMode.carte)} F</span>
          </div>
          <div className="badge badge-lg badge-ghost gap-2">
            🏦 Virement: <span className="font-bold">{Math.round(totauxParMode.virement)} F</span>
          </div>
          <div className="badge badge-lg badge-ghost gap-2">
            🟧 OM: <span className="font-bold">{Math.round(totauxParMode.om)} F</span>
          </div>
          <div className="badge badge-lg badge-ghost gap-2">
            📱 MoMo: <span className="font-bold">{Math.round(totauxParMode.momo)} F</span>
          </div>
          <div className="badge badge-lg badge-ghost gap-2">
            📊 En compte: <span className="font-bold">{Math.round(totauxParMode.en_compte)} F</span>
          </div>
          <div className="badge badge-lg badge-primary gap-2">
            💰 TOTAL: <span className="font-bold">{Math.round(totauxParMode.total)} F</span>
          </div>
        </div>
      </div>

      {/* Messages d'erreur */}
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

      {/* Tableau */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-base-content/40">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-lg">Aucune transaction trouvée</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-base-200 overflow-hidden">
            <table className="table table-zebra w-full">
              <thead>
                <tr className="bg-base-200">
                  <th className="text-xs uppercase">Date & Heure</th>
                  <th className="text-xs uppercase">Opérateur</th>
                  <th className="text-xs uppercase">Client</th>
                  <th className="text-xs uppercase">N° Facture</th>
                  <th className="text-xs uppercase text-right">Montant</th>
                  <th className="text-xs uppercase">Mode de règlement</th>
                  <th className="text-xs uppercase">Statut</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((transaction) => (
                  <tr key={transaction.id} className="hover">
                    <td className="font-mono text-sm">{formatDate(transaction.date_paiement)}</td>
                    <td>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">
                          {transaction.user_details?.full_name || 'Non renseigné'}
                        </span>
                        {transaction.user_details && (
                          <span className="text-xs text-base-content/60">
                            @{transaction.user_details.username}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="font-medium">{transaction.client_name}</td>
                    <td className="font-mono text-sm">{transaction.facture_numero || '-'}</td>
                    <td className="text-right font-bold">{Math.round(parseFloat(transaction.montant))} F</td>
                    <td>
                      <div className="badge badge-outline gap-2">
                        {getModeIcon(transaction.mode_paiement)}
                        {transaction.mode_paiement_display}
                      </div>
                    </td>
                    <td>
                      <div className={`badge ${
                        transaction.statut === 'completee' ? 'badge-success' :
                        transaction.statut === 'annulee' ? 'badge-error' :
                        'badge-warning'
                      }`}>
                        {transaction.statut}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer avec nombre de résultats */}
      <div className="px-6 py-3 border-t border-base-200 bg-base-50 shrink-0">
        <p className="text-sm text-base-content/60">
          {filteredTransactions.length} transaction{filteredTransactions.length > 1 ? 's' : ''} affichée{filteredTransactions.length > 1 ? 's' : ''}
          {filteredTransactions.length !== transactions.length && ` sur ${transactions.length} au total`}
        </p>
      </div>

      {/* Modal de Clôture */}
      <dialog className={`modal ${isClosingModalOpen ? 'modal-open' : ''}`}>
        <div className="modal-box">
          <h3 className="font-bold text-lg mb-4">Clôture de Caisse</h3>
          
          {closingTotals && (
            <div className="space-y-4">
              <div className="alert alert-info text-sm">
                <span>Période : {closingTotals.start_date ? `Depuis le ${formatDate(closingTotals.start_date)}` : 'Depuis le début'}</span>
              </div>

              <div className="stats shadow w-full">
                <div className="stat">
                  <div className="stat-title">Total Théorique</div>
                  <div className="stat-value text-primary">{Math.round(closingTotals.total_theorique)} F</div>
                  <div className="stat-desc">Calculé d'après les transactions</div>
                </div>
              </div>

              <div className="form-control w-full">
                <label className="label">
                  <span className="label-text font-bold">Montant Réel en Caisse</span>
                </label>
                <input 
                  type="number" 
                  placeholder="Entrez le montant compté..." 
                  className="input input-bordered w-full input-lg" 
                  value={actualAmount}
                  onChange={(e) => setActualAmount(e.target.value)}
                />
                <label className="label">
                  <span className="label-text-alt">
                    Ecart : {actualAmount ? Math.round(parseFloat(actualAmount) - closingTotals.total_theorique) : 0} F
                  </span>
                </label>
              </div>

              <div className="collapse collapse-arrow bg-base-100 border border-base-200">
                <input type="checkbox" /> 
                <div className="collapse-title font-medium">
                  Détails par mode de paiement
                </div>
                <div className="collapse-content"> 
                  <ul className="menu menu-compact bg-base-100 w-full p-2 rounded-box">
                    {Object.entries(closingTotals.details).map(([mode, montant]) => (
                      <li key={mode} className="flex-row justify-between">
                        <span>{getModeIcon(mode)} {mode}</span>
                        <span className="font-bold">{Math.round(montant)} F</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          <div className="modal-action flex justify-between items-center">
             <button className="btn btn-ghost" onClick={handleImprimerCloture}>🖨️ Imprimer Ticket</button>
             <div className="flex gap-2">
                <button className="btn" onClick={() => setIsClosingModalOpen(false)}>Annuler</button>
                <button className="btn btn-primary" onClick={handleCloseCaisse}>Confirmer la Clôture</button>
             </div>
          </div>
        </div>
      </dialog>
    </div>
  )
}
