import { useState, useCallback } from 'react'
import type { ProduitModel, Facture, TicketCaisse, OrdonnanceData, Client, TotalsData } from '../types'
import { calculateFactureTotals } from '../utils/finance'

export interface FacturationUIState {
    // Modals Visibility
    isPaymentModalOpen: boolean
    showTicketPreview: boolean
    showStockResolution: boolean
    showOrdonnanceModal: boolean
    isScannerModalOpen: boolean

    // Data for Modals
    paymentModalData: {
        facture: Facture | null
    }
    ticketPreviewData: {
        ticket: TicketCaisse | null
    }
    stockResolutionData: {
        items: { product: ProduitModel, quantity: number, stock: number }[]
        resolutionActions: Record<number, 'promis' | 'force' | 'reduce'>
        promisPhone: string
        promisClientName: string
    }
    lotModal: {
        isOpen: boolean
        product: ProduitModel | null
        currentLotId: string | null
    }
    confirmModal: {
        isOpen: boolean
        message: string
        onConfirm: () => void
    } | null

    alertTarget: {
        type: 'product' | 'client'
        id: number
        name: string
        currentMessage: string
    } | null
    isAlertModalOpen: boolean

    displayAlertQueue: { id: string; title: string; message: string; type: 'product'|'client'; is_blocking: boolean; targetId?: number }[]
    popDisplayAlert: () => void
    pushDisplayAlert: (alert: { title: string; message: string; type: 'product'|'client'; is_blocking: boolean; targetId?: number }) => void

    // Payment State
    modePaiement: 'especes' | 'cheque' | 'carte' | 'virement' | 'en_compte'
    montantPaye: string
    paiements: { mode: string; montant: number; part_patient?: number | null; part_assurance?: number | null }[]
    reference: string

    // Global Discount
    remiseGlobale: string
    remiseMode: 'montant' | 'taux'

    // Devis / Modification
    devisIdToValidate: number | null
    isModificationMode: boolean
    modificationInvoiceId: number | null
    modificationInvoiceStatus: string | null
    originalTotalTtc: number

    // Ordonnancier
    tempOrdonnanceData: OrdonnanceData | null
    pendingOrdonnanceFacture: Facture | null
    prescriptionImage: File | null
}

