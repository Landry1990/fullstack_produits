import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { Promotion } from '../../types/Promotion';
import { DiscountType } from '../../types/Promotion';
import { format } from 'date-fns';
import PromotionForm from './PromotionForm';

import { safeStorage } from '../../utils/storage';

const PromotionList: React.FC = () => {
    const { t } = useTranslation(['promotions', 'common']);
    const [promotions, setPromotions] = useState<Promotion[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);

    const [editingPromotion, setEditingPromotion] = useState<Promotion | undefined>(undefined);

    const fetchPromotions = async () => {
        try {
            const token = safeStorage.getItem('authToken');
            const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
            const response = await fetch(`${apiBaseUrl}/api/promotions/`, {
                headers: {
                    'Authorization': `Token ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            if (!response.ok) throw new Error(t('promotions:fetch_error'));
            const data = await response.json();
            // Handle pagination (Django Rest Framework default)
            setPromotions(Array.isArray(data) ? data : data.results || []);
        } catch (err) {
            setError(t('promotions:error_loading'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPromotions();
    }, []);

    const getDiscountLabel = (promo: Promotion) => {
        switch (promo.discount_type) {
            case DiscountType.PERCENTAGE:
                return `-${promo.value}%`;
            case DiscountType.FIXED_AMOUNT:
                return `-${promo.value} ${t('common:currency')}`;
            case DiscountType.BUY_X_GET_Y:
                return t('promotions:list.discount.buy_get', { buy: promo.buy_quantity, get: promo.get_quantity });
            default:
                return '';
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm(t('promotions:delete_confirm'))) return;
        
        try {
            const token = safeStorage.getItem('authToken');
            const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
            const response = await fetch(`${apiBaseUrl}/api/promotions/${id}/`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Token ${token}`
                }
            });
            if (!response.ok) {
                const text = await response.text();
                throw new Error(t('promotions:delete_error', { message: text }));
            }
            setPromotions(promotions.filter(p => p.id !== id));
        } catch (error: any) {
            console.error("Delete failed", error);
            alert(t('promotions:delete_error', { message: error.message || error }));
        }
    };

    const handleEdit = (promo: Promotion) => {
        setEditingPromotion(promo);
        setShowForm(true);
    };

    const handleCreate = () => {
        setEditingPromotion(undefined);
        setShowForm(true);
    };

    if (loading) return <div className="p-6 text-center">{t('promotions:loading')}</div>;
    if (error) return <div className="p-6 text-center text-red-500 font-bold">{error}</div>;

    return (
        <div className="p-6 bg-base-100 rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-base-content">{t('promotions:title')}</h2>
                <button 
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
                    onClick={handleCreate}
                >
                    {t('promotions:new_btn')}
                </button>
            </div>

            {showForm && (
                <PromotionForm 
                    initialData={editingPromotion}
                    onClose={() => {
                        setShowForm(false);
                        setEditingPromotion(undefined); // Clear editing state when form closes
                    }} 
                    onSave={() => {
                        fetchPromotions(); // Refresh list
                        setShowForm(false); // Close form after save
                        setEditingPromotion(undefined); // Clear editing state
                    }} 
                />
            )}

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-base-200">
                    <thead className="bg-base-200/50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-base-content/60 uppercase tracking-wider">{t('promotions:list.table.name')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-base-content/60 uppercase tracking-wider">{t('promotions:list.table.type')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-base-content/60 uppercase tracking-wider">{t('promotions:list.table.detail')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-base-content/60 uppercase tracking-wider">{t('promotions:list.table.period')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-base-content/60 uppercase tracking-wider">{t('promotions:list.table.status')}</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-base-content/60 uppercase tracking-wider">{t('promotions:list.table.actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="bg-base-100 divide-y divide-base-200">
                        {promotions.map((promo) => (
                            <tr key={promo.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-base-content">{promo.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-base-content/60">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                        ${promo.discount_type === DiscountType.BUY_X_GET_Y ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                                        {promo.discount_type === DiscountType.BUY_X_GET_Y ? t('promotions:list.types.special_offer') : t('promotions:list.types.discount')}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-base-content/60 font-bold">
                                    {getDiscountLabel(promo)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-base-content/60">
                                    {format(new Date(promo.start_date), t('common:date_format_short', 'dd/MM/yyyy'))} 
                                    {promo.end_date ? ` - ${format(new Date(promo.end_date), t('common:date_format_short', 'dd/MM/yyyy'))}` : ` ${t('promotions:list.period.indefinite')}`}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${promo.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                        {promo.active ? t('promotions:list.status.active') : t('promotions:list.status.inactive')}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button 
                                        onClick={() => handleEdit(promo)}
                                        className="text-indigo-600 hover:text-indigo-900 mr-4"
                                    >
                                        {t('promotions:list.actions.edit')}
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(promo.id)}
                                        className="text-red-600 hover:text-red-900"
                                    >
                                        {t('promotions:list.actions.delete')}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default PromotionList;

