import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';
import { gooeyToast } from 'goey-toast';
import type { Promotion } from '../../types/Promotion';
import { DiscountType } from '../../types/Promotion';
import { formatDate } from '../../utils/dateUtils';
import PromotionForm from './PromotionForm';
import { Button } from '../shadcn/button';
import { Badge } from '../shadcn/badge';
import { Card } from '../shadcn/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../shadcn/table';
import { cn } from '../../lib/utils';
import { Plus, Pencil, Trash2, Tag, CalendarDays } from 'lucide-react';
import { EmptyState } from '../ui/EmptyState';
import { Skeleton } from '../ui/Skeleton';
import { useConfirm } from '../../hooks/useConfirm';
import { getApiErrorDetail } from '../../utils/errorHandling';
import { logger } from '../../utils/logger'


const PromotionList: React.FC = () => {
    const { t } = useTranslation(['promotions', 'common']);
    const confirm = useConfirm();
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
        } catch {
            setError(t('promotions:error_loading'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPromotions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const getDiscountLabel = (promo: Promotion) => {
        switch (promo.discount_type) {
            case DiscountType.PERCENTAGE:
                return `-${promo.value}%`;
            case DiscountType.FIXED_AMOUNT:
                return `-${promo.value} ${t('common:currency')}`;
            case DiscountType.BUY_X_GET_Y:
                return t('promotions:list.discount.buy_get', { buy: promo.buy_quantity, get: promo.get_quantity });
            case DiscountType.BUNDLE:
                return t('promotions:list.discount.bundle', { value: promo.value, currency: t('common:currency') });
            default:
                return '';
        }
    };

    const handleDelete = async (id: number) => {
        const confirmed = await confirm({
            title: t('common:confirmation'),
            message: t('promotions:delete_confirm'),
            confirmText: t('common:confirm'),
            variant: 'danger'
        });
        if (!confirmed) return;
        const previousPromotions = promotions;
        setPromotions(prev => prev.filter(p => p.id !== id));
        try {
            await api.delete(`promotions/${id}/`);
            gooeyToast.success(t('promotions:delete_success'));
        } catch (error: unknown) {
            setPromotions(previousPromotions);
            logger.error("Delete failed", error);
            gooeyToast.error(t('promotions:delete_error', { message: getApiErrorDetail(error, '') }));
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
      <div className="min-h-screen bg-slate-50 p-6 space-y-4">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
    if (error) return (
      <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center justify-center gap-4">
        <p className="text-red-600 font-bold text-lg">{error}</p>
        <Button
          variant="outline"
          onClick={() => {
            setError(null);
            setLoading(true);
            fetchPromotions();
          }}
        >
          {t('common:retry')}
        </Button>
      </div>
    );

    return (
        <div className="h-full flex flex-col bg-slate-50 p-3 sm:p-6 gap-4 sm:gap-6 font-sans">
          {/* Header */}
          <Card className="flex flex-col p-4 sm:p-6">
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

            <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead>{t('promotions:list.table.name')}</TableHead>
                            <TableHead>{t('promotions:list.table.type')}</TableHead>
                            <TableHead>{t('promotions:list.table.detail')}</TableHead>
                            <TableHead>{t('promotions:list.table.period')}</TableHead>
                            <TableHead>{t('promotions:list.table.status')}</TableHead>
                            <TableHead className="text-right">{t('promotions:list.table.actions')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {promotions.map((promo) => (
                            <TableRow key={promo.id}>
                                <TableCell className="whitespace-nowrap font-semibold">{promo.name}</TableCell>
                                <TableCell className="whitespace-nowrap">
                                    <Badge variant={promo.discount_type !== DiscountType.PERCENTAGE && promo.discount_type !== DiscountType.FIXED_AMOUNT ? 'secondary' : 'default'} className={cn(promo.discount_type === DiscountType.BUY_X_GET_Y && 'bg-purple-100 text-purple-700 border-transparent shadow-none', promo.discount_type === DiscountType.BUNDLE && 'bg-violet-100 text-violet-700 border-transparent shadow-none')}>
                                      <Tag className="size-3 mr-1" />
                                      {promo.discount_type === DiscountType.BUY_X_GET_Y ? t('promotions:list.types.special_offer') : promo.discount_type === DiscountType.BUNDLE ? t('promotions:list.types.bundle') : t('promotions:list.types.discount')}
                                    </Badge>
                                </TableCell>
                                <TableCell className="whitespace-nowrap font-bold">
                                    {getDiscountLabel(promo)}
                                </TableCell>
                                <TableCell className="whitespace-nowrap text-slate-500">
                                    <div className="flex items-center gap-1.5">
                                      <CalendarDays className="size-3.5 text-slate-400" />
                                      {formatDate(promo.start_date)}
                                      {promo.end_date ? ` - ${formatDate(promo.end_date)}` : ` ${t('promotions:list.period.indefinite')}`}
                                    </div>
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                    <Badge variant={promo.active ? 'default' : 'destructive'} className={cn(!promo.active && 'bg-red-100 text-red-700 border-transparent shadow-none')}>
                                        {promo.active ? t('promotions:list.status.active') : t('promotions:list.status.inactive')}
                                    </Badge>
                                </TableCell>
                                <TableCell className="whitespace-nowrap text-right font-medium">
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
                                </TableCell>
                            </TableRow>
                        ))}
                        {promotions.length === 0 && (
                          <TableRow className="hover:bg-transparent">
                            <TableCell colSpan={6} className="h-64 text-center">
                              <EmptyState
                                compact
                                icon={<Tag className="size-6" />}
                                title={t('promotions:no_promotions')}
                                className="h-full"
                              />
                            </TableCell>
                          </TableRow>
                        )}
                    </TableBody>
                </Table>
          </Card>
        </div>
    );
};

export default PromotionList;

