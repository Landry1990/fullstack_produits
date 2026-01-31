import React, { useState, useEffect } from 'react';
import type { Promotion } from '../../types/Promotion';
import { DiscountType } from '../../types/Promotion';
import { format } from 'date-fns';
import PromotionForm from './PromotionForm';

import { safeStorage } from '../../utils/storage';

const PromotionList: React.FC = () => {
    const [promotions, setPromotions] = useState<Promotion[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);

    const [editingPromotion, setEditingPromotion] = useState<Promotion | undefined>(undefined);

    const fetchPromotions = async () => {
        try {
            const token = safeStorage.getItem('authToken');
            const response = await fetch('http://127.0.0.1:8000/api/promotions/', {
                headers: {
                    'Authorization': `Token ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            if (!response.ok) throw new Error('Erreur chargement promotions');
            const data = await response.json();
            // Handle pagination (Django Rest Framework default)
            setPromotions(Array.isArray(data) ? data : data.results || []);
        } catch (err) {
            setError('Impossible de charger les promotions');
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
                return `-${promo.value} F`;
            case DiscountType.BUY_X_GET_Y:
                return `Acheter ${promo.buy_quantity}, +${promo.get_quantity} offert(s)`;
            default:
                return '';
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('Voulez-vous vraiment supprimer cette promotion ?')) return;
        
        try {
            const token = safeStorage.getItem('authToken');
            const response = await fetch(`http://127.0.0.1:8000/api/promotions/${id}/`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Token ${token}`
                }
            });
            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Erreur suppression (${response.status}): ${text}`);
            }
            setPromotions(promotions.filter(p => p.id !== id));
        } catch (error: any) {
            console.error("Delete failed", error);
            alert(`Impossible de supprimer la promotion: ${error.message || error}`);
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

    if (loading) return <div>Chargement...</div>;
    if (error) return <div className="text-red-500">{error}</div>;

    return (
        <div className="p-6 bg-white rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Promotions</h2>
                <button 
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
                    onClick={handleCreate}
                >
                    + Nouvelle Promotion
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
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Détail</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Période</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {promotions.map((promo) => (
                            <tr key={promo.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{promo.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                        ${promo.discount_type === DiscountType.BUY_X_GET_Y ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                                        {promo.discount_type === DiscountType.BUY_X_GET_Y ? 'Offre Spéciale' : 'Remise'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-bold">
                                    {getDiscountLabel(promo)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {format(new Date(promo.start_date), 'dd/MM/yyyy')} 
                                    {promo.end_date ? ` - ${format(new Date(promo.end_date), 'dd/MM/yyyy')}` : ' (Indéfini)'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${promo.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                        {promo.active ? 'Active' : 'Inacive'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button 
                                        onClick={() => handleEdit(promo)}
                                        className="text-indigo-600 hover:text-indigo-900 mr-4"
                                    >
                                        Modifier
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(promo.id)}
                                        className="text-red-600 hover:text-red-900"
                                    >
                                        Supprimer
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
