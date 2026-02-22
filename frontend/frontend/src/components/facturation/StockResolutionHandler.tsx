import React from 'react'
import StockResolutionModal from './StockResolutionModal'
import { useSudo } from '../../hooks/useSudo'
import type { LigneFacture, Client, ProduitModel } from '../../types'

interface StockResolutionHandlerProps {
    isOpen: boolean
    onClose: () => void
    stockResolutionItems: {product: ProduitModel, quantity: number, stock: number}[]
    
    // Promis State
    promisSelections: Set<number>
    setPromisSelections: (ids: Set<number>) => void
    promisPhone: string
    setPromisPhone: (phone: string) => void
    promisClientName: string
    setPromisClientName: (name: string) => void
    
    // Cart Actions
    lignesFacture: LigneFacture[]
    setLignesFacture: React.Dispatch<React.SetStateAction<LigneFacture[]>>
    
    // Client Actions
    clients: Client[]
    selectedClient: number | null
    setSelectedClient: (id: number | null) => void
    useManualClient: boolean
    setUseManualClient: (val: boolean) => void
    setManualClientName: (name: string) => void
    
    // Completion Callback - receives updated lines to avoid state update timing issues
    onComplete: (updatedLignes?: LigneFacture[], sudoCredentials?: { validatorId: number, password: string }) => void
}

export const StockResolutionHandler: React.FC<StockResolutionHandlerProps> = ({
    isOpen,
    onClose,
    stockResolutionItems,
    promisSelections,
    setPromisSelections,
    promisPhone,
    setPromisPhone,
    promisClientName,
    setPromisClientName,
    lignesFacture,
    setLignesFacture,
    clients,
    selectedClient,
    setSelectedClient,
    useManualClient,
    setUseManualClient,
    setManualClientName,
    onComplete
}) => {
    
    const { requireSudo } = useSudo()

    const handleConfirm = () => {
        console.log('[DEBUG StockResolutionHandler] handleConfirm appelé')
        console.log('[DEBUG StockResolutionHandler] lignesFacture initiales:', lignesFacture)
        console.log('[DEBUG StockResolutionHandler] promisSelections:', Array.from(promisSelections))
        console.log('[DEBUG StockResolutionHandler] promisPhone:', promisPhone)
        console.log('[DEBUG StockResolutionHandler] promisClientName:', promisClientName)
        
        // Apply Promis selections to the invoice lines
        const updatedLignes = lignesFacture.map(ligne => {
            if (promisSelections.has(ligne.produit.id)) {
                // Logic: PromisQty = Demanded - Available. Available = Max(0, Stock).
                const stock = Math.max(0, ligne.produit.stock ?? 0)
                const promisQty = Math.max(0, ligne.quantite - stock)
                console.log(`[DEBUG StockResolutionHandler] Produit ${ligne.produit.id} (${ligne.produit.name}) marqué comme PROMIS. Stock: ${stock}, Qty: ${ligne.quantite}, PromisQty: ${promisQty}`)
                return {
                    ...ligne,
                    isPromis: true,
                    promisQuantity: promisQty,
                    promisPhone: promisPhone || undefined
                }
            } else {
                // Forced sale 
                console.log(`[DEBUG StockResolutionHandler] Produit ${ligne.produit.id} (${ligne.produit.name}) marqué comme FORCED SALE`)
                return {
                    ...ligne,
                    isPromis: false,
                    promisQuantity: 0,
                }
            }
        })
        
        console.log('[DEBUG StockResolutionHandler] updatedLignes après traitement:', updatedLignes)
        console.log('[DEBUG StockResolutionHandler] Lignes avec isPromis=true:', updatedLignes.filter(l => l.isPromis))
        console.log('[DEBUG StockResolutionHandler] Lignes avec isPromis=false:', updatedLignes.filter(l => !l.isPromis))
        
        setLignesFacture(updatedLignes)
        
        // Update Client Name if provided in modal logic
        if (promisClientName.trim() !== '') {
            if (!selectedClient || useManualClient) {
                setUseManualClient(true)
                setManualClientName(promisClientName)
                setSelectedClient(null)
            }
        }

        // CHECK IF SUDO IS NEEDED FOR FORCE SALE
        const hasForceSale = updatedLignes.some(l => !l.isPromis && l.quantite > (l.produit.stock || 0));
        console.log('[DEBUG StockResolutionHandler] hasForceSale:', hasForceSale)

        if (hasForceSale) {
            console.log('[DEBUG StockResolutionHandler] Requiert SUDO pour vente forcée')
            requireSudo(async (validatorId, password) => {
                console.log('[DEBUG StockResolutionHandler] SUDO validé, fermeture du modal et appel onComplete avec credentials et lignes mises à jour')
                onClose() // Close Stock Modal
                onComplete(updatedLignes, { validatorId, password }) // Trigger Payment Modal with creds and updated lines
            }, {
                title: `Validation Vente à Perte / Stock Insuffisant`,
                message: `Confirmer la vente forcée de produits avec stock insuffisant ?`
            });
        } else {
            console.log('[DEBUG StockResolutionHandler] Pas de vente forcée, fermeture du modal et appel onComplete() avec lignes mises à jour')
            onClose()
            onComplete(updatedLignes) // Pass updated lines directly to avoid state timing issues
        }
    }

    if (!isOpen) return null

    return (
        <StockResolutionModal
            isOpen={isOpen}
            onClose={onClose}
            stockResolutionItems={stockResolutionItems}
            onConfirm={handleConfirm}
            promisSelections={promisSelections}
            setPromisSelections={setPromisSelections}
            promisPhone={promisPhone}
            setPromisPhone={setPromisPhone}
            promisClientName={promisClientName}
            setPromisClientName={setPromisClientName}
            clients={clients}
            selectedClientName={
                useManualClient 
                    ? undefined 
                    : (clients.find(c => c.id === selectedClient)?.name)
            }
        />
    )
}
