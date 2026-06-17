import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';
import type { Promotion } from '../../types/Promotion';
import { DiscountType } from '../../types/Promotion';
import { format } from 'date-fns';
import PromotionForm from './PromotionForm';
import { Button } from '../shadcn/button';
import { Badge } from '../shadcn/badge';
import { cn } from '../../lib/utils';
import { Plus, Pencil, Trash2, Loader2, Tag, CalendarDays } from 'lucide-react';


const PromotionList: React.FC = () => {
    const { t } = useTranslation(['promotions', 'common']);
    const [promotions, setPromotions] = useState<Promotion[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);

    const [editingPromotion, setEditingPromotion] = useState<Promotion | undefined>(undefined);

    const fetchPromotions = async () => {
        try {
            const response = await api.get('promotions/');
            const data = response.data;
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
            await api.delete(`promotions/${id}/`);
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

    if (loading) return (
      <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center justify-center gap-4">
        <div className="animate-spin rounded-full size-10 border-b-2 border-emerald-600"></div>
        <p className="text-slate-500 font-medium">{t('promotions:loading')}</p>
      </div>
    );
    if (error) return (
      <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center justify-center gap-4">
        <p className="text-red-600 font-bold text-lg">{error}</p>
      </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 p-3 sm:p-6 space-y-4 sm:space-y-6 font-sans">
          {/* Header */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t('promotions:title')}</h1>
                <p className="text-slate-500 text-sm mt-1">{t('promotions:subtitle')}</p>
              </div>
              <Button
                size="sm"
                className="gap-2"
                onClick={handleCreate}
              >
                <Plus className="size-4" />
                {t('promotions:new_btn')}
              </Button>
            </div>

            {showForm && (
                <PromotionForm
                    initialData={editingPromotion}
                    onClose={() => {
                        setShowForm(false);
                        setEditingPromotion(undefined);
                    }}
                    onSave={() => {
                        fetchPromotions();
                        setShowForm(false);
                        setEditingPromotion(undefined);
                    }}
                />
            )}

            <div className="overflow-x-auto -mx-2 px-2">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-100">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('promotions:list.table.name')}</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('promotions:list.table.type')}</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('promotions:list.table.detail')}</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('promotions:list.table.period')}</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('promotions:list.table.status')}</th>
                            <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">{t('promotions:list.table.actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {promotions.map((promo) => (
                            <tr key={promo.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-slate-700">{promo.name}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm">
                                    <Badge variant={promo.discount_type === DiscountType.BUY_X_GET_Y ? 'secondary' : 'default'} className={cn(promo.discount_type === DiscountType.BUY_X_GET_Y && 'bg-purple-100 text-purple-700 border-transparent shadow-none')}>
                                      <Tag className="size-3 mr-1" />
                                      {promo.discount_type === DiscountType.BUY_X_GET_Y ? t('promotions:list.types.special_offer') : t('promotions:list.types.discount')}
                                    </Badge>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-700 font-bold">
                                    {getDiscountLabel(promo)}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500">
                                    <div className="flex items-center gap-1.5">
                                      <CalendarDays className="size-3.5 text-slate-400" />
                                      {format(new Date(promo.start_date), t('common:date_format_short', 'dd/MM/yyyy'))}
                                      {promo.end_date ? ` - ${format(new Date(promo.end_date), t('common:date_format_short', 'dd/MM/yyyy'))}` : ` ${t('promotions:list.period.indefinite')}`}
                                    </div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                    <Badge variant={promo.active ? 'default' : 'destructive'} className={cn(!promo.active && 'bg-red-100 text-red-700 border-transparent shadow-none')}>
                                        {promo.active ? t('promotions:list.status.active') : t('promotions:list.status.inactive')}
                                    </Badge>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                                    <div className="flex justify-end gap-2">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-emerald-600 h-8 w-8 p-0"
                                        onClick={() => handleEdit(promo)}
                                        title={t('promotions:list.actions.edit')}
                                      >
                                        <Pencil className="size-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-red-600 h-8 w-8 p-0"
                                        onClick={() => handleDelete(promo.id)}
                                        title={t('promotions:list.actions.delete')}
                                      >
                                        <Trash2 className="size-4" />
                                      </Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {promotions.length === 0 && (
                          <tr>
                            <td colSpan={6} className="h-64 text-center text-slate-500">
                              <div className="flex flex-col items-center justify-center gap-3">
                                <Tag className="size-12 text-slate-300" />
                                <p className="text-lg font-medium">{t('promotions:no_promotions')}</p>
                              </div>
                            </td>
                          </tr>
                        )}
                    </tbody>
                </table>
            </div>
          </div>
        </div>
    );
};

export default PromotionList;

