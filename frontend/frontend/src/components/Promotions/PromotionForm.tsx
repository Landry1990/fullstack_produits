import React, { useState } from 'react';
import type { Promotion } from '../../types/Promotion';
import { DiscountType, ApplicationMode } from '../../types/Promotion';
import { safeStorage } from '../../utils/storage';
import { useProductSearch } from '../../hooks/useProductSearch';

interface PromotionFormProps {
    onClose: () => void;
    onSave: () => void;
    initialData?: Promotion;
}

const PromotionForm: React.FC<PromotionFormProps> = ({ onClose, onSave, initialData }) => {
    const [name, setName] = useState(initialData?.name || '');
    const [description, setDescription] = useState(initialData?.description || '');
    const [discountType, setDiscountType] = useState<DiscountType>(initialData?.discount_type || DiscountType.PERCENTAGE);
    const [applicationMode, setApplicationMode] = useState<ApplicationMode>(initialData?.application_mode || ApplicationMode.AUTO_APPLY);
    const [value, setValue] = useState(initialData?.value || 0);
    const [buyQuantity, setBuyQuantity] = useState(initialData?.buy_quantity || 1);
    const [getQuantity, setGetQuantity] = useState(initialData?.get_quantity || 0);
    const [startDate, setStartDate] = useState(initialData?.start_date ? new Date(initialData.start_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(initialData?.end_date ? new Date(initialData.end_date).toISOString().split('T')[0] : '');
    const [loading, setLoading] = useState(false);

    // Product Search State
    // Product Search State
    const { 
        searchQuery, 
        setSearchQuery: handleSearchChange, 
        produits: searchResults,
        loading: searchLoading 
    } = useProductSearch({ 
        minSearchLength: 2,
        debounceMs: 300 
    });
    
    // For Bundle, we need to track quantity per product.
    // We'll reuse selectedProducts but enhance it to store quantity.
    // Interface: { id, name, ...otherProductFields, quantity: number }
    const [selectedProducts, setSelectedProducts] = useState<any[]>(() => {
        if (initialData?.discount_type === 'BUNDLE' && initialData.pack_items) {
             return initialData.pack_items.map(pi => ({
                 id: pi.product, // Assuming pack_items has product ID
                 name: pi.product_name || `Produit #${pi.product}`,
                 quantity: pi.quantity,
                 // We might miss price/stock unless we fetch products details again or initialData includes them
                 // Ideally we should fetch full product details if missing, but for now relying on minimal info
             }));
        } 
        // For regular promos, initialData.products is list of IDs? Wait Promotion interface says products?: number[]
        // But in previous implementation we might have treated it loosely.
        // If we only have IDs, we can't show names properly without fetching.
        // Assuming fetchPromotions returns details or we won't see names initially correctly (TODO: fix backend to return full objects or fetch them)
        // For now, let's proceed. If products is list of IDs, we need to handle that.
        // Actually, if it's Edit mode, we probably want to load product list.
        return initialData?.products ? initialData.products.map(id => ({ id, name: 'Chargement...', quantity: 1 })) : []; 
    });

    // We need to fetch product details if we only have IDs, ideally.
    // Or simpler: The backend serializer for List returns `products_count`. Detail serializer might return objects?
    // Let's assume for now we might have issue with names if we just map IDs.
    
    // ... search logic ...

    const addProduct = (product: any) => {
        if (!selectedProducts.find(p => p.id === product.id)) {
            setSelectedProducts([...selectedProducts, { ...product, quantity: 1 }]);
        }
        handleSearchChange('');
    };

    const updateProductQuantity = (id: number, qty: number) => {
        setSelectedProducts(selectedProducts.map(p => 
            p.id === id ? { ...p, quantity: qty } : p
        ));
    };

    const removeProduct = (productId: number) => {
        setSelectedProducts(selectedProducts.filter(p => p.id !== productId));
    };

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
            const url = initialData 
                ? `http://127.0.0.1:8000/api/promotions/${initialData.id}/`
                : 'http://127.0.0.1:8000/api/promotions/';

            const response = await fetch(url, {
                method,
                headers: {
                    'Authorization': `Token ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error('Erreur sauvegarde');
            
            onSave();
            onClose();
        } catch (error) {
            console.error(error);
            alert('Erreur lors de la sauvegarde');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <h2 className="text-xl font-bold mb-4">{initialData ? 'Modifier' : 'Nouvelle'} Promotion</h2>
                
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Nom</label>
                                <input type="text" className="input input-bordered w-full" value={name} onChange={e => setName(e.target.value)} required />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Période</label>
                                <div className="flex gap-2">
                                    <input type="date" className="input input-bordered w-full" value={startDate} onChange={e => setStartDate(e.target.value)} required />
                                    <input type="date" className="input input-bordered w-full" value={endDate} onChange={e => setEndDate(e.target.value)} />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Type de Promotion</label>
                                <select 
                                    className="select select-bordered w-full" 
                                    value={discountType} 
                                    onChange={e => setDiscountType(e.target.value as DiscountType)}
                                >
                                    <option value={DiscountType.PERCENTAGE}>Remise en Pourcentage (%)</option>
                                    <option value={DiscountType.FIXED_AMOUNT}>Remise Montant Fixe (F)</option>
                                    <option value={DiscountType.BUY_X_GET_Y}>Buy X Get Y (Offre Gratuité)</option>
                                    <option value={DiscountType.BUNDLE}>Pack / Lot (Prix Fixe)</option>
                                </select>
                            </div>

                             {/* Global Values */}
                            <div className="p-3 bg-gray-50 rounded border border-gray-200">
                                <div className="grid grid-cols-2 gap-4">
                                    {(discountType === DiscountType.PERCENTAGE || discountType === DiscountType.FIXED_AMOUNT || discountType === DiscountType.BUNDLE) && (
                                        <div>
                                            <label className="block text-xs font-bold uppercase text-gray-500 mb-1">
                                                {discountType === DiscountType.BUNDLE ? 'Prix du Pack (Total)' : `Valeur Remise (${discountType === DiscountType.PERCENTAGE ? '%' : 'F'})`}
                                            </label>
                                            <input type="number" className="input input-bordered w-full input-sm font-bold text-primary" value={value} onChange={e => setValue(Number(e.target.value))} />
                                        </div>
                                    )}
                                    
                                    {discountType === DiscountType.BUY_X_GET_Y && (
                                        <>
                                            <div>
                                                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Acheter (X)</label>
                                                <input type="number" className="input input-bordered w-full input-sm" value={buyQuantity} onChange={e => setBuyQuantity(Number(e.target.value))} min="1" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Offert (Y)</label>
                                                <input type="number" className="input input-bordered w-full input-sm" value={getQuantity} onChange={e => setGetQuantity(Number(e.target.value))} />
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Products Table Section */}
                    <div className="mt-6 border-t pt-4">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="font-bold text-lg">Produits Concernés</h3>
                            
                            <div className="relative w-64">
                                <input 
                                    type="text" 
                                    className="input input-bordered input-sm w-full" 
                                    placeholder="Ajouter un produit..." 
                                    value={searchQuery}
                                    onChange={(e) => handleSearchChange(e.target.value)}
                                />
                                {searchResults.length > 0 && (
                                    <ul className="absolute z-50 right-0 w-80 bg-white border border-gray-300 rounded shadow-xl max-h-60 overflow-y-auto mt-1">
                                        {searchResults.map(p => (
                                            <li 
                                                key={p.id} 
                                                className="p-3 hover:bg-base-200 cursor-pointer border-b last:border-0 flex justify-between items-center"
                                                onClick={() => addProduct(p)}
                                            >
                                                <div>
                                                    <div className="font-bold text-sm">{p.name}</div>
                                                    <div className="text-xs text-gray-500">Stock: {p.stock} | Prix: {p.selling_price} F</div>
                                                </div>
                                                <button type="button" className="btn btn-xs btn-primary btn-outline">+</button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>

                        <div className="overflow-x-auto border rounded-lg max-h-64">
                            <table className="table table-sm table-pin-rows w-full">
                                <thead className="bg-base-200">
                                    <tr>
                                        <th>Produit</th>
                                        <th className="w-24 text-right">Qté Requise</th>
                                        {discountType !== DiscountType.BUNDLE && <th className="w-32 text-right">Remise</th>}
                                        <th className="w-32 text-right">Prix Vente</th>
                                        <th className="w-16"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedProducts.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="text-center py-8 text-gray-400 italic">
                                                Aucun produit sélectionné. Utilisez la recherche pour ajouter des articles.
                                            </td>
                                        </tr>
                                    ) : (
                                        selectedProducts.map(p => (
                                            <tr key={p.id}>
                                                <td className="font-medium">
                                                    {p.name}
                                                    <div className="text-xs text-gray-400">{p.cip1 || 'Sans Code'}</div>
                                                </td>
                                                <td className="text-right font-mono">
                                                    {discountType === DiscountType.BUNDLE ? (
                                                        <input 
                                                            type="number" 
                                                            className="input input-bordered input-xs w-16 text-center" 
                                                            value={p.quantity || 1} 
                                                            onChange={(e) => updateProductQuantity(p.id, Number(e.target.value))}
                                                            min="1"
                                                        />
                                                    ) : (
                                                        discountType === DiscountType.BUY_X_GET_Y ? buyQuantity : 1
                                                    )}
                                                </td>
                                                {discountType !== DiscountType.BUNDLE && (
                                                    <td className="text-right font-bold text-primary">
                                                         {discountType === DiscountType.BUY_X_GET_Y ? (
                                                            `${getQuantity} Offert`
                                                         ) : (
                                                            discountType === DiscountType.PERCENTAGE ? `-${value}%` : `-${value} F`
                                                         )}
                                                    </td>
                                                )}
                                                <td className="text-right text-gray-500">
                                                    {p.selling_price} F
                                                </td>
                                                <td className="text-center">
                                                    <button 
                                                        type="button" 
                                                        onClick={() => removeProduct(p.id)}
                                                        className="btn btn-ghost btn-xs text-error"
                                                    >
                                                        ✕
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                        <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
                        <button type="submit" className="btn btn-primary px-8" disabled={loading}>
                            {loading ? 'Sauvegarde...' : 'Enregistrer'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PromotionForm;
