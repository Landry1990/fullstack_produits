import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { toast } from 'react-hot-toast';
import type { Commande, CommandeProduit, Fournisseur, ProduitModel } from '../../types';
import { formatCurrency } from '../../utils/formatters';

interface TransferCommandeModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedProducts: CommandeProduit[];
    fournisseurs: Fournisseur[];
    currentSupplierId: string;
    produitsList: ProduitModel[];
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
    commandesEndpoint,
    fournisseursEndpoint,
    onTransferSuccess
}: TransferCommandeModalProps) {
    const { t } = useTranslation(['orders', 'common']);
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
            const response = await api.get(catalogueEndpoint);
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
            const produitId = (p.produit && typeof p.produit === 'object') ? p.produit.id : p.produit;
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
            toast.error(t('orders:transfer_modal.select_supplier_error'));
            return;
        }

        try {
            // 1. Créer une nouvelle commande
            const newCommandePayload = {
                fournisseur: parseInt(transferTargetFournisseur, 10),
                numero_facture: '',
            };
            const { data: newCommande } = await api.post<Commande>(commandesEndpoint, newCommandePayload);

            // 2. Ajouter les produits transférés
            for (const p of selectedProducts) {
                const payload = {
                    commande: newCommande.id,
                    produit: typeof p.produit === 'object' ? p.produit.id : p.produit,
                    quantity: parseInt(String(p.quantity || 0)),
                    unites_gratuites: parseInt(String(p.unites_gratuites || 0)),
                    price: parseFloat(String(p.price || 0)).toFixed(0),
                    price_cost: parseFloat(String(p.price || 0)).toFixed(0),
                    selling_price: parseFloat(String(p.selling_price || 0)).toFixed(0),
                    prix_euro: p.prix_euro ? parseFloat(String(p.prix_euro)).toFixed(0) : null,
                    tva: parseFloat(String(p.tva || 0)).toFixed(0),
                    marge: parseFloat(String(p.marge || 1.3)).toFixed(4),
                    lot: p.lot || null,
                    date_expiration: p.date_expiration || null,
                };
                
                await api.post('commande-produits/', payload);
            }

            const fournisseurName = fournisseurs.find(f => f.id === parseInt(transferTargetFournisseur))?.name || 'Inconnu';
            onTransferSuccess(selectedProducts.length, fournisseurName, newCommande.id);
            onClose();

        } catch (err) {
            console.error('Erreur lors du transfert:', err);
            toast.error(t('orders:transfer_modal.transfer_error'));
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-2xl">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                    {t('orders:transfer_modal.title')}
                </h3>

                <p className="text-sm text-base-content/70 mb-4"
                   dangerouslySetInnerHTML={{ __html: t('orders:transfer_modal.description') }}
                />

                {/* Sélection du fournisseur */}
                <div className="form-control mb-4">
                    <label className="label">
                        <span className="label-text font-semibold">{t('orders:transfer_modal.supplier_label')}</span>
                    </label>
                    <select
                        className="select select-bordered w-full"
                        value={transferTargetFournisseur}
                        onChange={handleSupplierChange}
                    >
                        <option value="">{t('orders:transfer_modal.select_supplier')}</option>
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
                    <h4 className="font-semibold text-sm mb-2">{t('orders:transfer_modal.products_title', { count: selectedProducts.length })}</h4>
                    <div className="space-y-2">
                        {selectedProducts.map((p, i) => {
                            const produitId = (p.produit && typeof p.produit === 'object') ? p.produit.id : p.produit;
                            let produitName = '';
                            if (p.produit && typeof p.produit === 'object' && p.produit.name) {
                                produitName = p.produit.name;
                            } else if ((p as any).produit_nom) {
                                produitName = (p as any).produit_nom;
                            } else {
                                const found = produitsList.find(prod => prod.id === produitId);
                                produitName = found?.name || `Produit #${produitId}`;
                            }
                            const isDeleted = p.produit === null || produitName.includes('(supprimé)');
                            const currentPrice = parseFloat(String(p.price || 0));
                            const quantity = parseInt(String(p.quantity || 0));
                            const newPrice = transferCataloguePrices.get(produitId);
                            const hasPriceInfo = newPrice !== undefined;
                            const priceDiff = hasPriceInfo ? currentPrice - newPrice : 0;

                            return (
                                <div key={i} className="flex justify-between items-center text-sm bg-base-100 p-2 rounded">
                                    <div>
                                        <span className={`font-medium ${isDeleted ? 'italic text-base-content/50' : ''}`}>
                                            {produitName}
                                        </span>
                                        <span className="text-base-content/50 ml-2">({t('orders:transfer_modal.qty_label', { qty: quantity })})</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-base-content/60">{formatCurrency(currentPrice)}</span>
                                        {hasPriceInfo && (
                                            <>
                                                <span className="text-base-content/40">→</span>
                                                <span className={newPrice < currentPrice ? 'text-success font-semibold' : newPrice > currentPrice ? 'text-error font-semibold' : ''}>
                                                    {formatCurrency(newPrice)}
                                                </span>
                                                {priceDiff !== 0 && (
                                                    <span className={`badge badge-xs ${priceDiff > 0 ? 'badge-success' : 'badge-error'}`}>
                                                        {priceDiff > 0 ? '+' : ''}{formatCurrency(priceDiff * quantity)}
                                                    </span>
                                                )}
                                            </>
                                        )}
                                        {!hasPriceInfo && transferTargetFournisseur && !loadingCatalogue && (
                                            <span className="badge badge-ghost badge-xs">{t('orders:transfer_modal.unknown_price')}</span>
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
                                <div className="text-xs text-base-content/50 uppercase">{t('orders:transfer_modal.current_cost')}</div>
                                <div className="font-bold">{formatCurrency(transferCalc.totalCurrentCost)}</div>
                            </div>
                            <div>
                                <div className="text-xs text-base-content/50 uppercase">{t('orders:transfer_modal.new_cost')}</div>
                                <div className="font-bold">{formatCurrency(transferCalc.totalNewCost)}</div>
                            </div>
                            <div>
                                <div className="text-xs text-base-content/50 uppercase">
                                    {transferCalc.isGain ? t('orders:transfer_modal.savings') : t('orders:transfer_modal.overspend')}
                                </div>
                                <div className={`font-bold text-lg ${transferCalc.isGain ? 'text-success' : transferCalc.difference < 0 ? 'text-error' : ''}`}>
                                    {transferCalc.isGain ? '+' : ''}{formatCurrency(transferCalc.difference)}
                                </div>
                            </div>
                        </div>
                        {transferCalc.productsWithoutPricing > 0 && (
                            <div className="mt-2 text-xs text-warning text-center">
                                {t('orders:transfer_modal.no_price_warning', { count: transferCalc.productsWithoutPricing })}
                            </div>
                        )}
                    </div>
                )}

                {loadingCatalogue && (
                    <div className="flex items-center justify-center py-4">
                        <span className="loading loading-spinner loading-sm mr-2"></span>
                        {t('orders:transfer_modal.loading_prices')}
                    </div>
                )}

                <div className="modal-action">
                    <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={onClose}
                    >
                        {t('orders:transfer_modal.cancel')}
                    </button>
                    <button
                        type="button"
                        className="btn btn-info"
                        onClick={handleTransfer}
                        disabled={!transferTargetFournisseur || loadingCatalogue}
                    >
                        {t('orders:transfer_modal.transfer_btn', { count: selectedProducts.length })}
                    </button>
                </div>
            </div>
            <div className="modal-backdrop" onClick={onClose}></div>
        </div>
    );
}
