import { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import type { Creance, Client } from '../types'

export default function Creances() {
  const [creances, setCreances] = useState<Creance[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Filtres
  const [selectedClient, setSelectedClient] = useState<string>('')
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  
  // Modals
  const [isPaiementModalOpen, setIsPaiementModalOpen] = useState(false)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [selectedCreance, setSelectedCreance] = useState<Creance | null>(null)
  
  // Formulaire de paiement
  const [modePaiement, setModePaiement] = useState('especes')
  const [montantPaiement, setMontantPaiement] = useState('')
  const [referencePaiement, setReferencePaiement] = useState('')

  // Bulk / Historique
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false)

  // Tri
  const [sortConfig, setSortConfig] = useState<{ key: keyof Creance | 'client_name', direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' })

  // Notification System
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null)

  useEffect(() => {
      if (notification) {
          const timer = setTimeout(() => setNotification(null), 5000)
          return () => clearTimeout(timer)
      }
  }, [notification])

  const apiBaseUrl = useMemo(() => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL ?? ''
    return baseUrl ? String(baseUrl).replace(/\/$/, '') : ''
  }, [])

  const creancesEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/creances/` : '/api/creances/'
  const clientsEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/clients/` : '/api/clients/'

  useEffect(() => {
    fetchClients()
    fetchCreances()
  }, [])

  const fetchClients = async () => {
    try {
      const response = await axios.get(clientsEndpoint)
      // Handle paginated response and filter professionals
      const data: any = response.data;
      const allClients = Array.isArray(data) ? data : (data.results || []);
      const professionnels = allClients.filter((c: any) => c.client_type === 'PROFESSIONNEL')
      setClients(professionnels)
    } catch (err) {
      console.error('Erreur chargement clients:', err)
    }
  }

  const fetchCreances = async () => {
    setLoading(true)
    setError(null)
    try {
      const params: any = {}
      if (selectedClient) params.client_id = selectedClient
      if (dateDebut) params.date_debut = dateDebut
      if (dateFin) params.date_fin = dateFin
      params.history = showHistory

      const response = await axios.get(creancesEndpoint, { params })
      // Handle paginated response
      const data: any = response.data;
      setCreances(Array.isArray(data) ? data : (data.results || []))
    } catch (err) {
      setError('Erreur lors du chargement des créances')
      console.error('Erreur:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    fetchCreances()
  }

  const handleResetFilters = () => {
    setSelectedClient('')
    setDateDebut('')
    setDateFin('')
    fetchCreances()
  }

  // --- Bulk Selection Handlers ---
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
        // Select all filtered invoices that have debt > 0
        const ids = filteredCreances.filter(c => parseFloat(c.reste_a_payer) > 0).map(c => c.id)
        setSelectedIds(ids)
    } else {
        setSelectedIds([])
    }
  }

  const handleSelectOne = (id: number) => {
    setSelectedIds(prev => 
        prev.includes(id) 
            ? prev.filter(item => item !== id)
            : [...prev, id]
    )
  }

  const handleBulkPayment = async () => {
    if (selectedIds.length === 0) return
    setIsBulkModalOpen(true)
    setModePaiement('especes')
    setReferencePaiement('')
    setMontantPaiement('') // Not used for bulk, we pay full remainder
  }
  
  const confirmBulkPayment = async () => {
    try {
        await axios.post(`${creancesEndpoint}bulk_paiement/`, {
            facture_ids: selectedIds,
            mode_paiement: modePaiement,
            reference: referencePaiement
        })
        
        setIsBulkModalOpen(false)
        setSelectedIds([])
        fetchCreances()
        setNotification({ type: 'success', message: 'Règlement groupé effectué avec succès !' })
    } catch (err: any) {
        const errorMsg = err.response?.data?.detail || 'Erreur lors du règlement groupé'
        setNotification({ type: 'error', message: errorMsg })
        console.error('Erreur:', err)
    }
  }

  const handleOpenPaiementModal = (creance: Creance) => {
    setSelectedCreance(creance)
    setModePaiement('especes')
    setMontantPaiement('')
    setReferencePaiement('')
    setIsPaiementModalOpen(true)
  }

  const handleOpenDetailsModal = (creance: Creance) => {
    setSelectedCreance(creance)
    setIsDetailsModalOpen(true)
  }

  const handleAjouterPaiement = async () => {
    if (!selectedCreance || !montantPaiement) return

    try {
      await axios.post(`${creancesEndpoint}${selectedCreance.id}/ajouter_paiement/`, {
        mode_paiement: modePaiement,
        montant: parseFloat(montantPaiement),
        reference: referencePaiement || undefined
      })
      
      setIsPaiementModalOpen(false)
      fetchCreances()
      setNotification({ type: 'success', message: 'Paiement enregistré avec succès !' })
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || 'Erreur lors de l\'enregistrement du paiement'
      setNotification({ type: 'error', message: errorMsg })
      console.error('Erreur:', err)
    }
  }

  const handleImprimerReleve = async () => {
    if (!selectedClient) {
      setNotification({ type: 'error', message: 'Veuillez sélectionner un client' })
      return
    }

    try {
      const params: any = { client_id: selectedClient }
      if (dateDebut) params.date_debut = dateDebut
      if (dateFin) params.date_fin = dateFin

      const response = await axios.get(`${creancesEndpoint}releve/`, { params })
      const data = response.data

      // Générer l'impression
      const win = window.open('', '', 'height=800,width=600')
      if (win) {
        const content = `
          <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto;">
            <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px;">
              <h1 style="margin: 0; font-size: 24px;">RELEVÉ DE CRÉANCES</h1>
              <p style="margin: 5px 0;">PHARMA STOCK</p>
              <p style="margin: 5px 0; font-size: 12px;">Douala, Cameroun</p>
            </div>

            <div style="margin-bottom: 20px;">
              <h3 style="margin: 10px 0;">Client</h3>
              <p style="margin: 5px 0;"><strong>Nom:</strong> ${data.client.name}</p>
              <p style="margin: 5px 0;"><strong>Adresse:</strong> ${data.client.address}</p>
              <p style="margin: 5px 0;"><strong>Téléphone:</strong> ${data.client.phone}</p>
              <p style="margin: 5px 0;"><strong>Email:</strong> ${data.client.email}</p>
            </div>

            ${data.periode.date_debut || data.periode.date_fin ? `
              <div style="margin-bottom: 20px;">
                <h3 style="margin: 10px 0;">Période</h3>
                ${data.periode.date_debut ? `<p style="margin: 5px 0;"><strong>Du:</strong> ${new Date(data.periode.date_debut).toLocaleDateString('fr-FR')}</p>` : ''}
                ${data.periode.date_fin ? `<p style="margin: 5px 0;"><strong>Au:</strong> ${new Date(data.periode.date_fin).toLocaleDateString('fr-FR')}</p>` : ''}
              </div>
            ` : ''}

            <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 10px;">
              <thead>
                <tr style="background-color: #f0f0f0;">
                  <th style="border: 1px solid #ddd; padding: 4px; text-align: left;">Date</th>
                  <th style="border: 1px solid #ddd; padding: 4px; text-align: left;">N° Facture</th>
                  <th style="border: 1px solid #ddd; padding: 4px; text-align: left;">Ayant Droit</th>
                  <th style="border: 1px solid #ddd; padding: 4px; text-align: right;">Montant Total</th>
                  <th style="border: 1px solid #ddd; padding: 4px; text-align: right;">Payé</th>
                  <th style="border: 1px solid #ddd; padding: 4px; text-align: right;">Reste</th>
                </tr>
              </thead>
              <tbody>
                ${data.creances.map((c: any) => `
                  <tr>
                    <td style="border: 1px solid #ddd; padding: 4px;">${new Date(c.date).toLocaleDateString('fr-FR')}</td>
                    <td style="border: 1px solid #ddd; padding: 4px;">${c.numero_facture || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 4px;">${c.ayant_droit || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 4px; text-align: right;">${Math.round(parseFloat(c.montant_total))} F</td>
                    <td style="border: 1px solid #ddd; padding: 4px; text-align: right;">${Math.round(parseFloat(c.montant_paye))} F</td>
                    <td style="border: 1px solid #ddd; padding: 4px; text-align: right;">${Math.round(parseFloat(c.reste_a_payer))} F</td>
                  </tr>
                `).join('')}
              </tbody>
              <tfoot>
                <tr style="background-color: #f0f0f0; font-weight: bold;">
                  <td colspan="3" style="border: 1px solid #ddd; padding: 4px; text-align: right;">TOTAUX:</td>
                  <td style="border: 1px solid #ddd; padding: 4px; text-align: right;">${Math.round(parseFloat(data.totaux.total_factures))} F</td>
                  <td style="border: 1px solid #ddd; padding: 4px; text-align: right;">${Math.round(parseFloat(data.totaux.total_paye))} F</td>
                  <td style="border: 1px solid #ddd; padding: 4px; text-align: right;">${Math.round(parseFloat(data.totaux.total_reste))} F</td>
                </tr>
              </tfoot>
            </table>

            <div style="margin-top: 40px; display: flex; justify-content: space-between;">
              <div style="text-align: center;">
                <p style="margin-bottom: 60px;">Signature Client</p>
                <p>_____________________</p>
              </div>
              <div style="text-align: center;">
                <p style="margin-bottom: 60px;">Signature Pharmacie</p>
                <p>_____________________</p>
              </div>
            </div>

            <div style="text-align: center; margin-top: 30px; font-size: 12px; color: #666;">
              <p>Document généré le ${new Date().toLocaleString('fr-FR')}</p>
            </div>
          </div>
        `

        win.document.write('<html><head><title>Relevé de Créances</title>')
        win.document.write('<style>@media print { body { margin: 0; } }</style>')
        win.document.write('</head><body>')
        win.document.write(content)
        win.document.write('</body></html>')
        win.document.close()
        win.print()
      }
    } catch (err) {
      console.error('Erreur impression relevé:', err)
      setNotification({ type: 'error', message: 'Erreur lors de la génération du relevé' })
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'especes': return '💵'
      case 'cheque': return '📝'
      case 'carte': return '💳'
      case 'virement': return '🏦'
      case 'om': return '🟧'
      case 'momo': return '📱'
      default: return '💰'
    }
  }

  // Données groupées par client
  const clientsGroupes = useMemo(() => {
    const groupes: { [key: number]: { client: Client, total: number, paye: number, reste: number, count: number } } = {}
    
    creances.forEach(creance => {
      // Apply history filter logic to groups as well? 
      // User likely wants to see clients who owe money in default view.
      // And clients with history in history view.
      const reste = parseFloat(creance.reste_a_payer)
      const isPaid = reste <= 0
      
      // If filtering logic matches 'filteredCreances', apply it here too for consistency?
      // Yes: if showHistory is false, ignore fully paid invoices in the count/sum.
      if (!showHistory && isPaid) return 
      if (showHistory && !isPaid) return

      if (!groupes[creance.client]) {
        // Trouver le client correspondant ou utiliser les données de la facture
        const clientObj = clients.find(c => c.id === creance.client) || {
            id: creance.client,
            name: creance.client_name,
            client_type: 'PROFESSIONNEL',
            email: '',
            phone: '',
            address: ''
        }
        
        groupes[creance.client] = {
          client: clientObj,
          total: 0,
          paye: 0,
          reste: 0,
          count: 0
        }
      }
      
      groupes[creance.client].total += parseFloat(creance.total_ttc)
      groupes[creance.client].paye += parseFloat(creance.montant_paye)
      groupes[creance.client].reste += parseFloat(creance.reste_a_payer)
      groupes[creance.client].count += 1
    })

    return Object.values(groupes).sort((a, b) => b.reste - a.reste)
  }, [creances, clients, showHistory])

  // Filtrer et trier les créances pour le client sélectionné
  const filteredCreances = useMemo(() => {
    if (!selectedClient) return []
    let result = creances.filter(c => c.client.toString() === selectedClient.toString())
    
    // Filter by History vs Pending (Client-side)
    if (showHistory) {
        // Show only fully paid invoices (reste <= 0 or status PAYEE if user prefers, but debt logic is safer)
        result = result.filter(c => parseFloat(c.reste_a_payer) <= 0)
    } else {
        // Show pending invoices (reste > 0)
        result = result.filter(c => parseFloat(c.reste_a_payer) > 0)
    }
    
    // Appliquer le tri
    if (sortConfig.key) {
      result.sort((a, b) => {
        let aValue: any = a[sortConfig.key as keyof Creance]
        let bValue: any = b[sortConfig.key as keyof Creance]
        
        // Cas particuliers
        if (sortConfig.key === 'client_name') {
             aValue = a.client_name || ''
             bValue = b.client_name || ''
        }
        
        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1
        }
        return 0
      })
    }
    
    return result
  }, [creances, selectedClient, sortConfig, showHistory])
  
  const handleSort = (key: keyof Creance | 'client_name') => {
    let direction: 'asc' | 'desc' = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
  }

  // Calculer les totaux (adaptatif selon la vue)
  const totaux = useMemo(() => {
    const source = selectedClient ? filteredCreances : creances
    return source.reduce((acc, c) => {
      acc.total += parseFloat(c.total_ttc)
      acc.paye += parseFloat(c.montant_paye)
      acc.reste += parseFloat(c.reste_a_payer)
      return acc
    }, { total: 0, paye: 0, reste: 0 })
  }, [creances, filteredCreances, selectedClient])

  return (
    <div className="h-full flex flex-col bg-base-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-base-200 bg-white shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-base-content">💳 Gestion des Créances</h1>
          <p className="text-sm text-base-content/60 mt-1">Suivi des ventes en compte - Clients professionnels</p>
        </div>
        <div className="flex gap-2">
             <div className="form-control">
                <label className="label cursor-pointer gap-2">
                    <span className="label-text text-xs font-bold uppercase">Voir Historique</span> 
                    <input type="checkbox" className="toggle toggle-sm" checked={showHistory} onChange={(e) => { setShowHistory(e.target.checked); setSelectedIds([]); }} />
                </label>
            </div>
            <button
            onClick={fetchCreances}
            className="btn btn-sm btn-ghost gap-2"
            disabled={loading}
            >
            {loading ? <span className="loading loading-spinner loading-xs"></span> : '🔄'}
            Actualiser
            </button>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div className="toast toast-top toast-center z-50">
          <div className={`alert ${notification.type === 'success' ? 'alert-success' : 'alert-error'} shadow-lg`}>
            <span>{notification.message}</span>
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="px-6 py-4 bg-base-50 border-b border-base-200 shrink-0">
        <div className="flex flex-wrap items-end gap-3">
          {/* Client */}
          <div className="form-control w-full md:w-64">
             {selectedClient ? (
                <button 
                  onClick={() => setSelectedClient('')}
                  className="btn btn-sm btn-outline gap-2 w-full"
                >
                  ⬅️ Retour à la liste
                </button>
             ) : (
                <>
                  <label className="label py-1">
                    <span className="label-text text-xs font-bold uppercase">Client</span>
                  </label>
                  <select
                    value={selectedClient}
                    onChange={(e) => setSelectedClient(e.target.value)}
                    className="select select-bordered select-sm w-full"
                  >
                    <option value="">Tous les clients</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                </>
             )}
          </div>

          {/* Date début */}
          <div className="form-control w-40">
            <label className="label py-1">
              <span className="label-text text-xs font-bold uppercase">Date Début</span>
            </label>
            <input
              type="date"
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
              className="input input-bordered input-sm w-full"
            />
          </div>

          {/* Date fin */}
          <div className="form-control w-40">
            <label className="label py-1">
              <span className="label-text text-xs font-bold uppercase">Date Fin</span>
            </label>
            <input
              type="date"
              value={dateFin}
              onChange={(e) => setDateFin(e.target.value)}
              className="input input-bordered input-sm w-full"
            />
          </div>

          {/* Boutons */}
          <div className="flex gap-2">
            <button onClick={handleSearch} className="btn btn-sm btn-primary">
              🔍 Rechercher
            </button>
            <button onClick={handleResetFilters} className="btn btn-sm btn-ghost btn-square" title="Réinitialiser">
              ✕
            </button>
          </div>
        </div>

        {/* Bouton imprimer relevé */}
        {selectedClient && (
          <div className="mt-3 flex justify-between items-center bg-base-100 p-2 rounded-lg border border-base-200">
            <div className="font-bold text-lg">
                Client : {clients.find(c => c.id.toString() === selectedClient.toString())?.name}
            </div>
            <button onClick={handleImprimerReleve} className="btn btn-sm btn-accent gap-2">
              🖨️ Imprimer le Relevé
            </button>
          </div>
        )}
      </div>

      {/* Totaux */}
      <div className="px-6 py-3 bg-white border-b border-base-200 shrink-0">
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="badge badge-lg badge-ghost gap-2">
            💰 Total Factures: <span className="font-bold">{Math.round(totaux.total)} F</span>
          </div>
          <div className="badge badge-lg badge-success gap-2">
            ✅ Total Payé: <span className="font-bold">{Math.round(totaux.paye)} F</span>
          </div>
          <div className="badge badge-lg badge-warning gap-2">
            ⏳ Reste à Payer: <span className="font-bold">{Math.round(totaux.reste)} F</span>
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


        {/* Bulk Action Bar */}
        {selectedClient && selectedIds.length > 0 && !showHistory && (
            <div className="px-6 py-2 bg-primary/10 border-b border-primary/20 flex items-center justify-between">
                <div className="text-sm font-semibold text-primary">
                    {selectedIds.length} facture(s) sélectionnée(s)
                </div>
                <button onClick={handleBulkPayment} className="btn btn-sm btn-primary">
                    💰 Régler la sélection
                </button>
            </div>
        )}


        {/* Bulk Action Bar */}
        {selectedClient && selectedIds.length > 0 && !showHistory && (
            <div className="px-6 py-2 bg-primary/10 border-b border-primary/20 flex items-center justify-between shrink-0">
                <div className="text-sm font-semibold text-primary">
                    {selectedIds.length} facture(s) sélectionnée(s)
                </div>
                <button onClick={handleBulkPayment} className="btn btn-sm btn-primary">
                    💰 Régler la sélection
                </button>
            </div>
        )}

      {/* Tableau */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        ) : !selectedClient ? (
            // VUE SYNTHETIQUE (Liste des clients)
            clientsGroupes.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-base-content/40">
                    <p className="text-lg">Aucun client avec des créances sur cette période</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-base-200 overflow-hidden">
                <table className="table table-zebra table-xs w-full">
                    <thead>
                    <tr className="bg-base-200">
                        <th className="uppercase">Client</th>
                        <th className="uppercase text-right">Nb Factures</th>
                        <th className="uppercase text-right">Montant Total</th>
                        <th className="uppercase text-right">Déjà Payé</th>
                        <th className="uppercase text-right">Reste à Payer</th>
                        <th className="uppercase text-center">Actions</th>
                    </tr>
                    </thead>
                    <tbody>
                    {clientsGroupes.map((groupe) => (
                        <tr key={groupe.client.id} className="hover cursor-pointer" onClick={() => setSelectedClient(groupe.client.id.toString())}>
                        <td className="font-bold text-lg">{groupe.client.name}</td>
                        <td className="text-right font-mono">{groupe.count}</td>
                        <td className="text-right font-bold">{Math.round(groupe.total)} F</td>
                        <td className="text-right text-success font-semibold">{Math.round(groupe.paye)} F</td>
                        <td className="text-right text-warning font-bold text-lg">{Math.round(groupe.reste)} F</td>
                        <td className="text-center">
                            <button 
                                className="btn btn-sm btn-ghost btn-circle"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedClient(groupe.client.id.toString());
                                }}
                            >
                                🔍
                            </button>
                        </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
                </div>
            )
        ) : (
            // VUE DETAILLEE (Liste des factures du client sélectionné)
            filteredCreances.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-base-content/40">
                    <p className="text-lg">Aucune facture trouvée pour ce client</p>
                    <button onClick={() => setSelectedClient('')} className="btn btn-link">Retour à la liste</button>
                </div>
            ) : (
                <>
                {/* Bulk Action Bar */}
                {selectedClient && selectedIds.length > 0 && !showHistory && (
                    <div className="mb-4 px-6 py-2 bg-primary/10 border border-primary/20 rounded-lg flex items-center justify-between shadow-sm">
                        <div className="text-sm font-semibold text-primary">
                            {selectedIds.length} facture(s) sélectionnée(s)
                        </div>
                        <button onClick={handleBulkPayment} className="btn btn-sm btn-primary gap-2">
                            💰 Régler la sélection
                        </button>
                    </div>
                )}
                <div className="bg-white rounded-xl shadow-sm border border-base-200 overflow-hidden">
                    <table className="table table-zebra w-full">
                    <thead>
                        <tr className="bg-base-200 border-b border-base-300">
                          {/* Checkbox Header */}
                         {!showHistory && (
                            <th className="py-2 px-3 w-10 text-center">
                                <input 
                                    type="checkbox" 
                                    className="checkbox checkbox-xs" 
                                    onChange={handleSelectAll}
                                    checked={filteredCreances.length > 0 && selectedIds.length === filteredCreances.filter(c => parseFloat(c.reste_a_payer) > 0).length}
                                />
                            </th>
                         )}
                        <th className="py-2 px-3 text-xs font-semibold uppercase whitespace-nowrap cursor-pointer hover:bg-base-300 transition-colors w-32" onClick={() => handleSort('date')}>
                          <div className="flex items-center gap-1">
                            Date {sortConfig.key === 'date' && <span className="text-primary">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}
                          </div>
                        </th>
                        <th className="py-2 px-3 text-xs font-semibold uppercase whitespace-nowrap cursor-pointer hover:bg-base-300 transition-colors w-32" onClick={() => handleSort('numero_facture')}>
                          <div className="flex items-center gap-1">
                            N° Facture {sortConfig.key === 'numero_facture' && <span className="text-primary">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}
                          </div>
                        </th>
                        <th className="py-2 px-3 text-xs font-semibold uppercase whitespace-nowrap">Ayant Droit</th>
                        <th className="py-2 px-3 text-xs font-semibold uppercase whitespace-nowrap text-right cursor-pointer hover:bg-base-300 transition-colors w-36" onClick={() => handleSort('total_ttc')}>
                          <div className="flex items-center justify-end gap-1">
                            Total {sortConfig.key === 'total_ttc' && <span className="text-primary">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}
                          </div>
                        </th>
                        <th className="py-2 px-3 text-xs font-semibold uppercase whitespace-nowrap text-right cursor-pointer hover:bg-base-300 transition-colors w-36" onClick={() => handleSort('montant_paye')}>
                          <div className="flex items-center justify-end gap-1">
                            Payé {sortConfig.key === 'montant_paye' && <span className="text-primary">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}
                          </div>
                        </th>
                        <th className="py-2 px-3 text-xs font-semibold uppercase whitespace-nowrap text-right cursor-pointer hover:bg-base-300 transition-colors w-36" onClick={() => handleSort('reste_a_payer')}>
                          <div className="flex items-center justify-end gap-1">
                            Reste {sortConfig.key === 'reste_a_payer' && <span className="text-primary">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}
                          </div>
                        </th>
                        <th className="py-2 px-3 text-xs font-semibold uppercase whitespace-nowrap text-center w-24">Statut</th>
                        <th className="py-2 px-3 text-xs font-semibold uppercase whitespace-nowrap text-center w-20">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredCreances.map((creance) => (
                        <tr key={creance.id} className={`hover ${selectedIds.includes(creance.id) ? 'active' : ''}`}>
                             {/* Checkbox Row */}
                             {!showHistory && (
                                <td className="text-center">
                                    <input 
                                        type="checkbox" 
                                        className="checkbox checkbox-xs" 
                                        checked={selectedIds.includes(creance.id)}
                                        onChange={() => handleSelectOne(creance.id)}
                                        disabled={parseFloat(creance.reste_a_payer) <= 0}
                                    />
                                </td>
                             )}
                            <td className="font-mono text-sm">{formatDate(creance.date)}</td>
                            <td className="font-mono text-sm">{creance.numero_facture || '-'}</td>
                            <td className="text-sm">
                            {creance.ayant_droit_details?.nom || '-'}
                            </td>
                            <td className="text-right font-bold">{Math.round(parseFloat(creance.total_ttc))} F</td>
                            <td className="text-right text-success font-semibold">{Math.round(parseFloat(creance.montant_paye))} F</td>
                            <td className="text-right text-warning font-semibold">{Math.round(parseFloat(creance.reste_a_payer))} F</td>
                            <td>
                            <div className={`badge ${
                                creance.status === 'PAY' ? 'badge-success' :
                                creance.status === 'VAL' ? 'badge-warning' :
                                'badge-ghost'
                            }`}>
                                {creance.status_display}
                            </div>
                            </td>
                            <td>
                            <div className="flex gap-1 justify-center">
                                <button
                                onClick={() => handleOpenDetailsModal(creance)}
                                className="btn btn-xs btn-ghost"
                                title="Voir les paiements"
                                >
                                👁️
                                </button>
                                {parseFloat(creance.reste_a_payer) > 0 && (
                                <button
                                    onClick={() => handleOpenPaiementModal(creance)}
                                    className="btn btn-xs btn-primary"
                                    title="Ajouter un paiement"
                                >
                                    💰
                                </button>
                                )}
                            </div>
                            </td>
                        </tr>
                        ))}
                    </tbody>
                    </table>
                </div>
                </>
            )
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-3 border-t border-base-200 bg-base-50 shrink-0">
        <p className="text-sm text-base-content/60">
          {creances.length} créance{creances.length > 1 ? 's' : ''} affichée{creances.length > 1 ? 's' : ''}
        </p>
      </div>

      {/* Modal Bulk Paiement */}
      <dialog className={`modal ${isBulkModalOpen ? 'modal-open' : ''}`}>
        <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">💰 Règlement Groupé</h3>
            <div className="py-4">
                <p>Vous êtes sur le point de régler <strong>{selectedIds.length}</strong> factures.</p>
                <div className="alert alert-warning mt-2 text-sm">
                    Ce règlement soldera le montant restant de toutes les factures sélectionnées.
                    Une entrée sera créée dans le journal de caisse pour chaque facture.
                </div>

                <div className="form-control mt-4">
                    <label className="label">
                        <span className="label-text font-bold">Mode de Paiement</span>
                    </label>
                    <select
                        value={modePaiement}
                        onChange={(e) => setModePaiement(e.target.value)}
                        className="select select-bordered"
                    >
                        <option value="especes">💵 Espèces</option>
                        <option value="om">🟧 Orange Money</option>
                        <option value="momo">📱 Mobile Money</option>
                        <option value="cheque">📝 Chèque</option>
                        <option value="carte">💳 Carte</option>
                        <option value="virement">🏦 Virement</option>
                    </select>
                </div>
                 <div className="form-control mt-2">
                    <label className="label">
                        <span className="label-text font-bold">Référence (optionnel)</span>
                    </label>
                    <input
                        type="text"
                        placeholder="N° chèque, transaction..."
                        value={referencePaiement}
                        onChange={(e) => setReferencePaiement(e.target.value)}
                        className="input input-bordered"
                    />
                </div>
            </div>
            <div className="modal-action">
                <button className="btn btn-ghost" onClick={() => setIsBulkModalOpen(false)}>Annuler</button>
                <button className="btn btn-primary" onClick={confirmBulkPayment}>Confirmer le Règlement</button>
            </div>
        </div>
      </dialog>



      {/* Modal Ajouter Paiement */}
      <dialog className={`modal ${isPaiementModalOpen ? 'modal-open' : ''}`}>
        <div className="modal-box">
          <h3 className="font-bold text-lg mb-4">💰 Ajouter un Paiement</h3>
          
          {selectedCreance && (
            <div className="space-y-4">
              <div className="alert alert-info text-sm">
                <div>
                  <div><strong>Facture:</strong> {selectedCreance.numero_facture}</div>
                  <div><strong>Client:</strong> {selectedCreance.client_name}</div>
                  <div><strong>Reste à payer:</strong> {Math.round(parseFloat(selectedCreance.reste_a_payer))} F</div>
                </div>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-bold">Mode de Paiement</span>
                </label>
                <select
                  value={modePaiement}
                  onChange={(e) => setModePaiement(e.target.value)}
                  className="select select-bordered"
                >
                  <option value="especes">💵 Espèces</option>
                  <option value="om">🟧 Orange Money</option>
                  <option value="momo">📱 Mobile Money</option>
                  <option value="cheque">📝 Chèque</option>
                  <option value="carte">💳 Carte</option>
                  <option value="virement">🏦 Virement</option>
                </select>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-bold">Montant</span>
                </label>
                <input
                  type="number"
                  placeholder="Montant du paiement"
                  value={montantPaiement}
                  onChange={(e) => setMontantPaiement(e.target.value)}
                  className="input input-bordered"
                  max={parseFloat(selectedCreance.reste_a_payer)}
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-bold">Référence (optionnel)</span>
                </label>
                <input
                  type="text"
                  placeholder="Numéro de transaction, chèque..."
                  value={referencePaiement}
                  onChange={(e) => setReferencePaiement(e.target.value)}
                  className="input input-bordered"
                />
              </div>
            </div>
          )}


          {/* Modal Bulk Content - Show Total */}
          {isBulkModalOpen && (
              <div className="alert alert-info py-2 mb-4">
                  <span className="text-sm font-semibold">
                      Montant Total à Régler : {Math.round(selectedIds.reduce((sum, id) => {
                          const f = creances.find(c => c.id === id);
                          return sum + (f ? parseFloat(f.reste_a_payer) : 0);
                      }, 0))} F
                  </span>
              </div>
          )}
          
          <div className="modal-action">
            <button className="btn" onClick={() => setIsPaiementModalOpen(false)}>Annuler</button>
            <button className="btn btn-primary" onClick={handleAjouterPaiement}>Enregistrer le Paiement</button>
          </div>
        </div>
      </dialog>

      {/* Modal Détails Paiements */}
      <dialog className={`modal ${isDetailsModalOpen ? 'modal-open' : ''}`}>
        <div className="modal-box max-w-2xl">

          <h3 className="font-bold text-lg mb-4">👁️ Détails des Paiements</h3>
          
          {selectedCreance && (
            <div className="space-y-4">
              <div className="alert alert-info text-sm">
                <div>
                  <div><strong>Facture:</strong> {selectedCreance.numero_facture}</div>
                  <div><strong>Client:</strong> {selectedCreance.client_name}</div>
                  <div><strong>Montant Total:</strong> {Math.round(parseFloat(selectedCreance.total_ttc))} F</div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Mode</th>
                      <th className="text-right">Montant</th>
                      <th>Référence</th>
                      <th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedCreance.paiements.filter(p => p.mode_paiement !== 'en_compte').map((paiement) => (
                      <tr key={paiement.id}>
                        <td className="font-mono text-xs">{formatDate(paiement.date_paiement)}</td>
                        <td>
                          <div className="badge badge-outline badge-sm gap-1">
                            {getModeIcon(paiement.mode_paiement)}
                            {paiement.mode_paiement_display}
                          </div>
                        </td>
                        <td className="text-right font-semibold">{Math.round(parseFloat(paiement.montant))} F</td>
                        <td className="text-xs">{paiement.reference || '-'}</td>
                        <td>
                          <div className={`badge badge-xs ${
                            paiement.statut === 'completee' ? 'badge-success' :
                            paiement.statut === 'annulee' ? 'badge-error' :
                            'badge-warning'
                          }`}>
                            {paiement.statut}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-bold">
                      <td colSpan={2}>TOTAL PAYÉ</td>
                      <td className="text-right text-success">{Math.round(parseFloat(selectedCreance.montant_paye))} F</td>
                      <td colSpan={2}></td>
                    </tr>
                    <tr className="font-bold">
                      <td colSpan={2}>RESTE À PAYER</td>
                      <td className="text-right text-warning">{Math.round(parseFloat(selectedCreance.reste_a_payer))} F</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          <div className="modal-action">
            <button className="btn" onClick={() => setIsDetailsModalOpen(false)}>Fermer</button>
          </div>
        </div>
      </dialog>
    </div>
  )
}
