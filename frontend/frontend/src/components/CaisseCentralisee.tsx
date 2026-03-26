import { useState, useEffect, useCallback, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { toast } from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { usePharmacySettings } from '../hooks/usePharmacySettings'
import { formatCurrency } from '../utils/formatters'
import type { Facture, TicketCaisse, CouponMonnaie } from '../types'
import PasswordConfirmModal from './PasswordConfirmModal'
import { PaymentModal } from './caisse/PaymentModal'
import { FacturesTable } from './caisse/FacturesTable'
import { CouponPanel } from './caisse/CouponPanel'
import { useTranslation } from 'react-i18next'
import PremiumModal from './common/PremiumModal'
import { TicketTemplate } from './printing/TicketTemplate'
import { RefreshCw, Ticket, Banknote, Clock, Keyboard } from 'lucide-react'

// TicketTemplate is used for preview and print

export default function CaisseCentralisee() {
  const queryClient = useQueryClient()
  const { t } = useTranslation('caisse')
  const navigate = useNavigate()
  const { user } = useAuth()
  const { settings: pharmacySettings } = usePharmacySettings()
  const [facturesEnAttente, setFacturesEnAttente] = useState<Facture[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedFacture, setSelectedFacture] = useState<Facture | null>(null)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [ticketCaisse, setTicketCaisse] = useState<TicketCaisse | null>(null)
  const [showTicketPreview, setShowTicketPreview] = useState(false)
  
  // États pour les coupons
  const [coupons, setCoupons] = useState<CouponMonnaie[]>([])
  const [isCouponPanelOpen, setIsCouponPanelOpen] = useState(false)
  const [isGenererCouponModalOpen, setIsGenererCouponModalOpen] = useState(false)
  const [nouveauCouponMontant, setNouveauCouponMontant] = useState('')
  const [nouveauCouponNotes, setNouveauCouponNotes] = useState('')
  const [searchCouponNumero, setSearchCouponNumero] = useState('')
  const [couponTrouve, setCouponTrouve] = useState<CouponMonnaie | null>(null)
  const [isDetailsCouponModalOpen, setIsDetailsCouponModalOpen] = useState(false)
  const [isSudoModalOpen, setIsSudoModalOpen] = useState(false)
  
  
  // Coupon à appliquer PAR VENTE (clé = factureId, valeur = coupon)
  const [couponsParFacture, setCouponsParFacture] = useState<Record<number, CouponMonnaie>>({})
  // Modal pour sélectionner un coupon pour une facture spécifique
  const [factureForCoupon, setFactureForCoupon] = useState<Facture | null>(null)
  
  // État pour la navigation clavier (mouse killing)
  const [selectedRowIndex, setSelectedRowIndex] = useState<number>(0)

  const apiBaseUrl = useMemo(() => (import.meta.env.VITE_API_BASE_URL ?? ''), [])

  // Fonction pour récupérer les factures en attente
  const fetchFacturesEnAttente = useCallback(async () => {
    try {
      const facturesEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/factures/` : '/api/factures/'
      
      // Fetch list of pending invoices
      const response = await axios.get(`${facturesEndpoint}?status__in=BROU,VAL&include_pending=true`)
      const facturesList = response.data.results || response.data || []
      
      // Fetch full details for each invoice to get products
      const facturesWithDetails = await Promise.all(
        facturesList.map(async (facture: Facture) => {
          try {
            const detailResponse = await axios.get(`${facturesEndpoint}${facture.id}/`)
            // Preserve session_ticket_number from list response (assigned by backend)
            return { 
              ...detailResponse.data, 
              session_ticket_number: facture.session_ticket_number 
            }
          } catch (err) {
            console.error(`Failed to fetch details for invoice ${facture.id}:`, err)
            return facture // Fallback to list data
          }
        })
      )
      
      setFacturesEnAttente(facturesWithDetails)
    } catch (err) {
      console.error('Erreur lors du chargement des factures en attente:', err)
    }
  }, [apiBaseUrl])


  // Fonction pour récupérer les coupons (actifs + récemment utilisés)
  const fetchCoupons = useCallback(async () => {
    try {
      const endpoint = apiBaseUrl ? `${apiBaseUrl}/api/coupons/` : '/api/coupons/'
      // Récupérer tous les coupons récents (triés par date de création décroissante)
      const response = await axios.get(`${endpoint}?ordering=-date_creation&page_size=50`)
      setCoupons(response.data.results || response.data || [])
    } catch (err) {
      console.error('Erreur lors du chargement des coupons:', err)
    }
  }, [apiBaseUrl])

  // Rafraîchissement automatique toutes les 20 secondes
  useEffect(() => {
    fetchFacturesEnAttente()
    fetchCoupons()
    const interval = setInterval(() => {
      fetchFacturesEnAttente()
      fetchCoupons()
    }, 20000)
    return () => clearInterval(interval)
  }, [fetchFacturesEnAttente, fetchCoupons])

  // Générer un nouveau coupon (après validation sudo)
  const handleGenererCoupon = async () => {
    if (!nouveauCouponMontant || Number(nouveauCouponMontant) <= 0) {
      toast.error(t('messages.invalid_amount'))
      return
    }

      setLoading(true)
    try {
      const endpoint = apiBaseUrl ? `${apiBaseUrl}/api/coupons/` : '/api/coupons/'
      const payload = {
        montant: Number(nouveauCouponMontant),
        notes: nouveauCouponNotes,
        facture_origine: selectedFacture?.id || null
      }
      
      const { data } = await axios.post<CouponMonnaie>(endpoint, payload)
      toast.success(t('messages.coupon_generated', { numero: data.numero }))
      
      setCoupons([data, ...coupons])
      setIsGenererCouponModalOpen(false)
      setNouveauCouponMontant('')
      setNouveauCouponNotes('')
      
      // Ouvrir un aperçu pour impression
      setCouponTrouve(data)
      setIsDetailsCouponModalOpen(true)
    } catch (err: any) {
      console.error('Erreur génération coupon:', err)
      toast.error(err.response?.data?.detail || t('messages.error_generation'))
    } finally {
      setLoading(false)
    }
  }

  // Appliquer un coupon à UNE vente spécifique
  const handleAppliquerCouponAFacture = (coupon: CouponMonnaie, facture: Facture) => {
    if (coupon.status !== 'ACTIF') {
      toast.error(t('messages.coupon_not_active'))
      return
    }
    // Vérifier si ce coupon est déjà appliqué à une autre facture
    const existingFactureId = Object.keys(couponsParFacture).find(
      id => couponsParFacture[Number(id)]?.id === coupon.id
    )
    if (existingFactureId && Number(existingFactureId) !== facture.id) {
      toast.error(t('messages.coupon_already_applied'))
      return
    }
    
    setCouponsParFacture(prev => ({ ...prev, [facture.id]: coupon }))
    setFactureForCoupon(null)
    setIsDetailsCouponModalOpen(false)
    setCouponTrouve(null)
    toast.success(t('messages.coupon_applied_to', { numero: coupon.numero, ticket: facture.session_ticket_number || facture.numero_facture }))
  }
  
  // Retirer le coupon d'une facture spécifique
  const handleRetirerCouponDeFacture = (factureId: number) => {
    setCouponsParFacture(prev => {
      const updated = { ...prev }
      delete updated[factureId]
      return updated
    })
    toast(t('messages.coupon_removed'), { icon: '🗑️' })
  }
  
  // Ouvrir le panneau pour sélectionner un coupon pour une facture
  const openCouponSelectionForFacture = (facture: Facture) => {
    setFactureForCoupon(facture)
    setIsCouponPanelOpen(true)
  }

  // Utiliser réellement le coupon (appelé après encaissement réussi)
  const utiliserCouponApresEncaissement = async (couponId: number, factureId: number) => {
    try {
      const endpoint = apiBaseUrl ? `${apiBaseUrl}/api/coupons/${couponId}/utiliser/` : `/api/coupons/${couponId}/utiliser/`
      await axios.post(endpoint, { facture_id: factureId })
      fetchCoupons()
    } catch (err: any) {
      console.error('Erreur utilisation coupon:', err)
      // Ne pas bloquer - le paiement a réussi
    }
  }

  // Rechercher un coupon par numéro
  const handleRechercherCoupon = async () => {
    if (!searchCouponNumero) return

    try {
      const endpoint = apiBaseUrl ? `${apiBaseUrl}/api/coupons/` : '/api/coupons/'
      const response = await axios.get(`${endpoint}?search=${searchCouponNumero}`)
      const results = response.data.results || response.data || []
      
      if (results.length > 0) {
        setCouponTrouve(results[0])
        setIsDetailsCouponModalOpen(true)
      } else {
        toast.error(t('messages.coupon_not_found'))
      }
    } catch (err) {
      console.error('Erreur recherche coupon:', err)
      toast.error(t('messages.search_error'))
    }
  }

  // Trier les factures par date chronologique (plus ancienne en premier)
  const sortedFactures = useMemo(() => 
    [...facturesEnAttente].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [facturesEnAttente]
  )

  // Ouvrir la modale de paiement (useCallback pour les raccourcis clavier)
  const handleEncaisser = useCallback((facture: Facture) => {
    setSelectedFacture(facture)
    setIsPaymentModalOpen(true)
  }, [])

  // Raccourcis clavier (mouse killing)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorer si une modale est ouverte ou si l'utilisateur tape dans un champ
      if (isPaymentModalOpen || isGenererCouponModalOpen || isDetailsCouponModalOpen || isSudoModalOpen) {
        // Escape pour fermer les modales
        if (e.key === 'Escape') {
          setIsPaymentModalOpen(false)
          setIsGenererCouponModalOpen(false)
          setIsDetailsCouponModalOpen(false)
          setShowTicketPreview(false)
        }
        return
      }
      if (showTicketPreview && e.key === 'Escape') {
        setShowTicketPreview(false)
        return
      }
      
      // Si l'utilisateur tape dans un input, ignorer
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      // Navigation avec flèches
      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault()
        setSelectedRowIndex(prev => Math.min(prev + 1, sortedFactures.length - 1))
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault()
        setSelectedRowIndex(prev => Math.max(prev - 1, 0))
      }
      // Enter pour encaisser la vente sélectionnée
      else if (e.key === 'Enter' && sortedFactures.length > 0) {
        e.preventDefault()
        const facture = sortedFactures[selectedRowIndex]
        if (facture && ((user as any)?.can_cash_out || user?.is_superuser)) {
          handleEncaisser(facture)
        }
      }
      // C pour ouvrir le panneau des coupons
      else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault()
        if (sortedFactures.length > 0) {
          openCouponSelectionForFacture(sortedFactures[selectedRowIndex])
        }
      }
      // R pour rafraîchir
      else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        fetchFacturesEnAttente()
        fetchCoupons()
        toast.success(t('messages.refreshed'))
      }
      // Escape pour fermer le panneau coupons
      else if (e.key === 'Escape') {
        if (isCouponPanelOpen) {
          setIsCouponPanelOpen(false)
          setFactureForCoupon(null)
        }
      }
      // 1-9 pour sélectionner directement une vente
      else if (e.key >= '1' && e.key <= '9') {
        const index = parseInt(e.key) - 1
        if (index < sortedFactures.length) {
          setSelectedRowIndex(index)
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [sortedFactures, selectedRowIndex, isPaymentModalOpen, isGenererCouponModalOpen, isDetailsCouponModalOpen, isSudoModalOpen, showTicketPreview, isCouponPanelOpen, user, handleEncaisser, openCouponSelectionForFacture, fetchFacturesEnAttente, fetchCoupons])

  // Garder l'index valide quand la liste change
  useEffect(() => {
    if (selectedRowIndex >= facturesEnAttente.length && facturesEnAttente.length > 0) {
      setSelectedRowIndex(facturesEnAttente.length - 1)
    }
  }, [facturesEnAttente.length, selectedRowIndex])

  // Enregistrer le paiement
  // Enregistrer le paiement
  const enregistrerPaiement = async (paiementsValides: { mode: string; montant: number }[]) => {
    if (!selectedFacture) return

    // Calculer le total des paiements
    const montantTotal = paiementsValides.reduce((acc, p) => acc + p.montant, 0)

    if (montantTotal === 0) {
      toast.error(t('messages.invalid_amount'))
      return
    }

    setLoading(true)

    try {
      const facturesEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/factures/` : '/api/factures/'
      const caisseEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/caisse/` : '/api/caisse/'

      // 1. Valider la facture si elle n'est pas déjà validée
      let factureValidee = selectedFacture
      if (selectedFacture.status !== 'VAL' && selectedFacture.status !== 'VALIDEE') {
        const validerEndpoint = `${facturesEndpoint}${selectedFacture.id}/valider/`
        const { data } = await axios.post<Facture>(validerEndpoint, {})
        factureValidee = data
      }

      // Déterminer le montant réel à encaisser (en tenant compte des paiements déjà effectués comme les coupons)
      // Le backend calcule automatiquement reste_a_payer = total_ttc - paiements_deja_effectues
      const montantAEncaisser = factureValidee.reste_a_payer !== undefined && factureValidee.reste_a_payer !== null
        ? Number(factureValidee.reste_a_payer)
        : (factureValidee.part_client !== null && Number(factureValidee.part_client) >= 0
            ? Number(factureValidee.part_client)
            : Number(factureValidee.total_ttc))

      // 2. Enregistrer les paiements
      let resteAEnregistrer = montantAEncaisser;
      
      // Ajouter le paiement par coupon si présent
      const couponUtilise = couponsParFacture[factureValidee.id]
      if (couponUtilise) {
        const couponPayload: any = {
          facture: factureValidee.id,
          mode_paiement: 'coupon',
          montant: couponUtilise.montant,
          reference: `COUPON-${couponUtilise.numero}`,
          statut: 'completee',
        }
        await axios.post(caisseEndpoint, couponPayload)
        // Le coupon est déjà déduit de montantAEncaisser dans le frontend
      }

      for (const paiement of paiementsValides) {
        if (resteAEnregistrer <= 0) break;

        const montantReel = Math.min(paiement.montant, resteAEnregistrer);

        const paiementPayload: any = {
          facture: factureValidee.id,
          mode_paiement: paiement.mode,
          montant: montantReel,
          reference: null,
          statut: 'completee',
        }

        // Si tiers payant, marquer comme paiement de la part patient
        const hasTiersPayant = factureValidee.part_client !== null && Number(factureValidee.part_client) >= 0
        if (hasTiersPayant) {
          paiementPayload.part_patient = montantReel
          paiementPayload.part_assurance = 0
        }

        await axios.post(caisseEndpoint, paiementPayload)
        resteAEnregistrer -= montantReel;
      }

      // 3. Mettre à jour le statut à PAYEE
      const factureUpdateEndpoint = `${facturesEndpoint}${factureValidee.id}/`
      await axios.patch(factureUpdateEndpoint, { status: 'PAY' })

      // 4. Récupérer la facture finale
      const { data: factureFinale } = await axios.get<Facture>(factureUpdateEndpoint)

      // 5. Créer le ticket de caisse (calculer le rendu sur la base du montant encaissé, pas du total)
      const rendu = montantTotal - montantAEncaisser
      
      // Priorité: client_name_override > client_name > 'Client de passage'
      const clientNameForTicket = factureFinale.client_name_override 
          || factureFinale.client_name 
          || 'Client de passage';
      
      setTicketCaisse({
        id: factureFinale.id,
        facture: factureFinale,
        mode_paiement: paiementsValides.length > 1 ? 'Mixte' : (paiementsValides[0]?.mode || 'especes'),
        montant: factureFinale.total_ttc,
        montant_verse: montantTotal.toString(),
        rendu: rendu.toString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        statut: 'completee',
        date_paiement: new Date().toISOString(),
        client_name: clientNameForTicket,
        paiements_details: (factureFinale as any).paiements || [],
        user_details: user,
        reference: null
      } as any)

      // 6. Fermer la modale de paiement et afficher le ticket
      setIsPaymentModalOpen(false)
      setShowTicketPreview(true)

      // 7. Rafraîchir la liste
      await fetchFacturesEnAttente()

      // Invalidate product cache to refresh stock data (if on same machine)
      queryClient.invalidateQueries({ queryKey: ['products'] })
      
      // 8. Si un coupon était appliqué à cette facture, le marquer comme utilisé au niveau du CouponMonnaie
      if (couponUtilise) {
        await utiliserCouponApresEncaissement(couponUtilise.id, factureFinale.id)
        // Retirer le coupon de la map
        setCouponsParFacture(prev => {
          const updated = { ...prev }
          delete updated[factureFinale.id]
          return updated
        })
      }

      toast.success(t('messages.modification_success'))
    } catch (err: any) {
      console.error('Erreur lors du paiement:', err)
      toast.error(err.response?.data?.detail || t('messages.save_payment_error'))
    } finally {
      setLoading(false)
    }
  }
  // Envoi WhatsApp
  const handleSendWhatsApp = async () => {
    if (!ticketCaisse || !ticketCaisse.facture || typeof ticketCaisse.facture === 'number') return
    
    const facture = ticketCaisse.facture as any
    // Déterminer le numéro (priorité au numéro du client si présent)
    const clientPhone = (typeof facture.client === 'object' ? facture.client?.phone : '') || facture.client_phone
    const phone = window.prompt(t('messages.enter_whatsapp_number') || t('messages.enter_whatsapp_number_desc'), clientPhone || '')
    
    if (!phone) return

    setLoading(true)
    try {
      const facturesEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/factures/` : '/api/factures/'
      const response = await axios.post(`${facturesEndpoint}${facture.id}/send_whatsapp/`, {
        phone: phone
      })
      toast.success(response.data.detail || 'Ticket envoyé par WhatsApp !')
    } catch (err: any) {
      console.error('Erreur envoi WhatsApp:', err)
      toast.error(err.response?.data?.detail || t('messages.whatsapp_send_error'))
    } finally {
      setLoading(false)
    }
  }



  // Annuler une facture
  const handleAnnuler = async (facture: Facture) => {
    if (!window.confirm(t('confirm_cancel_invoice', { numero: facture.numero_facture }))) return

    try {
      const facturesEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/factures/` : '/api/factures/'
      // Utiliser l'endpoint d'annulation
      await axios.post(`${facturesEndpoint}${facture.id}/annuler/`, { motif: 'Annulation depuis Caisse Centrale' })
      toast.success(t('messages.cancel_invoice_success'))
      fetchFacturesEnAttente()
    } catch (err) {
      console.error('Erreur annulation:', err)
      toast.error(t('messages.cancel_invoice_error'))
    }
  }

  // Modifier une facture (Redirection vers Facturation)
  const handleModifier = async (facture: Facture) => {
    if (!window.confirm(t('confirm_modify_invoice'))) return

    try {
      setLoading(true)
      const facturesEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/factures/` : '/api/factures/'
      const produitsEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/produits/` : '/api/produits/'
      
      // 1. Fetch the FULL invoice detail (list endpoint doesn't include products)
      const { data: fullFacture } = await axios.get<Facture>(`${facturesEndpoint}${facture.id}/`)
      
      if (!fullFacture.produits || fullFacture.produits.length === 0) {
        toast.error(t('messages.empty_invoice_error'))
        setLoading(false)
        return
      }
      
      // 2. Fetch complete product details for all products
      const productPromises = fullFacture.produits.map(async (p: any) => {
        try {
          const response = await axios.get(`${produitsEndpoint}${p.produit}/`)
          return {
            id: response.data.id,
            name: response.data.name,
            price: p.selling_price,
            quantity: p.quantity,
            stock: response.data.stock,
            discount: p.discount || 0,
            cip: response.data.cip,
            tva: response.data.tva
          }
        } catch (err) {
          console.error(`Failed to fetch product ${p.produit}:`, err)
          return {
            id: p.produit,
            name: p.produit_nom || 'Produit',
            price: p.selling_price,
            quantity: p.quantity,
            stock: 9999,
            discount: p.discount || 0
          }
        }
      })

      const cartItems = await Promise.all(productPromises)

      // 3. Cancel the invoice after fetching all data
      await axios.post(`${facturesEndpoint}${facture.id}/annuler/`, { motif: 'Modification (Reload)' })

      // 4. Navigate to Facturation with complete state
      navigate('/app/facturation', { 
        state: { 
          cartData: cartItems,
          client: fullFacture.client ? { id: fullFacture.client, name: fullFacture.client_name } : null,
          remise: fullFacture.remise,
          mode: 'edit_reload'
        } 
      })
      
    } catch (err) {
      console.error('Erreur modification:', err)
      toast.error(t('messages.load_invoice_error'))
    } finally {
      setLoading(false)
    }
  }

  // Modifier la quantité d'un produit directement (Partial Modification)
  const handleUpdateProductQuantity = async (factureId: number, produitId: number, newQty: number) => {
    try {
      setLoading(true)
      const facturesEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/factures/` : '/api/factures/'
      
      const facture = facturesEnAttente.find(f => f.id === factureId)
      if (!facture) return
      
      const updatedProducts = (facture.produits || []).map((p: any) => {
        if (p.produit === produitId) {
          return { ...p, quantity: newQty }
        }
        return p
      })
      
      const response = await axios.post(`${facturesEndpoint}${factureId}/modifier/`, {
        produits: updatedProducts,
        remise: facture.remise,
        client: facture.client,
        client_name_override: facture.client_name_override
      })
      
      const updatedFacture = response.data.facture
      setFacturesEnAttente(prev => prev.map(f => f.id === factureId ? { ...updatedFacture, session_ticket_number: f.session_ticket_number } : f))
      toast.success(t('messages.modification_success'))
      
    } catch (err: any) {
      console.error('Erreur modification produit:', err)
      toast.error(err.response?.data?.detail || t('messages.modification_error'))
    } finally {
      setLoading(false)
    }
  }

  // Supprimer un produit directement (Partial Modification)
  const handleRemoveProduct = async (factureId: number, produitId: number) => {
    try {
      setLoading(true)
      const facturesEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/factures/` : '/api/factures/'
      
      const facture = facturesEnAttente.find(f => f.id === factureId)
      if (!facture) return
      
      const updatedProducts = (facture.produits || []).filter((p: any) => p.produit !== produitId)
      
      if (updatedProducts.length === 0) {
        if (window.confirm(t('messages.confirm_cancel_empty'))) {
          await handleAnnuler(facture)
        }
        setLoading(false)
        return
      }
      
      const response = await axios.post(`${facturesEndpoint}${factureId}/modifier/`, {
        produits: updatedProducts,
        remise: facture.remise,
        client: facture.client,
        client_name_override: facture.client_name_override
      })
      
      const updatedFacture = response.data.facture
      setFacturesEnAttente(prev => prev.map(f => f.id === factureId ? { ...updatedFacture, session_ticket_number: f.session_ticket_number } : f))
      toast.success(t('messages.product_removed'))
      
    } catch (err: any) {
      console.error('Erreur suppression produit:', err)
      toast.error(err.response?.data?.detail || t('messages.modification_error'))
    } finally {
      setLoading(false)
    }
  }

  // Compute stats for the header cards
  const totalMontantEnAttente = useMemo(() => 
    facturesEnAttente.reduce((acc, f) => acc + Number(f.total_ttc || 0), 0), 
    [facturesEnAttente]
  )
  const activeCouponsCount = useMemo(() => coupons.filter(c => c.status === 'ACTIF').length, [coupons])
  const appliedCouponsCount = Object.keys(couponsParFacture).length

  return (
    <div className="min-h-screen bg-base-200 p-6 space-y-6 font-sans">

      {/* Header Card */}
      <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 flex flex-col">
        <div className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-base-content tracking-tight">{t('title')}</h1>
            <p className="text-base-content/60 text-sm mt-1">{t('subtitle')}</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-primary bg-primary/10 px-3 py-1.5 rounded-full font-medium">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '3s' }} />
              {t('auto_refresh')}
            </div>
            <button 
              onClick={() => setIsCouponPanelOpen(!isCouponPanelOpen)}
              className={`btn btn-sm gap-2 ${isCouponPanelOpen ? 'btn-primary' : 'btn-outline btn-primary'}`}
            >
              <Ticket className="w-4 h-4" />
              {t('coupons_active', { count: activeCouponsCount })}
            </button>
            {appliedCouponsCount > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-success bg-success/10 px-3 py-1.5 rounded-full font-medium">
                <span>{t('coupons_applied', { count: appliedCouponsCount })}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Pending Invoices */}
        <div className="bg-gradient-to-br from-error/10 to-error/5 p-4 rounded-xl border border-error/20 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-error uppercase tracking-wider mb-1 flex items-center gap-1">
              <Clock className="w-3 h-3" /> {t('stats_pending_title', { defaultValue: 'En Attente' })}
            </div>
            <div className="text-2xl font-bold text-base-content">{facturesEnAttente.length}</div>
            <div className="text-xs text-base-content/60">{t('stats_pending_desc', { defaultValue: 'facture(s) à encaisser' })}</div>
          </div>
          <div className="w-12 h-12 rounded-full bg-error/10 flex items-center justify-center">
            <Clock className="w-6 h-6 text-error" />
          </div>
        </div>

        {/* Total Amount */}
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-4 rounded-xl border border-primary/20 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-primary uppercase tracking-wider mb-1 flex items-center gap-1">
              <Banknote className="w-3 h-3" /> {t('stats_total_title', { defaultValue: 'Montant Total' })}
            </div>
            <div className="text-2xl font-bold text-base-content">{formatCurrency(Math.round(totalMontantEnAttente))}</div>
            <div className="text-xs text-base-content/60">{t('stats_total_desc', { defaultValue: 'à encaisser' })}</div>
          </div>
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Banknote className="w-6 h-6 text-primary" />
          </div>
        </div>

        {/* Active Coupons */}
        <div className="bg-gradient-to-br from-secondary/10 to-secondary/5 p-4 rounded-xl border border-secondary/20 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-secondary uppercase tracking-wider mb-1 flex items-center gap-1">
              <Ticket className="w-3 h-3" /> {t('stats_coupons_title', { defaultValue: 'Coupons Actifs' })}
            </div>
            <div className="text-2xl font-bold text-base-content">{activeCouponsCount}</div>
            <div className="text-xs text-base-content/60">{appliedCouponsCount > 0 ? t('coupons_applied', { count: appliedCouponsCount }) : t('stats_coupons_desc', { defaultValue: 'coupon(s) disponible(s)' })}</div>
          </div>
          <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center">
            <Ticket className="w-6 h-6 text-secondary" />
          </div>
        </div>
      </div>

      {/* Main Content: Sidebar + Table */}
      <div className="flex gap-6" style={{ minHeight: 'calc(100vh - 320px)' }}>
        {/* Panneau des Coupons (Sidebar Gauche) */}
        {isCouponPanelOpen && (
          <CouponPanel
            coupons={coupons}
            onGenerateCoupon={() => setIsGenererCouponModalOpen(true)}
            searchNumero={searchCouponNumero}
            onSearchChange={setSearchCouponNumero}
            onSearch={handleRechercherCoupon}
            onSelectCoupon={(c) => {
              setCouponTrouve(c)
              setIsDetailsCouponModalOpen(true)
            }}
            user={user}
          />
        )}

        {/* Table Card */}
        <div className="flex-1 bg-base-100 rounded-2xl shadow-sm border border-base-300 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-auto">
            <FacturesTable
              sortedFactures={sortedFactures}
              loading={loading}
              selectedRowIndex={selectedRowIndex}
              onSelectRow={setSelectedRowIndex}
              onEncaisser={handleEncaisser}
              onRemoveCoupon={handleRetirerCouponDeFacture}
              onModify={handleModifier}
              onCancel={handleAnnuler}
              onApplyCoupon={openCouponSelectionForFacture}
              onUpdateProductQuantity={handleUpdateProductQuantity}
              onRemoveProduct={handleRemoveProduct}
              couponsParFacture={couponsParFacture}
              user={user}
            />
          </div>
          {/* Keyboard Shortcuts Footer */}
          <div className="p-3 border-t border-base-200 flex items-center justify-between text-xs text-base-content/40">
            <div className="flex items-center gap-1">
              <Keyboard className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('shortcuts.title')}</span>
            </div>
            <div className="flex gap-3">
              <span><kbd className="kbd kbd-xs">↑↓</kbd> {t('shortcuts.navigate')}</span>
              <span><kbd className="kbd kbd-xs">Entrée</kbd> {t('shortcuts.cash_in')}</span>
              <span><kbd className="kbd kbd-xs">C</kbd> {t('shortcuts.coupon')}</span>
              <span><kbd className="kbd kbd-xs">R</kbd> {t('shortcuts.refresh')}</span>
              <span><kbd className="kbd kbd-xs">1-9</kbd> {t('shortcuts.quick_select')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de paiement */}
      {isPaymentModalOpen && selectedFacture && (
        <PaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          facture={selectedFacture}
          coupon={couponsParFacture[selectedFacture.id]}
          onConfirm={enregistrerPaiement}
          loading={loading}
        />
      )}

      <PremiumModal
        isOpen={showTicketPreview && !!ticketCaisse}
        onClose={() => setShowTicketPreview(false)}
        title={t('ticket.title')}
        icon={<span className="text-primary text-xl">📄</span>}
        maxWidth="max-w-sm"
        footer={
            <div className="flex justify-end gap-2 w-full">
              <button className="btn btn-ghost btn-sm" onClick={() => setShowTicketPreview(false)}>{t('coupons.details_modal.close') || 'Fermer'} (Esc)</button>
              {pharmacySettings?.whatsapp_enabled && (
                <button 
                  className="btn btn-outline btn-success btn-sm gap-2"
                  onClick={handleSendWhatsApp}
                  disabled={loading}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="currentColor" viewBox="0 0 448 512">
                    <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 54 81.2 54 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-5.5-2.8-23.4-8.6-44.4-27.4-16.4-14.6-27.4-32.7-30.6-38.2-3.2-5.6-.3-8.6 2.5-11.3 2.5-2.4 5.5-6.5 8.3-9.7 2.8-3.3 3.7-5.6 5.5-9.3 1.9-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 13.2 5.8 23.5 9.2 31.5 11.8 13.3 4.2 25.4 3.6 35 2.2 10.7-1.5 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z" />
                  </svg>
                  WhatsApp
                </button>
              )}
              <button 
                className="btn btn-primary btn-sm px-6"
                onClick={() => {
                  const ticketElement = document.getElementById('ticket-preview');
                  if (!ticketElement) return;
                  
                  const ticketWidth = pharmacySettings.ticket_paper_width || 80;
                  const content = ticketElement.outerHTML;
                  const styleTags = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
                    .map(node => node.outerHTML)
                    .join('\n');
                  
                  const win = window.open('', '', 'height=800,width=600');
                  if (win && content) {
                    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Ticket de Caisse</title>
  <base href="${window.location.origin}/">
  ${styleTags}
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @media print {
      @page { 
        size: ${ticketWidth}mm auto; 
        margin: 0; 
      }
      html, body { 
        width: ${ticketWidth}mm !important;
        margin: 0 !important; 
        padding: 0 !important; 
        background: white !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
    html, body {
      width: ${ticketWidth}mm;
      max-width: ${ticketWidth}mm;
      margin: 0 auto;
      padding: 0;
      background: white;
      font-family: 'Inter', 'Poppins', sans-serif;
      overflow: hidden;
    }
    #print-root {
      width: ${ticketWidth}mm;
      max-width: ${ticketWidth}mm;
      overflow: hidden;
    }
    #ticket-preview {
      width: ${ticketWidth}mm !important;
      max-width: ${ticketWidth}mm !important;
      min-width: 0 !important;
      margin: 0 !important;
      padding: 2mm !important;
      background: white;
      color: black;
      box-shadow: none !important;
      outline: none !important;
      overflow: hidden;
      word-break: break-word;
      overflow-wrap: break-word;
    }
    #ticket-preview table { table-layout: fixed; width: 100% !important; }
    #ticket-preview td, #ticket-preview th { overflow: hidden; text-overflow: ellipsis; }
  </style>
</head>
<body>
  <div id="print-root">
    ${content}
  </div>
</body>
</html>`);
                    win.document.close();
                    win.focus();
                    if (win.document.fonts) {
                      win.document.fonts.ready.then(() => {
                        setTimeout(() => {
                          win.print();
                          win.close();
                        }, 300);
                      });
                    } else {
                      setTimeout(() => {
                        win.print();
                        win.close();
                      }, 800);
                    }
                  }
                }}
              >
                {t('common:print')}
              </button>
            </div>
        }
      >
        <div className="max-h-[70vh] overflow-y-auto bg-base-200/50 flex justify-center py-4">
          {ticketCaisse && (
            <div id="ticket-preview" className="shadow-lg bg-base-100">
              <TicketTemplate ticket={ticketCaisse} settings={pharmacySettings} />
            </div>
          )}
        </div>
      </PremiumModal>

      {/* Modals pour les Coupons */}
      <PremiumModal
        isOpen={isGenererCouponModalOpen}
        onClose={() => setIsGenererCouponModalOpen(false)}
        title={t('coupons.generate_modal.title')}
        icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>}
        footer={
            <div className="flex justify-end gap-2 w-full">
              <button className="btn btn-ghost" onClick={() => setIsGenererCouponModalOpen(false)}>{t('table.cancel')}</button>
              <button 
                className="btn btn-primary gap-2" 
                onClick={() => setIsSudoModalOpen(true)}
                disabled={loading || !nouveauCouponMontant}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Valider (Mode Sudo)
              </button>
            </div>
        }
      >
        <div className="p-6">
            <div className="form-control w-full mb-4">
              <label className="label">
                <span className="label-text">Montant à rendre (F)</span>
              </label>
              <input 
                type="number" 
                className="input input-bordered w-full text-2xl font-bold text-center" 
                placeholder="Ex: 250"
                value={nouveauCouponMontant}
                onChange={(e) => setNouveauCouponMontant(e.target.value)}
                autoFocus
              />
            </div>

            <div className="form-control w-full mb-4">
              <label className="label">
                <span className="label-text">Notes (Optionnel)</span>
              </label>
              <textarea 
                className="textarea textarea-bordered h-20" 
                placeholder="Raison du coupon..."
                value={nouveauCouponNotes}
                onChange={(e) => setNouveauCouponNotes(e.target.value)}
              ></textarea>
            </div>
        </div>
      </PremiumModal>

      {/* Modal Confirmation Sudo pour Coupon */}
      <PasswordConfirmModal
        isOpen={isSudoModalOpen}
        onClose={() => setIsSudoModalOpen(false)}
        onConfirm={handleGenererCoupon}
        title="Validation par mot de passe"
        message={`Confirmez la génération du coupon de ${nouveauCouponMontant} F.`}
      />

      {/* Modal Détails Coupon */}
      <PremiumModal
        isOpen={isDetailsCouponModalOpen && !!couponTrouve}
        onClose={() => { setIsDetailsCouponModalOpen(false); setCouponTrouve(null); setSearchCouponNumero(''); }}
        title="Détails du Coupon"
        icon={<span className="text-primary text-xl">🎫</span>}
        footer={
            <div className="flex justify-between gap-2 w-full">
              <button 
                className="btn btn-sm btn-outline"
                onClick={() => {
                  if (!couponTrouve) return;
                  const win = window.open('', '', 'height=600,width=400');
                  if (win) {
                    const dateStr = new Date(couponTrouve.date_creation).toLocaleString('fr-FR', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    });
                    
                    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Coupon de Monnaie</title>
  <style>
    @media print {
      @page {
        size: 80mm auto;
        margin: 0;
      }
      body {
        margin: 0;
        padding: 10mm 5mm;
      }
    }
    body {
      font-family: 'Courier New', monospace;
      width: 80mm;
      margin: 0 auto;
      padding: 10mm 5mm;
      font-size: 11px;
      line-height: 1.4;
      color: #000;
      background: #fff;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #000;
      padding-bottom: 8px;
      margin-bottom: 12px;
    }
    .pharmacy-name {
      font-size: 16px;
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .pharmacy-info {
      font-size: 10px;
      line-height: 1.3;
    }
    .coupon-box {
      border: 2px dashed #000;
      padding: 15px;
      margin: 15px 0;
      text-align: center;
    }
    .coupon-label {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 5px;
      font-weight: bold;
    }
    .coupon-number {
      font-size: 24px;
      font-weight: bold;
      margin: 8px 0;
      font-family: 'Courier New', monospace;
    }
    .coupon-amount {
      font-size: 32px;
      font-weight: bold;
      margin: 10px 0;
      color: #000;
    }
    .info-section {
      margin-top: 15px;
      font-size: 10px;
      text-align: left;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
    }
    .info-label {
      font-weight: bold;
    }
    .status-badge {
      display: inline-block;
      padding: 2px 8px;
      border: 1px solid #000;
      font-size: 9px;
      margin-left: 5px;
    }
    .notes {
      margin-top: 12px;
      padding: 8px;
      background: #f5f5f5;
      border: 1px solid #ddd;
      font-size: 9px;
      font-style: italic;
      text-align: left;
    }
    .footer {
      text-align: center;
      margin-top: 20px;
      padding-top: 10px;
      border-top: 1px solid #000;
      font-size: 9px;
    }
    .warning {
      font-size: 9px;
      color: #666;
      margin-top: 10px;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="pharmacy-name">${pharmacySettings.pharmacy_name || 'PHARMACIE'}</div>
    <div class="pharmacy-info">
      ${pharmacySettings.city ? `${pharmacySettings.city}` : ''}${pharmacySettings.country ? `, ${pharmacySettings.country}` : ''}<br>
      ${pharmacySettings.phone ? `Tel: ${pharmacySettings.phone}` : ''}<br>
      ${pharmacySettings.niu ? `NIU: ${pharmacySettings.niu}` : ''}<br>
      ${pharmacySettings.registre_commerce ? `RC: ${pharmacySettings.registre_commerce}` : ''}
    </div>
  </div>
  
  <div class="coupon-box">
    <div class="coupon-label">Coupon de Monnaie</div>
    <div class="coupon-number">#${couponTrouve.numero}</div>
    <div class="coupon-amount">${formatCurrency(Math.round(Number(couponTrouve.montant)))}</div>
  </div>
  
  <div class="info-section">
    <div class="info-row">
      <span class="info-label">Statut:</span>
      <span>${couponTrouve.status_display || couponTrouve.status}<span class="status-badge">${couponTrouve.status}</span></span>
    </div>
    <div class="info-row">
      <span class="info-label">Généré par:</span>
      <span>${couponTrouve.cree_par_nom || 'Système'}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Date:</span>
      <span>${dateStr}</span>
    </div>
    ${couponTrouve.facture_origine ? `
    <div class="info-row">
      <span class="info-label">Facture origine:</span>
      <span>#${couponTrouve.facture_origine}</span>
    </div>
    ` : ''}
  </div>
  
  ${couponTrouve.notes ? `
  <div class="notes">
    <strong>Notes:</strong><br>
    ${couponTrouve.notes}
  </div>
  ` : ''}
  
  <div class="warning">
    Ce coupon est valable uniquement dans cette pharmacie
  </div>
  
  <div class="footer">
    ${pharmacySettings.ticket_footer_message || 'Merci de votre visite !'}
  </div>
</body>
</html>`);
                    win.document.close();
                    // Attendre que le contenu soit chargé avant d'imprimer
                    win.onload = () => {
                      setTimeout(() => {
                        win.print();
                      }, 250);
                    };
                  }
                }}
              > {t('coupons.details_modal.print')} </button>
              <div className="flex gap-2">
                <button className="btn btn-sm btn-ghost" onClick={() => { setIsDetailsCouponModalOpen(false); setCouponTrouve(null); setSearchCouponNumero(''); }}>{t('coupons.details_modal.close') || 'Fermer'}</button>
                {couponTrouve && couponTrouve.status === 'ACTIF' && factureForCoupon && (
                  <button className="btn btn-sm btn-success text-white" onClick={() => handleAppliquerCouponAFacture(couponTrouve, factureForCoupon)}>
                    {t('table.apply_coupon')} #{factureForCoupon.session_ticket_number}
                  </button>
                )}
                {couponTrouve && couponTrouve.status === 'ACTIF' && !factureForCoupon && (
                  <div className="text-xs text-warning">Sélectionnez d'abord une vente pour appliquer le coupon</div>
                )}
              </div>
            </div>
        }
      >
        <div className="p-6">
            {couponTrouve && (
            <div className="text-center p-4 border-2 border-dashed border-base-300 rounded-xl bg-base-50">
              <div className="text-xs font-bold text-base-content/40 uppercase tracking-widest mb-1">Coupon de Monnaie</div>
              <div className="text-4xl font-black text-primary font-mono mb-2">#{couponTrouve.numero}</div>
              <div className="text-3xl font-bold mb-4">{Math.round(Number(couponTrouve.montant))} F</div>
              <div className="divider"></div>
              <div className="text-left space-y-2 text-xs">
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className={`badge badge-xs ${
                    couponTrouve.status === 'ACTIF' ? 'badge-success' : 
                    couponTrouve.status === 'UTILISE' ? 'badge-neutral' : 'badge-ghost'
                  }`}>
                    {couponTrouve.status_display || couponTrouve.status}
                  </span>
                </div>
                
                <div className="divider my-1"></div>
                
                <div className="bg-base-100 p-2 rounded border border-base-200 space-y-1">
                  <div className="font-bold text-[10px] uppercase opacity-50 mb-1">Création</div>
                  <div className="flex justify-between">
                    <span>Généré par:</span>
                    <span className="font-medium">{couponTrouve.cree_par_nom || 'Système'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Date:</span>
                    <span className="font-medium">{new Date(couponTrouve.date_creation).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                  </div>
                </div>

                {couponTrouve.status === 'UTILISE' && (
                  <div className="bg-success/5 p-2 rounded border border-success/20 space-y-1">
                    <div className="font-bold text-[10px] uppercase text-success opacity-70 mb-1">Utilisation</div>
                    <div className="flex justify-between">
                      <span>Utilisé par:</span>
                      <span className="font-medium">{couponTrouve.utilise_par_nom || 'N/A'}</span>
                    </div>
                    {couponTrouve.date_utilisation && (
                      <div className="flex justify-between">
                        <span>Date:</span>
                        <span>{new Date(couponTrouve.date_utilisation).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                      </div>
                    )}
                  </div>
                )}
                
                {couponTrouve.notes && (
                  <div className="mt-2 p-2 bg-base-100 rounded italic border border-base-200">
                    <span className="font-bold not-italic opacity-50 block text-[10px] mb-1">Notes:</span>
                    "{couponTrouve.notes}"
                  </div>
                )}
              </div>
            </div>
            )}
        </div>
      </PremiumModal>
    </div>
  )
}


