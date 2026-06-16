import React, { useState } from 'react';
import { getLocale } from '../../utils/dateUtils';
import { useTranslation } from 'react-i18next';
import type { Promotion } from '../../types/Promotion';
import { DiscountType, ApplicationMode } from '../../types/Promotion';
import { ProductSearch, type SearchResult } from '../common/ProductSearch';
import { useProductSearch as useProductSearchBase } from '../../hooks/product-search';
import { useKeyboardNavigation } from '../../hooks/useKeyboardNavigation';
import { ShoppingBag, X, Plus, Minus, Calendar, Tag, Package, Trash2, Search } from 'lucide-react';
import api from '../../services/api';
import { useEffect, useRef, useCallback } from 'react';
import { Button } from '../shadcn/button';
import { Badge } from '../shadcn/badge';
import { cn } from '../../lib/utils';

interface PromotionFormProps {
    onClose: () => void;
    onSave: () => void;
    initialData?: Promotion;
}

const PromotionForm: React.FC<PromotionFormProps> = ({ onClose, onSave, initialData }) => {
    const { t } = useTranslation(['promotions', 'common']);
    const [name, setName] = useState(initialData?.name || '');
    const [description] = useState(initialData?.description || '');
    const [discountType, setDiscountType] = useState<DiscountType>(initialData?.discount_type || DiscountType.PERCENTAGE);
    const [applicationMode] = useState<ApplicationMode>(initialData?.application_mode || ApplicationMode.AUTO_APPLY);
    const [value, setValue] = useState(initialData?.value || 0);
    const [buyQuantity, setBuyQuantity] = useState(initialData?.buy_quantity || 1);
    const [getQuantity, setGetQuantity] = useState(initialData?.get_quantity || 0);
    const [startDate, setStartDate] = useState(initialData?.start_date ? new Date(initialData.start_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(initialData?.end_date ? new Date(initialData.end_date).toISOString().split('T')[0] : '');
    const [loading, setLoading] = useState(false);


    const [selectedProducts, setSelectedProducts] = useState<any[]>(() => {
        if (!initialData) return [];
        if (initialData.products) {
            return initialData.products.map(id => ({ id, name: t('promotions:form.products.loading_names'), quantity: 1 }));
        }
        if (initialData.pack_items) {
            return initialData.pack_items.map((item: any) => ({
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

    const updateProductQuantity = useCallback((id: number, qty: number) => {
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

    const handleAddProduct = (product: SearchResult) => {
        addProduct(product);
        resetSearch();
    };

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
                    } catch (e) {
                        return { ...p, name: t('promotions:form.products.error_id', { id: p.id }) };
                    }
                }));
                setSelectedProducts(updated);
            } catch (err) {
                console.error("Failed to resolve product names", err);
            }
        };

        if (initialData) resolveNames();
    }, [initialData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const payload: any = {
            name,
            description,
            discount_type: discountType,
            application_mode: applicationMode,
            value: Number(value),
            buy_quantity: Number(buyQuantity),
            get_quantity: Number(getQuantity),
            start_date: new Date(startDate).toISOString(),
            end_date: endDate ? new Date(endDate).toISOString() : null,
            active: true,
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
            console.error(error);
            alert(t('promotions:form.save_error'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            {initialData ? <Tag className="text-emerald-600" /> : <Plus className="text-emerald-600" />}
                            {initialData ? t('promotions:form.title_edit') : t('promotions:form.title_new')}
                        </h2>
                        <p className="text-sm text-slate-500">{t('promotions:form.subtitle')}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="size-10 rounded-full">
                        <X size={24} />
                    </Button>
                </div>
                
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Info Section */}
                        <div className="md:col-span-2 space-y-6">
                            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                                <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-2">
                                    <ShoppingBag size={14} /> {t('promotions:form.general_info')}
                                </h3>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">{t('promotions:form.pack_name')}</label>
                                    <input
                                        type="text"
                                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 transition-all"
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        placeholder={t('promotions:form.pack_placeholder')}
                                        required
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-2 text-emerald-600">
                                            <Calendar size={14} /> {t('promotions:form.start_date')}
                                        </label>
                                        <input type="date" lang={getLocale()} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 transition-all" value={startDate} onChange={e => setStartDate(e.target.value)} required />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-2 text-red-500">
                                            <Calendar size={14} /> {t('promotions:form.end_date')}
                                        </label>
                                        <input type="date" lang={getLocale()} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 transition-all" value={endDate} onChange={e => setEndDate(e.target.value)} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Configuration Section */}
                        <div className="space-y-6">
                            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4">
                                <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">{t('promotions:form.type_value')}</h3>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">{t('promotions:form.promo_type')}</label>
                                    <select
                                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 transition-all"
                                        value={discountType}
                                        onChange={e => setDiscountType(e.target.value as DiscountType)}
                                    >
                                        <option value={DiscountType.PERCENTAGE}>{t('promotions:form.types.percentage')}</option>
                                        <option value={DiscountType.FIXED_AMOUNT}>{t('promotions:form.types.fixed')}</option>
                                        <option value={DiscountType.BUY_X_GET_Y}>{t('promotions:form.types.buy_get')}</option>
                                        <option value={DiscountType.BUNDLE}>{t('promotions:form.types.bundle')}</option>
                                    </select>
                                </div>

                                {(discountType === DiscountType.PERCENTAGE || discountType === DiscountType.FIXED_AMOUNT || discountType === DiscountType.BUNDLE) && (
                                    <div className="bg-white p-3 rounded-lg border border-slate-200">
                                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                                            {discountType === DiscountType.BUNDLE ? t('promotions:form.labels.pack_price') : t('promotions:form.labels.discount_value')}
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-2xl font-black text-emerald-600 h-14 focus:outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 transition-all"
                                                value={value}
                                                onChange={e => setValue(Number(e.target.value))}
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                                                {discountType === DiscountType.PERCENTAGE ? '%' : t('common:currency')}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {discountType === DiscountType.BUY_X_GET_Y && (
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="bg-white p-2 rounded-lg border border-slate-200">
                                            <label className="block text-[10px] font-bold uppercase text-slate-500">{t('promotions:form.labels.buy')}</label>
                                            <input type="number" className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-bold focus:outline-none focus:border-emerald-300" value={buyQuantity} onChange={e => setBuyQuantity(Number(e.target.value))} min="1" />
                                        </div>
                                        <div className="bg-white p-2 rounded-lg border border-slate-200">
                                            <label className="block text-[10px] font-bold uppercase text-slate-500">{t('promotions:form.labels.get')}</label>
                                            <input type="number" className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-bold text-emerald-600 focus:outline-none focus:border-emerald-300" value={getQuantity} onChange={e => setGetQuantity(Number(e.target.value))} />
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
                                results={[]}
                                loading={false}
                                modes={['products']}
                                onSelect={handleAddProduct}
                                searchInputRef={searchInputRef}
                                handleKeyDown={handleKeyDown}
                                getItemProps={getItemProps}
                                placeholder={t('promotions.form.products.search_placeholder')}
                            />
                        </div>
                    </div>

                        {/* Selected Products Table */}
                        <div className="mt-6 border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 border-b border-slate-100">
                                    <tr className="text-slate-500 uppercase text-[10px] tracking-widest">
                                        <th className="py-3 px-4 text-left">{t('promotions:form.products.table.product')}</th>
                                        <th className="py-3 px-4 text-center">{t('promotions:form.products.table.stock')}</th>
                                        <th className="py-3 px-4 text-center w-32">{t('promotions:form.products.table.qty')}</th>
                                        <th className="py-3 px-4 text-right">{t('promotions:form.products.table.unit_price')}</th>
                                        {discountType !== DiscountType.BUNDLE && <th className="py-3 px-4 text-right">{t('promotions:form.products.table.discount_effect')}</th>}
                                        <th className="py-3 px-4 w-20"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedProducts.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="text-center py-16">
                                                <div className="flex flex-col items-center gap-3 text-slate-400">
                                                    <Search size={48} strokeWidth={1} />
                                                    <p className="italic">{t('promotions:form.products.table.empty')}</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        selectedProducts.map((p: any, idx: number) => (
                                            <tr
                                                key={p.id}
                                                className={cn(
                                                    "hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0",
                                                    tableSelectedIndex === idx ? 'bg-emerald-50/50 ring-1 ring-inset ring-emerald-200' : ''
                                                )}
                                            >
                                                <td className="py-3 px-4">
                                                    <div className="font-semibold text-slate-800">{p.name}</div>
                                                    <div className="text-[10px] font-mono text-slate-400">{p.cip1 || '#'+p.id}</div>
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <span className={cn("font-bold", p.stock <= 0 ? 'text-red-500' : 'text-emerald-600')}>
                                                        {p.stock ?? t('common:not_available')}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center justify-center">
                                                        <div className="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200">
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                className="size-7"
                                                                onClick={() => updateProductQuantity(p.id, Math.max(1, (p.quantity || 1) - 1))}
                                                            ><Minus size={12} /></Button>
                                                            <input
                                                                type="number"
                                                                className="w-12 text-center bg-transparent border-none font-bold text-sm text-slate-700 focus:outline-none"
                                                                value={p.quantity || 1}
                                                                onChange={(e) => updateProductQuantity(p.id, Number(e.target.value))}
                                                                min="1"
                                                            />
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                className="size-7"
                                                                onClick={() => updateProductQuantity(p.id, (p.quantity || 1) + 1)}
                                                            ><Plus size={12} /></Button>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 text-right font-medium text-slate-600">
                                                    {p.selling_price} {t('common:currency')}
                                                </td>
                                                {discountType !== DiscountType.BUNDLE && (
                                                    <td className="py-3 px-4 text-right">
                                                         <Badge variant="secondary" className="text-xs font-bold">
                                                            {discountType === DiscountType.BUY_X_GET_Y ? (
                                                                t('promotions:form.products.table.offered', { count: getQuantity })
                                                            ) : (
                                                                discountType === DiscountType.PERCENTAGE ? `-${value}%` : `-${value} ${t('common:currency')}`
                                                            )}
                                                         </Badge>
                                                    </td>
                                                )}
                                                <td className="py-3 px-4 text-center">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => removeProduct(p.id)}
                                                        className="size-8 text-slate-400 hover:text-red-500 hover:bg-red-50"
                                                    >
                                                        <Trash2 size={18} />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                </form>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
                    <div className="flex gap-4 text-xs font-bold text-slate-400 uppercase">
                        <span>Status: {loading ? t('promotions:form.status.loading') : t('promotions:form.status.ready')}</span>
                        {discountType === DiscountType.BUNDLE && (
                            <span className="text-violet-600">{t('promotions:form.status.total_fixed', { value })}</span>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <Button type="button" variant="outline" className="px-6" onClick={onClose} disabled={loading}>{t('promotions:form.actions.cancel')}</Button>
                        <Button type="submit" className="px-10 bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-200" onClick={handleSubmit} disabled={loading}>
                            {loading ? <span className="inline-block size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : t('promotions:form.actions.save')}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PromotionForm;

