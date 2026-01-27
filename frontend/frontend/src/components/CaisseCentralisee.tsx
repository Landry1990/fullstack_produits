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

// Lazy load barcode component
const Barcode = lazy(() => import('react-barcode'))

export default function CaisseCentralisee() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { settings: pharmacySettings } = usePharmacySettings()
  const [facturesEnAttente, setFacturesEnAttente] = useState<Facture[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedFacture, setSelectedFacture] = useState<Facture | null>(null)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [montantPaye, setMontantPaye] = useState('')
  const [modePaiement, setModePaiement] = useState<'especes' | 'cheque' | 'carte' | 'virement' | 'om' | 'momo'>('especes')
  const [reference, setReference] = useState('')
  const [ticketCaisse, setTicketCaisse] = useState<TicketCaisse | null>(null)
  const [showTicketPreview, setShowTicketPreview] = useState(false)
  const [paiements, setPaiements] = useState<{ mode: string; montant: number }[]>([])
  
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
  
  // Coupon à appliquer sur la vente en cours (déduction du montant à payer)
  const [couponApplique, setCouponApplique] = useState<CouponMonnaie | null>(null)

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
      toast.error('Veuillez entrer un montant valide')
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
      toast.success(`Coupon #${data.numero} généré avec succès !`)
      
      setCoupons([data, ...coupons])
      setIsGenererCouponModalOpen(false)
      setNouveauCouponMontant('')
      setNouveauCouponNotes('')
      
      // Ouvrir un aperçu pour impression
      setCouponTrouve(data)
      setIsDetailsCouponModalOpen(true)
    } catch (err: any) {
      console.error('Erreur génération coupon:', err)
      toast.error(err.response?.data?.detail || "Erreur lors de la génération du coupon")
    } finally {
      setLoading(false)
    }
  }

  // Appliquer un coupon à la vente (déduction du montant à payer)
  const handleAppliquerCoupon = (coupon: CouponMonnaie) => {
    if (coupon.status !== 'ACTIF') {
      toast.error('Ce coupon n\'est pas actif')
      return
    }
    setCouponApplique(coupon)
    setIsDetailsCouponModalOpen(false)
    setCouponTrouve(null)
    setSearchCouponNumero('')
    toast.success(`Coupon #${coupon.numero} appliqué (-${coupon.montant} F)`)
  }
  
  // Retirer le coupon appliqué
  const handleRetirerCoupon = () => {
    setCouponApplique(null)
    toast('Coupon retiré', { icon: '🗑️' })
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
        toast.error('Coupon introuvable')
      }
    } catch (err) {
      console.error('Erreur recherche coupon:', err)
      toast.error('Erreur lors de la recherche')
    }
  }

  // Rafraîchissement automatique toutes les 20 secondes
  useEffect(() => {
    fetchFacturesEnAttente()
    const interval = setInterval(fetchFacturesEnAttente, 20000)
    return () => clearInterval(interval)
  }, [fetchFacturesEnAttente])

  // Ouvrir la modale de paiement
  const handleEncaisser = (facture: Facture) => {
    setSelectedFacture(facture)
    // Suggest part_client if available and positive, otherwise total_ttc
    let amountToPay = (facture.part_client !== null && Number(facture.part_client) >= 0) 
      ? Number(facture.part_client) 
      : Number(facture.total_ttc)
    
    // Déduire le coupon si appliqué
    if (couponApplique) {
      amountToPay = Math.max(0, amountToPay - Number(couponApplique.montant))
    }
    
    setMontantPaye(Math.round(amountToPay).toString())
    setModePaiement('especes')
    setReference('')
    setPaiements([]) // Reset multiple payments
    setIsPaymentModalOpen(true)
  }

  // Enregistrer le paiement
  const enregistrerPaiement = async () => {
    if (!selectedFacture) return

    // Calculer le total des paiements
    const totalPaiements = paiements.reduce((acc, p) => acc + p.montant, 0)
    const montantCourant = Number(montantPaye) || 0
    const montantTotal = totalPaiements + (paiements.length === 0 ? montantCourant : 0)

    if (montantTotal <= 0) {
      toast.error('Veuillez entrer un montant valide')
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

      // 2. Enregistrer les paiements (multiples ou simple)
      const paiementsAEnregistrer = paiements.length > 0 
        ? paiements 
        : [{ mode: modePaiement, montant: montantCourant }]

      for (const paiement of paiementsAEnregistrer) {
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
        mode_paiement: paiements.length > 1 ? 'Mixte' : (paiements[0]?.mode || modePaiement),
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
      
      // 8. Si un coupon était appliqué, le marquer comme utilisé
      
      // 8. Si un coupon était appliqué, le marquer comme utilisé
      if (couponApplique) {
        await utiliserCouponApresEncaissement(couponApplique.id, factureFinale.id)
        setCouponApplique(null) // Reset pour la prochaine vente
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
          <h1 className="text-2xl font-bold text-base-content">Caisse Centralisée</h1>
          <p className="text-sm text-base-content/60 mt-1">
            Les ventes en attente de règlement s'affichent automatiquement
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="badge badge-lg badge-primary gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Actualisation auto (20s)
          </div>
          <button 
            onClick={() => setIsCouponPanelOpen(!isCouponPanelOpen)}
            className={`btn btn-lg gap-2 ${isCouponPanelOpen ? 'btn-primary' : 'btn-outline btn-primary'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
            </svg>
            Coupons ({coupons.filter(c => c.status === 'ACTIF').length} actifs)
          </button>
          {/* Indicateur de coupon appliqué */}
          {couponApplique && (
            <div className="badge badge-lg badge-success gap-2 animate-pulse">
              <span>Coupon #{couponApplique.numero}: -{couponApplique.montant} F</span>
              <button 
                onClick={handleRetirerCoupon}
                className="btn btn-xs btn-circle btn-ghost"
                title="Retirer le coupon"
              >×</button>
            </div>
          )}
          <div className="badge badge-lg badge-error">
            {facturesEnAttente.length} en attente
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Panneau des Coupons (Sidebar Gauche) */}
        {isCouponPanelOpen && (
          <div className="w-80 bg-white border-r border-base-200 flex flex-col animate-fade-in-right">
            <div className="p-4 border-b border-base-100 bg-base-50/50">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-bold text-lg flex items-center gap-2">
                  <span className="text-primary"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg></span>
                  Coupons
                </h2>
                <button 
                  onClick={() => setIsGenererCouponModalOpen(true)}
                  className="btn btn-sm btn-circle btn-primary"
                  title={user?.is_superuser || user?.profile?.can_generate_coupon ? "Générer un coupon" : "Permission requise"}
                  disabled={!user?.is_superuser && !user?.profile?.can_generate_coupon}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                </button>
              </div>

              <div className="join w-full">
                <input 
                  type="text" 
                  placeholder="Rechercher #..." 
                  className="input input-sm input-bordered join-item flex-1"
                  value={searchCouponNumero}
                  onChange={(e) => setSearchCouponNumero(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleRechercherCoupon()}
                />
                <button 
                  className="btn btn-sm join-item"
                  onClick={handleRechercherCoupon}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {coupons.length === 0 ? (
                <div className="text-center py-10 text-base-content/40 italic text-sm">
                  Aucun coupon
                </div>
              ) : (
                <table className="table table-xs table-zebra w-full">
                  <thead className="sticky top-0 bg-base-100 z-10">
                    <tr>
                      <th className="text-xs">N°</th>
                      <th className="text-xs text-right">Montant</th>
                      <th className="text-xs">Date</th>
                      <th className="text-xs">Utilisé par</th>
                      <th className="text-xs text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coupons.map(coupon => (
                      <tr 
                        key={coupon.id} 
                        className={`cursor-pointer hover:bg-primary/10 transition-colors ${
                          coupon.status !== 'ACTIF' ? 'opacity-60' : ''
                        }`}
                        onClick={() => { setCouponTrouve(coupon); setIsDetailsCouponModalOpen(true); }}
                        title={coupon.status === 'UTILISE' && coupon.date_utilisation 
                          ? `Utilisé le ${new Date(coupon.date_utilisation).toLocaleDateString('fr-FR')} à ${new Date(coupon.date_utilisation).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}${coupon.utilise_par_nom ? ` par ${coupon.utilise_par_nom}` : ''}`
                          : ''
                        }
                      >
                        <td className="font-mono text-xs font-bold">
                          #{coupon.numero}
                        </td>
                        <td className={`text-right font-bold ${coupon.status === 'ACTIF' ? 'text-primary' : 'text-base-content/50'}`}>
                          {Math.round(Number(coupon.montant))} F
                        </td>
                        <td className="text-[10px] text-base-content/60">
                          {new Date(coupon.date_creation).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="text-[10px] text-base-content/60">
                          {coupon.status === 'UTILISE' && coupon.utilise_par_nom 
                            ? coupon.utilise_par_nom 
                            : coupon.status === 'UTILISE' 
                              ? <span className="italic">N/A</span> 
                              : '-'
                          }
                        </td>
                        <td className="text-center">
                          <span className={`badge badge-xs ${
                            coupon.status === 'ACTIF' ? 'badge-success' : 
                            coupon.status === 'UTILISE' ? 'badge-neutral' :
                            coupon.status === 'EXPIRE' ? 'badge-warning' : 'badge-error'
                          }`}>
                            {coupon.status === 'ACTIF' ? '✓' : coupon.status === 'UTILISE' ? '✗' : '!'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-auto p-6">
        {facturesEnAttente.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-base-content/40">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-xl font-light">Aucune facture en attente de règlement</p>
            <p className="text-sm mt-2">Les ventes validées par les vendeurs apparaîtront ici</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {facturesEnAttente
              .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) // Sort by date ascending
              .map((facture) => (
              <div
                key={facture.id}
                className="bg-white rounded-lg shadow-md border-2 border-base-200 hover:border-primary transition-all p-6"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="badge badge-lg badge-neutral font-bold">
                      Vente #{ facture.session_ticket_number || '?' }
                    </div>
                    <div>
                      <div className="text-xs text-base-content/60 uppercase tracking-wide">Facture</div>
                      <div className="text-2xl font-bold text-primary">#{facture.numero_facture}</div>
                    </div>
                  </div>
                  <div className="badge badge-warning">En attente</div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-base-content/60">Client:</span>
                    <span className="font-medium">{facture.client_name || 'Client de passage'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-base-content/60">Date:</span>
                    <span className="font-medium">{new Date(facture.date).toLocaleString('fr-FR')}</span>
                  </div>
                  
                  {/* Products Preview - Collapsible */}
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs text-primary hover:text-primary-focus flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      Voir les produits ({facture.produits?.length || 0})
                    </summary>
                    <div className="mt-2 bg-base-50 rounded p-2 space-y-1 max-h-40 overflow-y-auto">
                      {facture.produits && facture.produits.length > 0 ? (
                        facture.produits.map((p: any) => (
                          <div key={p.id} className="flex justify-between text-xs bg-white p-2 rounded">
                            <span className="font-medium">{p.produit_nom || `Produit #${p.produit}`}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-base-content/60">×{p.quantity}</span>
                              <span className="font-bold">{Math.round(p.quantity * Number(p.selling_price))} F</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-center text-base-content/40 py-2">Aucun produit</div>
                      )}
                    </div>
                  </details>
                </div>

                <div className="divider my-2"></div>

                <div className="flex justify-between items-center mb-4">
                  <span className="text-base-content/60">
                    {(facture.part_client !== null && Number(facture.part_client) >= 0) 
                      ? 'Part Client' 
                      : 'Montant TTC'}
                    {couponApplique && ' (Coupon appliqué)'}
                  </span>
                  <span className="text-3xl font-bold text-success">
                    {Math.round(
                      Math.max(0, 
                        ((facture.part_client !== null && Number(facture.part_client) >= 0)
                          ? Number(facture.part_client)
                          : Number(facture.total_ttc)) 
                        - (couponApplique ? Number(couponApplique.montant) : 0)
                      )
                    )} F
                  </span>
                </div>
                {(facture.part_client !== null && Number(facture.part_client) >= 0) && (
                  <div className="flex justify-between items-center text-xs text-base-content/50 mb-2">
                    <span>Total TTC</span>
                    <span>{Math.round(Number(facture.total_ttc))} F (Tiers Payant)</span>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => handleModifier(facture)}
                    className="btn btn-outline btn-warning flex-1"
                    title="Modifier (Recharger dans la vente)"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  
                  <button
                    onClick={() => handleAnnuler(facture)}
                    className="btn btn-outline btn-error flex-1"
                    title="Annuler la vente"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>

                <button
                  onClick={() => handleEncaisser(facture)}
                  disabled={!(user as any)?.can_cash_out && !(user?.is_superuser)}
                  className="btn btn-success btn-block gap-2 text-white mt-2 disabled:bg-base-300 disabled:text-base-content/50"
                  title={!(user as any)?.can_cash_out && !(user?.is_superuser) ? "Vous n'êtes pas autorisé à encaisser" : "Encaisser la facture"}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Encaisser
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de paiement */}
      {isPaymentModalOpen && selectedFacture && (
        <div className="modal modal-open">
          <div className="modal-box max-w-md">
            <h3 className="font-bold text-lg mb-4">Encaissement - Facture #{selectedFacture.numero_facture}</h3>

            <div className="text-center mb-6">
              <div className="text-sm text-base-content/60">Total à payer</div>
              <div className="text-4xl font-bold text-primary">
                {Math.round(
                  Math.max(0,
                    ((selectedFacture.part_client !== null && Number(selectedFacture.part_client) >= 0)
                      ? Number(selectedFacture.part_client)
                      : Number(selectedFacture.total_ttc))
                    - (couponApplique ? Number(couponApplique.montant) : 0)
                  )
                )} F
              </div>
              {couponApplique && (
                <div className="badge badge-success mt-2 gap-1">
                  <span>Coupon #{couponApplique.numero}: -{couponApplique.montant} F</span>
                </div>
              )}
              {(selectedFacture.part_client !== null && Number(selectedFacture.part_client) >= 0) && (
                 <div className="badge badge-info mt-2">Part Client (Tiers Payant actif)</div>
              )}
            </div>

            <div className="form-control w-full mb-4">
              <label className="label">
                <span className="label-text">Mode de paiement</span>
              </label>
              <select
                value={modePaiement}
                onChange={(e) => setModePaiement(e.target.value as any)}
                className="select select-bordered w-full"
              >
                <option value="especes">Espèces</option>
                <option value="cheque">Chèque</option>
                <option value="carte">Carte</option>
                <option value="virement">Virement</option>
                <option value="om">Orange Money</option>
                <option value="momo">Mobile Money</option>
              </select>
            </div>

            {/* Liste des paiements ajoutés */}
            {paiements.length > 0 && (
              <div className="bg-base-200 rounded-lg p-3 mb-4">
                <div className="text-xs font-bold mb-2">Paiements enregistrés:</div>
                {paiements.map((p, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-white p-2 rounded mb-1">
                    <span className="text-sm">{p.mode === 'especes' ? 'Espèces' : p.mode === 'carte' ? 'Carte' : p.mode === 'cheque' ? 'Chèque' : p.mode === 'om' ? 'OM' : p.mode === 'momo' ? 'MoMo' : p.mode.toUpperCase()}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{p.montant} F</span>
                      <button 
                        onClick={() => setPaiements(paiements.filter((_, i) => i !== idx))}
                        className="btn btn-ghost btn-xs text-error"
                      >✕</button>
                    </div>
                  </div>
                ))}
                <div className="text-right text-xs mt-2 pt-2 border-t">
                  Total versé: <span className="font-bold">{paiements.reduce((acc, p) => acc + p.montant, 0)} F</span>
                </div>
              </div>
            )}

            <div className="flex gap-2 items-end mb-4">
              <div className="form-control flex-1">
                <label className="label">
                  <span className="label-text">Montant</span>
                </label>
                <input
                  type="number"
                  value={montantPaye}
                  onChange={(e) => setMontantPaye(e.target.value)}
                  className="input input-bordered w-full text-2xl text-center"
                  placeholder={
                    (selectedFacture.part_client !== null && Number(selectedFacture.part_client) >= 0)
                      ? `Part Client: ${Math.round(Number(selectedFacture.part_client))} F`
                      : `${Math.round(Number(selectedFacture.total_ttc))} F`
                  }
                  autoFocus={paiements.length === 0}
                />
              </div>
              <button
                onClick={() => {
                  if (montantPaye && Number(montantPaye) > 0) {
                    setPaiements([...paiements, { mode: modePaiement, montant: Number(montantPaye) }])
                    const reste = Math.max(0, Number(selectedFacture.total_ttc) - paiements.reduce((acc, p) => acc + p.montant, 0) - Number(montantPaye))
                    setMontantPaye(reste > 0 ? reste.toString() : '')
                  }
                }}
                className="btn btn-primary"
                disabled={!montantPaye || Number(montantPaye) <= 0}
              >
                ➕ Ajouter
              </button>
            </div>

            {/* Calcul du rendu avec paiements multiples */}
            {(() => {
              const totalVerse = paiements.reduce((acc, p) => acc + p.montant, 0) + (paiements.length === 0 ? Number(montantPaye) : 0)
              const amountToPay = (selectedFacture.part_client !== null && Number(selectedFacture.part_client) >= 0)
                    ? Number(selectedFacture.part_client)
                    : Number(selectedFacture.total_ttc)
              const rendu = totalVerse - amountToPay
              
              return rendu > 0 && (
                <div className="alert alert-success mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <div className="text-sm">Monnaie à rendre</div>
                    <div className="text-xl font-bold">{rendu.toFixed(0)} F</div>
                  </div>
                </div>
              )
            })()}

            <div className="modal-action">
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="btn btn-ghost"
                disabled={loading}
              >
                Annuler
              </button>
              <button
                onClick={enregistrerPaiement}
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? <span className="loading loading-spinner"></span> : 'Confirmer'}
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setIsPaymentModalOpen(false)}></div>
        </div>
      )}

      {/* Modal Ticket */}
      {showTicketPreview && ticketCaisse && (
        <div className="modal modal-open">
          <div className="modal-box max-w-md mx-4 p-0 overflow-hidden bg-white">
            <div className="bg-base-50 p-4 flex justify-between items-center border-b border-base-200">
              <h3 className="font-bold text-lg">Ticket de Caisse</h3>
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
                <div className="flex justify-between"><span>Ticket:</span><span>#{ticketCaisse.id}</span></div>
                {typeof ticketCaisse.facture === 'object' && ticketCaisse.facture.numero_facture && (
                  <div className="flex justify-between"><span>Facture:</span><span>#{ticketCaisse.facture.numero_facture}</span></div>
                )}
                <div className="flex justify-between"><span>Date:</span><span>{new Date().toLocaleDateString('fr-FR')} {new Date().toLocaleTimeString('fr-FR')}</span></div>
                <div className="flex justify-between"><span>Client:</span><span>{typeof ticketCaisse.facture === 'object' ? ticketCaisse.facture.client_name || 'Passage' : ticketCaisse.client_name || 'Passage'}</span></div>
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
              <button className="btn btn-ghost btn-sm" onClick={() => setShowTicketPreview(false)}>Fermer (Esc)</button>
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
                Imprimer
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
              Générer un Coupon
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
              <button className="btn btn-ghost" onClick={() => setIsGenererCouponModalOpen(false)}>Annuler</button>
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
                <div className="flex justify-between"><span>Status:</span><span className={`badge badge-xs ${couponTrouve.status === 'ACTIF' ? 'badge-success' : 'badge-ghost'}`}>{couponTrouve.status_display}</span></div>
                <div className="flex justify-between"><span>Généré par:</span><span>{couponTrouve.cree_par_nom || 'Système'}</span></div>
                <div className="flex justify-between"><span>Date:</span><span>{new Date(couponTrouve.date_creation).toLocaleString()}</span></div>
                {couponTrouve.notes && <div className="mt-2 p-2 bg-white rounded italic">"{couponTrouve.notes}"</div>}
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
              >Imprimer</button>
              <div className="flex gap-2">
                <button className="btn btn-sm btn-ghost" onClick={() => { setIsDetailsCouponModalOpen(false); setCouponTrouve(null); setSearchCouponNumero(''); }}>Fermer</button>
                {couponTrouve.status === 'ACTIF' && (
                  <button className="btn btn-sm btn-success text-white" onClick={() => handleAppliquerCoupon(couponTrouve)}>Appliquer</button>
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

