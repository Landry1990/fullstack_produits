import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import axios from 'axios'
import { toast } from 'react-hot-toast'
import type { CaisseTransaction, MouvementCaisse } from '../types'
import CashMovementModal from './CashMovementModal'
import DatePicker, { registerLocale } from 'react-datepicker'
import { fr } from 'date-fns/locale'
import 'react-datepicker/dist/react-datepicker.css'
import { usePharmacySettings } from '../hooks/usePharmacySettings'
import { formatCurrency, normalizeNumberInput } from '../utils/formatters'
import { 
  Search, RefreshCw, Plus, Lock, Wallet, 
  ArrowUpRight, ArrowDownRight, Banknote, Printer, CreditCard 
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from 'react-i18next'

// Register French locale
registerLocale('fr', fr)

export default function JournalCaisse() {
  const { t } = useTranslation(['cash_journal', 'common'])
  const currentLocale = t('common:locale', { defaultValue: 'fr-FR' })
  const currencySymbol = t('common.currency_symbol', 'F')

  const formatCurrencyLocal = (amount: number) => formatCurrency(amount, currentLocale, currencySymbol)
  const [transactions, setTransactions] = useState<CaisseTransaction[]>([])
  const [mouvements, setMouvements] = useState<MouvementCaisse[]>([])
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterMode, setFilterMode] = useState<string>('all')
  const [filterType, setFilterType] = useState<'all' | 'entrees' | 'sorties'>('all')
  const [expandedReleves, setExpandedReleves] = useState<Set<number>>(new Set())
  const { settings: pharmacySettings } = usePharmacySettings()
  const { getServerDate } = useAuth()

  const [dateDebut, setDateDebut] = useState<Date | null>(() => {
    const today = getServerDate()
    today.setHours(0, 0, 0, 0)
    return today
  })
  const [dateFin, setDateFin] = useState<Date | null>(() => {
    const endToday = getServerDate()
    endToday.setHours(23, 59, 59, 999)
    return endToday
  })

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
    details: Record<string, number>,
    mouvements_audit?: any[]
  } | null>(null)

  const [detectedShift, setDetectedShift] = useState<{
    start: Date,
    end: Date,
    active: boolean
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

  // Track mount state for initial page_init vs subsequent fetches
  const isInitialMount = useRef(true)
  const hasLoadedOnce = useRef(false)

  // Process transactions response data
  const processTransactionsData = useCallback((data: any) => {
    if (data.results) {
      setTransactions(data.results)
      setTotalCount(data.count || 0)
      setTotalPages(Math.ceil((data.count || 0) / 50))
    } else {
      setTransactions(Array.isArray(data) ? data : [])
      setTotalCount(Array.isArray(data) ? data.length : 0)
      setTotalPages(1)
    }
  }, [])

  // ---- INITIAL LOAD: unified page_init endpoint (4 requests → 1) ----
  const fetchPageInit = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.append('page', '1')
      if (selectedUser) params.append('user', selectedUser)
      // Pass date filters so get_totals computes for the right period
      if (dateDebut) params.append('date_debut', formatLocalISOString(dateDebut))
      if (dateFin) params.append('date_fin', formatLocalISOString(dateFin))

      const response = await axios.get(`${caisseEndpoint}page_init/`, { params })
      const { transactions: txData, mouvements: mouvData, totals: totalsData, users: usersData } = response.data

      processTransactionsData(txData)
      setMouvements(Array.isArray(mouvData) ? mouvData : (mouvData?.results || []))
      if (totalsData) setServerTotals(totalsData)
      if (usersData) setUsers(usersData)
    } catch (err) {
      setError(t('table.loading_error') || 'Erreur lors du chargement des données')
      console.error('Erreur page_init caisse:', err)
    } finally {
      setLoading(false)
    }
  }, [caisseEndpoint, selectedUser, dateDebut, dateFin, processTransactionsData, t])

  // Initial load uses page_init
  useEffect(() => {
    if (!hasLoadedOnce.current) {
      hasLoadedOnce.current = true
      fetchPageInit()
    }
  }, [])

  // Re-fetch transactions when page changes (not on initial mount)
  useEffect(() => {
    if (isInitialMount.current) return
    fetchTransactions()
  }, [page])

  // Re-fetch data when user or date filters change (not on initial mount)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    // Combined: fetch transactions + totals + mouvements on filter change
    setPage(1)
    fetchData()
  }, [selectedUser, dateDebut, dateFin])

  // New effect for shift detection when user is selected
  useEffect(() => {
    if (selectedUser) {
      handleUserShiftDetection(selectedUser)
    }
  }, [selectedUser])

  const handleUserShiftDetection = async (userId: string) => {
    try {
      const response = await axios.get(`${caisseEndpoint}get_user_shift/`, {
        params: { user_id: userId }
      })
      const { start_date, end_date, has_activity } = response.data
      
      if (has_activity && start_date) {
        const start = new Date(start_date)
        const end = end_date ? new Date(end_date) : new Date()
        
        setDetectedShift({ start, end, active: true })
        setDateDebut(start)
        setDateFin(end)
        toast.success(t('messages.shift_detected'))
      } else {
        setDetectedShift(null)
        // Default to whole day if no activity
        const today = getServerDate()
        today.setHours(0,0,0,0)
        const endToday = getServerDate()
        endToday.setHours(23,59,59,999)
        setDateDebut(today)
        setDateFin(endToday)
      }
    } catch (err) {
      console.error("Erreur détection shift:", err)
      setDetectedShift(null)
    }
  }

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
      setError(t('table.loading_error') || 'Erreur lors du chargement des données')
    } finally {
      setLoading(false)
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
    try {
      const params = new URLSearchParams()
      params.append('page', page.toString())
      if (selectedUser) params.append('user', selectedUser)
      
      const response = await axios.get(caisseEndpoint, { params })
      processTransactionsData(response.data)
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
                     
                     const totalAmount = releveItems.reduce((sum, item) => sum + normalizeNumberInput(item.montant), 0)
                     
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
       const montant = normalizeNumberInput(item.montant)
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
                // DO NOT add to totaux[mode] or totaux.total as per user request (Recoveries are not cash register operations)
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
    return date.toLocaleString(currentLocale, {
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
      const response = await axios.post(`${caisseEndpoint}cloturer/`, {
        montant_reel: normalizeNumberInput(actualAmount),
        date_debut: dateDebut ? formatLocalISOString(dateDebut) : null,
        date_fin: dateFin ? formatLocalISOString(dateFin) : null,
        user_id: selectedUser
      })
      
      toast.success(t('messages.close_success'))
      const completeData = response.data.cloture;
      setClosingTotals(completeData)
      
      // Automatiquement imprimer après succès
      setTimeout(() => {
          handleImprimerCloture(completeData);
      }, 500);
      
      setIsClosingModalOpen(false)
      fetchData()
    } catch (err: any) {
      console.error('Erreur clôture:', err)
      const errorMessage = err.response?.data?.detail || err.message || 'Erreur inconnue'
      setError(`${t('messages.close_error')}: ${errorMessage}`)
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleImprimerCloture = (dataToPrint?: any) => {
    const data = dataToPrint || closingTotals;
    if (!data) return

    const win = window.open('', '_blank', 'width=800,height=600')
    if (win) {
      const startStr = data.start_date ? new Date(data.start_date).toLocaleString(currentLocale) : '--'
      const endStr = data.date_fin ? new Date(data.date_fin).toLocaleString(currentLocale) : '--'
      
      const soldeOp = (data.total_ventes || 0) + (data.total_entrees || 0) - (data.total_sorties || 0)
      
      // Filter out technical keys for display
      const displayDetails = Object.entries(data.details || {}).filter(
        ([key]) => !key.startsWith('__') && key !== 'mouvements_audit' && key !== 'mouvements'
      );

      const movementsAudit = data.mouvements_audit || [];

      const content = `
        <div style="font-family: monospace; width: 80mm; margin: 0 auto; padding: 10px; color: black; line-height: 1.2;">
            <div style="text-align: center; margin-bottom: 10px; border-bottom: 2px solid black; padding-bottom: 5px;">
                <h2 style="margin: 0; font-size: 1.1em; font-weight: bold;">${pharmacySettings?.pharmacy_name || 'Ma Pharmacie'}</h2>
                <div style="font-size: 0.8em; margin-top: 2px;">${t('print.report_title')}</div>
            </div>

            <div style="font-size: 0.8em; margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between;">
                    <span>${t('print.print_date')}:</span>
                    <span>${new Date().toLocaleDateString(currentLocale)} ${new Date().toLocaleTimeString(currentLocale)}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>${t('print.operator')}:</span>
                    <span>${data.user || 'Admin'}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 5px; border-top: 1px dotted #ccc; padding-top: 5px;">
                    <span>${t('print.from')}: ${startStr}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>${t('print.to')}: ${endStr}</span>
                </div>
            </div>

            <div style="margin-bottom: 10px; background: #f9f9f9; padding: 5px; border: 1px solid #eee;">
                <div style="font-weight: bold; margin-bottom: 3px; border-bottom: 1px solid black; font-size: 0.85em;">${t('print.activity_title')}</div>
                <div style="display: flex; justify-content: space-between; font-size: 0.85em;">
                    <span>${t('print.net_sales')}</span>
                    <span>${formatCurrencyLocal(data.total_ventes)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.85em;">
                    <span>${t('print.misc_entries')}</span>
                    <span>${formatCurrencyLocal(data.total_entrees)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.85em;">
                    <span>${t('print.expenses')}</span>
                    <span>-${formatCurrencyLocal(data.total_sorties)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-weight: bold; border-top: 1px dashed black; margin-top: 3px; padding-top: 2px;">
                    <span>${t('print.solde_to_justify')}</span>
                    <span>${formatCurrencyLocal(soldeOp)}</span>
                </div>
            </div>

            ${movementsAudit.length > 0 ? `
            <div style="margin-bottom: 10px;">
                <div style="font-weight: bold; margin-bottom: 3px; border-bottom: 1px solid black; font-size: 0.85em;">${t('print.expense_details')}</div>
                ${movementsAudit.map((m: any) => `
                    <div style="display: flex; justify-content: space-between; font-size: 0.75em; margin-bottom: 2px;">
                        <span style="max-width: 70%;">${m.motif} (${m.user_nom})</span>
                        <span style="font-weight: bold;">${formatCurrencyLocal(m.montant)}</span>
                    </div>
                `).join('')}
            </div>
            ` : ''}

            <div style="margin-bottom: 15px;">
                <div style="font-weight: bold; margin-bottom: 3px; border-bottom: 1px solid black; font-size: 0.85em;">${t('print.mode_summary')}</div>
                ${displayDetails.map(([mode, montant]) => `
                    <div style="display: flex; justify-content: space-between; font-size: 0.8em; margin-bottom: 1px;">
                        <span style="text-transform: capitalize;">${mode}</span>
                        <span>${formatCurrencyLocal(normalizeNumberInput(montant as any))}</span>
                    </div>
                `).join('')}
            </div>

            <div style="border-top: 2px solid black; padding-top: 5px; margin-top: 5px;">
                <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 1.05em;">
                    <span>${t('print.total_to_justify')}</span>
                    <span>${formatCurrencyLocal(data.total_theorique)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.85em; margin-top: 3px;">
                    <span>${t('print.actual_amount')}</span>
                    <span>${actualAmount ? formatCurrencyLocal(normalizeNumberInput(actualAmount)) : '_________'}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-weight: bold; border-top: 1px solid black; margin-top: 3px; padding-top: 3px;">
                    <span>${t('print.cash_gap')}</span>
                    <span>${actualAmount ? formatCurrencyLocal(normalizeNumberInput(actualAmount) - data.total_theorique) : '_________'}</span>
                </div>
            </div>

            <div style="display: flex; justify-content: space-between; margin-top: 30px; font-size: 0.7em;">
                <div style="text-align: center; width: 45%;">
                    <p style="margin-bottom: 30px; border-bottom: 1px solid #ccc; padding-bottom: 2px;">${t('print.cashier')}</p>
                </div>
                <div style="text-align: center; width: 45%;">
                    <p style="margin-bottom: 30px; border-bottom: 1px solid #ccc; padding-bottom: 2px;">${t('print.manager')}</p>
                </div>
            </div>
            
            <div style="text-align: center; font-size: 0.6em; margin-top: 15px; font-style: italic; opacity: 0.5;">
                ${t('print.footer', { date: new Date().toLocaleDateString(currentLocale) })}
            </div>
        </div>
      `;
      
      win.document.write('<html><head><title>' + t('print.window_title') + '</title>');
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
      <div className="bg-base-100 border-b border-base-200 shrink-0 p-6 sticky-header">
        <div className="flex flex-col xl:flex-row gap-6 justify-between items-start xl:items-end">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-base-content flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg text-primary shrink-0">
                <Banknote className="w-6 h-6" />
              </div>
              <span className="truncate">{t('title')}</span>
            </h1>
            <div className="text-base-content/60 mt-1 pl-0 md:pl-12 text-xs md:text-sm flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>{t('subtitle')}</span>
                <span className="hidden md:inline w-1 h-1 rounded-full bg-base-300"></span>
                <span className="font-mono text-primary font-semibold">{t('operations_count', { count: totalCount })}</span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-nowrap gap-3 items-end w-full lg:w-auto mt-4 xl:mt-0">
             <div className="relative w-full lg:w-48">
                <input
                    type="text"
                    placeholder={t('search_placeholder')}
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
                    <option value="all">{t('all_modes')}</option>
                    <option value="especes">💵 {t('common:payment_modes.especes')}</option>
                    <option value="cheque">✍️ {t('common:payment_modes.cheque')}</option>
                    <option value="carte">💳 {t('common:payment_modes.carte')}</option>
                    <option value="virement">🏦 {t('common:payment_modes.virement')}</option>
                    <option value="om">📶 {t('common:payment_modes.om')}</option>
                    <option value="momo">📶 {t('common:payment_modes.momo')}</option>
                </select>
             </div>

             <div className="form-control w-full lg:w-40">
                <select
                    value={selectedUser}
                    onChange={(e) => setSelectedUser(e.target.value)}
                    className="select select-bordered select-sm w-full bg-base-50 font-medium"
                >
                    <option value="">👤 {t('all_cashiers')}</option>
                    {users.map((u: any) => (
                        <option key={u.id} value={u.id}>
                            {u.first_name ? `${u.first_name} ${u.last_name || ''}` : u.username}
                        </option>
                    ))}
                </select>
             </div>

             <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 bg-base-50 border border-base-200 rounded-lg p-1 w-full lg:w-auto justify-between sm:justify-start">
                 <DatePicker
                    selected={dateDebut}
                    onChange={(date: Date | null) => setDateDebut(date)}
                    showTimeSelect
                    timeFormat="HH:mm"
                    dateFormat="dd/MM/yy HH:mm"
                    placeholderText={t('date_start')}
                    locale="fr"
                     className="w-28 text-xs bg-transparent focus:outline-none cursor-pointer text-center font-medium"
                    isClearable
                 />
                 {detectedShift?.active && (
                    <div className="flex flex-col items-center justify-center px-1 border-x border-base-200">
                        <span className="text-[8px] font-black text-primary uppercase leading-none">Shift</span>
                        <div className="w-1 h-1 rounded-full bg-primary animate-pulse mt-0.5"></div>
                    </div>
                 )}
                 <DatePicker
                    selected={dateFin}
                    onChange={(date: Date | null) => setDateFin(date)}
                    showTimeSelect
                    timeFormat="HH:mm"
                    dateFormat="dd/MM/yy HH:mm"
                    placeholderText={t('date_end')}
                    locale="fr"
                    className="w-28 text-xs bg-transparent focus:outline-none cursor-pointer text-center font-medium"
                    isClearable
                 />
                 <button
                    onClick={() => {
                        const today = getServerDate()
                        today.setHours(0, 0, 0, 0)
                        const endToday = getServerDate()
                        endToday.setHours(23, 59, 59, 999)
                        setDateDebut(today)
                        setDateFin(endToday)
                    }}
                    className="btn btn-xs btn-ghost text-primary px-1 sm:px-2"
                    title={t('today')}
                 >
                    {t('today_short') || 'Auj.'}
                  </button>
             </div>

             <div className="flex gap-2 w-full lg:w-nowrap justify-end sm:justify-start">
                <button
                    onClick={fetchData}
                    className="btn btn-sm btn-ghost btn-square"
                    disabled={loading}
                    title={t('refresh')}
                >
                    {loading ? <span className="loading loading-spinner loading-xs"></span> : <RefreshCw className="w-4 h-4 text-base-content/70" />}
                </button>
                <div className="h-8 w-px bg-base-200 mx-1"></div>
                <button
                    onClick={() => setIsMovementModalOpen(true)}
                    className="btn btn-sm btn-outline border-base-300 btn-primary gap-2 flex-1 sm:flex-none"
                >
                    <Plus className="w-4 h-4" /> <span className="sm:inline">{t('new_operation')}</span>
                </button>
                <button
                    onClick={openClosingModal}
                    className="btn btn-sm btn-primary shadow-sm gap-2 flex-1 sm:flex-none"
                    disabled={loading || !selectedUser}
                    title={!selectedUser ? t('messages.no_cashier_selected') : t('close_register')}
                >
                    <Lock className="w-4 h-4" /> <span className="sm:inline">{t('close_register')}</span>
                </button>
             </div>
          </div>
        </div>

        {/* Status Filters Bar */}
        <div className="mt-4 pt-4 border-t border-base-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="join bg-base-50 p-1 rounded-lg border border-base-200 w-full sm:w-auto overflow-x-auto">
                <button 
                    className={`join-item btn btn-sm border-none font-medium px-6 ${filterType === 'all' ? 'bg-base-100 shadow-sm text-base-content' : 'bg-transparent text-base-content/60 hover:text-base-content'}`}
                    onClick={() => setFilterType('all')}
                >
                    {t('filter.all')}
                </button>
                <button 
                    className={`join-item btn btn-sm border-none font-medium px-6 flex items-center gap-1 ${filterType === 'entrees' ? 'bg-success text-white shadow-sm' : 'bg-transparent text-success/70 hover:text-success'}`}
                    onClick={() => setFilterType('entrees')}
                >
                    <ArrowUpRight className="w-4 h-4" /> {t('filter.entries')}
                </button>
                <button 
                    className={`join-item btn btn-sm border-none font-medium px-6 flex items-center gap-1 ${filterType === 'sorties' ? 'bg-error text-white shadow-sm' : 'bg-transparent text-error/70 hover:text-error'}`}
                    onClick={() => setFilterType('sorties')}
                >
                    <ArrowDownRight className="w-4 h-4" /> {t('filter.exits')}
                </button>
           </div>
        </div>
      </div>

      {/* Global Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 p-4 md:p-6 pb-2 shrink-0">
          {/* Card 1: Sales */}
          <div className="bg-base-100 p-5 rounded-xl border border-base-200 shadow-sm flex flex-col justify-center">
              <div className="flex justify-between items-start">
                  <div>
                      <h3 className="text-base-content/60 text-xs font-bold uppercase tracking-wider mb-1">{t('stats.net_sales')}</h3>
                      <div className="text-2xl font-black text-primary">{formatCurrency(serverTotals?.total_ventes ?? totauxParMode.ventes)}</div>
                      <div className="text-[10px] text-base-content/40 mt-1 font-medium">{t('stats.ca_real')}</div>
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
                        <h3 className="text-base-content/60 text-[10px] font-bold uppercase tracking-wider">{t('stats.recoveries')}</h3>
                        <span className="badge badge-ghost badge-xs text-[8px] uppercase font-bold opacity-50">{t('stats.memo')}</span>
                      </div>
                      <div className="text-xl font-bold text-base-content/70">{formatCurrency(serverTotals?.total_recouvrement ?? totauxParMode.recouvrement)}</div>
                      <div className="text-[9px] text-base-content/40 mt-1 font-medium">{t('stats.debt_collection')}</div>
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
                      <h3 className="text-success text-xs font-black uppercase tracking-wider mb-1">{t('stats.cash_to_justify')}</h3>
                      <div className="text-2xl font-black text-success">{formatCurrency(serverTotals?.total_theorique ?? totauxParMode.total)}</div>
                      <div className="text-[10px] text-success/60 font-medium mt-1 uppercase italic">{t('stats.cash_formula')}</div>
                  </div>
                  <div className="p-3 bg-success/10 rounded-lg text-success">
                     <Banknote className="w-5 h-5" />
                  </div>
              </div>
          </div>

          {/* Card 4: Digital / Mobile Money */}
          <div className="bg-base-100 p-5 rounded-xl border border-base-200 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start">
                  <h3 className="text-base-content/60 text-xs font-bold uppercase tracking-wider mb-1">{t('stats.mobile_payments')}</h3>
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
                      <h3 className="text-base-content/60 text-xs font-bold uppercase tracking-wider mb-1">{t('stats.bank_digital')}</h3>
                      <div className="text-xl font-bold text-info">{formatCurrency((serverTotals?.details?.carte || 0) + (serverTotals?.details?.cheque || 0) + (serverTotals?.details?.virement || 0) || (totauxParMode.ventes_par_mode.carte + totauxParMode.ventes_par_mode.cheque + totauxParMode.ventes_par_mode.virement))}</div>
                      <div className="text-[10px] text-base-content/40 mt-1 font-medium uppercase text-xs">{t('stats.non_cash_sales')}</div>
                  </div>
                  <div className="p-3 bg-info/10 rounded-lg text-info">
                     <CreditCard className="w-5 h-5" />
                  </div>
              </div>
          </div>
      </div>

      {/* Adaptive Details Bar: Only show if there are secondary payments or movements */}
      <div className="px-6 flex flex-wrap gap-2 items-center mb-4 min-h-[32px]">
          <span className="text-[10px] font-black uppercase text-base-content/40 mr-2">{t('stats.flow_details')}</span>
          
          {/* Part 1: Sales breakdown - using server totals details if avail */}
          {Object.entries(serverTotals?.details || totauxParMode.ventes_par_mode).map(([mode, value]) => {
              const numValue = normalizeNumberInput(value);
              if (numValue === 0) return null;
              
              const labels: Record<string, {label: string, color: string}> = {
                  especes: { label: t('common:payment_modes.especes'), color: 'success' },
                  cheque: { label: t('common:payment_modes.cheque'), color: 'info' },
                  carte: { label: t('common:payment_modes.carte'), color: 'info' },
                  virement: { label: t('common:payment_modes.virement'), color: 'info' },
                  om: { label: 'O.M.', color: 'warning' },
                  momo: { label: 'MoMo', color: 'warning' },
                  recouvrement: { label: t('common:payment_modes.recouvrement'), color: 'primary' }
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
                  <span className="opacity-60">{t('filter.entries')}:</span>
                  <span>{formatCurrency(serverTotals?.total_entrees ?? totauxParMode.entrees)}</span>
              </div>
          )}
          {(serverTotals?.total_sorties ?? totauxParMode.sorties) !== 0 && (
              <div className="badge badge-error badge-outline gap-2 p-3 text-[10px] font-bold text-error/80">
                  <ArrowDownRight className="w-3 h-3" />
                  <span className="opacity-60">{t('filter.exits')}:</span>
                  <span>{formatCurrency(serverTotals?.total_sorties ?? totauxParMode.sorties)}</span>
              </div>
          )}

          {/* Performance Summary Bar: Strictly Interval Operations */}
          <div className="flex items-center gap-0">
              {/* Part 1: Breakdown (Ventes + Flux) */}
              <div className="flex items-center gap-4 bg-base-200 py-2 px-6 rounded-l-full border border-base-300">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black uppercase opacity-50">{t('stats.interval_activity')}</span>
                    <span className="text-sm font-bold text-base-content">{formatCurrency((serverTotals?.total_ventes ?? totauxParMode.ventes) + (serverTotals?.total_entrees ?? totauxParMode.entrees))}</span>
                  </div>
                  <div className="w-px h-6 bg-base-300"></div>
                  <div className="flex flex-col opacity-60">
                    <span className="text-[9px] font-black uppercase italic">{t('stats.expenses')}</span>
                    <span className="text-sm font-bold">-{formatCurrency(serverTotals?.total_sorties ?? totauxParMode.sorties)}</span>
                  </div>
              </div>

              {/* Final Operational Balance */}
              <div className="flex items-center gap-4 bg-primary text-white py-2 px-6 rounded-r-emerald-none rounded-r-full shadow-xl shadow-primary/20 flex-1 sm:flex-none justify-center sm:justify-start">
                  <div className="flex flex-col items-start">
                     <span className="text-[10px] font-black uppercase opacity-70 tracking-wider leading-tight">{t('stats.net_operational_balance')}</span>
                     <span className="text-[8px] opacity-60 uppercase font-bold">{t('stats.excluding_recoveries')}</span>
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
                    <p className="text-base-content/60 font-medium animate-pulse">{t('table.loading')}</p>
                </div>
            ) : filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-base-content/30 gap-3">
                    <span className="text-6xl opacity-20">📂</span>
                    <p className="text-lg font-medium italic">{t('table.no_transaction')}</p>
                </div>
            ) : (
                <table className="table table-sm w-full border-separate border-spacing-0">
                    <thead className="sticky top-0 z-30 bg-base-200 opacity-100">
                        <tr className="border-b border-base-300">
                            <th className="border-b-2 border-base-200 text-xs font-bold text-base-content/50 py-3 pl-6">{t('table.date_time')}</th>
                            <th className="border-b-2 border-base-200 text-xs font-bold text-base-content/50 py-3">{t('table.cashier')}</th>
                            <th className="border-b-2 border-base-200 text-xs font-bold text-base-content/50 py-3">{t('table.entered_by')}</th>
                            <th className="border-b-2 border-base-200 text-xs font-bold text-base-content/50 py-3">{t('table.client_label')}</th>
                            <th className="border-b-2 border-base-200 text-xs font-bold text-base-content/50 py-3">{t('table.piece_num')}</th>
                            <th className="border-b-2 border-base-200 text-xs font-bold text-base-content/50 py-3 text-right">{t('table.amount')}</th>
                            <th className="border-b-2 border-base-200 text-xs font-bold text-base-content/50 py-3">{t('table.mode')}</th>
                            <th className="border-b-2 border-base-200 text-xs font-bold text-base-content/50 py-3 pr-6 text-right">{t('table.status')}</th>
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
                                                    <span className="font-bold text-sm text-base-content">{mouv.user_nom || t('table.user')}</span>
                                                    <span className="text-[10px] text-base-content/50 uppercase tracking-wider font-bold">{t('table.operation')}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4">
                                            <span className="text-xs text-base-content/30 italic">-</span>
                                        </td>
                                        <td className="py-4">
                                            <div className="font-bold text-sm text-base-content">{mouv.motif}</div>
                                            <div className="text-xs text-base-content/50 italic max-w-xs truncate" title={mouv.description}>{mouv.description || t('table.no_description')}</div>
                                        </td>
                                        <td className="font-mono text-[10px] py-4 opacity-50">MOUV-{mouv.id}</td>
                                        <td className={`text-right font-black text-base py-4 ${mouv.type === 'ENTREE' ? 'text-success' : 'text-error'}`}>
                                            {mouv.type === 'ENTREE' ? '+' : '-'}{formatCurrencyLocal(normalizeNumberInput(mouv.montant))}
                                        </td>
                                        <td className="py-4">
                                            <div className={`badge badge-sm font-bold gap-1 py-1 px-2 border-none ${mouv.type === 'ENTREE' ? 'bg-success text-white' : 'bg-error text-white'}`}>
                                                {mouv.type === 'ENTREE' ? t('filter_caps.entry') || 'ENTRÉE' : t('filter_caps.exit') || 'SORTIE'}
                                            </div>
                                        </td>
                                        <td className="py-4 pr-6 text-right">
                                            <span className="inline-flex items-center gap-1 text-success font-bold text-[10px] bg-success/10 px-2 py-1 rounded-md uppercase">
                                                {t('table.validated')}
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
                                                        {isExpanded ? '▼' : '▶'} {t('table.grouped_releve')}
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
                                                        {transaction.user_details?.full_name || t('common.unknown') || 'Inconnu'}
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
                                                    <span className="badge badge-sm badge-info text-white font-bold text-[9px] px-1.5">{t('common.creance') || 'CRÉANCE'}</span>
                                                )}
                                            </div>
                                            {transaction.isReleveGroup && (
                                                <div className="text-[10px] text-primary font-bold mt-1">Réf: {transaction.releve_reference}</div>
                                            )}
                                        </td>
                                        <td className="font-mono text-xs py-4">
                                            {transaction.isReleveGroup ? (
                                                <span className="text-primary/70 font-bold italic">{transaction.items?.length} {t('common.pieces') || 'pièces'}</span>
                                            ) : (
                                                <span className="bg-base-200 px-2 py-1 rounded font-bold text-base-content/60">{transaction.facture_numero || '-'}</span>
                                            )}
                                        </td>
                                        <td className="text-right font-black text-base py-4 text-base-content">
                                            {formatCurrencyLocal(normalizeNumberInput(transaction.montant))}
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
                                                            {isRecouvrement ? '💸' : getModeIcon(transaction.mode_paiement)} {isRecouvrement ? t('common:payment_modes.recouvrement_caps') || 'RECOUVREMENT' : transaction.mode_paiement_display?.toUpperCase()}
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
                                                <span className="inline-flex items-center text-success font-bold text-[10px] bg-success/10 px-2 py-1 rounded-md uppercase">{t('table.paid')}</span>
                                            ) : transaction.statut === 'annulee' ? (
                                                <span className="inline-flex items-center text-error font-bold text-[10px] bg-error/10 px-2 py-1 rounded-md uppercase">{t('table.cancelled')}</span>
                                            ) : (
                                                <span className="inline-flex items-center text-warning font-bold text-[10px] bg-warning/10 px-2 py-1 rounded-md uppercase">{t('table.pending')}</span>
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
                                                {formatCurrencyLocal(normalizeNumberInput(subItem.montant))}
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
                {t('pagination.showing')} <span className="text-base-content">{filteredItems.length}</span> {filteredItems.length > 1 ? t('pagination.lines_plural') : t('pagination.lines')} {t('pagination.of')} <span className="text-base-content">{totalCount}</span> {t('pagination.total')}
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
                            {t('common:pagination.prev')}
                        </button>
                        <button 
                            className="btn btn-sm px-4 bg-white hover:bg-base-200 border-base-300 shadow-sm transition-all" 
                            disabled={page >= totalPages} 
                            onClick={() => setPage(page + 1)}
                        >
                            {t('common:pagination.next')}
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
            <h3 className="font-black text-2xl tracking-tight">{t('closing.title')}</h3>
            <p className="text-primary-content/80 text-xs mt-1 font-bold uppercase tracking-widest">{t('closing.security')}</p>
          </div>
          
          <div className="p-8 space-y-6">
            {closingTotals && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-3">
                        <div className="p-5 bg-primary/5 border border-primary/20 rounded-xl shadow-sm text-center">
                            <div className="text-[10px] font-black text-primary/60 uppercase mb-1 tracking-widest">{t('stats.net_operational_balance')}</div>
                            <div className="text-3xl font-black text-primary">{formatCurrencyLocal(Math.round(closingTotals.total_ventes + closingTotals.total_entrees - closingTotals.total_sorties))}</div>
                            <div className="text-[10px] font-bold text-primary/40 mt-1 uppercase">{t('stats.cash_formula')}</div>
                        </div>
                        <div className="p-4 bg-success/5 border border-success/20 rounded-xl text-center">
                            <div className="text-[9px] font-black text-success/60 uppercase mb-1 tracking-widest">{t('stats.cash_to_justify')}</div>
                            <div className="text-2xl font-black text-success">{formatCurrencyLocal(Math.round(closingTotals.total_theorique))}</div>
                            <div className="text-[10px] font-bold text-success/40 mt-1 uppercase">{t('stats.cash_formula')}</div>
                        </div>
                    </div>

                    <div className="form-control w-full">
                        <label className="label py-1">
                            <span className="label-text text-xs font-black text-base-content/50 uppercase">{t('closing.real_amount')}</span>
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
                            <span className="absolute right-6 top-1/2 -translate-y-1/2 font-black text-base-content/20">{t('common:currency')}</span>
                        </div>
                        <div className="mt-4 flex items-center justify-between p-3 bg-base-200 rounded-lg">
                            <span className="text-xs font-bold text-base-content/60 uppercase">{t('closing.cash_gap')}</span>
                            <span className={`text-sm font-black ${
                                !actualAmount ? 'text-base-content/20' : 
                                (normalizeNumberInput(actualAmount) - closingTotals.total_theorique) >= 0 ? 'text-success' : 'text-error'
                            }`}>
                                {actualAmount ? formatCurrencyLocal(normalizeNumberInput(actualAmount) - closingTotals.total_theorique) : '---'}
                            </span>
                        </div>
                    </div>

                    <div className="collapse collapse-arrow bg-base-100 border border-base-200 rounded-xl">
                        <input type="checkbox" /> 
                        <div className="collapse-title text-sm font-bold flex items-center gap-2">
                           📊 {t('closing.mode_details')}
                        </div>
                        <div className="collapse-content"> 
                            <div className="space-y-2 pt-2 border-t border-base-200 mt-2">
                                {Object.entries(closingTotals.details).filter(([,v]) => v !== 0).map(([mode, montant]) => (
                                <div key={mode} className="flex items-center justify-between text-xs">
                                    <span className="font-medium text-base-content/60 capitalize ">{mode}</span>
                                    <span className="font-black text-base-content">{formatCurrencyLocal(Math.round(montant))}</span>
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
                    {loading ? <span className="loading loading-spinner"></span> : t('closing.confirm')}
                </button>
                <div className="grid grid-cols-2 gap-3">
                    <button className="btn btn-outline border-base-300 font-bold flex items-center justify-center gap-2" onClick={handleImprimerCloture}>
                        <Printer className="w-5 h-5" /> {t('closing.ticket')}
                    </button>
                    <button className="btn btn-ghost font-bold opacity-50" onClick={() => setIsClosingModalOpen(false)}>
                        {t('common:cancel')}
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
