import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../../services/api';
import { toast } from 'react-hot-toast';
import { X, Search } from 'lucide-react';
import type { ProduitModel, Client } from '../../../types';
import PremiumModal from '../../common/PremiumModal';

interface PromisFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    clients: Client[];
    produits: ProduitModel[];
    onSuccess: () => void;
}

export const PromisFormModal: React.FC<PromisFormModalProps> = ({
    isOpen,
    onClose,
    clients,
    produits,
    onSuccess
}) => {
    const { t } = useTranslation(['stock', 'common']);
    
    const [formData, setFormData] = useState({
        client: null as number | null,
        client_name: '',
        client_phone: '',
        produit: null as number | null,
        quantite: 1,
        notes: ''
    });
    
    const [clientSearch, setClientSearch] = useState('');
    const [productSearch, setProductSearch] = useState('');
    const [saving, setSaving] = useState(false);

    const resetForm = () => {
        setFormData({
            client: null,
            client_name: '',
            client_phone: '',
            produit: null,
            quantite: 1,
            notes: ''
        });
        setClientSearch('');
        setProductSearch('');
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formData.produit) {
            toast(t('stock:promis.validation.product_required'), { icon: '⚠️' });
            return;
        }
        if (!formData.client && !formData.client_name.trim()) {
            toast(t('stock:promis.validation.client_required'), { icon: '⚠️' });
            return;
        }

        setSaving(true);
        try {
            await api.post('promis/', {
                ...formData,
                client: formData.client || null
            });
            toast.success(t('common:messages.created'));
            onSuccess();
            handleClose();
        } catch (err: any) {
            toast.error(err.response?.data?.detail || t('stock:promis.validation.create_error'));
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const selectClient = (c: Client) => {
        setFormData(prev => ({ 
            ...prev, 
            client: c.id, 
            client_name: c.name,
            client_phone: c.phone || ''
        }));
        setClientSearch(c.name);
    };

    const selectProduct = (p: ProduitModel) => {
        setFormData(prev => ({ ...prev, produit: p.id }));
        setProductSearch(p.name);
    };

    return (
        <PremiumModal
            isOpen={isOpen}
            onClose={handleClose}
            title={t('stock:promis.modal.title_new')}
        >
            <form onSubmit={handleSubmit} className="space-y-5">
                {/* Client Search */}
                <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-base-content/60 mb-1">
                        {t('stock:promis.modal.client_label')}
                    </label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-base-content/50" />
                        <input
                            type="text"
                            className="w-full rounded-lg border border-base-300 bg-base-100 pl-9 text-sm font-medium text-base-content focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                            placeholder={t('stock:promis.modal.client_placeholder')}
                            value={clientSearch}
                            onChange={(e) => {
                                setClientSearch(e.target.value);
                                setFormData(prev => ({ ...prev, client: null, client_name: e.target.value }));
                            }}
                        />
                        {clientSearch && !formData.client && (
                            <button
                                type="button"
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 bg-base-200 rounded-full hover:bg-base-300"
                                onClick={() => {
                                    setClientSearch('');
                                    setFormData(prev => ({ ...prev, client: null, client_name: '' }));
                                }}
                            >
                                <X className="size-3 text-base-content/60" />
                            </button>
                        )}
                    </div>
                    {clientSearch && !formData.client && clients.filter(c => 
                        c.name.toLowerCase().includes(clientSearch.toLowerCase())
                    ).slice(0, 5).length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-base-100 border border-base-200 rounded-xl shadow-md max-h-48 overflow-y-auto">
                            {clients.filter(c => 
                                c.name.toLowerCase().includes(clientSearch.toLowerCase())
                            ).slice(0, 5).map(c => (
                                <div 
                                    key={c.id} 
                                    className="p-3 hover:bg-primary/10 cursor-pointer border-b border-base-200 last:border-0 transition-colors"
                                    onClick={() => selectClient(c)}
                                >
                                    <div className="font-medium text-sm">{c.name}</div>
                                    <div className="text-xs text-base-content/60 font-mono mt-0.5">{c.phone || t('common:no_number', 'Sans numéro')}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Phone */}
                <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-base-content/60 mb-1">
                        {t('stock:promis.modal.phone_label')}
                    </label>
                    <input
                        type="text"
                        className="w-full rounded-lg border border-base-300 bg-base-100 px-3 text-sm font-mono text-base-content focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                        placeholder={t('stock:promis.modal.phone_placeholder')}
                        value={formData.client_phone}
                        onChange={(e) => setFormData(prev => ({ ...prev, client: null, client_phone: e.target.value }))}
                    />
                </div>

                {/* Product Search */}
                <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-base-content/60 mb-1">
                        {t('stock:promis.modal.product_label')}
                    </label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-base-content/50" />
                        <input
                            type="text"
                            className="w-full rounded-lg border border-base-300 bg-base-100 pl-9 text-sm font-medium text-base-content focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                            placeholder={t('stock:promis.modal.product_placeholder')}
                            value={productSearch}
                            onChange={(e) => {
                                setProductSearch(e.target.value);
                                setFormData(prev => ({ ...prev, produit: null }));
                            }}
                        />
                        {productSearch && !formData.produit && (
                            <button
                                type="button"
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 bg-base-200 rounded-full hover:bg-base-300"
                                onClick={() => {
                                    setProductSearch('');
                                    setFormData(prev => ({ ...prev, produit: null }));
                                }}
                            >
                                <X className="size-3 text-base-content/60" />
                            </button>
                        )}
                    </div>
                    {productSearch && !formData.produit && produits.filter(p => 
                        p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                        (p.cip1 && p.cip1.includes(productSearch))
                    ).slice(0, 5).length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-base-100 border border-base-200 rounded-xl shadow-md max-h-48 overflow-y-auto">
                            {produits.filter(p => 
                                p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                                (p.cip1 && p.cip1.includes(productSearch))
                            ).slice(0, 5).map(p => (
                                <div 
                                    key={p.id} 
                                    className="p-3 hover:bg-primary/10 cursor-pointer border-b border-base-200 last:border-0 flex justify-between items-center transition-colors"
                                    onClick={() => selectProduct(p)}
                                >
                                    <div>
                                        <div className="font-medium text-sm">{p.name}</div>
                                        {p.cip1 && <div className="text-xs text-base-content/60 font-mono mt-0.5">{p.cip1}</div>}
                                    </div>
                                    <div className="text-xs font-medium px-2 py-1 bg-base-200 rounded-md">
                                        {t('common:stock', 'Stock')}: {p.stock}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Quantity */}
                <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-base-content/60 mb-1">
                        {t('stock:promis.modal.qty_label')}
                    </label>
                    <input
                        type="number"
                        min="1"
                        className="w-full rounded-lg border border-base-300 bg-base-100 px-3 text-sm font-mono text-base-content focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                        value={formData.quantite}
                        onChange={(e) => setFormData(prev => ({ ...prev, quantite: parseInt(e.target.value) || 1 }))}
                        required
                    />
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-base-content/60 mb-1">
                        {t('stock:promis.modal.notes_label')}
                    </label>
                    <textarea
                        className="w-full rounded-lg border border-base-300 bg-base-100 p-3 text-sm font-medium text-base-content focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all h-24"
                        placeholder={t('stock:promis.modal.notes_placeholder')}
                        value={formData.notes}
                        onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    />
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-base-200 mt-6">
                    <button 
                        type="button" 
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-base-content/70 hover:bg-base-200 rounded-lg text-sm font-medium transition-colors btn-ghost" 
                        onClick={handleClose}
                        disabled={saving}
                    >
                        {t('common:cancel')}
                    </button>
                    <button 
                        type="submit" 
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-base-content/70 hover:bg-base-200 rounded-lg text-sm font-medium transition-colors btn-primary text-white shadow-sm hover:shadow-md transition-all gap-2 px-6"
                        disabled={saving}
                    >
                        {saving && <span className="inline-block size-4 border-2 border-base-300 border-t-indigo-600 rounded-full animate-spin" />}
                        {t('common:save')}
                    </button>
                </div>
            </form>
        </PremiumModal>
    );
};
