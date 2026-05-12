import { useState, useRef, useEffect } from 'react';
import api from '../../services/api';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { getApiErrorDetail } from '../../utils/errorHandling';
import type { ProduitModel, LigneInventaire, StockLot } from '../../types';

export const useProductSearch = (
    _lignesEndpoint: string,
    activeInventaireId: number | undefined,
    setLignes: React.Dispatch<React.SetStateAction<LigneInventaire[]>>,
    lignes: LigneInventaire[],
    inventoryType?: 'GLOBAL' | 'RAYON' | 'RESERVE'
) => {
    const { t } = useTranslation(['stock', 'common']);

    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<ProduitModel[]>([]);
    const [loadingSearch, setLoadingSearch] = useState(false);
    const [selectedItemIndex, setSelectedItemIndex] = useState(-1);
    const searchInputRef = useRef<HTMLInputElement>(null);

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
                console.error("Erreur recherche produits", err);
                toast.error(getApiErrorDetail(err, t('common:messages.error_loading', { defaultValue: 'Erreur recherche' })));
            } finally {
                setLoadingSearch(false);
            }
        };

        const timeoutId = setTimeout(fetchProducts, 300);
        return () => { clearTimeout(timeoutId); controller.abort(); };
    }, [searchQuery, t]);

    const focusInput = () => {
        if (searchInputRef.current) searchInputRef.current.focus();
    };

    const focusFirstQty = (id?: number) => {
        // Wait a bit for the DOM to update since the line was just added
        setTimeout(() => {
            const targetId = id !== undefined ? `qty-input-${id}` : 'qty-input-0';
            const input = document.getElementById(targetId);
            if (input) {
                (input as HTMLInputElement).focus();
                (input as HTMLInputElement).select(); // Pre-select for quick typing
            }
        }, 150);
    };

    const handleSearchKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedItemIndex(prev => Math.min(prev + 1, searchResults.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedItemIndex(prev => Math.max(prev - 1, -1));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedItemIndex >= 0 && selectedItemIndex < searchResults.length) {
                handleProductSelect(searchResults[selectedItemIndex]);
            } else if (searchResults.length === 1) {
                handleProductSelect(searchResults[0]);
            }
        } else if (e.key === 'Escape') {
            setSearchQuery('');
            setSearchResults([]);
            setSelectedItemIndex(-1);
        }
    };

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
            console.error("Erreur chargement lots", err);
            toast.error(t('common:messages.error_loading', { defaultValue: 'Erreur lors du chargement' }));
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

    const handleLotSelection = (lotId: number | 'NEW' | 'GLOBAL') => {
        if (!selectedProductForLot) return;
        const tempId = Date.now();

        // Default values (GLOBAL or product fallback)
        let lotStock = selectedProductForLot.stock;
        let lotNum = undefined;
        let lotExp = undefined;

        if (lotId !== 'NEW' && lotId !== 'GLOBAL') {
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
            // For NEW, we will let the user enter lot info later or handle it as is
            // but the theoretical stock is definitely 0
        }

        handleAddProduct(
            selectedProductForLot,
            lotId === 'NEW' || lotId === 'GLOBAL' ? undefined : lotId,
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
        availableLots.forEach(lot => {
            const qtyStr = lotQuantities[lot.id.toString()];
            if (qtyStr !== undefined) {
                const qty = parseFloat(qtyStr) || 0;
                
                // Check if already in local lines
                const exists = lignes.some(l => 
                    (typeof l.produit === 'object' ? l.produit.id === selectedProductForLot.id : l.produit === selectedProductForLot.id) &&
                    l.stock_lot === lot.id
                );

                if (!exists) {
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

        // 2. Global if modified
        if (lotQuantities['GLOBAL'] !== undefined) {
            const qty = parseFloat(lotQuantities['GLOBAL']) || 0;
            const exists = lignes.some(l => 
                (typeof l.produit === 'object' ? l.produit.id === selectedProductForLot.id : l.produit === selectedProductForLot.id) &&
                !l.stock_lot
            );

            if (!exists) {
                let stockTh = selectedProductForLot.stock || 0;
                if (inventoryType === 'RESERVE') stockTh = selectedProductForLot.stock_reserve || 0;
                else if (inventoryType === 'GLOBAL') stockTh = (selectedProductForLot.stock || 0) + (selectedProductForLot.stock_reserve || 0);

                linesToAdd.push({
                    id: now + Math.random(),
                    inventaire: activeInventaireId,
                    produit: selectedProductForLot,
                    produit_nom: selectedProductForLot.name,
                    produit_cip: selectedProductForLot.cip1 || undefined,
                    produit_rayon: selectedProductForLot.rayon_name || undefined,
                    stock_lot: undefined,
                    stock_theorique: stockTh,
                    quantite_physique: qty,
                    ecart: qty - stockTh,
                    isLocalOnly: true,
                    pmp_snapshot: selectedProductForLot.cost_price || '0',
                    produit_cost_price: selectedProductForLot.cost_price || '0'
                });
            }
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

        // Optimistic UI checks: verify if line already exists
        const existsLocally = lignes.some(l =>
            (typeof l.produit === 'object' ? l.produit.id === product.id : l.produit === product.id) &&
            (stockLotId ? l.stock_lot === stockLotId : !l.stock_lot)
        );

        if (existsLocally) {
            toast.error(t('inventaire.detail.already_added'));
            setSearchQuery('');
            setSearchResults([]);
            setSelectedItemIndex(-1);
            focusInput();
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

        // Lot Modal
        showLotModal, setShowLotModal,
        selectedProductForLot, setSelectedProductForLot,
        availableLots, loadingLots,
        selectedLotIndex, setSelectedLotIndex,
        lotQuantities, setLotQuantities,
        handleLotSelection,
        handleMultiLotConfirm
    };
};

