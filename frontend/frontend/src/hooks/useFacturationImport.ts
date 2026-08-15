import { useCallback } from 'react'
import type { TFunction } from 'i18next'
import api from '../services/api'
import { toast } from 'react-hot-toast'
import type { ProduitModel } from '../types'

export interface UseFacturationImportOptions {
    cart: {
        bulkAddProduits: (items: { product: ProduitModel; quantity: number; discountPercent: string }[]) => void
    }
    apiBaseUrl: string
    t: TFunction
}

export function useFacturationImport({ cart, t }: UseFacturationImportOptions) {
    // Pack Addition
    const addPackToFacture = useCallback(async (pack: {
        pack_items?: { product: number; quantity: number }[];
        value?: string | number;
        name?: string;
    }) => {
        if (!pack.pack_items || pack.pack_items.length === 0) {
            toast.error(t('facturation:messages.pack_empty'))
            return
        }
        const toastId = toast.loading(t('facturation:messages.adding_pack'))
        try {
            const itemPromises = pack.pack_items.map(async (item: { product: number; quantity: number }) => {
                try {
                    const { data: product } = await api.get<ProduitModel>(`produits/${item.product}/`)
                    return { product, quantity: item.quantity }
                } catch {
                    return null
                }
            })
            const results = await Promise.all(itemPromises)
            const items = results.filter((i): i is { product: ProduitModel, quantity: number } => i !== null)

            if (items.length === 0) {
                toast.error(t('facturation:messages.pack_items_error'), { id: toastId })
                return
            }
            const totalNormalPrice = items.reduce((sum, item) => sum + (Number(item.product.selling_price) * item.quantity), 0)
            const packPrice = Number(pack.value)
            const ratio = totalNormalPrice > 0 ? packPrice / totalNormalPrice : 1

            const itemsToBulkAdd = items.map(({ product, quantity }) => {
                return {
                    product,
                    quantity,
                    discountPercent: ratio < 1 ? (Math.round((1 - ratio) * 10000) / 100).toFixed(0) : '0'
                }
            })
            cart.bulkAddProduits(itemsToBulkAdd)
            toast.success(t('facturation.messages.pack_added', { name: pack.name }), { id: toastId })
        } catch {
            toast.error(t('facturation.messages.pack_error'), { id: toastId })
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cart.bulkAddProduits, t])

    // CSV Import
    const handleCsvImport = useCallback(async (file: File) => {
        const toastId = toast.loading(t('facturation:messages.csv_loading'));
        try {
            const text = await file.text();
            const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
            if (lines.length === 0) {
                toast.error(t('facturation:messages.csv_empty_file'), { id: toastId });
                return;
            }
            const params: { identifiers: string[], quantities: Record<string, number> } = {
                identifiers: [],
                quantities: {}
            };
            for (let i = 0; i < lines.length; i++) {
                const parts = lines[i].split(/[,;]/).map(s => s.trim());
                if (parts.length >= 2) {
                    const identifier = parts[0];
                    if (identifier.toLowerCase() === 'cip' || identifier.toLowerCase() === 'id') continue;
                    const quantity = parseInt(parts[1], 10);
                    if (identifier && !isNaN(quantity) && quantity > 0) {
                        params.identifiers.push(identifier);
                        params.quantities[identifier] = quantity;
                    }
                }
            }
            if (params.identifiers.length === 0) {
                toast.error(t('facturation:messages.csv_no_valid_data'), { id: toastId });
                return;
            }
            let fetchedProducts: ProduitModel[] = [];
            try {
                const res = await api.post('produits/bulk_search/', { identifiers: params.identifiers });
                fetchedProducts = res.data;
            } catch {
                const productPromises = params.identifiers.map(async (ident) => {
                    try {
                        const res = await api.get('produits/', { params: { search: ident } });
                        const results = res.data.results || res.data;
                        if (results && results.length > 0) {
                            const match = results.find((p: ProduitModel) => p.cip1 === ident || String(p.id) === ident) || results[0];
                            return { identifier: ident, product: match };
                        }
                    } catch { return null; }
                    return null;
                });
                const results = await Promise.all(productPromises);
                const items = results.filter(i => i !== null) as { identifier: string; product: ProduitModel }[];
                fetchedProducts = items.map(i => {
                    (i.product as unknown)._matched_identifier = i.identifier;
                    return i.product;
                });
            }
            if (fetchedProducts.length === 0) {
                toast.error(t('facturation:messages.csv_no_matching_products'), { id: toastId });
                return;
            }
            const itemsToBulkAdd = fetchedProducts.map(product => {
                const identifier = (product as unknown)._matched_identifier || product.cip1 || String(product.id);
                const qty = params.quantities[identifier] || 1;
                return {
                    product,
                    quantity: qty,
                    discountPercent: '0'
                }
            });
            cart.bulkAddProduits(itemsToBulkAdd);
            toast.success(t('facturation:messages.csv_import_success', { count: itemsToBulkAdd.length }), { id: toastId });
        } catch {
            toast.error(t('facturation:messages.csv_read_error'), { id: toastId });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cart.bulkAddProduits])

    return {
        addPackToFacture,
        handleCsvImport
    }
}
