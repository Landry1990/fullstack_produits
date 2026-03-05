import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import type { Commande, CommandeProduit, Fournisseur, ProduitModel } from '../../types';

// Helper function for Date format MM/YY
function parseMMYYToDate(mmyy: string | null | undefined): string | null {
    if (!mmyy) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(mmyy)) return mmyy; // Already ISO
    
    const parts = mmyy.split('/');
    if (parts.length === 2 && parts[1].length === 2) {
        const month = parseInt(parts[0], 10);
        const year = parseInt('20' + parts[1], 10);
        if (month >= 1 && month <= 12) {
             const lastDay = new Date(year, month, 0).getDate();
             return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        }
    }
    return null; 
}

interface TransferCommandeModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedProducts: CommandeProduit[];
    fournisseurs: Fournisseur[];
    currentSupplierId: string;
    produitsList: ProduitModel[];
    apiBaseUrl: string;
    commandesEndpoint: string;
    fournisseursEndpoint: string;
    onTransferSuccess: (transferredCount: number, supplierName: string, newCommandeId: number) => void;
}

export default function TransferCommandeModal({
    isOpen,
    onClose,
    selectedProducts,
    fournisseurs,
    currentSupplierId,
    produitsList,
    apiBaseUrl,
    commandesEndpoint,
    fournisseursEndpoint,
    onTransferSuccess
}: TransferCommandeModalProps) {
    const [transferTargetFournisseur, setTransferTargetFournisseur] = useState('');
    const [transferCataloguePrices, setTransferCataloguePrices] = useState<Map<number, number>>(new Map());
    const [loadingCatalogue, setLoadingCatalogue] = useState(false);

    // Reset state on open
    useEffect(() => {
        if (isOpen) {
            setTransferTargetFournisseur('');
            setTransferCataloguePrices(new Map());
        }
    }, [isOpen]);

    // Récupérer les prix du catalogue
    const fetchCataloguePrices = async (fournisseurId: string) => {
        if (!fournisseurId) {
            setTransferCataloguePrices(new Map());
            return;
        }

        setLoadingCatalogue(true);
        try {
            const catalogueEndpoint = `${fournisseursEndpoint}${fournisseurId}/catalogue/`;
            const response = await axios.get(catalogueEndpoint);
            const produits = response.data?.produits || [];

            const priceMap = new Map<number, number>();
            produits.forEach((item: { produit_id: number; dernier_prix_achat: number }) => {
                priceMap.set(item.produit_id, item.dernier_prix_achat);
            });
            setTransferCataloguePrices(priceMap);
        } catch (err) {
            console.error('Erreur chargement catalogue:', err);
            setTransferCataloguePrices(new Map());
        } finally {
            setLoadingCatalogue(false);
        }
    };

    const handleSupplierChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        setTransferTargetFournisseur(val);
        fetchCataloguePrices(val);
    };

    // Calculer le gain/perte
    const transferCalc = useMemo(() => {
        let totalCurrentCost = 0;
        let totalNewCost = 0;
        let productsWithPricing = 0;
        let productsWithoutPricing = 0;

        selectedProducts.forEach(p => {
            const produitId = typeof p.produit === 'object' ? p.produit.id : p.produit;
            const currentPrice = parseFloat(String(p.price || 0));
            const quantity = parseInt(String(p.quantity || 0));
            const currentTotal = currentPrice * quantity;
            totalCurrentCost += currentTotal;

            const newPrice = transferCataloguePrices.get(produitId);
            if (newPrice !== undefined) {
                totalNewCost += newPrice * quantity;
                productsWithPricing++;
            } else {
                totalNewCost += currentTotal;
                productsWithoutPricing++;
            }
        });

        const difference = totalCurrentCost - totalNewCost;
        return {
            totalCurrentCost,
            totalNewCost,
            difference,
            isGain: difference > 0,
            productsWithPricing,
            productsWithoutPricing
        };
    }, [selectedProducts, transferCataloguePrices]);

    const handleTransfer = async () => {
        if (!transferTargetFournisseur) {
            toast.error('Veuillez sélectionner un fournisseur de destination.');
            return;
        }

        try {
            // 1. Créer une nouvelle commande
            const newCommandePayload = {
                fournisseur: parseInt(transferTargetFournisseur, 10),
                numero_facture: '',
            };
            const { data: newCommande } = await axios.post<Commande>(commandesEndpoint, newCommandePayload);

            // 2. Ajouter les produits transférés
            const commandeProduitsEndpoint = apiBaseUrl
                ? `${String(apiBaseUrl).replace(/\/$/, '')}/api/commande-produits/`
                : '/api/commande-produits/';

            for (const p of selectedProducts) {
                const produitId = typeof p.produit === 'object' ? p.produit.id : p.produit;
                const newPrice = transferCataloguePrices.get(produitId);
                const priceToUse = newPrice !== undefined ? newPrice : parseFloat(String(p.price || 0));

                const payload = {
                    commande: newCommande.id,
                    produit: produitId,
                    quantity: parseInt(String(p.quantity || 1)),
                    unites_gratuites: parseInt(String(p.unites_gratuites || 0)),
                    price: priceToUse.toFixed(0),
                    price_cost: priceToUse.toFixed(0),
                    selling_price: parseFloat(String(p.selling_price || 0)).toFixed(0),
                    tva: parseFloat(String(p.tva || 0)).toFixed(0),
                    marge: parseFloat(String(p.marge || 1.3)).toFixed(4),
                    lot: p.lot || null,
                    date_expiration: parseMMYYToDate(p.date_expiration), 
                };
                
                 // Note: Commandes.tsx had parseMMYYToDate logic.  
                 // Usually date_expiration in p is already string.
                 // If it's MM/YY, the backend might need parsing. 
                 // The original code used parseMMYYToDate(p.date_expiration). 
                 // We should replicate that or import the helper.
                 // For now, let's assume we need to parse if it's not ISO.
                 // But simply passing p.date_expiration might be enough if it's already proper format 
                 // or if we duplicate the helper.
                 // Let's duplicate the helper for safety or better, import it? 
                 // It's not exported. I will quickly add the helper here.
                
                await axios.post(commandeProduitsEndpoint, payload);
            }

            const fournisseurName = fournisseurs.find(f => f.id === parseInt(transferTargetFournisseur))?.name || 'Inconnu';
            onTransferSuccess(selectedProducts.length, fournisseurName, newCommande.id);
            onClose();

        } catch (err) {
            console.error('Erreur lors du transfert:', err);
            toast.error('Erreur lors du transfert des produits.');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-2xl">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                    ➡️ Transférer vers un autre fournisseur
                </h3>

                <p className="text-sm text-base-content/70 mb-4">
                    Les produits sélectionnés seront retirés de cette commande et ajoutés à une <strong>nouvelle commande</strong> chez le fournisseur choisi.
                </p>

                {/* Sélection du fournisseur */}
                <div className="form-control mb-4">
                    <label className="label">
                        <span className="label-text font-semibold">Fournisseur de destination</span>
                    </label>
                    <select
                        className="select select-bordered w-full"
                        value={transferTargetFournisseur}
                        onChange={handleSupplierChange}
                    >
                        <option value="">Sélectionnez un fournisseur...</option>
                        {fournisseurs
                            .filter(f => f.id !== parseInt(currentSupplierId || '0'))
                            .map(f => (
                                <option key={f.id} value={f.id}>{f.name}</option>
                            ))
                        }
                    </select>
                </div>

                {/* Liste des produits à transférer */}
                <div className="bg-base-200 rounded-lg p-4 mb-4 max-h-60 overflow-y-auto">
                    <h4 className="font-semibold text-sm mb-2">Produits à transférer ({selectedProducts.length})</h4>
                    <div className="space-y-2">
                        {selectedProducts.map((p, i) => {
                            const produitId = typeof p.produit === 'object' ? p.produit.id : p.produit;
                            let produitName = '';
                            if (typeof p.produit === 'object' && p.produit.name) {
                                produitName = p.produit.name;
                            } else if ((p as any).produit_nom) {
                                produitName = (p as any).produit_nom;
                            } else {
                                const found = produitsList.find(prod => prod.id === produitId);
                                produitName = found?.name || `Produit #${produitId}`;
                            }
                            const currentPrice = parseFloat(String(p.price || 0));
                            const quantity = parseInt(String(p.quantity || 0));
                            const newPrice = transferCataloguePrices.get(produitId);
                            const hasPriceInfo = newPrice !== undefined;
                            const priceDiff = hasPriceInfo ? currentPrice - newPrice : 0;

                            return (
                                <div key={i} className="flex justify-between items-center text-sm bg-white p-2 rounded">
                                    <div>
                                        <span className="font-medium">{produitName}</span>
                                        <span className="text-base-content/50 ml-2">(Qté: {quantity})</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-base-content/60">{currentPrice.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} F</span>
                                        {hasPriceInfo && (
                                            <>
                                                <span className="text-base-content/40">→</span>
                                                <span className={newPrice < currentPrice ? 'text-success font-semibold' : newPrice > currentPrice ? 'text-error font-semibold' : ''}>
                                                    {newPrice.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} F
                                                </span>
                                                {priceDiff !== 0 && (
                                                    <span className={`badge badge-xs ${priceDiff > 0 ? 'badge-success' : 'badge-error'}`}>
                                                        {priceDiff > 0 ? '+' : ''}{(priceDiff * quantity).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} F
                                                    </span>
                                                )}
                                            </>
                                        )}
                                        {!hasPriceInfo && transferTargetFournisseur && !loadingCatalogue && (
                                            <span className="badge badge-ghost badge-xs">Prix inconnu</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Résumé Gain/Perte */}
                {transferTargetFournisseur && (
                    <div className="bg-base-100 border border-base-300 rounded-lg p-4 mb-4">
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                                <div className="text-xs text-base-content/50 uppercase">Coût actuel</div>
                                <div className="font-bold">{transferCalc.totalCurrentCost.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} F</div>
                            </div>
                            <div>
                                <div className="text-xs text-base-content/50 uppercase">Nouveau coût</div>
                                <div className="font-bold">{transferCalc.totalNewCost.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} F</div>
                            </div>
                            <div>
                                <div className="text-xs text-base-content/50 uppercase">
                                    {transferCalc.isGain ? 'Économie' : 'Surcoût'}
                                </div>
                                <div className={`font-bold text-lg ${transferCalc.isGain ? 'text-success' : transferCalc.difference < 0 ? 'text-error' : ''}`}>
                                    {transferCalc.isGain ? '+' : ''}{transferCalc.difference.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} F
                                </div>
                            </div>
                        </div>
                        {transferCalc.productsWithoutPricing > 0 && (
                            <div className="mt-2 text-xs text-warning text-center">
                                ⚠️ {transferCalc.productsWithoutPricing} produit(s) sans historique de prix chez ce fournisseur
                            </div>
                        )}
                    </div>
                )}

                {loadingCatalogue && (
                    <div className="flex items-center justify-center py-4">
                        <span className="loading loading-spinner loading-sm mr-2"></span>
                        Chargement des prix...
                    </div>
                )}

                <div className="modal-action">
                    <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={onClose}
                    >
                        Annuler
                    </button>
                    <button
                        type="button"
                        className="btn btn-info"
                        onClick={handleTransfer}
                        disabled={!transferTargetFournisseur || loadingCatalogue}
                    >
                        Transférer {selectedProducts.length} produit(s)
                    </button>
                </div>
            </div>
            <div className="modal-backdrop" onClick={onClose}></div>
        </div>
    );
}
