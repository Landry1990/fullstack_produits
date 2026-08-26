import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { gooeyToast } from 'goey-toast';
import { useTranslation } from 'react-i18next';
import { getApiErrorDetail } from '../../utils/errorHandling';
import type { ProduitModel, LigneInventaire, StockLot } from '../../types';
import { getProduitId } from '../../types/inventory';
import { logger } from '../../utils/logger'
import { useProductSearch as useSearchNav } from '../product-search/useProductSearch';

const focusFirstQty = (id?: number) => {
    setTimeout(() => {
        const targetId = id !== undefined ? `qty-input-${id}` : 'qty-input-0';
        const input = document.getElementById(targetId);
        if (input) {
            (input as HTMLInputElement).focus();
            (input as HTMLInputElement).select();
        }
    }, 150);
};

export const useProductSearch = (
    _lignesEndpoint: string,
    activeInventaireId: number | undefined,
    setLignes: React.Dispatch<React.SetStateAction<LigneInventaire[]>>,
    lignes: LigneInventaire[],
    inventoryType?: 'GLOBAL' | 'RAYON' | 'RESERVE'
) => {
    const { t } = useTranslation(['stock', 'common']);

    // Navigation clavier / sélection partagée avec les autres écrans de recherche produit
    const {
        searchQuery, setSearchQuery,
        selectedIndex: selectedItemIndex, setSelectedIndex: setSelectedItemIndex,
        searchInputRef,
        handleKeyDown: handleSearchNavKeyDown,
        getItemProps,
        resetSearch
    } = useSearchNav();

    const [searchResults, setSearchResults] = useState<ProduitModel[]>([]);
    const [loadingSearch, setLoadingSearch] = useState(false);

    // Lot selection modal state
    const [showLotModal, setShowLotModal] = useState(false);
    const [selectedProductForLot, setSelectedProductForLot] = useState<ProduitModel | null>(null);
    const [availableLots, setAvailableLots] = useState<StockLot[]>([]);
    const [loadingLots, setLoadingLots] = useState(false);
    const [selectedLotIndex, setSelectedLotIndex] = useState(-1);
    const [lotQuantities, setLotQuantities] = useState<Record<string, string>>({});

    // Fetch products based on search query
    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            return;
        }

        const controller = new AbortController();

        const fetchProducts = async () => {
            setLoadingSearch(true);
            try {
                const response = await api.get('produits/', { params: { search: searchQuery }, signal: controller.signal });
                const productsList = Array.isArray(response.data) ? response.data : response.data.results;
                setSearchResults(productsList || []);
                setSelectedItemIndex(productsList?.length > 0 ? 0 : -1);
            } catch (err) {
                if (err instanceof Error && err.name === 'CanceledError') return;
                logger.error("Erreur recherche produits", err);
                gooeyToast.error(getApiErrorDetail(err, t('common:messages.error_loading', { defaultValue: 'Erreur recherche' })));
            } finally {
                setLoadingSearch(false);
            }
        };

        const timeoutId = setTimeout(fetchProducts, 300);
        return () => { clearTimeout(timeoutId); controller.abort(); };
    }, [searchQuery, t, setSelectedItemIndex]);

    const focusInput = () => {
        if (searchInputRef.current) searchInputRef.current.focus();
    };

    // Enveloppe le hook clavier commun : Escape vide aussi la recherche (comportement historique),
    // et Enter s'appuie sur `getItemProps` (attribut `data-search-index`) posé par <ProductSearch />.
    const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            resetSearch();
            setSearchResults([]);
            return;
        }
        handleSearchNavKeyDown(e, searchResults.length);
    }, [handleSearchNavKeyDown, resetSearch, searchResults.length]);

    const fetchAvailableLots = async (productId: number) => {
        setLoadingLots(true);
        try {
            const filterKey = inventoryType === 'RESERVE' ? 'quantity_reserved_gt' : 'quantity_remaining_gt';
            const res = await api.get('stock-lots/', { params: { produit: productId, [filterKey]: 0 } });
            const lots = Array.isArray(res.data) ? res.data : res.data.results;
            setAvailableLots(lots || []);
            setSelectedLotIndex(lots?.length > 0 ? 0 : -1);
            
            // Initialize quantities
            const initialQtys: Record<string, string> = {};
            lots?.forEach((l: StockLot) => {
                let stock = l.quantity_remaining;
                if (inventoryType === 'RESERVE') stock = l.quantity_reserved || 0;
                else if (inventoryType === 'GLOBAL') stock = (l.quantity_remaining || 0) + (l.quantity_reserved || 0);
                initialQtys[l.id.toString()] = stock.toString();
            });
            setLotQuantities(initialQtys);
        } catch (err) {
            logger.error("Erreur chargement lots", err);
            gooeyToast.error(t('common:messages.error_loading', { defaultValue: 'Erreur lors du chargement' }));
        } finally {
            setLoadingLots(false);
        }
    };

    const handleProductSelect = (product: ProduitModel) => {
        if (product.use_lot_management) {
            setSelectedProductForLot(product);
            setShowLotModal(true);
            setSelectedLotIndex(0); // <-- Auto-select the first lot option
            fetchAvailableLots(product.id);
            setSearchQuery('');
            setSearchResults([]);
        } else {
            handleAddProduct(product);
        }
    };

    const closeLotModal = () => {
        setShowLotModal(false);
        setSelectedProductForLot(null);
        setLotQuantities({});
        setSelectedLotIndex(-1);
        focusInput();
    };

    const handleLotSelection = (lotId: number | 'NEW') => {
        if (!selectedProductForLot) return;
        const tempId = Date.now();

        let lotStock = selectedProductForLot.stock;
        let lotNum = undefined;
        let lotExp = undefined;

        if (lotId !== 'NEW') {
            const lot = availableLots.find(l => l.id === lotId);
            if (lot) {
                lotStock = lot.quantity_remaining;
                if (inventoryType === 'RESERVE') lotStock = lot.quantity_reserved || 0;
                else if (inventoryType === 'GLOBAL') lotStock = (lot.quantity_remaining || 0) + (lot.quantity_reserved || 0);

                lotNum = lot.lot || undefined;
                lotExp = lot.date_expiration || undefined;
            }
        } else if (lotId === 'NEW') {
            lotStock = 0;
        }

        handleAddProduct(
            selectedProductForLot,
            lotId === 'NEW' ? undefined : lotId,
            tempId,
            lotStock,
            lotNum as string | undefined,
            lotExp as string | undefined
        );
        setShowLotModal(false);
        setSelectedProductForLot(null);
    };

    const handleMultiLotConfirm = () => {
        if (!selectedProductForLot || !activeInventaireId) return;

        const linesToAdd: LigneInventaire[] = [];
        const now = Date.now();

        // 1. Existing lots
        const duplicateLots: string[] = [];
        availableLots.forEach(lot => {
            const qtyStr = lotQuantities[lot.id.toString()];
            if (qtyStr !== undefined) {
                const qty = parseFloat(qtyStr) || 0;
                
                // Check if already in local lines
                const exists = lignes.some(l => 
                    (getProduitId(l.produit) === selectedProductForLot.id) &&
                    l.stock_lot === lot.id
                );

                if (exists) {
                    // Lot déjà saisi — signaler le doublon
                    duplicateLots.push(lot.lot || `#${lot.id}`);
                } else {
                    let stockTh = lot.quantity_remaining;
                    if (inventoryType === 'RESERVE') stockTh = lot.quantity_reserved || 0;
                    else if (inventoryType === 'GLOBAL') stockTh = (lot.quantity_remaining || 0) + (lot.quantity_reserved || 0);

                    linesToAdd.push({
                        id: now + Math.random(),
                        inventaire: activeInventaireId,
                        produit: selectedProductForLot,
                        produit_nom: selectedProductForLot.name,
                        produit_cip: selectedProductForLot.cip1 || undefined,
                        produit_rayon: selectedProductForLot.rayon_name || undefined,
                        stock_lot: lot.id,
                        stock_theorique: stockTh,
                        quantite_physique: qty,
                        ecart: qty - stockTh,
                        isLocalOnly: true,
                        pmp_snapshot: selectedProductForLot.cost_price || '0',
                        produit_cost_price: selectedProductForLot.cost_price || '0',
                        lot_numero: lot.lot || undefined,
                        lot_expiration: lot.date_expiration || undefined
                    });
                }
            }
        });

        if (duplicateLots.length > 0) {
            gooeyToast.error(t('stock:inventaire.detail.duplicate_lots_message', {
                lots: duplicateLots.join(', ')
            }));
        }

        if (linesToAdd.length > 0) {
            setLignes(prev => [...linesToAdd, ...prev]);
        }

        setShowLotModal(false);
        setSelectedProductForLot(null);
        setLotQuantities({});
        focusInput();
    };

    const handleAddProduct = async (
        product: ProduitModel,
        stockLotId?: number,
        forcedId?: number,
        initialStock?: number,
        lotNum?: string,
        lotExp?: string
    ) => {
        if (!activeInventaireId) return;

        // Vérifier si ce produit + lot existe déjà dans les lignes
        const existingLine = lignes.find(l =>
            (getProduitId(l.produit) === product.id) &&
            (stockLotId ? l.stock_lot === stockLotId : !l.stock_lot)
        );

        if (existingLine) {
            // Ce produit + lot est déjà saisi — proposer d'ajuster la quantité
            const lotLabel = lotNum ? ` (Lot: ${lotNum})` : '';
            const currentQty = existingLine.quantite_physique;
            const confirmMsg = t('stock:inventaire.detail.duplicate_lot_confirm', {
                product: product.name,
                lot: lotLabel,
                currentQty
            });
            if (window.confirm(confirmMsg)) {
                // L'utilisateur veut ajuster — on focus le champ quantité de la ligne existante
                focusFirstQty(existingLine.id);
                setSearchQuery('');
                setSearchResults([]);
                setSelectedItemIndex(-1);
                focusInput();
            }
            return;
        }

        const fallbackId = forcedId || Date.now();

        let baseStock = product.stock || 0;
        if (inventoryType === 'RESERVE') baseStock = product.stock_reserve || 0;
        else if (inventoryType === 'GLOBAL') baseStock = (product.stock || 0) + (product.stock_reserve || 0);

        const temporaryLine: LigneInventaire = {
            id: fallbackId,
            inventaire: activeInventaireId,
            produit: product,
            produit_nom: product.name,
            produit_cip: product.cip1 || undefined,
            produit_rayon: product.rayon_name || undefined,
            stock_lot: stockLotId,
            stock_theorique: initialStock ?? baseStock,
            quantite_physique: initialStock ?? baseStock,
            ecart: 0,
            isLocalOnly: true,
            pmp_snapshot: product.cost_price || '0',
            produit_cost_price: product.cost_price || '0',
            lot_numero: lotNum,
            lot_expiration: lotExp
        };

        // Optimistic add
        setLignes(prev => [temporaryLine, ...prev]);
        setSearchQuery('');
        setSearchResults([]);
        setSelectedItemIndex(-1);
        focusFirstQty(fallbackId);
    };

    return {
        searchQuery, setSearchQuery,
        searchResults, setSearchResults,
        loadingSearch, setLoadingSearch,
        selectedItemIndex, setSelectedItemIndex,
        searchInputRef, focusInput, focusFirstQty,
        handleSearchKeyDown, handleProductSelect,
        getItemProps, resetSearch,

        // Lot Modal
        showLotModal, setShowLotModal,
        selectedProductForLot, setSelectedProductForLot,
        availableLots, loadingLots,
        selectedLotIndex, setSelectedLotIndex,
        lotQuantities, setLotQuantities,
        handleLotSelection,
        handleMultiLotConfirm,
        closeLotModal
    };
};

