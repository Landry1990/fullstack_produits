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
    
    // Completion Callback
    onComplete: (sudoCredentials?: { validatorId: number, password: string }) => void
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
        // Apply Promis selections to the invoice lines
        const updatedLignes = lignesFacture.map(ligne => {
            if (promisSelections.has(ligne.produit.id)) {
                // Logic: PromisQty = Demanded - Available. Available = Max(0, Stock).
                const stock = Math.max(0, ligne.produit.stock ?? 0)
                const promisQty = Math.max(0, ligne.quantite - stock)
                return {
                    ...ligne,
                    isPromis: true,
                    promisQuantity: promisQty,
                    promisPhone: promisPhone || undefined
                }
            } else {
                // Forced sale 
                return {
                    ...ligne,
                    isPromis: false,
                    promisQuantity: 0,
                }
            }
        })
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

        if (hasForceSale) {
            requireSudo(async (validatorId, password) => {
                onClose() // Close Stock Modal
                onComplete({ validatorId, password }) // Trigger Payment Modal with creds
            }, {
                title: `Validation Vente à Perte / Stock Insuffisant`,
                message: `Confirmer la vente forcée de produits avec stock insuffisant ?`
            });
        } else {
            onClose()
            onComplete()
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
