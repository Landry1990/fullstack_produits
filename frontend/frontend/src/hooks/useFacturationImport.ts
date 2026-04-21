import { useCallback } from 'react'
import axios from 'axios'
import { toast } from 'react-hot-toast'
import type { ProduitModel } from '../types'

export interface UseFacturationImportOptions {
    cart: {
        bulkAddProduits: (items: { product: ProduitModel; quantity: number; discountPercent: string }[]) => void
    }
    apiBaseUrl: string
    t: (key: string, options?: any) => string
}

export function useFacturationImport({ cart, apiBaseUrl, t }: UseFacturationImportOptions) {
    // Pack Addition
    const addPackToFacture = useCallback(async (pack: any) => {
        if (!pack.pack_items || pack.pack_items.length === 0) {
            toast.error(t('facturation:messages.pack_empty'))
            return
        }
        const toastId = toast.loading(t('facturation:messages.adding_pack'))
        try {
            const apiBase = apiBaseUrl
            const endpoint = apiBase ? `${apiBase}/api/produits/` : '/api/produits/'

            const itemPromises = pack.pack_items.map(async (item: any) => {
                try {
                    const { data: product } = await axios.get<ProduitModel>(`${endpoint}${item.product}/`)
                    return { product, quantity: item.quantity }
                } catch (e) {
                    return null
                }
            })
            const results = await Promise.all(itemPromises)
            const items = results.filter(i => i !== null) as { product: ProduitModel, quantity: number }[]

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
        } catch (e) {
            toast.error(t('facturation.messages.pack_error'), { id: toastId })
        }
    }, [cart.bulkAddProduits, apiBaseUrl, t])

    // CSV Import
    const handleCsvImport = useCallback(async (file: File) => {
        const toastId = toast.loading('Analyse et importation du fichier CSV...');
        try {
            const text = await file.text();
            const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
            if (lines.length === 0) {
                toast.error('Le fichier CSV est vide.', { id: toastId });
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
                toast.error('Aucune donnée valide trouvée dans le CSV.', { id: toastId });
                return;
            }
            const apiBase = apiBaseUrl;
            const endpoint = apiBase ? `${apiBase}/api/produits/bulk_search/` : '/api/produits/bulk_search/';
            let fetchedProducts: ProduitModel[] = [];
            try {
                const res = await axios.post(endpoint, { identifiers: params.identifiers });
                fetchedProducts = res.data;
            } catch (e) {
                const productPromises = params.identifiers.map(async (ident) => {
                    try {
                        const searchUrl = `${apiBase ? apiBase : ''}/api/produits/?search=${ident}`;
                        const res = await axios.get(searchUrl);
                        const results = res.data.results || res.data;
                        if (results && results.length > 0) {
                            const match = results.find((p: any) => p.cip1 === ident || String(p.id) === ident) || results[0];
                            return { identifier: ident, product: match };
                        }
                    } catch (err) { return null; }
                    return null;
                });
                const results = await Promise.all(productPromises);
                const items = results.filter(i => i !== null) as { identifier: string; product: ProduitModel }[];
                fetchedProducts = items.map(i => {
                    (i.product as any)._matched_identifier = i.identifier;
                    return i.product;
                });
            }
            if (fetchedProducts.length === 0) {
                toast.error('Aucun produit correspondant trouvé.', { id: toastId });
                return;
            }
            const itemsToBulkAdd = fetchedProducts.map(product => {
                const identifier = (product as any)._matched_identifier || product.cip1 || String(product.id);
                const qty = params.quantities[identifier] || 1;
                return {
                    product,
                    quantity: qty,
                    discountPercent: '0'
                }
            });
            cart.bulkAddProduits(itemsToBulkAdd);
            toast.success(`${itemsToBulkAdd.length} produit(s) importé(s).`, { id: toastId });
        } catch (err) {
            toast.error("Erreur lecture CSV.", { id: toastId });
        }
    }, [cart.bulkAddProduits, apiBaseUrl])

    return {
        addPackToFacture,
        handleCsvImport
    }
}
