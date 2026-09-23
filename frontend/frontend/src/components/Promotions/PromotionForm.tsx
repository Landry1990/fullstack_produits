import React, { useState } from 'react';

import { useTranslation } from 'react-i18next';
import { gooeyToast } from 'goey-toast';
import type { Promotion, PromotionPackItem } from '../../types/Promotion';
import type { ProduitModel } from '../../types';
import { DiscountType, ApplicationMode } from '../../types/Promotion';
import { ProductSearch, type SearchResult } from '../common/ProductSearch';
import { useProductSearch as useProductSearchBase } from '../../hooks/product-search/useProductSearch';
import { useKeyboardNavigation } from '../../hooks/useKeyboardNavigation';
import { ShoppingBag, X, Plus, Minus, Calendar, Tag, Package, Trash2, Search } from 'lucide-react';
import api from '../../services/api';
import { useEffect, useCallback } from 'react';
import { Button } from '../shadcn/button';
import { Badge } from '../shadcn/badge';
import { Input } from '../shadcn/input';
import { Select } from '../shadcn/select';
import { Checkbox } from '../shadcn/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../shadcn/dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../shadcn/table';
import { cn } from '../../lib/utils';
import { logger } from '../../utils/logger'
import { LocalizedDateInput } from '../LocalizedDateInput';

interface PromotionFormProps {
    onClose: () => void;
    onSave: () => void;
    initialData?: Promotion;
}

interface SelectedProduct extends SearchResult {
    quantity: number;
}

