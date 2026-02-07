import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { toast } from 'react-hot-toast'
import DOMPurify from 'dompurify'
import { useAuth } from '../context/AuthContext'
import { usePharmacySettings } from '../hooks/usePharmacySettings'
import type { Facture, TicketCaisse, CouponMonnaie } from '../types'
import PasswordConfirmModal from './PasswordConfirmModal'
import { PaymentModal } from './caisse/PaymentModal'
import { FacturesTable } from './caisse/FacturesTable'
import { CouponPanel } from './caisse/CouponPanel'
import { useTranslation } from 'react-i18next'

// Lazy load barcode component
const Barcode = lazy(() => import('react-barcode'))

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
  const [reference, setReference] = useState('')
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
      const response = await axios.get(`${facturesEndpoint}?status__in=BROU,VAL`)
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

  // Trier les factures par numéro de ticket pour la navigation clavier
  const sortedFactures = useMemo(() => 
    [...facturesEnAttente].sort((a, b) => (a.session_ticket_number || 0) - (b.session_ticket_number || 0)),
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

    if (montantTotal <= 0) {
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
      for (const paiement of paiementsValides) {
        const paiementPayload: any = {
          facture: factureValidee.id,
          mode_paiement: paiement.mode,
          montant: paiement.montant,
          reference: reference || null,
          statut: 'completee',
        }

        // Si tiers payant, marquer comme paiement de la part patient
        const hasTiersPayant = factureValidee.part_client !== null && Number(factureValidee.part_client) >= 0
        if (hasTiersPayant) {
          paiementPayload.part_patient = paiement.montant
          paiementPayload.part_assurance = 0
        }

        await axios.post(caisseEndpoint, paiementPayload)
      }

      // 3. Mettre à jour le statut à PAYEE
      const factureUpdateEndpoint = `${facturesEndpoint}${factureValidee.id}/`
      await axios.patch(factureUpdateEndpoint, { status: 'PAY' })

      // 4. Récupérer la facture finale
      const { data: factureFinale } = await axios.get<Facture>(factureUpdateEndpoint)

      // 5. Créer le ticket de caisse (calculer le rendu sur la base du montant encaissé, pas du total)
      const rendu = montantTotal - montantAEncaisser
      setTicketCaisse({
        id: 0,
        facture: factureFinale,
        mode_paiement: paiementsValides.length > 1 ? 'Mixte' : (paiementsValides[0]?.mode || 'especes'),
        montant: factureFinale.total_ttc,
        montant_verse: montantTotal.toString(),
        rendu: rendu.toString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        statut: 'completee',
        date_paiement: new Date().toISOString(),
        paiements_details: (factureFinale as any).paiements || []
      } as any)

      // 6. Fermer la modale de paiement et afficher le ticket
      setIsPaymentModalOpen(false)
      setShowTicketPreview(true)

      // 7. Rafraîchir la liste
      await fetchFacturesEnAttente()

      // Invalidate product cache to refresh stock data (if on same machine)
      queryClient.invalidateQueries({ queryKey: ['products'] })
      
      // 8. Si un coupon était appliqué à cette facture, le marquer comme utilisé
      const couponUtilise = couponsParFacture[factureFinale.id]
      if (couponUtilise) {
        await utiliserCouponApresEncaissement(couponUtilise.id, factureFinale.id)
        // Retirer le coupon de la map
        setCouponsParFacture(prev => {
          const updated = { ...prev }
          delete updated[factureFinale.id]
          return updated
        })
      }

      toast.success(`Facture #${factureFinale.numero_facture} encaissée avec succès !`)
    } catch (err: any) {
      console.error('Erreur lors du paiement:', err)
      toast.error(err.response?.data?.detail || "Erreur lors de l'enregistrement du paiement")
    } finally {
      setLoading(false)
    }
  }



  // Annuler une facture
  const handleAnnuler = async (facture: Facture) => {
    if (!window.confirm(`Voulez-vous vraiment annuler la facture #${facture.numero_facture} ?`)) return

    try {
      const facturesEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/factures/` : '/api/factures/'
      // Utiliser l'endpoint d'annulation
      await axios.post(`${facturesEndpoint}${facture.id}/annuler/`, { motif: 'Annulation depuis Caisse Centrale' })
      toast.success('Facture annulée')
      fetchFacturesEnAttente()
    } catch (err) {
      console.error('Erreur annulation:', err)
      toast.error('Erreur lors de l\'annulation')
    }
  }

  // Modifier une facture (Redirection vers Facturation)
  const handleModifier = async (facture: Facture) => {
    if (!window.confirm(`Modifier cette facture ?\nElle sera retirée de la liste et rechargée dans l'écran de vente.`)) return

    try {
      setLoading(true)
      const facturesEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/factures/` : '/api/factures/'
      const produitsEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/produits/` : '/api/produits/'
      
      // 1. Fetch the FULL invoice detail (list endpoint doesn't include products)
      const { data: fullFacture } = await axios.get<Facture>(`${facturesEndpoint}${facture.id}/`)
      
      if (!fullFacture.produits || fullFacture.produits.length === 0) {
        toast.error('Cette facture ne contient aucun produit')
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
      toast.error('Impossible de charger la facture pour modification')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-full flex flex-col bg-base-100">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-base-200 bg-white shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-base-content">{t('title')}</h1>
          <p className="text-sm text-base-content/60 mt-1">
            {t('subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="badge badge-lg badge-primary gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {t('auto_refresh')}
          </div>
          <button 
            onClick={() => setIsCouponPanelOpen(!isCouponPanelOpen)}
            className={`btn btn-lg gap-2 ${isCouponPanelOpen ? 'btn-primary' : 'btn-outline btn-primary'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
            </svg>
            {t('coupons_active', { count: coupons.filter(c => c.status === 'ACTIF').length })}
          </button>
          {/* Indicateur: nombre de coupons appliqués aux ventes */}
          {Object.keys(couponsParFacture).length > 0 && (
            <div className="badge badge-lg badge-success gap-2">
              <span>{t('coupons_applied', { count: Object.keys(couponsParFacture).length })}</span>
            </div>
          )}
          <div className="badge badge-lg badge-error">
            {t('pending_count', { count: facturesEnAttente.length })}
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Panneau des Coupons (Sidebar Gauche) */}
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

        <div className="flex-1 overflow-auto p-6">
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
            couponsParFacture={couponsParFacture}
            user={user}
          />
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

      {/* Modal Ticket */}
      {showTicketPreview && ticketCaisse && (
        <div className="modal modal-open">
          <div className="modal-box max-w-md mx-4 p-0 overflow-hidden bg-white">
            <div className="bg-base-50 p-4 flex justify-between items-center border-b border-base-200">
              <h3 className="font-bold text-lg">{t('ticket.title')}</h3>
              <button className="btn btn-sm btn-circle btn-ghost" onClick={() => setShowTicketPreview(false)}>✕</button>
            </div>
            
            <div className="p-6 bg-white text-black font-mono text-sm overflow-y-auto max-h-[60vh]" id="ticket-preview">
                {/* ... Ticket Content (kept mostly same for print compatibility) ... */}
                <div className="text-center mb-4 border-b-2 border-black pb-4">
                <h2 className="text-xl font-black">{pharmacySettings.pharmacy_name}</h2>
                <p>{pharmacySettings.city}, {pharmacySettings.country}</p>
                {pharmacySettings.phone && <p>Tel: {pharmacySettings.phone}</p>}
                {pharmacySettings.niu && <p>NIU: {pharmacySettings.niu}</p>}
                {pharmacySettings.registre_commerce && <p>RC: {pharmacySettings.registre_commerce}</p>}
              </div>
              
              <div className="space-y-1 mb-4">
                <div className="flex justify-between"><span>{t('table.ticket')}:</span><span>#{ticketCaisse.id}</span></div>
                {typeof ticketCaisse.facture === 'object' && ticketCaisse.facture.numero_facture && (
                  <div className="flex justify-between"><span>{t('table.invoice')}:</span><span>#{ticketCaisse.facture.numero_facture}</span></div>
                )}
                <div className="flex justify-between"><span>{t('table.date')}:</span><span>{new Date().toLocaleDateString('fr-FR')} {new Date().toLocaleTimeString('fr-FR')}</span></div>
                <div className="flex justify-between"><span>{t('table.client')}:</span><span>{typeof ticketCaisse.facture === 'object' ? ticketCaisse.facture.client_name || 'Passage' : ticketCaisse.client_name || 'Passage'}</span></div>
              </div>
              
              <div className="border-y border-dashed border-black py-2 mb-4">
                {typeof ticketCaisse.facture === 'object' && ticketCaisse.facture.produits?.map((p: any) => (
                  <div key={p.id} className="flex justify-between mb-1">
                    <span>{typeof p.produit === 'object' ? p.produit.name : (p.produit_nom || `Produit #${p.produit}`)} x{p.quantity}</span>
                    <span>{Math.round(p.quantity * p.selling_price)}</span>
                  </div>
                ))}
              </div>
              
              <div className="space-y-1 font-bold text-right">
                <div className="flex justify-between text-xs font-normal border-t border-dashed border-black pt-2">
                  <span>Sous-total HT</span>
                  <span>{typeof ticketCaisse.facture === 'object' ? Math.round(Number(ticketCaisse.facture.total_ht)) : 0}</span>
                </div>
                {typeof ticketCaisse.facture === 'object' && Number(ticketCaisse.facture.remise) > 0 && (
                  <div className="flex justify-between text-xs font-normal">
                    <span>Remise</span>
                    <span>-{Math.round(Number(ticketCaisse.facture.remise))}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs font-normal">
                  <span>TVA</span>
                  <span>{typeof ticketCaisse.facture === 'object' ? Math.round(Number(ticketCaisse.facture.total_tva)) : 0}</span>
                </div>
                <div className="flex justify-between text-lg border-t-2 border-black pt-2 mt-1">
                  <span>TOTAL TTC</span>
                  <span>{Math.round(Number(ticketCaisse.montant))} F</span>
                </div>
                {ticketCaisse.montant_verse && (
                  <div className="flex justify-between text-sm font-normal mt-1 border-t border-dashed border-black pt-1">
                    <span>Montant Versé</span>
                    <span>{Math.round(Number(ticketCaisse.montant_verse))} F</span>
                  </div>
                )}
                {ticketCaisse.rendu && (
                  <div className="flex justify-between text-sm font-normal">
                    <span>Rendu</span>
                    <span>{Math.round(Number(ticketCaisse.rendu))} F</span>
                  </div>
                )}
                {ticketCaisse.paiements_details && ticketCaisse.paiements_details.length > 0 ? (
                  <div className="mt-2 text-xs font-normal border-t border-dashed border-black pt-1">
                    <div className="font-bold mb-1">Règlements:</div>
                    {ticketCaisse.paiements_details.map((paiement: any, idx: number) => {
                      const getModeLabel = (mode: string) => {
                        if (!mode) return 'N/A'
                        const labels: { [key: string]: string } = {
                          'especes': 'Espèces',
                          'carte': 'Carte',
                          'cheque': 'Chèque',
                          'virement': 'Virement',
                          'om': 'Orange Money',
                          'momo': 'Mobile Money',
                          'en_compte': 'En compte'
                        }
                        return labels[mode] || mode.toUpperCase()
                      }
                      
                      // Check if it's tiers payant payment
                      const isPartPatient = paiement.part_patient && paiement.part_patient > 0
                      const isPartAssurance = paiement.part_assurance && paiement.part_assurance > 0
                      
                      return (
                        <div key={idx} className="flex justify-between">
                          <span>
                            {getModeLabel(paiement.mode || paiement.mode_paiement || 'N/A')}
                            {isPartPatient && <span className="text-success"> (Part Patient)</span>}
                            {isPartAssurance && <span className="text-info"> (Part Assurance)</span>}
                          </span>
                          <span>{Math.round(paiement.montant)} F</span>
                        </div>
                      )
                    })}
                  </div>
                ) : ticketCaisse.mode_paiement ? (
                  <div className="text-xs font-normal mt-2 text-center">
                    Mode: {ticketCaisse.mode_paiement.toUpperCase()}
                  </div>
                ) : (
                  <div className="text-xs text-red-500 mt-2 text-center">
                    [Aucun mode de paiement détecté]
                  </div>
                )}
              </div>
              
              <div className="text-center mt-6 text-xs">
                <p>{pharmacySettings.ticket_footer_message || 'Merci de votre visite !'}</p>
              </div>
              
              {/* Barcode with invoice number at bottom */}
              {typeof ticketCaisse.facture === 'object' && ticketCaisse.facture.numero_facture && (
                <Suspense fallback={<div className="text-center py-2">Chargement...</div>}>
                  <div className="flex justify-center mt-4 bg-white">
                    <Barcode value={ticketCaisse.facture.numero_facture} height={50} width={1.5} fontSize={12} />
                  </div>
                </Suspense>
              )}
            </div>
            
            <div className="p-4 bg-base-50 border-t border-base-200 flex justify-end gap-2">
              <button className="btn btn-ghost btn-sm" onClick={() => setShowTicketPreview(false)}>{t('coupons.details_modal.close') || 'Fermer'} (Esc)</button>
              <button 
                className="btn btn-primary btn-sm"
                onClick={() => {
                  const content = DOMPurify.sanitize(document.getElementById('ticket-preview')?.innerHTML || '');
                  const win = window.open('', '', 'height=600,width=400');
                  if (win && content) {
                    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Ticket de Caisse</title>
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
    .text-center { text-align: center; }
    .flex { display: flex; justify-content: space-between; }
    .font-bold { font-weight: bold; }
    .border-b-2 { border-bottom: 2px solid black; }
    .border-t-2 { border-top: 2px solid black; }
    .border-t { border-top: 1px solid black; }
    .border-dashed { border-style: dashed; }
    .mb-4 { margin-bottom: 1rem; }
    .mb-1 { margin-bottom: 0.25rem; }
    .mt-1 { margin-top: 0.25rem; }
    .mt-2 { margin-top: 0.5rem; }
    .mt-4 { margin-top: 1rem; }
    .mt-6 { margin-top: 1.5rem; }
    .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
    .pt-1 { padding-top: 0.25rem; }
    .pt-2 { padding-top: 0.5rem; }
    .pb-4 { padding-bottom: 1rem; }
    .space-y-1 > * + * { margin-top: 0.25rem; }
    .text-xs { font-size: 10px; }
    .text-sm { font-size: 11px; }
    .text-lg { font-size: 16px; }
    .text-xl { font-size: 18px; }
    .text-2xl { font-size: 20px; }
    .text-3xl { font-size: 24px; }
    .text-4xl { font-size: 28px; }
    .font-black { font-weight: 900; }
    .text-success { color: #10b981; }
    .text-info { color: #3b82f6; }
    .text-red-500 { color: #ef4444; }
  </style>
</head>
<body>`);
                    win.document.write(content);
                    win.document.write('</body></html>');
                    win.document.close();
                    // Attendre que le contenu soit chargé avant d'imprimer
                    win.onload = () => {
                      setTimeout(() => {
                        win.print();
                      }, 250);
                    };
                  }
                }}
              >
                {t('coupons.details_modal.print')}
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setShowTicketPreview(false)}></div>
          <div className="modal-backdrop" onClick={() => setShowTicketPreview(false)}></div>
        </div>
      )}

      </div> {/* Fin du Flex Wrapper (Sidebar + Contenu) */}

      {/* Modals pour les Coupons */}
      {isGenererCouponModalOpen && (
        <div className="modal modal-open">
          <div className="modal-box max-w-sm">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              {t('coupons.generate_modal.title')}
            </h3>
            
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

            <div className="modal-action">
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
          </div>
          <div className="modal-backdrop" onClick={() => setIsGenererCouponModalOpen(false)}></div>
        </div>
      )}

      {/* Modal Confirmation Sudo pour Coupon */}
      <PasswordConfirmModal
        isOpen={isSudoModalOpen}
        onClose={() => setIsSudoModalOpen(false)}
        onConfirm={handleGenererCoupon}
        title="Validation par mot de passe"
        message={`Confirmez la génération du coupon de ${nouveauCouponMontant} F.`}
      />

      {/* Modal Détails Coupon */}
      {isDetailsCouponModalOpen && couponTrouve && (
        <div className="modal modal-open">
          <div className="modal-box max-w-sm border-2 border-primary">
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
                    <span>{new Date(couponTrouve.date_creation).toLocaleString('fr-FR')}</span>
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
                        <span>{new Date(couponTrouve.date_utilisation).toLocaleString('fr-FR')}</span>
                      </div>
                    )}
                  </div>
                )}
                
                {couponTrouve.notes && (
                  <div className="mt-2 p-2 bg-white rounded italic border border-base-200">
                    <span className="font-bold not-italic opacity-50 block text-[10px] mb-1">Notes:</span>
                    "{couponTrouve.notes}"
                  </div>
                )}
              </div>
            </div>
            <div className="modal-action flex justify-between gap-2">
              <button 
                className="btn btn-sm btn-outline"
                onClick={() => {
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
    <div class="coupon-amount">${Math.round(Number(couponTrouve.montant)).toLocaleString('fr-FR')} F</div>
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
    ⚠️ Ce coupon est valable uniquement dans cette pharmacie
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
                {couponTrouve.status === 'ACTIF' && factureForCoupon && (
                  <button className="btn btn-sm btn-success text-white" onClick={() => handleAppliquerCouponAFacture(couponTrouve, factureForCoupon)}>
                    {t('table.apply_coupon')} #{factureForCoupon.session_ticket_number}
                  </button>
                )}
                {couponTrouve.status === 'ACTIF' && !factureForCoupon && (
                  <div className="text-xs text-warning">Sélectionnez d'abord une vente pour appliquer le coupon</div>
                )}
              </div>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => { setIsDetailsCouponModalOpen(false); setCouponTrouve(null); setSearchCouponNumero(''); }}></div>
        </div>
      )}
    </div>
  )
}

