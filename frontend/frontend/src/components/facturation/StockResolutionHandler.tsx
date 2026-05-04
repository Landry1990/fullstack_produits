import React, { type Dispatch, type SetStateAction } from 'react'
import StockResolutionModal from './StockResolutionModal'
import type { LigneFacture, Client, ProduitModel } from '../../types'

interface StockResolutionHandlerProps {
    isOpen: boolean
    onClose: () => void
    stockResolutionItems: {product: ProduitModel, quantity: number, stock: number}[]
    
    // Resolution State
    resolutionActions: Record<number, 'promis' | 'force' | 'reduce'>
    setResolutionActions: Dispatch<SetStateAction<Record<number, 'promis' | 'force' | 'reduce'>>>
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
    onComplete: (updatedLignes?: LigneFacture[], sudoCredentials?: { validatorId: number, password: string }) => void
    requireSudo: (onSuccess: (validatorId: number, password: string) => void | Promise<void>, options?: any) => void
}

export const StockResolutionHandler: React.FC<StockResolutionHandlerProps> = ({
    isOpen,
    onClose,
    stockResolutionItems,
    resolutionActions,
    setResolutionActions,
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
    onComplete,
    requireSudo
}) => {
    

    const handleConfirm = () => {
        // Apply Resolution actions to the invoice lines
        const updatedLignes = lignesFacture.map(ligne => {
            const action = resolutionActions[ligne.produit.id]
            
            if (action === 'promis') {
                const stock = Math.max(0, ligne.produit.stock ?? 0)
                const promisQty = Math.max(0, ligne.quantite - stock)
                return {
                    ...ligne,
                    isPromis: true,
                    promisQuantity: promisQty,
                    promisPhone: promisPhone || undefined,
                    // The line quantity for the invoice remains the original requested quantity
                    // The backend will subtract promisQuantity from the destocking
                }
            } else if (action === 'reduce') {
                const stock = Math.max(0, ligne.produit.stock ?? 0)
                return {
                    ...ligne,
                    quantite: stock,
                    isPromis: false,
                    promisQuantity: 0
                }
            } else {
                // Action 'force' OR default (not in conflict)
                return {
                    ...ligne,
                    isPromis: false,
                    promisQuantity: 0,
                }
            }
        }).filter(l => l.quantite > 0 || l.promisQuantity > 0) // Remove lines with 0 in both (e.g. reduce to 0 with no promis)
        
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
        const hasForceSale = updatedLignes.some(l => {
            const stock = l.produit.stock ?? 0
            return !l.isPromis && l.quantite > stock
        })

        if (hasForceSale) {
            onClose()
            requireSudo(async (validatorId, password) => {
                onComplete(updatedLignes, { validatorId, password })
            }, {
                title: `Validation Vente Forcée / Stock Insuffisant`,
                message: `Confirmer la vente forcée de produits avec stock insuffisant ? Cette action créera un stock négatif.`
            });
        } else {
            onClose()
            onComplete(updatedLignes)
        }
    }

    if (!isOpen) return null

    return (
        <StockResolutionModal
            isOpen={isOpen}
            onClose={onClose}
            stockResolutionItems={stockResolutionItems}
            onConfirm={handleConfirm}
            resolutionActions={resolutionActions}
            setResolutionActions={setResolutionActions}
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