const PromotionForm: React.FC<PromotionFormProps> = ({ onClose, onSave, initialData }) => {
    const { t } = useTranslation(['promotions', 'common']);
    const [name, setName] = useState(initialData?.name || '');
    const [description, setDescription] = useState(initialData?.description || '');
    const [discountType, setDiscountType] = useState<DiscountType>(initialData?.discount_type || DiscountType.PERCENTAGE);
    const [applicationMode, setApplicationMode] = useState<ApplicationMode>(initialData?.application_mode || ApplicationMode.AUTO_APPLY);
    const [active, setActive] = useState(initialData?.active ?? true);
    const [value, setValue] = useState(initialData?.value || 0);
    const [buyQuantity, setBuyQuantity] = useState(initialData?.buy_quantity || 1);
    const [getQuantity, setGetQuantity] = useState(initialData?.get_quantity || 0);
    const [startDate, setStartDate] = useState(initialData?.start_date ? new Date(initialData.start_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(initialData?.end_date ? new Date(initialData.end_date).toISOString().split('T')[0] : '');
    const [loading, setLoading] = useState(false);


    const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>(() => {
        if (!initialData) return [];
        if (initialData.products) {
            return initialData.products.map(id => ({
                id,
                name: t('promotions:form.products.loading_names'),
                quantity: 1
            }));
        }
        if (initialData.pack_items) {
            return initialData.pack_items.map((item: PromotionPackItem) => ({
                id: item.product,
                name: t('promotions:form.products.loading_names'),
                quantity: item.quantity
            }));
        }
        return [];
    });

    const addProduct = useCallback((product: SearchResult) => {
        setSelectedProducts(prev => {
            if (!prev.find(p => p.id === product.id)) {
                return [...prev, { ...product, quantity: 1 }];
            }
            return prev;
        });
    }, []);

    const updateProductQuantity = useCallback((id: number, qty: number | undefined) => {
        if (qty === undefined) return;
        setSelectedProducts(prev => prev.map(p =>
            p.id === id ? { ...p, quantity: qty } : p
        ));
    }, []);

    const removeProduct = useCallback((productId: number) => {
        setSelectedProducts(prev => prev.filter(p => p.id !== productId));
    }, []);

    // New ProductSearch architecture
    const {
        searchQuery,
        setSearchQuery: handleSearchChange,
        searchInputRef,
        handleKeyDown,
        getItemProps,
        resetSearch
    } = useProductSearchBase({
        modes: ['products']
    });

    const handleAddProduct = (product: SearchResult | ProduitModel) => {
        addProduct(product as SearchResult);
        resetSearch();
    };

    const [productResults, setProductResults] = useState<SearchResult[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);

    useEffect(() => {
        if (searchQuery.length < 2) {
            setProductResults([]);
            return;
        }
        const timer = setTimeout(async () => {
            setSearchLoading(true);
            try {
                const response = await api.get('produits/', {
                    params: { search: searchQuery, page_size: 20 }
                });
                const data = response.data;
                setProductResults(Array.isArray(data) ? data : data.results || []);
            } catch (e) {
                logger.error('PromotionForm product search error', e);
                setProductResults([]);
            } finally {
                setSearchLoading(false);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const handleIncrement = useCallback((idx: number) => {
        setSelectedProducts(prev => {
            const p = prev[idx];
            if (p) {
                return prev.map((item, i) => i === idx ? { ...item, quantity: (item.quantity || 1) + 1 } : item);
            }
            return prev;
        });
    }, []);

    const handleDecrement = useCallback((idx: number) => {
        setSelectedProducts(prev => {
            const p = prev[idx];
            if (p) {
                return prev.map((item, i) => i === idx ? { ...item, quantity: Math.max(1, (item.quantity || 1) - 1) } : item);
            }
            return prev;
        });
    }, []);

    const { selectedIndex: tableSelectedIndex } = useKeyboardNavigation({
        listLength: selectedProducts.length,
        onIncrement: handleIncrement,
        onDecrement: handleDecrement,
        onDelete: (idx) => removeProduct(selectedProducts[idx].id),
        enabled: !searchQuery
    });

    // Effect to resolve product names if missing (Edit mode for regular promotions)
    useEffect(() => {
        const resolveNames = async () => {
            const hasPlaceholders = selectedProducts.some(p => p.name === t('promotions:form.products.loading_names'));
            if (!hasPlaceholders) return;

            try {
                const updated = await Promise.all(selectedProducts.map(async (p) => {
                    if (p.name !== t('promotions:form.products.loading_names')) return p;
                    try {
                        const { data } = await api.get(`produits/${p.id}/`);
                        return { ...p, name: data.name, selling_price: data.selling_price, stock: data.stock };
                    } catch {
                        return { ...p, name: t('promotions:form.products.error_id', { id: p.id }) };
                    }
                }));
                setSelectedProducts(updated);
            } catch (err) {
                logger.error("Failed to resolve product names", err);
            }
        };

        if (initialData) resolveNames();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const payload: Record<string, unknown> = {
            name,
            description,
            discount_type: discountType,
            application_mode: applicationMode,
            value: Number(value),
            buy_quantity: Number(buyQuantity),
            get_quantity: Number(getQuantity),
            start_date: new Date(startDate).toISOString(),
            end_date: endDate ? new Date(`${endDate}T23:59:59.999`).toISOString() : null,
            active,
            priority: 1,
        };

        if (discountType === DiscountType.BUNDLE) {
            payload.pack_items = selectedProducts.map(p => ({
                product: p.id,
                quantity: p.quantity || 1
            }));
            payload.products = []; // Clear regular products
        } else {
            payload.products = selectedProducts.map(p => p.id);
            payload.pack_items = [];
        }

        try {
            if (initialData) {
                await api.put(`promotions/${initialData.id}/`, payload);
            } else {
                await api.post('promotions/', payload);
            }
            onSave();
            onClose();
        } catch (error) {
            logger.error(error);
            gooeyToast.error(t('promotions:form.save_error'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent size="xl" hideCloseButton className="w-[92vw] max-w-7xl max-h-[88vh] overflow-hidden flex flex-col p-0 gap-0">
                {/* Header */}
                <DialogHeader className="p-4 sm:p-6 border-b border-slate-100 bg-slate-50/50 space-y-0">
                    <div className="flex justify-between items-center">
                        <div>
                            <DialogTitle className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
                                {initialData ? <Tag className="text-emerald-600" /> : <Plus className="text-emerald-600" />}
                                {initialData ? t('promotions:form.title_edit') : t('promotions:form.title_new')}
                            </DialogTitle>
                            <DialogDescription>{t('promotions:form.subtitle')}</DialogDescription>
                        </div>
                        <Button variant="ghost" size="icon" onClick={onClose} className="size-10 rounded-full" aria-label={t('common:close')}>
                            <X size={24} aria-hidden="true" />
                        </Button>
                    </div>
                </DialogHeader>

                <form id="promotion-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Info Section */}
                        <div className="md:col-span-2 space-y-6">
                            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                                <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-2">
                                    <ShoppingBag size={14} /> {t('promotions:form.general_info')}
                                </h3>
                                <div>
                                    <label htmlFor="promo-pack-name" className="block text-sm font-semibold text-slate-700 mb-1">{t('promotions:form.pack_name')}</label>
                                    <Input
                                        id="promo-pack-name"
                                        type="text"
                                        disableUppercase
                                        className="rounded-lg focus-visible:ring-emerald-300 focus-visible:ring-offset-0"
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        placeholder={t('promotions:form.pack_placeholder')}
                                        required
                                    />
                                </div>
                                <div>
                                    <label htmlFor="promo-description" className="block text-sm font-semibold text-slate-700 mb-1">{t('promotions:form.description')}</label>
                                    <textarea
                                        id="promo-description"
                                        rows={2}
                                        className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 placeholder:text-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 transition-all resize-none"
                                        value={description}
                                        onChange={e => setDescription(e.target.value)}
                                        placeholder={t('promotions:form.description_placeholder')}
                                    />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="promo-start-date" className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-2 text-emerald-600">
                                            <Calendar size={14} /> {t('promotions:form.start_date')}
                                        </label>
                                        <LocalizedDateInput id="promo-start-date" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 transition-all" value={startDate} onChange={e => setStartDate(e.target.value)} required />
                                    </div>
                                    <div>
                                        <label htmlFor="promo-end-date" className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-2 text-red-500">
                                            <Calendar size={14} /> {t('promotions:form.end_date')}
                                        </label>
                                        <LocalizedDateInput id="promo-end-date" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 transition-all" value={endDate} onChange={e => setEndDate(e.target.value)} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Configuration Section */}
                        <div className="space-y-6">
                            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4">
                                <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">{t('promotions:form.type_value')}</h3>
                                <div>
                                    <label htmlFor="promo-type" className="block text-sm font-semibold text-slate-700 mb-1">{t('promotions:form.promo_type')}</label>
                                    <Select
                                        id="promo-type"
                                        className="font-semibold focus-visible:ring-emerald-300 focus-visible:ring-offset-0"
                                        value={discountType}
                                        onChange={e => setDiscountType(e.target.value as DiscountType)}
                                    >
                                        <option value={DiscountType.PERCENTAGE}>{t('promotions:form.types.percentage')}</option>
                                        <option value={DiscountType.FIXED_AMOUNT}>{t('promotions:form.types.fixed')}</option>
                                        <option value={DiscountType.BUY_X_GET_Y}>{t('promotions:form.types.buy_get')}</option>
                                        <option value={DiscountType.BUNDLE}>{t('promotions:form.types.bundle')}</option>
                                    </Select>
                                </div>

                                <div>
                                    <label htmlFor="promo-mode" className="block text-sm font-semibold text-slate-700 mb-1">{t('promotions:form.application_mode')}</label>
                                    <Select
                                        id="promo-mode"
                                        className="font-semibold focus-visible:ring-emerald-300 focus-visible:ring-offset-0"
                                        value={applicationMode}
                                        onChange={e => setApplicationMode(e.target.value as ApplicationMode)}
                                    >
                                        <option value={ApplicationMode.AUTO_SHOW}>{t('promotions:form.modes.auto_show')}</option>
                                        <option value={ApplicationMode.AUTO_SUGGEST}>{t('promotions:form.modes.auto_suggest')}</option>
                                        <option value={ApplicationMode.AUTO_APPLY}>{t('promotions:form.modes.auto_apply')}</option>
                                    </Select>
                                </div>

                                <label htmlFor="promo-active" className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
                                    <Checkbox
                                        id="promo-active"
                                        checked={active}
                                        onCheckedChange={(checked) => setActive(checked === true)}
                                    />
                                    {t('promotions:form.active_label')}
                                </label>

                                {(discountType === DiscountType.PERCENTAGE || discountType === DiscountType.FIXED_AMOUNT || discountType === DiscountType.BUNDLE) && (
                                    <div className="bg-white p-3 rounded-lg border border-slate-200">
                                        <label htmlFor="promo-value" className="block text-xs font-bold uppercase text-slate-500 mb-1">
                                            {discountType === DiscountType.BUNDLE ? t('promotions:form.labels.pack_price') : t('promotions:form.labels.discount_value')}
                                        </label>
                                        <div className="relative">
                                            <Input
                                                id="promo-value"
                                                type="number"
                                                className="text-2xl font-black text-emerald-600 h-14 rounded-lg focus-visible:ring-emerald-300 focus-visible:ring-offset-0"
                                                value={value}
                                                onChange={e => {
                                                    const parsed = e.target.value ? Number(e.target.value) : undefined;
                                                    setValue(prev => (parsed !== undefined && !Number.isNaN(parsed) ? parsed : prev));
                                                }}
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                                                {discountType === DiscountType.PERCENTAGE ? '%' : t('common:currency')}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {discountType === DiscountType.BUY_X_GET_Y && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        <div className="bg-white p-2 rounded-lg border border-slate-200">
                                            <label htmlFor="promo-buy-qty" className="block text-caption font-bold uppercase text-slate-500">{t('promotions:form.labels.buy')}</label>
                                            <Input id="promo-buy-qty" type="number" className="h-9 font-bold focus-visible:ring-emerald-300 focus-visible:ring-offset-0" value={buyQuantity} onChange={e => {
                                                const parsed = e.target.value ? Number(e.target.value) : undefined;
                                                setBuyQuantity(prev => (parsed !== undefined && !Number.isNaN(parsed) && parsed > 0 ? parsed : prev));
                                            }} min="1" />
                                        </div>
                                        <div className="bg-white p-2 rounded-lg border border-slate-200">
                                            <label htmlFor="promo-get-qty" className="block text-caption font-bold uppercase text-slate-500">{t('promotions:form.labels.get')}</label>
                                            <Input id="promo-get-qty" type="number" className="h-9 font-bold text-emerald-600 focus-visible:ring-emerald-300 focus-visible:ring-offset-0" value={getQuantity} onChange={e => {
                                                const parsed = e.target.value ? Number(e.target.value) : undefined;
                                                setGetQuantity(prev => (parsed !== undefined && !Number.isNaN(parsed) && parsed >= 0 ? parsed : prev));
                                            }} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Search & Products Section */}
                    <div className="mt-8">
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold text-lg flex items-center gap-2 text-slate-800">
                                    <Package size={20} className="text-violet-600" />
                                    {t('promotions:form.products.title')}
                                </h3>
                                <Badge variant="secondary" className="text-xs">{t('promotions:form.products.count', { count: selectedProducts.length })}</Badge>
                            </div>

                            {/* Product Search using generic component */}
                            <ProductSearch
                                searchQuery={searchQuery}
                                setSearchQuery={handleSearchChange}
                                results={productResults}
                                loading={searchLoading}
                                modes={['products']}
                                onSelect={handleAddProduct}
                                searchInputRef={searchInputRef}
                                handleKeyDown={handleKeyDown}
                                getItemProps={getItemProps}
                                placeholder={t('promotions:form.products.search_placeholder')}
                            />
                        </div>
                    </div>

                        {/* Selected Products Table */}
                        <div className="mt-6">
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead>{t('promotions:form.products.table.product')}</TableHead>
                                        <TableHead className="text-center">{t('promotions:form.products.table.stock')}</TableHead>
                                        <TableHead className="text-center w-32">{t('promotions:form.products.table.qty')}</TableHead>
                                        <TableHead className="text-right">{t('promotions:form.products.table.unit_price')}</TableHead>
                                        {discountType !== DiscountType.BUNDLE && <TableHead className="text-right">{t('promotions:form.products.table.discount_effect')}</TableHead>}
                                        <TableHead className="w-20"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {selectedProducts.length === 0 ? (
                                        <TableRow className="hover:bg-transparent">
                                            <TableCell colSpan={6} className="text-center py-16">
                                                <div className="flex flex-col items-center gap-3 text-slate-400">
                                                    <Search size={48} strokeWidth={1} />
                                                    <p className="italic">{t('promotions:form.products.table.empty')}</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        selectedProducts.map((p: SelectedProduct, idx: number) => (
                                            <TableRow
                                                key={p.id}
                                                className={cn(
                                                    tableSelectedIndex === idx ? 'bg-emerald-50/50 ring-1 ring-inset ring-emerald-200' : ''
                                                )}
                                            >
                                                <TableCell>
                                                    <div className="font-semibold text-slate-800">{p.name}</div>
                                                    <div className="text-caption font-mono text-slate-400">{p.cip1 ? String(p.cip1) : '#'+p.id}</div>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <span className={cn("font-bold", p.stock !== undefined && p.stock <= 0 ? 'text-red-500' : 'text-emerald-600')}>
                                                        {p.stock ?? t('common:not_available')}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center justify-center">
                                                        <div className="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200">
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                className="size-7"
                                                                onClick={() => updateProductQuantity(p.id, Math.max(1, (p.quantity || 1) - 1))}
                                                                aria-label={t('common:decrease')}
                                                            ><Minus size={12} aria-hidden="true" /></Button>
                                                            <input
                                                                type="number"
                                                                aria-label={`${t('promotions:form.products.table.qty')} — ${p.name}`}
                                                                className="w-12 text-center bg-transparent border-none font-bold text-sm text-slate-700 focus:outline-none"
                                                                value={p.quantity || 1}
                                                                onChange={(e) => {
                                                                    const parsed = e.target.value ? Number(e.target.value) : undefined;
                                                                    if (parsed !== undefined && !Number.isNaN(parsed) && parsed >= 1) {
                                                                        updateProductQuantity(p.id, parsed);
                                                                    }
                                                                }}
                                                                min="1"
                                                            />
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                className="size-7"
                                                                onClick={() => updateProductQuantity(p.id, (p.quantity || 1) + 1)}
                                                                aria-label={t('common:increase')}
                                                            ><Plus size={12} aria-hidden="true" /></Button>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right font-medium text-slate-600">
                                                    {p.selling_price != null ? `${p.selling_price} ${t('common:currency')}` : t('common:not_available')}
                                                </TableCell>
                                                {discountType !== DiscountType.BUNDLE && (
                                                    <TableCell className="text-right">
                                                         <Badge variant="secondary" className="text-xs font-bold">
                                                            {discountType === DiscountType.BUY_X_GET_Y ? (
                                                                t('promotions:form.products.table.offered', { count: getQuantity })
                                                            ) : (
                                                                discountType === DiscountType.PERCENTAGE ? `-${value}%` : `-${value} ${t('common:currency')}`
                                                            )}
                                                         </Badge>
                                                    </TableCell>
                                                )}
                                                <TableCell className="text-center">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => removeProduct(p.id)}
                                                        className="size-8 text-slate-400 hover:text-red-500 hover:bg-red-50"
                                                        aria-label={`${t('common:remove')} ${p.name}`}
                                                    >
                                                        <Trash2 size={18} aria-hidden="true" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                </form>

                {/* Footer */}
                <DialogFooter className="p-4 sm:p-6 border-t border-slate-100 bg-slate-50 flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
                    <div className="flex gap-4 text-xs font-bold text-slate-400 uppercase">
                        <span>{t('promotions:form.status.label')}: {loading ? t('promotions:form.status.loading') : t('promotions:form.status.ready')}</span>
                        {discountType === DiscountType.BUNDLE && (
                            <span className="text-violet-600">{t('promotions:form.status.total_fixed', { value, currency: t('common:currency') })}</span>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <Button type="button" variant="outline" className="px-6" onClick={onClose} disabled={loading}>{t('promotions:form.actions.cancel')}</Button>
                        <Button type="submit" form="promotion-form" className="px-10 bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-200" disabled={loading}>
                            {loading ? <span className="inline-block size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : t('promotions:form.actions.save')}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default PromotionForm;

