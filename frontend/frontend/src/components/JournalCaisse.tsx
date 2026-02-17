import React, { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import { toast } from 'react-hot-toast'
import type { CaisseTransaction, MouvementCaisse } from '../types'
import CashMovementModal from './CashMovementModal'
import DatePicker, { registerLocale } from 'react-datepicker'
import { fr } from 'date-fns/locale'
import 'react-datepicker/dist/react-datepicker.css'
import { usePharmacySettings } from '../hooks/usePharmacySettings'
import { formatCurrency, safeFormatNumber } from '../utils/formatters'

// Register French locale
registerLocale('fr', fr)

export default function JournalCaisse() {
  const [transactions, setTransactions] = useState<CaisseTransaction[]>([])
  const [mouvements, setMouvements] = useState<MouvementCaisse[]>([])
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterMode, setFilterMode] = useState<string>('all')
  const [filterType, setFilterType] = useState<'all' | 'entrees' | 'sorties'>('all')
  const [dateDebut, setDateDebut] = useState<Date | null>(null)
  const [dateFin, setDateFin] = useState<Date | null>(null)
  const [expandedReleves, setExpandedReleves] = useState<Set<number>>(new Set())
  const { settings: pharmacySettings } = usePharmacySettings()

  // User/Cashier filtering
  const [users, setUsers] = useState<any[]>([])
  const [selectedUser, setSelectedUser] = useState<string>('')
  
  // Pagination
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

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
    fetchUsers()
  }, [])

  // Re-fetch transactions when page changes
  useEffect(() => {
    fetchTransactions()
  }, [page])

  // Re-fetch totals when date filters or user change
  useEffect(() => {
    if (dateDebut || dateFin || selectedUser) {
      fetchTotals()
    }
  }, [dateDebut, dateFin, selectedUser])

  // Re-fetch transactions when filter changes (if relying on backend filtering)
  useEffect(() => {
      setPage(1)
      fetchTransactions()
  }, [selectedUser])

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

  const fetchUsers = async () => {
      try {
          const response = await axios.get(`${apiBaseUrl}/api/users/operators/`)
          setUsers(response.data)
      } catch (err) {
          console.error("Erreur chargement utilisateurs", err)
      }
  }

  const fetchMouvements = async () => {
      try {
          const params = new URLSearchParams()
          if (selectedUser) params.append('user', selectedUser)
          
          const response = await axios.get(`${apiBaseUrl}/api/mouvements-caisse/`, { params })
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
      const params = new URLSearchParams()
      params.append('page', page.toString())
      if (selectedUser) params.append('user', selectedUser)
      
      const response = await axios.get(caisseEndpoint, { params })
      const data: any = response.data
      
      if (data.results) {
        setTransactions(data.results)
        setTotalCount(data.count || 0)
        setTotalPages(Math.ceil((data.count || 0) / 50)) // Page size is 50
      } else {
        setTransactions(Array.isArray(data) ? data : [])
        setTotalCount(Array.isArray(data) ? data.length : 0)
        setTotalPages(1)
      }
    } catch (err) {
      console.error('Erreur:', err)
      throw err
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

      // Transactions (sales) are not entries/exits - only show when filterType is 'all'
      if (filterType !== 'all') return false

      // Filtre par mode de paiement
      const matchesMode = filterMode === 'all' || transaction.mode_paiement === filterMode

      // Filtre par date
      let matchesDate = true
      if (dateDebut && dateFin) {
        const transactionDate = new Date(transaction.date_paiement)
        const debut = dateDebut
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

       // Filter by entry/exit type
       const matchesType = filterType === 'all' || 
        (filterType === 'entrees' && mouv.type === 'ENTREE') ||
        (filterType === 'sorties' && mouv.type === 'SORTIE')

       let matchesDate = true
       if (dateDebut && dateFin) {
        const d = new Date(mouv.date)
        const debut = dateDebut
        const fin = new Date(dateFin)
        fin.setHours(23, 59, 59, 999) 
        matchesDate = d >= debut && d <= fin
      }
      return matchesSearch && matchesMode && matchesDate && matchesType
    })

    // Combine and mark types
    const combined = [
        ...filteredTrans.map(t => ({ ...t, _kind: 'transaction' as const })),
        ...filteredMouvs.map(m => ({ ...m, _kind: 'mouvement' as const, date_paiement: m.date })) // map date for sort
    ]
    
    // Sort by date desc
    return combined.sort((a, b) => new Date(b.date_paiement).getTime() - new Date(a.date_paiement).getTime())

  }, [transactions, mouvements, searchQuery, filterMode, filterType, dateDebut, dateFin])

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

  // Helper function to format date as YYYY-MM-DDTHH:mm:ss in local time
  const formatLocalISOString = (date: Date): string => {
    const pad = (num: number) => num.toString().padStart(2, '0')
    const year = date.getFullYear()
    const month = pad(date.getMonth() + 1)
    const day = pad(date.getDate())
    const hours = pad(date.getHours())
    const minutes = pad(date.getMinutes())
    const seconds = pad(date.getSeconds())
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`
  }

  const fetchTotals = async () => {
    try {
      const params: any = {}
      // Use local time formatting to avoid UTC shifting
      if (dateDebut) params.date_debut = formatLocalISOString(dateDebut)
      if (dateFin) params.date_fin = formatLocalISOString(dateFin)
      if (selectedUser) params.user_id = selectedUser
      
      const response = await axios.get(`${caisseEndpoint}get_totals/`, { params })

      return response.data
    } catch (err) {
      console.error('Erreur chargement totaux:', err)
      // Don't block UI, just log
    }
  }
  
  
  const openClosingModal = () => {
      // Use the filtered totals (totauxParMode) to match the displayed "Solde Théorique"
      const modalTotals = {
          start_date: dateDebut ? formatLocalISOString(dateDebut) : null,
          end_date: dateFin ? formatLocalISOString(dateFin) : null,
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
        date_debut: dateDebut ? formatLocalISOString(dateDebut) : undefined,
        date_fin: dateFin ? formatLocalISOString(dateFin) : undefined,
        user_id: selectedUser || undefined
      })
      setIsClosingModalOpen(false)
      toast.success('Caisse clôturée avec succès !')
      fetchTransactions() // Refresh list
    } catch (err: any) {
      console.error('Erreur clôture:', err)
      const errorMessage = err.response?.data?.detail || err.message || 'Erreur inconnue'
      setError(`Erreur lors de la clôture: ${errorMessage}`)
      toast.error(errorMessage)
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
      const endStr = dateFin ? formatDateLong(dateFin.toISOString()) : 'Maintenant';

      const content = `
        <div style="font-family: monospace; width: 80mm; margin: 0 auto; padding: 10px; color: black;">
            <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid black; padding-bottom: 10px;">
                <h2 style="margin: 0; font-size: 1.2em; font-weight: bold;">${pharmacySettings?.pharmacy_name || 'Ma Pharmacie'}</h2>
                <div style="font-size: 0.9em;">${pharmacySettings?.city || ''}, ${pharmacySettings?.country || ''}</div>
                <div style="font-size: 0.9em;">CLÔTURE DE CAISSE</div>
            </div>

            <div style="font-size: 0.8em; margin-bottom: 15px;">
                <div style="display: flex; justify-content: space-between;">
                    <span>Date:</span>
                    <span>${new Date().toLocaleDateString('fr-FR')} ${new Date().toLocaleTimeString('fr-FR')}</span>
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
                        <span>${formatCurrency(montant)}</span>
                    </div>
                `).join('')}
            </div>

            <div style="margin-bottom: 15px; border-top: 1px dashed black; padding-top: 5px;">
                <div style="display: flex; justify-content: space-between; font-size: 0.9em; margin-bottom: 3px;">
                    <span>AUTRES ENTRÉES</span>
                    <span>${formatCurrency(closingTotals.total_entrees)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.9em; margin-bottom: 3px;">
                    <span>SORTIES DIVERSES</span>
                    <span>-${formatCurrency(closingTotals.total_sorties)}</span>
                </div>
            </div>

            <div style="border-top: 2px solid black; padding-top: 10px; margin-top: 10px;">
                <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 1.1em; margin-bottom: 5px;">
                    <span>TOTAL THÉORIQUE</span>
                    <span>${formatCurrency(closingTotals.total_theorique)}</span>
                </div>
                 <div style="display: flex; justify-content: space-between; font-size: 0.9em; border-top: 1px dashed black; padding-top: 5px; margin-top: 5px;">
                    <span>Montant Réel (Compté)</span>
                    <span>${actualAmount ? formatCurrency(parseFloat(actualAmount)) : '_________'}</span>
                </div>
                 <div style="display: flex; justify-content: space-between; font-size: 0.9em; margin-top: 5px;">
                    <span>Ecart Caisse</span>
                    <span>${actualAmount ? formatCurrency(parseFloat(actualAmount) - closingTotals.total_theorique) : '_________'}</span>
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
      case 'especes': return ''
      case 'cheque': return ''
      case 'carte': return ''
      case 'virement': return ''
      case 'om': return ''
      case 'momo': return ''
      case 'en_compte': return ''
      default: return ''
    }
  }

  return (
    <div className="min-h-screen bg-base-200 p-6 space-y-6 font-sans">
      
      {/* Header & Filters Section */}
      <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 flex flex-col">
          <div className="p-4 border-b border-base-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 text-primary rounded-xl">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                </div>
                <div>
                    <h1 className="text-xl font-bold text-base-content tracking-tight">Journal de Caisse</h1>
                    <div className="text-xs text-base-content/50 flex items-center gap-2">
                        <span>Historique des flux</span>
                        <span className="w-1 h-1 rounded-full bg-base-300"></span>
                        <span className="font-mono text-primary">{totalCount} opérations</span>
                    </div>
                </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
                <button
                    onClick={fetchData}
                    className="btn btn-sm btn-ghost btn-square"
                    disabled={loading}
                    title="Actualiser"
                >
                    {loading ? <span className="loading loading-spinner loading-xs"></span> : '🔄'}
                </button>
                
                <div className="h-8 w-px bg-base-200 mx-1"></div>

                <button
                    onClick={() => setIsMovementModalOpen(true)}
                    className="btn btn-sm btn-ghost hover:bg-base-200 gap-2 font-normal"
                >
                    ➕ Opération
                </button>
                <button
                    onClick={openClosingModal}
                    className="btn btn-sm btn-primary gap-2 shadow-sm"
                    disabled={loading}
                >
                    🔒 Clôturer
                </button>
            </div>
          </div>

          {/* Toolbar de filtres compacte */}
          <div className="p-3 bg-base-50/50 flex flex-col xl:flex-row items-center gap-3 text-sm">
            
            {/* Groupe 1: Recherche & Mode */}
            <div className="flex items-center gap-2 w-full xl:w-auto flex-1">
                <div className="relative flex-1 min-w-[200px]">
                    <input
                        type="text"
                        placeholder="Rechercher..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="input input-sm input-bordered w-full pl-8 bg-white focus:outline-none focus:border-primary"
                    />
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-40 text-xs">🔍</span>
                </div>
                
                <select
                    value={filterMode}
                    onChange={(e) => setFilterMode(e.target.value)}
                    className="select select-bordered select-sm bg-white focus:outline-none focus:border-primary max-w-[150px]"
                >
                    <option value="all">Tous modes</option>
                    <option value="especes">💵 Espèces</option>
                    <option value="cheque">✍️ Chèque</option>
                    <option value="carte">💳 Carte</option>
                    <option value="virement">🏦 Virement</option>
                    <option value="om">📶 Orange Money</option>
                    <option value="momo">📶 Mobile Money</option>
                </select>
                
                <div className="h-8 w-px bg-base-200 mx-1"></div>

                <select
                    value={selectedUser}
                    onChange={(e) => setSelectedUser(e.target.value)}
                    className="select select-bordered select-sm bg-white focus:outline-none focus:border-primary max-w-[150px]"
                >
                    <option value="">👤 Tous</option>
                    {users.map((u: any) => (
                        <option key={u.id} value={u.id}>
                            {u.first_name ? `${u.first_name} ${u.last_name || ''}` : u.username}
                        </option>
                    ))}
                </select>
            </div>

            {/* Groupe 2: Dates */}
            <div className="flex items-center gap-2 w-full xl:w-auto bg-white p-1 rounded-lg border border-base-200 shadow-sm">
                <div className="flex items-center gap-1 px-2">
                    <span className="opacity-30 text-xs">📅</span>
                    <DatePicker
                        selected={dateDebut}
                        onChange={(date: Date | null) => setDateDebut(date)}
                        showTimeSelect
                        timeFormat="HH:mm"
                        dateFormat="dd/MM/yy HH:mm"
                        placeholderText="Début"
                        locale="fr"
                        className="w-28 text-xs bg-transparent focus:outline-none cursor-pointer text-center font-medium"
                        isClearable
                    />
                </div>
                <span className="text-base-content/20">→</span>
                <div className="flex items-center gap-1 px-2">
                     <DatePicker
                        selected={dateFin}
                        onChange={(date: Date | null) => setDateFin(date)}
                        showTimeSelect
                        timeFormat="HH:mm"
                        dateFormat="dd/MM/yy HH:mm"
                        placeholderText="Fin"
                        locale="fr"
                        className="w-28 text-xs bg-transparent focus:outline-none cursor-pointer text-center font-medium"
                        isClearable
                    />
                </div>
                <button
                    onClick={() => {
                        const today = new Date()
                        today.setHours(0, 0, 0, 0)
                        const endToday = new Date()
                        endToday.setHours(23, 59, 59, 999)
                        setDateDebut(today)
                        setDateFin(endToday)
                    }}
                    className="btn btn-xs btn-ghost text-primary px-2 ml-1"
                    title="Aujourd'hui"
                >
                    J
                </button>
            </div>

            {/* Groupe 3: Type de flux */}
            <div className="join shadow-sm border border-base-200 rounded-lg overflow-hidden bg-white">
                <button 
                    className={`join-item btn btn-sm border-none font-medium px-4 ${filterType === 'all' ? 'bg-neutral text-white hover:bg-neutral-focus' : 'bg-transparent hover:bg-base-100'}`}
                    onClick={() => setFilterType('all')}
                >
                    Tout
                </button>
                <button 
                    className={`join-item btn btn-sm border-none font-medium px-4 ${filterType === 'entrees' ? 'bg-success text-white hover:bg-success-focus' : 'bg-transparent hover:bg-base-100'}`}
                    onClick={() => setFilterType('entrees')}
                >
                    Entrées
                </button>
                <button 
                    className={`join-item btn btn-sm border-none font-medium px-4 ${filterType === 'sorties' ? 'bg-error text-white hover:bg-error-focus' : 'bg-transparent hover:bg-base-100'}`}
                    onClick={() => setFilterType('sorties')}
                >
                    Sorties
                </button>
            </div>

            {/* Reset Filter Button */}
            {(searchQuery || filterMode !== 'all' || filterType !== 'all' || dateDebut || dateFin) && (
                <button
                    onClick={() => {
                        setSearchQuery('')
                        setFilterMode('all')
                        setFilterType('all')
                        setDateDebut(null)
                        setDateFin(null)
                    }}
                    className="btn btn-ghost btn-sm btn-circle text-error"
                    title="Réinitialiser les filtres"
                >
                    ✕
                </button>
            )}

          </div>
      </div>

      {/* Quick Stats Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          <div className="bg-base-100 p-5 rounded-2xl shadow-sm border border-base-300">
              <div className="text-xs font-bold uppercase text-base-content/40 mb-1">Solde Théorique</div>
              <div className="text-2xl font-black text-primary">{Math.round(totauxParMode.total).toLocaleString()} F</div>
              <div className="text-[10px] text-base-content/50 mt-1">Cash + Digital</div>
          </div>
          <div className="bg-base-100 p-5 rounded-2xl shadow-sm border border-base-300">
              <div className="text-xs font-bold uppercase text-base-content/40 mb-1">Espèces</div>
              <div className="text-2xl font-black text-base-content">{Math.round(totauxParMode.especes).toLocaleString()} F</div>
              <div className="text-[10px] text-success font-bold mt-1">En Caisse</div>
          </div>
          <div className="bg-base-100 p-5 rounded-2xl shadow-sm border border-base-300">
              <div className="text-xs font-bold uppercase text-base-content/40 mb-1">Total Entrées</div>
              <div className="text-2xl font-black text-success">{Math.round(totauxParMode.entrees).toLocaleString()} F</div>
              <div className="text-[10px] text-base-content/50 mt-1">Opérations diverses</div>
          </div>
          <div className="bg-base-100 p-5 rounded-2xl shadow-sm border border-base-300">
              <div className="text-xs font-bold uppercase text-base-content/40 mb-1">Total Sorties</div>
              <div className="text-2xl font-black text-error">{Math.round(totauxParMode.sorties).toLocaleString()} F</div>
              <div className="text-[10px] text-base-content/50 mt-1">Dépenses diverse</div>
          </div>
          <div className="bg-base-100 p-5 rounded-2xl shadow-sm border border-base-300 lg:col-span-2 xl:col-span-1">
              <div className="text-xs font-bold uppercase text-base-content/40 mb-1">Digital (OM/MoMo)</div>
              <div className="text-2xl font-black text-info">{Math.round(totauxParMode.om + totauxParMode.momo).toLocaleString()} F</div>
              <div className="text-[10px] text-base-content/50 mt-1">Paiements mobiles</div>
          </div>
      </div>

      {/* Main Content: Table Wrapper */}
      <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 overflow-hidden flex flex-col">
        {error && (
            <div className="p-4 bg-error/10 border-b border-error/20 flex items-center gap-3 text-error text-sm font-medium">
                <span className="text-xl">⚠️</span>
                {error}
            </div>
        )}

        <div className="overflow-x-auto">
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 bg-base-100 gap-4">
                    <span className="loading loading-spinner loading-lg text-primary"></span>
                    <p className="text-base-content/60 font-medium animate-pulse">Chargement du journal...</p>
                </div>
            ) : filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-base-content/30 gap-3">
                    <span className="text-6xl opacity-20">📂</span>
                    <p className="text-lg font-medium italic">Aucune transaction trouvée</p>
                </div>
            ) : (
                <table className="table table-md w-full border-separate border-spacing-0">
                    <thead>
                        <tr className="bg-base-50 selection:bg-transparent">
                            <th className="bg-base-100 border-b border-base-200 text-xs uppercase font-bold text-base-content/50 py-4 pl-6">Date & Heure</th>
                            <th className="bg-base-100 border-b border-base-200 text-xs uppercase font-bold text-base-content/50 py-4">Caissier</th>
                            <th className="bg-base-100 border-b border-base-200 text-xs uppercase font-bold text-base-content/50 py-4">Saisie par</th>
                            <th className="bg-base-100 border-b border-base-200 text-xs uppercase font-bold text-base-content/50 py-4">Client / Libellé</th>
                            <th className="bg-base-100 border-b border-base-200 text-xs uppercase font-bold text-base-content/50 py-4">N° Pièce</th>
                            <th className="bg-base-100 border-b border-base-200 text-xs uppercase font-bold text-base-content/50 py-4 text-right">Montant</th>
                            <th className="bg-base-100 border-b border-base-200 text-xs uppercase font-bold text-base-content/50 py-4">Mode</th>
                            <th className="bg-base-100 border-b border-base-200 text-xs uppercase font-bold text-base-content/50 py-4 pr-6">Statut</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-base-200">
                        {groupedItems.map((item: any) => {
                            if (item._kind === 'mouvement') {
                                const mouv = item as MouvementCaisse
                                return (
                                    <tr key={`mouv-${mouv.id}`} className={`hover:bg-base-50/50 transition-colors ${mouv.type === 'ENTREE' ? 'bg-success/5' : 'bg-error/5'}`}>
                                        <td className="font-mono text-xs whitespace-nowrap pl-6 py-4">{formatDate(mouv.date)}</td>
                                        <td className="py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-base-200 flex items-center justify-center text-xs font-bold text-base-content/50 border border-base-300">
                                                    {(mouv.user_nom || 'U')[0]}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-sm">{mouv.user_nom || 'Utilisateur'}</span>
                                                    <span className="text-[10px] text-base-content/40 uppercase tracking-widest font-bold">🛠️ Opération</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4">
                                            <span className="text-xs text-base-content/30 italic">-</span>
                                        </td>
                                        <td className="py-4">
                                            <div className="font-bold text-sm text-base-content">{mouv.motif}</div>
                                            <div className="text-xs text-base-content/50 italic line-clamp-1">{mouv.description || 'Pas de description'}</div>
                                        </td>
                                        <td className="font-mono text-[10px] py-4 opacity-50">MOUV-{mouv.id}</td>
                                        <td className={`text-right font-black text-base py-4 ${mouv.type === 'ENTREE' ? 'text-success' : 'text-error'}`}>
                                            {mouv.type === 'ENTREE' ? '+' : '-'}{Math.round(parseFloat(mouv.montant)).toLocaleString()} F
                                        </td>
                                        <td className="py-4">
                                            <div className={`badge badge-sm font-bold gap-1 py-3 px-3 border-none ${mouv.type === 'ENTREE' ? 'bg-success text-white' : 'bg-error text-white'}`}>
                                                {mouv.type === 'ENTREE' ? '↑ ENTRÉE' : '↓ SORTIE'}
                                            </div>
                                        </td>
                                        <td className="py-4 pr-6">
                                            <span className="flex items-center gap-1.5 text-success font-bold text-[10px] uppercase">
                                                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse"></span>
                                                Validé
                                            </span>
                                        </td>
                                    </tr>
                                )
                            }
                            
                            const transaction = item as CaisseTransaction & { isReleveGroup?: boolean, items?: CaisseTransaction[] }
                            const isExpanded = transaction.isReleveGroup && transaction.releve_id && expandedReleves.has(transaction.releve_id)

                            return (
                                <React.Fragment key={transaction.id}>
                                    <tr 
                                        className={`hover:bg-base-50/50 transition-colors group ${transaction.isReleveGroup ? 'bg-primary/5 cursor-pointer border-l-4 border-l-primary' : ''}`}
                                        onClick={() => transaction.isReleveGroup && transaction.releve_id && toggleReleve(transaction.releve_id)}
                                    >
                                        <td className="font-mono text-xs whitespace-nowrap pl-6 py-4">
                                            <div className="flex flex-col">
                                                <span>{formatDate(transaction.date_paiement)}</span>
                                                {transaction.isReleveGroup && (
                                                    <span className="text-[9px] font-black text-primary uppercase mt-1 flex items-center gap-1 bg-white px-1.5 py-0.5 rounded-full border border-primary/20 w-fit">
                                                        {isExpanded ? '▼' : '▶'} Relevé Groupé
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary border border-primary/20">
                                                    {(transaction.user_details?.full_name || 'U')[0]}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-sm">
                                                        {transaction.user_details?.full_name || 'Inconnu'}
                                                    </span>
                                                    <span className="text-[10px] text-base-content/40 font-mono tracking-tight">
                                                        @{transaction.user_details?.username || 'user'}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4">
                                            {transaction.facture_created_by_name ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-base-200 flex items-center justify-center text-[10px] font-bold text-base-content/50">
                                                        {transaction.facture_created_by_name[0]}
                                                    </div>
                                                    <span className="text-sm border-b border-dashed border-base-content/20" title="Utilisateur ayant saisi la facture">
                                                        {transaction.facture_created_by_name}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-base-content/30 italic">-</span>
                                            )}
                                        </td>
                                        <td className="py-4">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-sm text-base-content">{transaction.client_name}</span>
                                                {transaction.is_creance_settlement && (
                                                    <span className="badge badge-sm badge-info text-white font-bold text-[9px] px-1.5">CRÉANCE</span>
                                                )}
                                            </div>
                                            {transaction.isReleveGroup && (
                                                <div className="text-[10px] text-primary font-bold mt-1">Réf: {transaction.releve_reference}</div>
                                            )}
                                        </td>
                                        <td className="font-mono text-xs py-4">
                                            {transaction.isReleveGroup ? (
                                                <span className="text-primary/70 font-bold italic">{transaction.items?.length} pièces</span>
                                            ) : (
                                                <span className="bg-base-200 px-2 py-1 rounded font-bold text-base-content/60">{transaction.facture_numero || '-'}</span>
                                            )}
                                        </td>
                                        <td className="text-right font-black text-base py-4 text-base-content">
                                            {Math.round(parseFloat(transaction.montant)).toLocaleString()} F
                                        </td>
                                        <td className="py-4">
                                            <div className="flex flex-col">
                                                <div className="badge badge-outline badge-sm font-bold text-[10px] gap-1.5 h-6">
                                                    {getModeIcon(transaction.mode_paiement)}
                                                    {transaction.mode_paiement_display?.toUpperCase()}
                                                </div>
                                                {transaction.reference && (
                                                    <span className="text-[10px] text-base-content/40 mt-1 truncate max-w-[120px]" title={transaction.reference}>
                                                        {transaction.reference}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-4 pr-6">
                                            {transaction.statut === 'completee' ? (
                                                <span className="badge badge-success text-[10px] font-bold text-white h-5">PAYÉ</span>
                                            ) : transaction.statut === 'annulee' ? (
                                                <span className="badge badge-error text-[10px] font-bold text-white h-5">ANNULÉ</span>
                                            ) : (
                                                <span className="badge badge-warning text-[10px] font-bold text-white h-5">ATTENTE</span>
                                            )}
                                        </td>
                                    </tr>
                                    
                                    {isExpanded && transaction.items?.map(subItem => (
                                        <tr key={subItem.id} className="bg-primary/[0.02] border-l-4 border-l-primary/30">
                                            <td className="pl-12 py-3 text-[11px] opacity-60 font-mono">↳ {formatDate(subItem.date_paiement).split(' ')[1]}</td>
                                            <td className="py-3 opacity-30 text-[11px]">Idem</td>
                                            <td className="py-3 opacity-30 text-[11px]">Idem</td>
                                            <td className="font-mono text-[11px] py-3 font-bold text-primary/60">{subItem.facture_numero}</td>
                                            <td className="text-right text-[11px] py-3 pr-4 font-bold text-base-content/70">
                                                {Math.round(parseFloat(subItem.montant)).toLocaleString()} F
                                            </td>
                                            <td className="py-3 pr-4">
                                                <span className="text-[10px] opacity-60 italic">{subItem.reference || '-'}</span>
                                            </td>
                                            <td className="py-3 text-[10px] font-black text-primary/30 pr-6">PIÈCE</td>
                                        </tr>
                                    ))}
                                </React.Fragment>
                            )
                        })}
                    </tbody>
                </table>
            )}
        </div>

        {/* Footer avec pagination unifié */}
        <div className="p-6 border-t border-base-200 bg-base-50/50 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-sm text-base-content/50 font-medium">
                Affichage de <span className="text-base-content">{filteredItems.length}</span> ligne{filteredItems.length > 1 ? 's' : ''} sur <span className="text-base-content">{totalCount}</span> au total
            </div>
            
            {!loading && totalCount > 0 && (
                <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-base-content/40 uppercase tracking-widest">Page {page} / {totalPages}</span>
                    <div className="flex gap-1.5">
                        <button 
                            className="btn btn-sm px-4 bg-white hover:bg-base-200 border-base-300 shadow-sm transition-all" 
                            disabled={page === 1} 
                            onClick={() => setPage(page - 1)}
                        >
                            Précédent
                        </button>
                        <button 
                            className="btn btn-sm px-4 bg-white hover:bg-base-200 border-base-300 shadow-sm transition-all" 
                            disabled={page >= totalPages} 
                            onClick={() => setPage(page + 1)}
                        >
                            Suivant
                        </button>
                    </div>
                </div>
            )}
        </div>
      </div>

      {/* Modal de Clôture - Unifiée avec Style Ventes */}
      <dialog className={`modal ${isClosingModalOpen ? 'modal-open' : ''}`}>
        <div className="modal-box max-w-md p-0 overflow-hidden rounded-2xl border border-base-300 shadow-2xl">
          <div className="bg-primary p-6 text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 p-8 opacity-10 text-9xl">🔒</div>
            <h3 className="font-black text-2xl tracking-tight">Clôture de Caisse</h3>
            <p className="text-primary-content/80 text-xs mt-1 font-bold uppercase tracking-widest">SÉCURISATION DES FONDS</p>
          </div>
          
          <div className="p-8 space-y-6">
            {closingTotals && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-base-100 border border-base-300 rounded-xl shadow-sm">
                            <div className="text-[10px] font-black text-base-content/40 uppercase mb-1">Théorique</div>
                            <div className="text-xl font-black text-primary">{Math.round(closingTotals.total_theorique).toLocaleString()} F</div>
                        </div>
                        <div className="p-4 bg-base-100 border border-base-300 rounded-xl shadow-sm">
                            <div className="text-[10px] font-black text-base-content/40 uppercase mb-1">Période</div>
                            <div className="text-[10px] font-bold text-base-content leading-tight">
                                {closingTotals.start_date ? formatDate(closingTotals.start_date).split(' ')[0] : 'Inconnue'}
                                <br/>au {new Date().toLocaleDateString()}
                            </div>
                        </div>
                    </div>

                    <div className="form-control w-full">
                        <label className="label py-1">
                            <span className="label-text text-xs font-black text-base-content/50 uppercase">Montant Réel (Physique)</span>
                        </label>
                        <div className="relative">
                            <input 
                                type="number" 
                                placeholder="0" 
                                className="input input-bordered w-full input-lg font-black text-2xl text-center focus:ring-4 focus:ring-primary/10 transition-all" 
                                value={actualAmount}
                                onChange={(e) => setActualAmount(e.target.value)}
                                autoFocus
                            />
                            <span className="absolute right-6 top-1/2 -translate-y-1/2 font-black text-base-content/20">CFA</span>
                        </div>
                        <div className="mt-4 flex items-center justify-between p-3 bg-base-200 rounded-lg">
                            <span className="text-xs font-bold text-base-content/60 uppercase">Écart de caisse</span>
                            <span className={`text-sm font-black ${
                                !actualAmount ? 'text-base-content/20' : 
                                (parseFloat(actualAmount) - closingTotals.total_theorique) >= 0 ? 'text-success' : 'text-error'
                            }`}>
                                {actualAmount ? Math.round(parseFloat(actualAmount) - closingTotals.total_theorique).toLocaleString() + ' F' : '---'}
                            </span>
                        </div>
                    </div>

                    <div className="collapse collapse-arrow bg-base-100 border border-base-200 rounded-xl">
                        <input type="checkbox" /> 
                        <div className="collapse-title text-sm font-bold flex items-center gap-2">
                           📊 Détails par mode
                        </div>
                        <div className="collapse-content"> 
                            <div className="space-y-2 pt-2 border-t border-base-200 mt-2">
                                {Object.entries(closingTotals.details).filter(([,v]) => v > 0).map(([mode, montant]) => (
                                <div key={mode} className="flex items-center justify-between text-xs">
                                    <span className="font-medium text-base-content/60 capitalize ">{mode}</span>
                                    <span className="font-black text-base-content">{Math.round(montant).toLocaleString()} F</span>
                                </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col gap-3">
                <button className="btn btn-primary btn-lg rounded-xl font-black shadow-lg shadow-primary/20" onClick={handleCloseCaisse}>
                    CONFIRMER LA CLÔTURE
                </button>
                <div className="grid grid-cols-2 gap-3">
                    <button className="btn btn-outline border-base-300 font-bold" onClick={handleImprimerCloture}>
                        🖨️ TICKET
                    </button>
                    <button className="btn btn-ghost font-bold opacity-50" onClick={() => setIsClosingModalOpen(false)}>
                        ANNULER
                    </button>
                </div>
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
