import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import api from '../../services/api';
import { gooeyToast } from 'goey-toast';
import type { Commande, CommandeProduit, Fournisseur, ProduitModel } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { Button } from '../shadcn/button';
import { logger } from '../../utils/logger';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '../shadcn/dialog';
import { Select } from '../shadcn/select';

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

    useEffect(() => {
        if (isOpen) {
            setTransferTargetFournisseur('');
            setTransferCataloguePrices(new Map());
        }
    }, [isOpen]);

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
            logger.error('Erreur chargement catalogue:', err);
            setTransferCataloguePrices(new Map());
        } finally {
            setLoadingCatalogue(false);
        }
    };

    const handleSupplierChange = (value: string) => {
        setTransferTargetFournisseur(value);
        fetchCataloguePrices(value);
    };

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
            gooeyToast.error(t('orders:transfer_modal.select_supplier_error'));
            return;
        }

        try {
            const newCommandePayload = {
                fournisseur: parseInt(transferTargetFournisseur, 10),
                numero_facture: '',
            };
            const { data: newCommande } = await api.post<Commande>(commandesEndpoint, newCommandePayload);

            await Promise.all(selectedProducts.map(async (p) => {
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
            }));

            const fournisseurName = fournisseurs.find(f => f.id === parseInt(transferTargetFournisseur))?.name || t('common:unknown');
            onTransferSuccess(selectedProducts.length, fournisseurName, newCommande.id);
            onClose();

        } catch (err) {
            logger.error('Erreur lors du transfert:', err);
            gooeyToast.error(t('orders:transfer_modal.transfer_error'));
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{t('orders:transfer_modal.title')}</DialogTitle>
                    <DialogDescription>{t('orders:transfer_modal.description')}</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">
                            {t('orders:transfer_modal.supplier_label')}
                        </label>
                        <Select
                            value={transferTargetFournisseur}
                            onChange={(e) => handleSupplierChange(e.target.value)}
                            className="w-full h-10 text-sm"
                        >
                            <option value="">{t('orders:transfer_modal.select_supplier')}</option>
                            {fournisseurs
                                .filter(f => f.id !== parseInt(currentSupplierId || '0'))
                                .map(f => (
                                    <option key={f.id} value={String(f.id)}>{f.name}</option>
                                ))
                            }
                        </Select>
                    </div>

                    <div className="bg-slate-50 rounded-lg p-4 max-h-60 overflow-y-auto">
                        <h4 className="font-semibold text-sm mb-2">{t('orders:transfer_modal.products_title', { count: selectedProducts.length })}</h4>
                        <div className="space-y-2">
                            {selectedProducts.map((p, _i) => {
                                const produitId = (p.produit && typeof p.produit === 'object') ? p.produit.id : p.produit;
                                let produitName = '';
                                if (p.produit && typeof p.produit === 'object' && p.produit.name) {
                                    produitName = p.produit.name;
                                } else if ((p as unknown as Record<string, unknown>).produit_nom) {
                                    produitName = (p as unknown as Record<string, unknown>).produit_nom as string;
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
                                    <div key={produitId} className="flex justify-between items-center text-sm bg-white p-2 rounded border border-slate-100">
                                        <div>
                                            <span className={`font-medium ${isDeleted ? 'italic text-slate-400' : ''}`}>
                                                {produitName}
                                            </span>
                                            <span className="text-slate-500 ml-2">({t('orders:transfer_modal.qty_label', { qty: quantity })})</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-500">{formatCurrency(currentPrice)}</span>
                                            {hasPriceInfo && (
                                                <>
                                                    <span className="text-slate-400">→</span>
                                                    <span className={newPrice < currentPrice ? 'text-emerald-600 font-semibold' : newPrice > currentPrice ? 'text-red-600 font-semibold' : ''}>
                                                        {formatCurrency(newPrice)}
                                                    </span>
                                                    {priceDiff !== 0 && (
                                                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${priceDiff > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                            {priceDiff > 0 ? '+' : ''}{formatCurrency(priceDiff * quantity)}
                                                        </span>
                                                    )}
                                                </>
                                            )}
                                            {!hasPriceInfo && transferTargetFournisseur && !loadingCatalogue && (
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">{t('orders:transfer_modal.unknown_price')}</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {transferTargetFournisseur && (
                        <div className="bg-white border border-slate-200 rounded-lg p-4">
                            <div className="grid grid-cols-3 gap-4 text-center">
                                <div>
                                    <div className="text-xs text-slate-500 uppercase">{t('orders:transfer_modal.current_cost')}</div>
                                    <div className="font-bold">{formatCurrency(transferCalc.totalCurrentCost)}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-slate-500 uppercase">{t('orders:transfer_modal.new_cost')}</div>
                                    <div className="font-bold">{formatCurrency(transferCalc.totalNewCost)}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-slate-500 uppercase">
                                        {transferCalc.isGain ? t('orders:transfer_modal.savings') : t('orders:transfer_modal.overspend')}
                                    </div>
                                    <div className={`font-bold text-lg ${transferCalc.isGain ? 'text-emerald-600' : transferCalc.difference < 0 ? 'text-red-600' : ''}`}>
                                        {transferCalc.isGain ? '+' : ''}{formatCurrency(transferCalc.difference)}
                                    </div>
                                </div>
                            </div>
                            {transferCalc.productsWithoutPricing > 0 && (
                                <div className="mt-2 text-xs text-amber-600 text-center">
                                    {t('orders:transfer_modal.no_price_warning', { count: transferCalc.productsWithoutPricing })}
                                </div>
                            )}
                        </div>
                    )}

                    {loadingCatalogue && (
                        <div className="flex items-center justify-center py-4 text-slate-600">
                            <Loader2 className="size-4 animate-spin mr-2" />
                            {t('orders:transfer_modal.loading_prices')}
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-2">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={onClose}
                        >
                            {t('orders:transfer_modal.cancel')}
                        </Button>
                        <Button
                            type="button"
                            onClick={handleTransfer}
                            disabled={!transferTargetFournisseur || loadingCatalogue}
                            className="bg-sky-600 hover:bg-sky-700 text-white"
                        >
                            {t('orders:transfer_modal.transfer_btn', { count: selectedProducts.length })}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
