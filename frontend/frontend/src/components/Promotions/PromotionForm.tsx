import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Promotion } from '../../types/Promotion';
import { DiscountType, ApplicationMode } from '../../types/Promotion';
import { safeStorage } from '../../utils/storage';
import { useProductSearch } from '../../hooks/useProductSearch';
import { useSearchNavigation } from '../../hooks/useSearchNavigation';
import { useKeyboardNavigation } from '../../hooks/useKeyboardNavigation';
import { Search, ShoppingBag, X, Plus, Minus, Calendar, Tag, Package, Trash2 } from 'lucide-react';
import axios from 'axios';
import { useEffect, useRef, useCallback } from 'react';

interface PromotionFormProps {
    onClose: () => void;
    onSave: () => void;
    initialData?: Promotion;
}

const PromotionForm: React.FC<PromotionFormProps> = ({ onClose, onSave, initialData }) => {
    const { t } = useTranslation();
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

    const searchInputRef = useRef<HTMLInputElement>(null);

    const [selectedProducts, setSelectedProducts] = useState<any[]>(() => {
        if (!initialData) return [];
        if (initialData.products) {
            return initialData.products.map(id => ({ id, name: t('promotions.form.products.loading_names'), quantity: 1 }));
        }
        if (initialData.pack_items) {
            return initialData.pack_items.map((item: any) => ({
                id: item.product,
                name: t('promotions.form.products.loading_names'),
                quantity: item.quantity
            }));
        }
        return [];
    });

    const addProduct = useCallback((product: any) => {
        setSelectedProducts(prev => {
            if (!prev.find(p => p.id === product.id)) {
                return [...prev, { ...product, quantity: 1 }];
            }
            return prev;
        });
        handleSearchChange('');
    }, []);

    const updateProductQuantity = useCallback((id: number, qty: number) => {
        setSelectedProducts(prev => prev.map(p => 
            p.id === id ? { ...p, quantity: qty } : p
        ));
    }, []);

    const removeProduct = useCallback((productId: number) => {
        setSelectedProducts(prev => prev.filter(p => p.id !== productId));
    }, []);

    const { 
        searchQuery, 
        setSearchQuery: handleSearchChange, 
        produits: searchResults
    } = useProductSearch({ 
        minSearchLength: 2,
        debounceMs: 300,
        onBarcodeMatch: (p) => addProduct(p)
    });

    const { handleKeyDown: handleSearchKeyDown, getItemProps } = useSearchNavigation(
        searchResults,
        (p) => addProduct(p),
        { resetOnSelect: true, searchInputRef }
    );

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
            const hasPlaceholders = selectedProducts.some(p => p.name === t('promotions.form.products.loading_names'));
            if (!hasPlaceholders) return;

            const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
            const token = safeStorage.getItem('authToken');

            try {
                const updated = await Promise.all(selectedProducts.map(async (p) => {
                    if (p.name !== t('promotions.form.products.loading_names')) return p;
                    try {
                        const { data } = await axios.get(`${apiBaseUrl}/api/produits/${p.id}/`, {
                            headers: { 'Authorization': `Token ${token}` }
                        });
                        return { ...p, name: data.name, selling_price: data.selling_price, stock: data.stock };
                    } catch (e) {
                        return { ...p, name: t('promotions.form.products.error_id', { id: p.id }) };
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
            const token = safeStorage.getItem('authToken');
            const method = initialData ? 'PUT' : 'POST';
            const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
            const url = initialData 
                ? `${apiBaseUrl}/api/promotions/${initialData.id}/`
                : `${apiBaseUrl}/api/promotions/`;

            const response = await fetch(url, {
                method,
                headers: {
                    'Authorization': `Token ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error(t('promotions.form.save_error'));
            
            onSave();
            onClose();
        } catch (error) {
            console.error(error);
            alert(t('promotions.form.save_error'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-6 border-b flex justify-between items-center bg-gray-50">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                            {initialData ? <Tag className="text-primary" /> : <Plus className="text-success" />}
                            {initialData ? t('promotions.form.title_edit') : t('promotions.form.title_new')}
                        </h2>
                        <p className="text-sm text-gray-500">{t('promotions.form.subtitle')}</p>
                    </div>
                    <button onClick={onClose} className="btn btn-ghost btn-circle">
                        <X size={24} />
                    </button>
                </div>
                
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Info Section */}
                        <div className="md:col-span-2 space-y-6">
                            <div className="bg-white p-5 rounded-xl border shadow-sm space-y-4">
                                <h3 className="text-xs font-bold uppercase text-gray-400 tracking-wider flex items-center gap-2">
                                    <ShoppingBag size={14} /> {t('promotions.form.general_info')}
                                </h3>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">{t('promotions.form.pack_name')}</label>
                                    <input 
                                        type="text" 
                                        className="input input-bordered w-full font-medium" 
                                        value={name} 
                                        onChange={e => setName(e.target.value)} 
                                        placeholder={t('promotions.form.pack_placeholder')} 
                                        required 
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2 text-primary">
                                            <Calendar size={14} /> {t('promotions.form.start_date')}
                                        </label>
                                        <input type="date" className="input input-bordered w-full" value={startDate} onChange={e => setStartDate(e.target.value)} required />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2 text-error">
                                            <Calendar size={14} /> {t('promotions.form.end_date')}
                                        </label>
                                        <input type="date" className="input input-bordered w-full" value={endDate} onChange={e => setEndDate(e.target.value)} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Configuration Section */}
                        <div className="space-y-6">
                            <div className="bg-base-200/50 p-5 rounded-xl border border-base-300 space-y-4">
                                <h3 className="text-xs font-bold uppercase text-gray-400 tracking-wider">{t('promotions.form.type_value')}</h3>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">{t('promotions.form.promo_type')}</label>
                                    <select 
                                        className="select select-bordered w-full font-bold" 
                                        value={discountType} 
                                        onChange={e => setDiscountType(e.target.value as DiscountType)}
                                    >
                                        <option value={DiscountType.PERCENTAGE}>{t('promotions.form.types.percentage')}</option>
                                        <option value={DiscountType.FIXED_AMOUNT}>{t('promotions.form.types.fixed')}</option>
                                        <option value={DiscountType.BUY_X_GET_Y}>{t('promotions.form.types.buy_get')}</option>
                                        <option value={DiscountType.BUNDLE}>{t('promotions.form.types.bundle')}</option>
                                    </select>
                                </div>

                                {(discountType === DiscountType.PERCENTAGE || discountType === DiscountType.FIXED_AMOUNT || discountType === DiscountType.BUNDLE) && (
                                    <div className="bg-white p-3 rounded-lg border">
                                        <label className="block text-xs font-bold uppercase text-gray-500 mb-1">
                                            {discountType === DiscountType.BUNDLE ? t('promotions.form.labels.pack_price') : t('promotions.form.labels.discount_value')}
                                        </label>
                                        <div className="relative">
                                            <input 
                                                type="number" 
                                                className="input input-bordered w-full font-black text-2xl text-primary h-14" 
                                                value={value} 
                                                onChange={e => setValue(Number(e.target.value))} 
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">
                                                {discountType === DiscountType.PERCENTAGE ? '%' : 'F'}
                                            </span>
                                        </div>
                                    </div>
                                )}
                                
                                {discountType === DiscountType.BUY_X_GET_Y && (
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="bg-white p-2 rounded-lg border">
                                            <label className="block text-[10px] font-bold uppercase text-gray-500">{t('promotions.form.labels.buy')}</label>
                                            <input type="number" className="input input-bordered w-full input-sm font-bold" value={buyQuantity} onChange={e => setBuyQuantity(Number(e.target.value))} min="1" />
                                        </div>
                                        <div className="bg-white p-2 rounded-lg border">
                                            <label className="block text-[10px] font-bold uppercase text-gray-500">{t('promotions.form.labels.get')}</label>
                                            <input type="number" className="input input-bordered w-full input-sm font-bold text-success" value={getQuantity} onChange={e => setGetQuantity(Number(e.target.value))} />
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
                                <h3 className="font-bold text-lg flex items-center gap-2">
                                    <Package size={20} className="text-secondary" /> 
                                    {t('promotions.form.products.title')}
                                </h3>
                                <span className="badge badge-lg badge-ghost">{t('promotions.form.products.count', { count: selectedProducts.length })}</span>
                            </div>

                            <div className="relative group">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors z-10">
                                    <Search size={24} />
                                </div>
                                <input 
                                    ref={searchInputRef}
                                    type="text" 
                                    className="input input-bordered w-full pl-14 h-16 text-xl shadow-lg ring-primary/10 focus:ring-4 transition-all" 
                                    placeholder={t('promotions.form.products.search_placeholder')} 
                                    value={searchQuery}
                                    onChange={(e) => handleSearchChange(e.target.value)}
                                    onKeyDown={handleSearchKeyDown}
                                />
                                
                                {searchResults.length > 0 && (
                                    <div className="absolute z-[100] left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                        <div className="max-h-80 overflow-y-auto">
                                            {searchResults.map((p, idx) => (
                                                <div 
                                                    key={p.id} 
                                                    {...getItemProps(idx)}
                                                    className={`p-4 hover:bg-primary/5 cursor-pointer border-b last:border-0 flex justify-between items-center transition-colors group/item ${getItemProps(idx).className}`}
                                                    onClick={() => addProduct(p)}
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 font-bold">
                                                            {p.name.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-gray-800">{p.name}</div>
                                                            <div className="text-xs text-gray-500 flex gap-4">
                                                                <span>CIP: {p.cip1 || 'N/A'}</span>
                                                                <span className="flex items-center gap-1">
                                                                    {t('promotions.form.products.stock')} <b className={`font-black ${p.stock <= 0 ? 'text-error' : 'text-success'}`}>{p.stock}</b>
                                                                </span>
                                                                <span className="font-bold">{p.selling_price} F</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <button type="button" className="btn btn-circle btn-primary btn-sm opacity-0 group-hover/item:opacity-100 transition-opacity">
                                                        <Plus size={16} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                        {/* Selected Products Table */}
                        <div className="mt-6 border rounded-2xl overflow-hidden shadow-sm">
                            <table className="table w-full">
                                <thead className="bg-gray-50 border-b">
                                    <tr className="text-gray-500 uppercase text-[10px] tracking-widest">
                                        <th className="py-4">{t('promotions.form.products.table.product')}</th>
                                        <th className="py-4 text-center">{t('promotions.form.products.table.stock')}</th>
                                        <th className="py-4 text-center w-32">{t('promotions.form.products.table.qty')}</th>
                                        <th className="py-4 text-right">{t('promotions.form.products.table.unit_price')}</th>
                                        {discountType !== DiscountType.BUNDLE && <th className="py-4 text-right">{t('promotions.form.products.table.discount_effect')}</th>}
                                        <th className="py-4 w-20"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedProducts.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="text-center py-16">
                                                <div className="flex flex-col items-center gap-3 text-gray-400">
                                                    <Search size={48} strokeWidth={1} />
                                                    <p className="italic">{t('promotions.form.products.table.empty')}</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        selectedProducts.map((p, idx) => (
                                            <tr 
                                                key={p.id} 
                                                className={`hover:bg-gray-50 transition-colors ${tableSelectedIndex === idx ? 'bg-primary/5 ring-1 ring-inset ring-primary' : ''}`}
                                            >
                                                <td className="py-4">
                                                    <div className="font-bold text-gray-800">{p.name}</div>
                                                    <div className="text-[10px] font-mono text-gray-400">{p.cip1 || '#'+p.id}</div>
                                                </td>
                                                <td className="py-4 text-center">
                                                    <span className={`font-black ${p.stock <= 0 ? 'text-error' : 'text-success'}`}>
                                                        {p.stock ?? 'N/A'}
                                                    </span>
                                                </td>
                                                <td className="py-4">
                                                    <div className="flex items-center justify-center">
                                                        <div className="flex items-center bg-gray-100 rounded-lg p-1 border">
                                                            <button 
                                                                type="button"
                                                                className="btn btn-xs btn-ghost"
                                                                onClick={() => updateProductQuantity(p.id, Math.max(1, (p.quantity || 1) - 1))}
                                                            ><Minus size={12} /></button>
                                                            <input 
                                                                type="number" 
                                                                className="w-12 text-center bg-transparent border-none font-bold text-sm" 
                                                                value={p.quantity || 1} 
                                                                onChange={(e) => updateProductQuantity(p.id, Number(e.target.value))}
                                                                min="1"
                                                            />
                                                            <button 
                                                                type="button"
                                                                className="btn btn-xs btn-ghost"
                                                                onClick={() => updateProductQuantity(p.id, (p.quantity || 1) + 1)}
                                                            ><Plus size={12} /></button>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-4 text-right font-medium text-gray-600">
                                                    {p.selling_price} F
                                                </td>
                                                {discountType !== DiscountType.BUNDLE && (
                                                    <td className="py-4 text-right">
                                                         <span className="px-3 py-1 bg-primary/10 text-primary font-bold rounded-full text-xs">
                                                            {discountType === DiscountType.BUY_X_GET_Y ? (
                                                                t('promotions.form.products.table.offered', { count: getQuantity })
                                                            ) : (
                                                                discountType === DiscountType.PERCENTAGE ? `-${value}%` : `-${value} F`
                                                            )}
                                                         </span>
                                                    </td>
                                                )}
                                                <td className="py-4 text-center">
                                                    <button 
                                                        type="button" 
                                                        onClick={() => removeProduct(p.id)}
                                                        className="btn btn-ghost btn-sm text-error hover:bg-error/10"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                </form>

                {/* Footer */}
                <div className="p-6 border-t bg-gray-50 flex justify-between items-center">
                    <div className="flex gap-4 text-xs font-bold text-gray-400 uppercase">
                        <span>Status: {loading ? t('promotions.form.status.loading') : t('promotions.form.status.ready')}</span>
                        {discountType === DiscountType.BUNDLE && (
                            <span className="text-secondary">{t('promotions.form.status.total_fixed', { value })}</span>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <button type="button" className="btn btn-ghost px-6" onClick={onClose} disabled={loading}>{t('promotions.form.actions.cancel')}</button>
                        <button type="submit" className="btn btn-primary px-10 shadow-lg shadow-primary/20" onClick={handleSubmit} disabled={loading}>
                            {loading ? <span className="loading loading-spinner"></span> : t('promotions.form.actions.save')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PromotionForm;
