import { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import type { CaisseTransaction, MouvementCaisse } from '../types'
import CashMovementModal from './CashMovementModal'

export default function JournalCaisse() {
  const [transactions, setTransactions] = useState<CaisseTransaction[]>([])
  const [mouvements, setMouvements] = useState<MouvementCaisse[]>([])
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterMode, setFilterMode] = useState<string>('all')
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [expandedReleves, setExpandedReleves] = useState<Set<number>>(new Set())

  const toggleReleve = (releveId: number) => {
    setExpandedReleves(prev => {
        const next = new Set(prev)
        if (next.has(releveId)) {
            next.delete(releveId)
        } else {
            next.add(releveId)
        }
        return next
    })
  }

  const apiBaseUrl = useMemo(() => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL ?? ''
    return baseUrl ? String(baseUrl).replace(/\/$/, '') : ''
  }, [])

  const caisseEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/caisse/` : '/api/caisse/'

  useEffect(() => {
    fetchData()
  }, [])

  // Re-fetch totals when date filters change
  useEffect(() => {
    if (dateDebut || dateFin) {
      fetchTotals()
    }
  }, [dateDebut, dateFin])

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      await Promise.all([
        fetchTransactions(),
        fetchMouvements(),
        fetchTotals()
      ])
    } catch (err) {
      setError('Erreur lors du chargement des données')
    } finally {
      setLoading(false)
    }
  }

  const fetchMouvements = async () => {
      try {
          const response = await axios.get(`${apiBaseUrl}/api/mouvements-caisse/`)
          // Handle both array and paginated responses
          const data: any = response.data
          setMouvements(Array.isArray(data) ? data : (data.results || []))
      } catch (err) {
          console.error("Erreur chargement mouvements", err)
      }
  }

  const fetchTransactions = async () => {
    // setLoading(true) handled in fetchData
    try {
      const response = await axios.get(caisseEndpoint)
      // Handle paginated response
      const data: any = response.data;
      setTransactions(Array.isArray(data) ? data : (data.results || []))
    } catch (err) {
      // setError('Erreur lors du chargement des transactions') handled in fetchData
      console.error('Erreur:', err)
      throw err;
    }
  }

  // Filtrer les transactions et mouvements
  const filteredItems = useMemo(() => {
    const filteredTrans = transactions.filter(transaction => {
      // Filtre par recherche
      const matchesSearch = searchQuery === '' || 
        transaction.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        transaction.facture_numero?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        transaction.user_details?.full_name.toLowerCase().includes(searchQuery.toLowerCase())

      // Exclure les transactions 'en_compte'
      if (transaction.mode_paiement === 'en_compte') return false

      // Filtre par mode de paiement
      const matchesMode = filterMode === 'all' || transaction.mode_paiement === filterMode

      // Filtre par date
      let matchesDate = true
      if (dateDebut && dateFin) {
        const transactionDate = new Date(transaction.date_paiement)
        const debut = new Date(dateDebut)
        const fin = new Date(dateFin)
        fin.setHours(23, 59, 59, 999) 
        matchesDate = transactionDate >= debut && transactionDate <= fin
      }

      return matchesSearch && matchesMode && matchesDate
    })

    const filteredMouvs = mouvements.filter(mouv => {
       const matchesSearch = searchQuery === '' || 
        mouv.motif.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (mouv.description && mouv.description.toLowerCase().includes(searchQuery.toLowerCase()))

       // Mode filter doesn't strictly apply to movements (they are usually Cash), but we could assume Cash.
       // For now, if mode is Espèces or All, we show them.
       const matchesMode = filterMode === 'all' || filterMode === 'especes'

       let matchesDate = true
       if (dateDebut && dateFin) {
        const d = new Date(mouv.date)
        const debut = new Date(dateDebut)
        const fin = new Date(dateFin)
        fin.setHours(23, 59, 59, 999) 
        matchesDate = d >= debut && d <= fin
      }
      return matchesSearch && matchesMode && matchesDate
    })

    // Combine and mark types
    const combined = [
        ...filteredTrans.map(t => ({ ...t, _kind: 'transaction' as const })),
        ...filteredMouvs.map(m => ({ ...m, _kind: 'mouvement' as const, date_paiement: m.date })) // map date for sort
    ]
    
    // Sort by date desc
    return combined.sort((a, b) => new Date(b.date_paiement).getTime() - new Date(a.date_paiement).getTime())

  }, [transactions, mouvements, searchQuery, filterMode, dateDebut, dateFin])

  // Group transactions by Relevé
  const groupedItems = useMemo(() => {
     // Check if we need to group. Only transactions can be grouped.
     // Movements are just added as is.
     
     const result: any[] = []
     const processedReleves = new Set<number>()
     
     // Separate transactions and movements from the sorted list to handle grouping safely?
     // Actually, since we want to keep date order, we should iterate the sorted list.
     
     filteredItems.forEach((item: any) => {
         if (item._kind === 'mouvement') {
             result.push(item)
         } else {
             const t = item as CaisseTransaction
             if (t.releve_id) {
                 if (!processedReleves.has(t.releve_id)) {
                     // Find all transactions for this Relevé in the current filtered list (excluding movements)
                     const releveItems = filteredItems.filter((rt: any) => rt._kind === 'transaction' && rt.releve_id === t.releve_id) as CaisseTransaction[]
                     
                     const totalAmount = releveItems.reduce((sum, item) => sum + parseFloat(item.montant), 0)
                     
                     result.push({
                         ...t, 
                         id: -t.releve_id, 
                         releve_reference: t.releve_reference,
                         montant: totalAmount.toString(),
                         isReleveGroup: true,
                         items: releveItems,
                         facture_numero: `${releveItems.length} factures`,
                         _kind: 'transaction'
                     })
                     processedReleves.add(t.releve_id)
                 }
             } else {
                 result.push(t)
             }
         }
     })
     
     return result
  }, [filteredItems])

  // Calculer les totaux
  const totauxParMode = useMemo(() => {
    const totaux: Record<string, number> = {
      especes: 0,
      cheque: 0,
      carte: 0,
      virement: 0,
      om: 0,
      momo: 0,
      en_compte: 0,
      total: 0,
      entrees: 0,
      sorties: 0
    }

    filteredItems.forEach((item: any) => {
       const montant = parseFloat(item.montant)
       if (item._kind === 'mouvement') {
           if (item.type === 'ENTREE') {
               totaux.entrees += montant
               totaux.total += montant // Assuming entries add to cash
           } else {
               totaux.sorties += montant
               totaux.total -= montant // Assuming exits subtract from cash
           }
       } else {
          // Transaction
          if (item.statut === 'completee') {
            totaux[item.mode_paiement] += montant
            totaux.total += montant
          }
       }
    })

    return totaux
  }, [filteredItems])

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
  const [globalTotals, setGlobalTotals] = useState<{
    start_date: string | null,
    end_date?: string | null,
    total_theorique: number,
    total_entrees: number,
    total_sorties: number,
    details: Record<string, number>,
    user?: string
  } | null>(null)


  const [closingTotals, setClosingTotals] = useState<{
    start_date: string | null,
    end_date?: string | null,
    total_theorique: number,
    total_ventes?: number,
    total_entrees: number,
    total_sorties: number,
    details: Record<string, number>,
    user?: string
  } | null>(null)
  const [actualAmount, setActualAmount] = useState<string>('')

  const fetchTotals = async () => {
    try {
      const params: any = {}
      if (dateDebut) params.date_debut = dateDebut
      if (dateFin) params.date_fin = dateFin
      
      const response = await axios.get(`${caisseEndpoint}get_totals/`, { params })
      setGlobalTotals(response.data)
      return response.data
    } catch (err) {
      console.error('Erreur chargement totaux:', err)
      // Don't block UI, just log
    }
  }
  
  
  const openClosingModal = () => {
      // Use the filtered totals (totauxParMode) to match the displayed "Solde Théorique"
      const modalTotals = {
          start_date: dateDebut || null,
          end_date: dateFin || null,
          total_theorique: totauxParMode.total,
          total_ventes: totauxParMode.total - totauxParMode.entrees + totauxParMode.sorties, // Sales only
          total_entrees: totauxParMode.entrees,
          total_sorties: totauxParMode.sorties,
          details: {
              especes: totauxParMode.especes,
              cheque: totauxParMode.cheque,
              carte: totauxParMode.carte,
              virement: totauxParMode.virement,
              om: totauxParMode.om,
              momo: totauxParMode.momo
          }
      }
      
      setClosingTotals(modalTotals)
      setActualAmount('') // Leave empty for manual entry
      setIsClosingModalOpen(true)
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
                <div style="font-weight: bold; margin-bottom: 5px; border-bottom: 1px dashed black; padding-bottom: 2px;">DÉTAILS ENCAISSEMENTS VENTES</div>
                ${Object.entries(closingTotals.details).map(([mode, montant]) => `
                    <div style="display: flex; justify-content: space-between; font-size: 0.9em; margin-bottom: 3px;">
                        <span>${getModeIcon(mode)} ${mode.toUpperCase()}</span>
                        <span>${Math.round(montant)} F</span>
                    </div>
                `).join('')}
            </div>

            <div style="margin-bottom: 15px; border-top: 1px dashed black; padding-top: 5px;">
                <div style="display: flex; justify-content: space-between; font-size: 0.9em; margin-bottom: 3px;">
                    <span>📥 AUTRES ENTRÉES</span>
                    <span>${Math.round(closingTotals.total_entrees)} F</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.9em; margin-bottom: 3px;">
                    <span>📤 SORTIES DIVERSES</span>
                    <span>-${Math.round(closingTotals.total_sorties)} F</span>
                </div>
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
          onClick={fetchData}
          className="btn btn-sm btn-ghost gap-2"
          disabled={loading}
        >
          {loading ? <span className="loading loading-spinner loading-xs"></span> : '🔄'}
          Actualiser
        </button>
        <button
            onClick={() => setIsMovementModalOpen(true)}
            className="btn btn-sm btn-outline gap-2 ml-2"
        >
            ➕ Opération
        </button>
        <button
          onClick={openClosingModal}
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

          <div className="badge badge-lg badge-primary gap-2">
            💰 SOLDE THÉORIQUE: <span className="font-bold">{Math.round(totauxParMode.total)} F</span>
          </div>
          
          <div className="ml-4 flex gap-2">
               <div className="badge badge-md badge-success gap-1">
                📥 Entrées: {Math.round(totauxParMode.entrees)} F
               </div>
               <div className="badge badge-md badge-error gap-1 text-white">
                📤 Sorties: {Math.round(totauxParMode.sorties)} F
               </div>
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
        ) : filteredItems.length === 0 ? (
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
                {groupedItems.map((item: any) => {
                  if (item._kind === 'mouvement') {
                      // Rendering Mouvement Row
                      const mouv = item as MouvementCaisse
                      return (
                        <tr key={`mouv-${mouv.id}`} className={mouv.type === 'ENTREE' ? 'bg-success/5' : 'bg-error/5'}>
                            <td className="font-mono text-sm whitespace-nowrap">{formatDate(mouv.date)}</td>
                            <td>
                                <div className="flex flex-col">
                                    <span className="font-medium text-sm">{mouv.user_nom || 'Utilisateur'}</span>
                                    <span className="text-xs text-base-content/60">Opération Spéciale</span>
                                </div>
                            </td>
                            <td className="font-medium">{mouv.motif}</td>
                            <td className="text-xs italic opacity-70">{mouv.description || '-'}</td>
                            <td className={`text-right font-bold text-lg ${mouv.type === 'ENTREE' ? 'text-success' : 'text-error'}`}>
                                {mouv.type === 'ENTREE' ? '+' : '-'}{Math.round(parseFloat(mouv.montant))} F
                            </td>
                            <td>
                                <div className={`badge badge-outline gap-2 ${mouv.type === 'ENTREE' ? 'badge-success' : 'badge-error'}`}>
                                    {mouv.type === 'ENTREE' ? '📥 Entrée' : '📤 Sortie'}
                                </div>
                            </td>
                            <td>
                                <div className="badge badge-xs badge-success gap-1 py-2 px-3">
                                    <span className="font-semibold">Validé</span>
                                </div>
                            </td>
                        </tr>
                      )
                  }
                  
                  // Rendering Transaction Row
                  const transaction = item as CaisseTransaction & { isReleveGroup?: boolean, items?: CaisseTransaction[] }
                  return (
                  <>
                  <tr 
                    key={transaction.id} 
                    className={`hover ${transaction.isReleveGroup ? 'bg-primary/5 cursor-pointer border-l-4 border-l-primary' : ''}`}
                    onClick={() => transaction.isReleveGroup && transaction.releve_id && toggleReleve(transaction.releve_id)}
                  >
                    <td className="font-mono text-sm whitespace-nowrap">
                        {formatDate(transaction.date_paiement)}
                        {transaction.isReleveGroup && (
                            <div className="text-[10px] font-bold text-primary uppercase mt-1 flex items-center gap-1">
                                {expandedReleves.has(transaction.releve_id!) ? '▼' : '▶'} Relevé Groupé
                            </div>
                        )}
                    </td>
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
                    <td className="font-medium">
                        {transaction.client_name}
                        {transaction.is_creance_settlement && (
                            <div className="badge badge-sm badge-info badge-outline ml-2 gap-1" title="Règlement de créance">
                                💳 Créance
                            </div>
                        )}
                        {transaction.isReleveGroup && (
                            <div className="badge badge-sm badge-primary badge-outline ml-2">Relevé {transaction.releve_reference?.split('-').pop()}</div>
                        )}
                    </td>
                    <td className="font-mono text-sm">
                        {transaction.isReleveGroup ? (
                            <span className="italic opacity-70">{transaction.items?.length} factures</span>
                        ) : (
                            transaction.facture_numero || '-'
                        )}
                    </td>
                    <td className="text-right font-bold text-lg">{Math.round(parseFloat(transaction.montant))} F</td>
                    <td>
                      <div className="badge badge-outline gap-2">
                        {getModeIcon(transaction.mode_paiement)}
                        {transaction.mode_paiement_display}
                      </div>
                      {transaction.reference && (
                          <div className="text-xs opacity-60 mt-1 truncate max-w-[150px]">{transaction.reference}</div>
                      )}
                    </td>
                     <td>
                        {transaction.statut === 'completee' ? (
                        <div className="badge badge-xs badge-success gap-1 py-2 px-3">
                            <span className="font-semibold">Complété</span>
                        </div>
                        ) : transaction.statut === 'annulee' ? (
                        <div className="badge badge-xs badge-error gap-1 py-2 px-3">
                            <span className="font-semibold">Annulé</span>
                        </div>
                        ) : (
                        <div className="badge badge-xs badge-warning gap-1 py-2 px-3">
                            <span className="font-semibold">En attente</span>
                        </div>
                        )}
                    </td>
                  </tr>
                  
                  {/* Expanded Rows for Releve Items */}
                  {transaction.isReleveGroup && transaction.releve_id && expandedReleves.has(transaction.releve_id) && transaction.items?.map(item => (
                    <tr key={item.id} className="bg-base-100/40 text-sm">
                        <td className="pl-8 text-xs opacity-60">↳ {formatDate(item.date_paiement).split(' ')[1]}</td>
                        <td className="opacity-50 text-xs">Same</td>
                        <td className="opacity-50 text-xs">Same</td>
                        <td className="font-mono text-xs">{item.facture_numero}</td>
                        <td className="text-right text-xs opacity-80">{Math.round(parseFloat(item.montant))} F</td>
                        <td className="text-xs opacity-60">{item.reference || '-'}</td>
                        <td className="text-center opacity-50"><span className="text-[10px] uppercase">Détail</span></td>
                    </tr>
                   ))}
                  </>
                )})}
            </tbody>
            </table>
          </div>
        )}

      </div>

      {/* Footer avec nombre de résultats */}
      <div className="px-6 py-3 border-t border-base-200 bg-base-50 shrink-0">
        <p className="text-sm text-base-content/60">
          {filteredItems.length} ligne{filteredItems.length > 1 ? 's' : ''} affichée{filteredItems.length > 1 ? 's' : ''}
          {filteredItems.length !== (transactions.length + mouvements.length) && ` sur ${transactions.length + mouvements.length} au total`}
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
      
      <CashMovementModal 
        isOpen={isMovementModalOpen}
        onClose={() => setIsMovementModalOpen(false)}
        onSuccess={fetchData}
      />
    </div>
  )
}