export function useFacturationUI() {
    // --- STATE DEFINITIONS ---

    // Global Discount
    const [remiseGlobale, setRemiseGlobale] = useState('0')
    const [remiseMode, setRemiseMode] = useState<'montant' | 'taux'>('montant')

    // Payment Form State
    const [modePaiement, setModePaiement] = useState<'especes' | 'cheque' | 'carte' | 'virement' | 'en_compte'>('especes')
    const [montantPaye, setMontantPaye] = useState('')
    const [paiements, setPaiements] = useState<{ mode: string; montant: number; part_patient?: number | null; part_assurance?: number | null }[]>([])
    const [reference, setReference] = useState('')

    // Modals State
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
    const [facturePourPaiement, setFacturePourPaiement] = useState<Facture | null>(null)

    const [showTicketPreview, setShowTicketPreview] = useState(false)
    const [ticketCaisse, setTicketCaisse] = useState<TicketCaisse | null>(null)

    const [showStockResolution, setShowStockResolution] = useState(false)
    const [stockResolutionItems, setStockResolutionItems] = useState<{ product: ProduitModel, quantity: number, stock: number }[]>([])
    const [resolutionActions, setResolutionActions] = useState<Record<number, 'promis' | 'force' | 'reduce'>>({})
    const [promisPhone, setPromisPhone] = useState('')
    const [promisClientName, setPromisClientName] = useState('')

    const [lotModal, setLotModal] = useState<{
        isOpen: boolean
        product: ProduitModel | null
        currentLotId: string | null
    }>({
        isOpen: false,
        product: null,
        currentLotId: null
    })

    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        message: string;
        onConfirm: () => void;
    } | null>(null)

    const [alertTarget, setAlertTarget] = useState<{
        type: 'product' | 'client'
        id: number
        name: string
        currentMessage: string
    } | null>(null)
    const [isAlertModalOpen, setIsAlertModalOpen] = useState(false)

    const [displayAlertQueue, setDisplayAlertQueue] = useState<{ id: string; title: string; message: string; type: 'product'|'client'; is_blocking: boolean; targetId?: number }[]>([])
    
    const popDisplayAlert = useCallback(() => {
        setDisplayAlertQueue(prev => prev.slice(1))
    }, [])

    const pushDisplayAlert = useCallback((alert: { title: string; message: string; type: 'product'|'client'; is_blocking: boolean; targetId?: number }) => {
        setDisplayAlertQueue(prev => [...prev, { ...alert, id: Math.random().toString(36).substring(7) }])
    }, [])

    // Ordonnancier State
    const [showOrdonnanceModal, setShowOrdonnanceModal] = useState(false)
    const [tempOrdonnanceData, setTempOrdonnanceData] = useState<OrdonnanceData | null>(null)
    const [pendingOrdonnanceFacture, setPendingOrdonnanceFacture] = useState<Facture | null>(null)
    const [isScannerModalOpen, setIsScannerModalOpen] = useState(false)
    const [prescriptionImage, setPrescriptionImage] = useState<File | null>(null)

    // Devis / Modification State
    const [devisIdToValidate, setDevisIdToValidate] = useState<number | null>(null)
    const [isModificationMode, setIsModificationMode] = useState(false)
    const [modificationInvoiceId, setModificationInvoiceId] = useState<number | null>(null)
    const [modificationInvoiceStatus, setModificationInvoiceStatus] = useState<string | null>(null)
    const [originalTotalTtc, setOriginalTotalTtc] = useState<number>(0)
    const [isAvoirClient, setIsAvoirClient] = useState(false)


    // --- HELPERS ---

    const resetUIState = useCallback(() => {
        setRemiseGlobale('0')
        setRemiseMode('montant')
        setModePaiement('especes')
        setMontantPaye('')
        setPaiements([])
        setReference('')
        setFacturePourPaiement(null)
        setTicketCaisse(null)
        setStockResolutionItems([])
        setResolutionActions({})
        setPromisPhone('')
        setPromisClientName('')
        setTempOrdonnanceData(null)
        setPendingOrdonnanceFacture(null)
        setIsScannerModalOpen(false)
        setPrescriptionImage(null)
        setDevisIdToValidate(null)
        setIsModificationMode(false)
        setModificationInvoiceId(null)
        setModificationInvoiceStatus(null)
        setOriginalTotalTtc(0)
        setIsAvoirClient(false)
    }, [])

    const openPaymentModal = useCallback((facture?: Facture) => {
        if (facture) setFacturePourPaiement(facture)
        // Réinitialiser les états de paiement sauf montantPaye (pré-rempli par l'appelant)
        setPaiements([])
        setModePaiement('especes')
        setReference('')
        setIsPaymentModalOpen(true)
    }, [])

    const closePaymentModal = useCallback(() => {
        setIsPaymentModalOpen(false)
        setFacturePourPaiement(null)
    }, [])

    const openLotModal = useCallback((product: ProduitModel, currentLotId: string | null) => {
        setLotModal({ isOpen: true, product, currentLotId })
    }, [])

    const closeLotModal = useCallback(() => {
        setLotModal(prev => ({ ...prev, isOpen: false }))
    }, [])

    // --- TOTALS CALCULATION ---
    const calculateTotals = useCallback((
        cartStats: { sousTotal: number, totalTva: number, totalTTC: number, totalBuyHT?: number },
        selectedClient: Client | null | undefined
    ): TotalsData => {
        return calculateFactureTotals({ ...cartStats, totalBuyHT: cartStats.totalBuyHT ?? 0 }, selectedClient, remiseGlobale, remiseMode);
    }, [remiseGlobale, remiseMode])

    return {
        // States
        remiseGlobale, setRemiseGlobale,
        remiseMode, setRemiseMode,
        modePaiement, setModePaiement,
        montantPaye, setMontantPaye,
        paiements, setPaiements,
        reference, setReference,

        isPaymentModalOpen,
        facturePourPaiement,
        openPaymentModal,
        closePaymentModal,

        showTicketPreview, setShowTicketPreview,
        ticketCaisse, setTicketCaisse,

        showStockResolution, setShowStockResolution,
        stockResolutionItems, setStockResolutionItems,
        resolutionActions, setResolutionActions,
        promisPhone, setPromisPhone,
        promisClientName, setPromisClientName,

        lotModal, openLotModal, closeLotModal,
        confirmModal, setConfirmModal,

        alertTarget, setAlertTarget,
        isAlertModalOpen, setIsAlertModalOpen,

        displayAlertQueue, popDisplayAlert, pushDisplayAlert,

        showOrdonnanceModal, setShowOrdonnanceModal,
        tempOrdonnanceData, setTempOrdonnanceData,
        pendingOrdonnanceFacture, setPendingOrdonnanceFacture,
        isScannerModalOpen, setIsScannerModalOpen,
        prescriptionImage, setPrescriptionImage,

        devisIdToValidate, setDevisIdToValidate,
        isModificationMode, setIsModificationMode,
        modificationInvoiceId, setModificationInvoiceId,
        modificationInvoiceStatus, setModificationInvoiceStatus,
        originalTotalTtc, setOriginalTotalTtc,
        isAvoirClient, setIsAvoirClient,

        // Actions
        resetUIState,
        calculateTotals
    }
}
