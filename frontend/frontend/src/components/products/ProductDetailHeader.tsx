import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, MoreVertical, Pencil, Trash2,
  BarChart3, Tags, Eye, EyeOff, Truck
} from 'lucide-react';
import type { ProduitModel } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger
} from '../shadcn/dropdown-menu';

interface ProductDetailHeaderProps {
  produit: ProduitModel;
  transferLoading: boolean;
  onBack: () => void;
  onOpenAdjust: (produit: ProduitModel) => void;
  onOpenEdit: (produit: ProduitModel) => void;
  onTransferToRayon: (produit: ProduitModel) => void;
  onGenerateLabels: (produit: ProduitModel) => void;
  onToggleActive: (produit: ProduitModel) => void;
  onDelete: (produit: ProduitModel) => void;
}

export const ProductDetailHeader: React.FC<ProductDetailHeaderProps> = ({
  produit,
  transferLoading,
  onBack,
  onOpenAdjust,
  onOpenEdit,
  onTransferToRayon,
  onGenerateLabels,
  onToggleActive,
  onDelete,
}) => {
  const { t } = useTranslation(['products', 'common']);

  return (
    <div className="shrink-0 px-4 sm:px-6 py-4 border-b border-slate-100 space-y-3">
      {/* Nom + méta */}
      <div className="flex items-start gap-1">
        <button
          type="button"
          onClick={onBack}
          className="lg:hidden -ml-1 mt-0.5 p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          aria-label={t('common:back')}
        >
          <ArrowLeft className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 uppercase leading-tight break-words min-w-0" title={produit.name}>
              {produit.name}
            </h2>
            {produit.is_active === false && <Badge variant="ghost" size="sm">{t('products:table.inactive_badge')}</Badge>}
            {produit.is_supplier_exclusive && <Badge variant="success" size="sm">{t('products:table.exclusive_badge_full')}</Badge>}
            {produit.is_service && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-violet-50 text-violet-600">
                {t('products:form.service_badge')}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
            <p className="text-sm text-slate-500 font-mono">{t('common:cip')}: <span className="text-slate-700">{produit.cip1 || '-'}</span></p>
            {produit.cip2 && <p className="text-sm text-slate-400 font-mono">• <span className="text-slate-600">{produit.cip2}</span></p>}
            {produit.cip3 && <p className="text-sm text-slate-400 font-mono">• <span className="text-slate-600">{produit.cip3}</span></p>}
            {produit.cip4 && <p className="text-sm text-slate-400 font-mono">• <span className="text-slate-600">{produit.cip4}</span></p>}
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="flex flex-wrap gap-2">
        {produit.is_service ? (
          <div className="flex-1 min-w-[110px] rounded-xl border bg-violet-50 border-violet-200 text-violet-700 px-3 py-2">
            <div className="text-caption font-bold uppercase tracking-wider opacity-75">{t('products:form.service_badge')}</div>
            <div className="text-2xl font-black leading-tight">—</div>
          </div>
        ) : (
          <>
            <div className={`flex-1 min-w-[110px] rounded-xl border px-3 py-2 ${
              ((produit.total_stock ?? produit.stock) ?? 0) <= 0 ? 'bg-red-50 border-red-200 text-red-700' :
              ((produit.total_stock ?? produit.stock) ?? 0) <= (produit.stock_minimum ?? 0) ? 'bg-amber-50 border-amber-200 text-amber-700' :
              'bg-emerald-50 border-emerald-200 text-emerald-700'
            }`}>
              <div className="text-caption font-bold uppercase tracking-wider opacity-75">
                {produit.has_reserve_storage ? t('common:rayon') : t('common:stock')}
              </div>
              <div className="text-2xl font-black tabular-nums leading-tight">{produit.stock ?? 0}</div>
            </div>
            {produit.has_reserve_storage && (
              <div className="flex-1 min-w-[110px] rounded-xl border bg-slate-50 border-slate-200 text-slate-700 px-3 py-2">
                <div className="text-caption font-bold uppercase tracking-wider opacity-75">{t('products:detail.reserve_label')}</div>
                <div className="text-2xl font-black tabular-nums leading-tight">{produit.stock_reserve ?? 0}</div>
              </div>
            )}
            <div className="flex-1 min-w-[110px] rounded-xl border bg-slate-50 border-slate-200 text-slate-700 px-3 py-2">
              <div className="text-caption font-bold uppercase tracking-wider opacity-75">{t('products:detail.general.alert_threshold')}</div>
              <div className="text-2xl font-black tabular-nums leading-tight">{produit.stock_minimum ?? 0}</div>
            </div>
          </>
        )}
        <div className="flex-1 min-w-[110px] rounded-xl border bg-indigo-50 border-indigo-200 text-indigo-700 px-3 py-2">
          <div className="text-caption font-bold uppercase tracking-wider opacity-75">{t('products:detail.price.selling')}</div>
          <div className="text-2xl font-black tabular-nums leading-tight">{formatCurrency(Math.round(Number(produit.selling_price || 0)))}</div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        {!produit.is_service && (
          <Button variant="outline" size="sm" onClick={() => onOpenAdjust(produit)} leftIcon={<BarChart3 className="size-4" />} title={t('products:actions.adjust_stock', { defaultValue: 'Ajuster le stock' })}>
            {t('products:actions.adjust_stock', { defaultValue: 'Stock' })}
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => onOpenEdit(produit)} leftIcon={<Pencil className="size-4" />} title={t('common:actions.edit', { defaultValue: 'Modifier' })}>
          {t('common:actions.edit', { defaultValue: 'Modifier' })}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" aria-label={t('common:actions_title', { defaultValue: 'Actions' })} className="!px-2">
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            {!produit.is_service && produit.has_reserve_storage && (produit.stock_reserve ?? 0) > 0 && (
              <DropdownMenuItem onSelect={() => onTransferToRayon(produit)} disabled={transferLoading}>
                <Truck className="size-4" />
                {t('products:actions.refill_rayon', { defaultValue: 'Réapprovisionner rayon' })}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={() => onGenerateLabels(produit)}>
              <Tags className="size-4" />
              {t('products:actions.labels', { defaultValue: 'Étiquettes' })}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onToggleActive(produit)}>
              {produit.is_active === false ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
              {produit.is_active === false ? t('products:actions.reactivate', { defaultValue: 'Réactiver' }) : t('products:actions.deactivate', { defaultValue: 'Désactiver' })}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onDelete(produit)} className="text-red-600 focus:text-red-700">
              <Trash2 className="size-4" />
              {t('common:actions.delete', { defaultValue: 'Supprimer' })}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};
