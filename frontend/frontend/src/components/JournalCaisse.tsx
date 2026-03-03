import React, { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import { toast } from 'react-hot-toast'
import type { CaisseTransaction, MouvementCaisse } from '../types'
import CashMovementModal from './CashMovementModal'
import DatePicker, { registerLocale } from 'react-datepicker'
import { fr } from 'date-fns/locale'
import 'react-datepicker/dist/react-datepicker.css'
import { usePharmacySettings } from '../hooks/usePharmacySettings'
import { formatCurrency } from '../utils/formatters'
import { 
  Search, RefreshCw, Plus, Lock, Wallet, 
  ArrowUpRight, ArrowDownRight, Banknote, Printer, CreditCard 
} from 'lucide-react'

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
  const [dateDebut, setDateDebut] = useState<Date | null>(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return today
  })
  const [dateFin, setDateFin] = useState<Date | null>(() => {
    const endToday = new Date()
    endToday.setHours(23, 59, 59, 999)
    return endToday
  })
  const [expandedReleves, setExpandedReleves] = useState<Set<number>>(new Set())
  const { settings: pharmacySettings } = usePharmacySettings()

  // User/Cashier filtering
  const [users, setUsers] = useState<any[]>([])
  const [selectedUser, setSelectedUser] = useState<string>('')
  
  // Pagination
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  // Server-side totals
  const [serverTotals, setServerTotals] = useState<{
    total_theorique: number,
    total_ventes: number,
    total_entrees: number,
    total_sorties: number,
    total_coupons: number,
    total_recouvrement: number,
    details: Record<string, number>
  } | null>(null)

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
    const totaux = {
      especes: 0,
      cheque: 0,
      carte: 0,
      virement: 0,
      om: 0,
      momo: 0,
      en_compte: 0,
      total: 0,
      entrees: 0,
      sorties: 0,
      recouvrement: 0,
      ventes: 0,
      // Breakdowns per mode
      ventes_par_mode: { especes: 0, cheque: 0, carte: 0, virement: 0, om: 0, momo: 0 } as Record<string, number>,
      recouv_par_mode: { especes: 0, cheque: 0, carte: 0, virement: 0, om: 0, momo: 0 } as Record<string, number>
    }

    filteredItems.forEach((item: any) => {
       const montant = parseFloat(item.montant)
       if (item._kind === 'mouvement') {
           if (item.type === 'ENTREE') {
               totaux.entrees += montant
               totaux.total += montant 
           } else {
               totaux.sorties += montant
               totaux.total -= montant 
           }
       } else {
          // Transaction
          if (item.statut === 'completee') {
            const isRecouvrement = item.mode_paiement === 'recouvrement' || item.is_creance_settlement || (item.reference && item.reference.includes('[RECOUV]'))
            
            if (isRecouvrement) {
                totaux.recouvrement += montant
                if (totaux.recouv_par_mode[item.mode_paiement] !== undefined) {
                    totaux.recouv_par_mode[item.mode_paiement] += montant
                }
                // DO NOT add to totaux[mode] or totaux.total as per user request (Operational only)
            } else {
                totaux.ventes += montant
                if (totaux.ventes_par_mode[item.mode_paiement] !== undefined) {
                    totaux.ventes_par_mode[item.mode_paiement] += montant
                }
                
                // Add to core totals ONLY for sales/operations
                if (totaux[item.mode_paiement as keyof typeof totaux] !== undefined) {
                    (totaux as any)[item.mode_paiement] += montant
                }
                
                // IMPORTANT: Only especes impact the physical total to justify
                if (item.mode_paiement === 'especes') {
                    totaux.total += montant
                }
            }
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
    total_ventes: number,
    total_recouvrement: number,
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
      if (dateDebut) params.date_debut = formatLocalISOString(dateDebut)
      if (dateFin) params.date_fin = formatLocalISOString(dateFin)
      if (selectedUser) params.user_id = selectedUser
      
      const response = await axios.get(`${caisseEndpoint}get_totals/`, { params })
      setServerTotals(response.data)
      return response.data
    } catch (err) {
      console.error('Erreur chargement totaux:', err)
    }
  }
  
  
  const openClosingModal = () => {
      // Use server totals if available, otherwise fallback to local (calculated as best effort)
      const currentTotals = (serverTotals || totauxParMode) as any;
      
      const modalTotals = {
          start_date: dateDebut ? formatLocalISOString(dateDebut) : currentTotals?.start_date || null,
          end_date: dateFin ? formatLocalISOString(dateFin) : null,
          total_theorique: currentTotals.total_theorique ?? currentTotals.total,
          total_ventes: currentTotals.total_ventes ?? currentTotals.ventes,
          total_recouvrement: currentTotals.total_recouvrement ?? currentTotals.recouvrement,
          total_entrees: currentTotals.total_entrees ?? currentTotals.entrees,
          total_sorties: currentTotals.total_sorties ?? currentTotals.sorties,
          details: currentTotals.details || {
              especes: currentTotals.especes,
              cheque: currentTotals.cheque,
              carte: currentTotals.carte,
              virement: currentTotals.virement,
              om: currentTotals.om,
              momo: currentTotals.momo
          },
          user: selectedUser ? users.find(u => u.id.toString() === selectedUser)?.full_name : 'Admin'
      }
      
      setClosingTotals(modalTotals)
      setActualAmount('') 
      setIsClosingModalOpen(true)
  }

  const handleCloseCaisse = async () => {
    if (!actualAmount) return
    
    setLoading(true)
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
    } finally {
      setLoading(false)
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
      const soldeOp = closingTotals.total_ventes + closingTotals.total_entrees - closingTotals.total_sorties;

      const content = `
        <div style="font-family: monospace; width: 80mm; margin: 0 auto; padding: 10px; color: black; line-height: 1.2;">
            <div style="text-align: center; margin-bottom: 10px; border-bottom: 2px solid black; padding-bottom: 5px;">
                <h2 style="margin: 0; font-size: 1.1em; font-weight: bold;">${pharmacySettings?.pharmacy_name || 'Ma Pharmacie'}</h2>
                <div style="font-size: 0.8em; margin-top: 2px;">RAPPORT DE CLÔTURE</div>
            </div>

            <div style="font-size: 0.8em; margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between;">
                    <span>Date Impression:</span>
                    <span>${new Date().toLocaleDateString('fr-FR')} ${new Date().toLocaleTimeString('fr-FR')}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>Opérateur:</span>
                    <span>${closingTotals.user || 'Admin'}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 5px; border-top: 1px dotted #ccc; padding-top: 5px;">
                    <span>Du: ${startStr}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>Au: ${endStr}</span>
                </div>
            </div>

            <div style="margin-bottom: 10px; background: #f9f9f9; padding: 5px; border: 1px solid #eee;">
                <div style="font-weight: bold; margin-bottom: 3px; border-bottom: 1px solid black; font-size: 0.85em;">ACTIVITÉ DU JOUR (OPÉRATIONNEL)</div>
                <div style="display: flex; justify-content: space-between; font-size: 0.85em;">
                    <span>Ventes Nettes (CA)</span>
                    <span>${formatCurrency(closingTotals.total_ventes)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.85em;">
                    <span>Entrées Diverses</span>
                    <span>${formatCurrency(closingTotals.total_entrees)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.85em;">
                    <span>Sorties/Dépenses</span>
                    <span>-${formatCurrency(closingTotals.total_sorties)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-weight: bold; border-top: 1px dashed black; margin-top: 3px; padding-top: 2px;">
                    <span>SOLDE NET À JUSTIFIER</span>
                    <span>${formatCurrency(soldeOp)}</span>
                </div>
            </div>

            <div style="margin-bottom: 15px;">
                <div style="font-weight: bold; margin-bottom: 3px; border-bottom: 1px solid black; font-size: 0.85em;">RÉCAPITULATIF DES MODES (VENTES)</div>
                ${Object.entries(closingTotals.details).map(([mode, montant]) => `
                    <div style="display: flex; justify-content: space-between; font-size: 0.8em; margin-bottom: 1px;">
                        <span style="text-transform: capitalize;">${mode}</span>
                        <span>${formatCurrency(montant)}</span>
                    </div>
                `).join('')}
            </div>

            <div style="border-top: 2px solid black; padding-top: 5px; margin-top: 5px;">
                <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 1.05em;">
                    <span>TOTAL À JUSTIFIER</span>
                    <span>${formatCurrency(closingTotals.total_theorique)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.85em; margin-top: 3px;">
                    <span>Montant Réel (Compté)</span>
                    <span>${actualAmount ? formatCurrency(parseFloat(actualAmount)) : '_________'}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-weight: bold; border-top: 1px solid black; margin-top: 3px; padding-top: 3px;">
                    <span>ÉCART DE CAISSE</span>
                    <span>${actualAmount ? formatCurrency(parseFloat(actualAmount) - closingTotals.total_theorique) : '_________'}</span>
                </div>
            </div>

            <div style="display: flex; justify-content: space-between; margin-top: 30px; font-size: 0.7em;">
                <div style="text-align: center; width: 45%;">
                    <p style="margin-bottom: 30px; border-bottom: 1px solid #ccc; padding-bottom: 2px;">Caissier</p>
                </div>
                <div style="text-align: center; width: 45%;">
                    <p style="margin-bottom: 30px; border-bottom: 1px solid #ccc; padding-bottom: 2px;">Responsable</p>
                </div>
            </div>
            
            <div style="text-align: center; font-size: 0.6em; margin-top: 15px; font-style: italic; opacity: 0.5;">
                Généré le ${new Date().toLocaleDateString('fr-FR')} - Logiciel de Gestion Pharmacie
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
      case 'en_compte': return '📒'
      default: return '💰'
    }
  }

  return (
    <div className="h-full flex flex-col bg-base-200/50">
      
      {/* Header and Filters Card */}
      <div className="bg-base-100 border-b border-base-200 shrink-0 p-6">
        <div className="flex flex-col xl:flex-row gap-6 justify-between items-start xl:items-end">
          <div>
            <h1 className="text-2xl font-bold text-base-content flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <Banknote className="w-6 h-6" />
              </div>
              Journal de Caisse
            </h1>
            <div className="text-base-content/60 mt-1 pl-12 text-sm flex items-center gap-2">
                <span>Historique des flux de caisse</span>
                <span className="w-1 h-1 rounded-full bg-base-300"></span>
                <span className="font-mono text-primary font-semibold">{totalCount} opérations</span>
            </div>
          </div>
          
          <div className="flex flex-wrap lg:flex-nowrap gap-3 items-end w-full lg:w-auto">
             <div className="relative flex-1 lg:w-48">
                <input
                    type="text"
                    placeholder="Rechercher..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="input input-sm input-bordered w-full pl-8 bg-base-50"
                />
                <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 opacity-40 text-base-content" />
             </div>

             <div className="form-control flex-1 lg:w-40">
                <select
                    value={filterMode}
                    onChange={(e) => setFilterMode(e.target.value)}
                    className="select select-bordered select-sm w-full bg-base-50 font-medium"
                >
                    <option value="all">Tous modes</option>
                    <option value="especes">💵 Espèces</option>
                    <option value="cheque">✍️ Chèque</option>
                    <option value="carte">💳 Carte</option>
                    <option value="virement">🏦 Virement</option>
                    <option value="om">📶 Orange Money</option>
                    <option value="momo">📶 Mobile Money</option>
                </select>
             </div>

             <div className="form-control flex-1 lg:w-40">
                <select
                    value={selectedUser}
                    onChange={(e) => setSelectedUser(e.target.value)}
                    className="select select-bordered select-sm w-full bg-base-50 font-medium"
                >
                    <option value="">👤 Tous les caissiers</option>
                    {users.map((u: any) => (
                        <option key={u.id} value={u.id}>
                            {u.first_name ? `${u.first_name} ${u.last_name || ''}` : u.username}
                        </option>
                    ))}
                </select>
             </div>

             <div className="flex items-center gap-2 bg-base-50 border border-base-200 rounded-lg p-1">
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
                 <span className="text-base-content/20 text-xs">→</span>
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
                 <button
                    onClick={() => {
                        const today = new Date()
                        today.setHours(0, 0, 0, 0)
                        const endToday = new Date()
                        endToday.setHours(23, 59, 59, 999)
                        setDateDebut(today)
                        setDateFin(endToday)
                    }}
                    className="btn btn-xs btn-ghost text-primary px-2"
                    title="Aujourd'hui"
                 >
                    Auj.
                 </button>
             </div>

             <div className="flex gap-2">
                <button
                    onClick={fetchData}
                    className="btn btn-sm btn-ghost btn-square"
                    disabled={loading}
                    title="Actualiser"
                >
                    {loading ? <span className="loading loading-spinner loading-xs"></span> : <RefreshCw className="w-4 h-4 text-base-content/70" />}
                </button>
                <div className="h-8 w-px bg-base-200 mx-1"></div>
                <button
                    onClick={() => setIsMovementModalOpen(true)}
                    className="btn btn-sm btn-outline border-base-300 btn-primary gap-2"
                >
                    <Plus className="w-4 h-4" /> Opération
                </button>
                <button
                    onClick={openClosingModal}
                    className="btn btn-sm btn-primary shadow-sm gap-2"
                    disabled={loading}
                >
                    <Lock className="w-4 h-4" /> Clôturer
                </button>
             </div>
          </div>
        </div>

        {/* Status Filters Bar */}
        <div className="mt-4 pt-4 border-t border-base-200 flex items-center justify-between">
           <div className="join bg-base-50 p-1 rounded-lg border border-base-200">
                <button 
                    className={`join-item btn btn-sm border-none font-medium px-6 ${filterType === 'all' ? 'bg-base-100 shadow-sm text-base-content' : 'bg-transparent text-base-content/60 hover:text-base-content'}`}
                    onClick={() => setFilterType('all')}
                >
                    Tout
                </button>
                <button 
                    className={`join-item btn btn-sm border-none font-medium px-6 flex items-center gap-1 ${filterType === 'entrees' ? 'bg-success text-white shadow-sm' : 'bg-transparent text-success/70 hover:text-success'}`}
                    onClick={() => setFilterType('entrees')}
                >
                    <ArrowUpRight className="w-4 h-4" /> Entrées
                </button>
                <button 
                    className={`join-item btn btn-sm border-none font-medium px-6 flex items-center gap-1 ${filterType === 'sorties' ? 'bg-error text-white shadow-sm' : 'bg-transparent text-error/70 hover:text-error'}`}
                    onClick={() => setFilterType('sorties')}
                >
                    <ArrowDownRight className="w-4 h-4" /> Sorties
                </button>
           </div>
        </div>
      </div>

      {/* Global Stats Cards */}
      {/* Global Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 p-6 pb-2 shrink-0">
          {/* Card 1: Sales */}
          <div className="bg-base-100 p-5 rounded-xl border border-base-200 shadow-sm flex flex-col justify-center">
              <div className="flex justify-between items-start">
                  <div>
                      <h3 className="text-base-content/60 text-xs font-bold uppercase tracking-wider mb-1">Ventes Nettes</h3>
                      <div className="text-2xl font-black text-primary">{formatCurrency(serverTotals?.total_ventes ?? totauxParMode.ventes)}</div>
                      <div className="text-[10px] text-base-content/40 mt-1 font-medium">CA de l'intervalle réel</div>
                  </div>
                  <div className="p-3 bg-primary/10 rounded-lg text-primary">
                     <ArrowUpRight className="w-5 h-5" />
                  </div>
              </div>
          </div>

          {/* Card 2: Recoveries - Informational only */}
          <div className="bg-base-100/50 p-5 rounded-xl border border-base-200 shadow-sm flex flex-col justify-center opacity-80 group hover:opacity-100 transition-opacity">
              <div className="flex justify-between items-start">
                  <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-base-content/60 text-[10px] font-bold uppercase tracking-wider">Recouvrements</h3>
                        <span className="badge badge-ghost badge-xs text-[8px] uppercase font-bold opacity-50">Mémo</span>
                      </div>
                      <div className="text-xl font-bold text-base-content/70">{formatCurrency(serverTotals?.total_recouvrement ?? totauxParMode.recouvrement)}</div>
                      <div className="text-[9px] text-base-content/40 mt-1 font-medium">Encaissements de créances</div>
                  </div>
                  <div className="p-2 bg-base-200 rounded-lg text-base-content/30">
                     <Wallet className="w-4 h-4" />
                  </div>
              </div>
          </div>

          {/* Card 3: Cash - Total physical reconciliation */}
          <div className="bg-base-100 p-5 rounded-xl border-l-4 border-l-success border border-base-200 shadow-md flex flex-col justify-center">
              <div className="flex justify-between items-start">
                  <div>
                      <h3 className="text-success text-xs font-black uppercase tracking-wider mb-1">Espèces à Justifier</h3>
                      <div className="text-2xl font-black text-success">{formatCurrency(serverTotals?.total_theorique ?? totauxParMode.total)}</div>
                      <div className="text-[10px] text-success/60 font-medium mt-1 uppercase italic">Ventes Espèces + Entrées - Sorties</div>
                  </div>
                  <div className="p-3 bg-success/10 rounded-lg text-success">
                     <Banknote className="w-5 h-5" />
                  </div>
              </div>
          </div>

          {/* Card 4: Digital / Mobile Money */}
          <div className="bg-base-100 p-5 rounded-xl border border-base-200 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start">
                  <h3 className="text-base-content/60 text-xs font-bold uppercase tracking-wider mb-1">Paiements Mobiles</h3>
                  <div className="text-xs font-bold text-orange-500">{formatCurrency((serverTotals?.details?.om || 0) + (serverTotals?.details?.momo || 0) || (totauxParMode.ventes_par_mode.om + totauxParMode.ventes_par_mode.momo))}</div>
              </div>
              <div className="flex flex-col gap-1 mt-2">
                 <div className="flex justify-between items-center text-[11px]">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500"></span> OM</span>
                    <span className="font-bold opacity-70">{formatCurrency(serverTotals?.details?.om ?? totauxParMode.ventes_par_mode.om)}</span>
                 </div>
                 <div className="flex justify-between items-center text-[11px]">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400"></span> MoMo</span>
                    <span className="font-bold opacity-70">{formatCurrency(serverTotals?.details?.momo ?? totauxParMode.ventes_par_mode.momo)}</span>
                 </div>
              </div>
          </div>

          {/* Card 5: Bank / Others (Grouped as Bank) */}
          <div className="bg-base-100 p-5 rounded-xl border border-base-200 shadow-sm flex flex-col justify-center">
              <div className="flex justify-between items-start">
                  <div>
                      <h3 className="text-base-content/60 text-xs font-bold uppercase tracking-wider mb-1">Banque / Digital</h3>
                      <div className="text-xl font-bold text-info">{formatCurrency((serverTotals?.details?.carte || 0) + (serverTotals?.details?.cheque || 0) + (serverTotals?.details?.virement || 0) || (totauxParMode.ventes_par_mode.carte + totauxParMode.ventes_par_mode.cheque + totauxParMode.ventes_par_mode.virement))}</div>
                      <div className="text-[10px] text-base-content/40 mt-1 font-medium uppercase text-xs">Ventes Hors Cash</div>
                  </div>
                  <div className="p-3 bg-info/10 rounded-lg text-info">
                     <CreditCard className="w-5 h-5" />
                  </div>
              </div>
          </div>
      </div>

      {/* Adaptive Details Bar: Only show if there are secondary payments or movements */}
      <div className="px-6 flex flex-wrap gap-2 items-center mb-4 min-h-[32px]">
          <span className="text-[10px] font-black uppercase text-base-content/40 mr-2">Détails flux :</span>
          
          {/* Part 1: Sales breakdown - using server totals details if avail */}
          {Object.entries(serverTotals?.details || totauxParMode.ventes_par_mode).map(([mode, value]) => {
              const numValue = typeof value === 'string' ? parseFloat(value) : (value as number);
              if (numValue === 0) return null;
              
              const labels: Record<string, {label: string, color: string}> = {
                  especes: { label: 'Ventes Esp.', color: 'success' },
                  cheque: { label: 'Chèque', color: 'info' },
                  carte: { label: 'Carte', color: 'info' },
                  virement: { label: 'Virement', color: 'info' },
                  om: { label: 'O.M.', color: 'warning' },
                  momo: { label: 'MoMo', color: 'warning' },
                  recouvrement: { label: 'Recouvrement', color: 'primary' }
              }
              
              const info = labels[mode] || { label: mode.toUpperCase(), color: 'ghost' };
              
              return (
                  <div key={mode} className={`badge badge-ghost border-base-300 gap-2 p-3 text-[10px] font-bold`}>
                      <span className={`w-1.5 h-1.5 rounded-full bg-${info.color}`}></span>
                      <span className="opacity-60">{info.label}:</span>
                      <span>{formatCurrency(numValue)}</span>
                  </div>
              )
          })}

          {/* Part 2: Movements breakdown (Flux) */}
          {(serverTotals?.total_entrees ?? totauxParMode.entrees) !== 0 && (
              <div className="badge badge-success badge-outline gap-2 p-3 text-[10px] font-bold text-success/80">
                  <ArrowUpRight className="w-3 h-3" />
                  <span className="opacity-60">Entrées:</span>
                  <span>{formatCurrency(serverTotals?.total_entrees ?? totauxParMode.entrees)}</span>
              </div>
          )}
          {(serverTotals?.total_sorties ?? totauxParMode.sorties) !== 0 && (
              <div className="badge badge-error badge-outline gap-2 p-3 text-[10px] font-bold text-error/80">
                  <ArrowDownRight className="w-3 h-3" />
                  <span className="opacity-60">Sorties:</span>
                  <span>{formatCurrency(serverTotals?.total_sorties ?? totauxParMode.sorties)}</span>
              </div>
          )}

          {/* Performance Summary Bar: Strictly Interval Operations */}
          <div className="flex items-center gap-0">
              {/* Part 1: Breakdown (Ventes + Flux) */}
              <div className="flex items-center gap-4 bg-base-200 py-2 px-6 rounded-l-full border border-base-300">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black uppercase opacity-50">Activité intervalle :</span>
                    <span className="text-sm font-bold text-base-content">{formatCurrency((serverTotals?.total_ventes ?? totauxParMode.ventes) + (serverTotals?.total_entrees ?? totauxParMode.entrees))}</span>
                  </div>
                  <div className="w-px h-6 bg-base-300"></div>
                  <div className="flex flex-col opacity-60">
                    <span className="text-[9px] font-black uppercase italic">Dépenses :</span>
                    <span className="text-sm font-bold">-{formatCurrency(serverTotals?.total_sorties ?? totauxParMode.sorties)}</span>
                  </div>
              </div>

              {/* Final Operational Balance */}
              <div className="flex items-center gap-4 bg-primary text-white py-2 px-6 rounded-r-emerald-none rounded-r-full shadow-xl shadow-primary/20">
                  <div className="flex flex-col items-start">
                     <span className="text-[10px] font-black uppercase opacity-70 tracking-wider">Solde Opérationnel Net</span>
                     <span className="text-[8px] opacity-60 uppercase font-bold">Hors Recouvrements</span>
                  </div>
                  <div className="w-px h-6 bg-white/20 mx-1"></div>
                  <span className="text-xl font-black">{formatCurrency((serverTotals?.total_ventes ?? totauxParMode.ventes) + (serverTotals?.total_entrees ?? totauxParMode.entrees) - (serverTotals?.total_sorties ?? totauxParMode.sorties))}</span>
              </div>
          </div>
      </div>

      {/* Main Content: Table Wrapper */}
      <div className="flex-1 bg-base-100 rounded-2xl border border-base-200 shadow-sm flex flex-col overflow-hidden mx-6 mb-6">
        {error && (
            <div className="p-3 bg-error/10 border-b border-error/20 flex items-center gap-2 text-error text-sm font-medium">
                <span className="text-lg">⚠️</span>
                {error}
            </div>
        )}

        <div className="flex-1 overflow-auto">
            {loading ? (
                <div className="flex flex-col items-center justify-center h-64 bg-base-100 gap-4">
                    <span className="loading loading-spinner loading-lg text-primary"></span>
                    <p className="text-base-content/60 font-medium animate-pulse">Chargement du journal...</p>
                </div>
            ) : filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-base-content/30 gap-3">
                    <span className="text-6xl opacity-20">📂</span>
                    <p className="text-lg font-medium italic">Aucune transaction trouvée</p>
                </div>
            ) : (
                <table className="table table-sm w-full border-separate border-spacing-0">
                    <thead className="sticky top-0 z-10">
                        <tr className="bg-base-50/50 backdrop-blur-md">
                            <th className="border-b-2 border-base-200 text-xs font-bold text-base-content/50 py-3 pl-6">DATE & HEURE</th>
                            <th className="border-b-2 border-base-200 text-xs font-bold text-base-content/50 py-3">CAISSIER</th>
                            <th className="border-b-2 border-base-200 text-xs font-bold text-base-content/50 py-3">SAISIE PAR</th>
                            <th className="border-b-2 border-base-200 text-xs font-bold text-base-content/50 py-3">CLIENT / LIBELLÉ</th>
                            <th className="border-b-2 border-base-200 text-xs font-bold text-base-content/50 py-3">N° PIÈCE</th>
                            <th className="border-b-2 border-base-200 text-xs font-bold text-base-content/50 py-3 text-right">MONTANT</th>
                            <th className="border-b-2 border-base-200 text-xs font-bold text-base-content/50 py-3">MODE</th>
                            <th className="border-b-2 border-base-200 text-xs font-bold text-base-content/50 py-3 pr-6 text-right">STATUT</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-base-100 bg-white">
                        {groupedItems.map((item: any) => {
                            if (item._kind === 'mouvement') {
                                const mouv = item as MouvementCaisse
                                return (
                                    <tr key={`mouv-${mouv.id}`} className={`hover:bg-base-50/50 transition-colors ${mouv.type === 'ENTREE' ? 'bg-success/5' : 'bg-error/5'}`}>
                                        <td className="font-mono text-xs whitespace-nowrap pl-6 py-4">{formatDate(mouv.date)}</td>
                                        <td className="py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-xl bg-base-200 flex items-center justify-center text-xs font-bold text-base-content/50 border border-base-300">
                                                    {(mouv.user_nom || 'U')[0]}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-sm text-base-content">{mouv.user_nom || 'Utilisateur'}</span>
                                                    <span className="text-[10px] text-base-content/50 uppercase tracking-wider font-bold">Opération</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4">
                                            <span className="text-xs text-base-content/30 italic">-</span>
                                        </td>
                                        <td className="py-4">
                                            <div className="font-bold text-sm text-base-content">{mouv.motif}</div>
                                            <div className="text-xs text-base-content/50 italic max-w-xs truncate" title={mouv.description}>{mouv.description || 'Pas de description'}</div>
                                        </td>
                                        <td className="font-mono text-[10px] py-4 opacity-50">MOUV-{mouv.id}</td>
                                        <td className={`text-right font-black text-base py-4 ${mouv.type === 'ENTREE' ? 'text-success' : 'text-error'}`}>
                                            {mouv.type === 'ENTREE' ? '+' : '-'}{formatCurrency(parseFloat(mouv.montant as string))}
                                        </td>
                                        <td className="py-4">
                                            <div className={`badge badge-sm font-bold gap-1 py-1 px-2 border-none ${mouv.type === 'ENTREE' ? 'bg-success text-white' : 'bg-error text-white'}`}>
                                                {mouv.type === 'ENTREE' ? 'ENTRÉE' : 'SORTIE'}
                                            </div>
                                        </td>
                                        <td className="py-4 pr-6 text-right">
                                            <span className="inline-flex items-center gap-1 text-success font-bold text-[10px] bg-success/10 px-2 py-1 rounded-md uppercase">
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
                                            {(() => {
                                                const mode = transaction.mode_paiement as any;
                                                const isRecouvrement = mode === 'recouvrement' || 
                                                                    transaction.is_creance_settlement || 
                                                                    transaction.client_type === 'PROFESSIONNEL' || 
                                                                    (transaction.reference && transaction.reference.includes('[RECOUV]'));
                                                return (
                                                    <div className="flex flex-col">
                                                        <div className={`badge border-none font-bold text-[10px] gap-1.5 py-3 ${isRecouvrement ? 'bg-primary text-white' : 'bg-base-200 text-base-content'}`}>
                                                            {isRecouvrement ? '💸' : getModeIcon(transaction.mode_paiement)} {isRecouvrement ? 'RECOUVREMENT' : transaction.mode_paiement_display?.toUpperCase()}
                                                        </div>
                                                        {transaction.reference && (
                                                            <span className="text-[10px] text-base-content/50 mt-1 max-w-[120px] truncate" title={transaction.reference}>
                                                                Réf: {transaction.reference}
                                                            </span>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                         </td>
                                        <td className="py-4 pr-6 text-right">
                                            {transaction.statut === 'completee' ? (
                                                <span className="inline-flex items-center text-success font-bold text-[10px] bg-success/10 px-2 py-1 rounded-md uppercase">PAYÉ</span>
                                            ) : transaction.statut === 'annulee' ? (
                                                <span className="inline-flex items-center text-error font-bold text-[10px] bg-error/10 px-2 py-1 rounded-md uppercase">ANNULÉ</span>
                                            ) : (
                                                <span className="inline-flex items-center text-warning font-bold text-[10px] bg-warning/10 px-2 py-1 rounded-md uppercase">ATTENTE</span>
                                            )}
                                        </td>
                                    </tr>
                                    
                                    {isExpanded && transaction.items?.map(subItem => (
                                        <tr key={subItem.id} className="bg-primary/5 border-l-4 border-l-primary/30">
                                            <td className="pl-12 py-3 text-[11px] opacity-60 font-mono">↳ {formatDate(subItem.date_paiement).split(' ')[1]}</td>
                                            <td className="py-3 opacity-40 text-[11px]">-</td>
                                            <td className="py-3 opacity-40 text-[11px]">-</td>
                                            <td className="font-mono text-[11px] py-3 font-bold text-primary/70">{subItem.facture_numero}</td>
                                            <td className="text-right text-[11px] py-3 pr-4 font-bold text-base-content/80">
                                                {formatCurrency(parseFloat(subItem.montant as string))}
                                            </td>
                                            <td className="py-3 pr-4">
                                                <span className="text-[10px] opacity-60 italic">{subItem.reference || '-'}</span>
                                            </td>
                                            <td className="py-3 text-[10px] font-black text-primary/40 pr-6 text-right">PIÈCE</td>
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
                    <div className="grid grid-cols-1 gap-3">
                        <div className="p-5 bg-primary/5 border border-primary/20 rounded-xl shadow-sm text-center">
                            <div className="text-[10px] font-black text-primary/60 uppercase mb-1 tracking-widest">Solde Opérationnel Net</div>
                            <div className="text-3xl font-black text-primary">{Math.round(closingTotals.total_ventes + closingTotals.total_entrees - closingTotals.total_sorties).toLocaleString()} F</div>
                            <div className="text-[10px] font-bold text-primary/40 mt-1 uppercase">Ventes + Entrées - Sorties</div>
                        </div>
                        <div className="p-4 bg-success/5 border border-success/20 rounded-xl text-center">
                            <div className="text-[9px] font-black text-success/60 uppercase mb-1 tracking-widest">Espèces à Justifier</div>
                            <div className="text-2xl font-black text-success">{Math.round(closingTotals.total_theorique).toLocaleString()} F</div>
                            <div className="text-[9px] font-bold text-success/40 mt-1 uppercase">Ventes Espèces + Entrées - Sorties</div>
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
                            <span className="text-xs font-bold text-base-content/60 uppercase">Écart de caisse (Espèces)</span>
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
                                {Object.entries(closingTotals.details).filter(([,v]) => v !== 0).map(([mode, montant]) => (
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
                <button 
                  className="btn btn-primary btn-lg rounded-xl font-black shadow-lg shadow-primary/20" 
                  onClick={handleCloseCaisse}
                  disabled={loading || !actualAmount}
                >
                    {loading ? <span className="loading loading-spinner"></span> : 'CONFIRMER LA CLÔTURE'}
                </button>
                <div className="grid grid-cols-2 gap-3">
                    <button className="btn btn-outline border-base-300 font-bold flex items-center justify-center gap-2" onClick={handleImprimerCloture}>
                        <Printer className="w-5 h-5" /> TICKET
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
