import { useTranslation } from 'react-i18next';
import { Calendar, Eye, Download, Trash2, Loader2 } from 'lucide-react';
import { Button } from '../shadcn/button';
import { LocalizedDateInput } from '../LocalizedDateInput';
import { ProductsCard } from './ProductsCard';
import { RetentionCard } from './RetentionCard';
import { StockLevelsCard } from './StockLevelsCard';
import type { UsePurgeTablesReturn } from './usePurgeTables';
import type { UseProductsMaintenanceReturn } from './useProductsMaintenance';
import type { UseRetentionReturn } from './useRetention';
import type { UseStockLevelsRecalcReturn } from './useStockLevelsRecalc';

interface CleanupTabProps {
  purge: UsePurgeTablesReturn;
  products: UseProductsMaintenanceReturn;
  retention: UseRetentionReturn;
  recalc: UseStockLevelsRecalcReturn;
}

export function CleanupTab({ purge, products, retention, recalc }: CleanupTabProps) {
  const { t } = useTranslation(['maintenance', 'common']);

  return (
    <div className="space-y-4">
      {/* Date Range */}
      <div className="bg-white shadow-xl rounded-2xl border border-slate-200">
        <div className="p-6">
          <h2 className="text-lg font-bold flex items-center gap-2 mb-2">
            <Calendar className="size-5 text-slate-600" />
            {t('period_title')}
          </h2>
          <div className="mb-2">
            <label htmlFor="purge-date-from" className="block"><span className="text-xs text-slate-600">{t('date_from')}</span></label>
            <LocalizedDateInput
              id="purge-date-from"
              className="h-9 text-sm"
              value={purge.dateFrom}
              onChange={e => purge.handleDateFromChange(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="purge-date-to" className="block"><span className="text-xs text-slate-600">{t('date_to')}</span></label>
            <LocalizedDateInput
              id="purge-date-to"
              className="h-9 text-sm"
              value={purge.dateTo}
              onChange={e => purge.handleDateToChange(e.target.value)}
            />
          </div>
          {!purge.dateFrom && !purge.dateTo && (
            <p className="text-xs text-amber-600 mt-2">{t('date_warning')}</p>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="bg-white shadow-xl rounded-2xl border border-slate-200">
        <div className="p-6 space-y-3">
          <h2 className="text-lg font-bold">{t('actions')}</h2>

          <Button
            variant="default"
            size="sm"
            className="w-full gap-2 !whitespace-normal"
            onClick={purge.handlePreview}
            disabled={purge.loading || purge.selectedTables.size === 0}
          >
            {purge.loading ? <Loader2 className="size-4 animate-spin" /> : <Eye className="size-4" />}
            {t('preview_btn')}
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2 border-blue-500 text-blue-600 hover:bg-blue-50"
            onClick={purge.handleExport}
            disabled={purge.exporting || purge.selectedTables.size === 0}
          >
            {purge.exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            {t('export_btn')}
          </Button>

          <div className="border-t border-slate-200 my-0"></div>

          <Button
            variant="destructive"
            size="sm"
            className="w-full gap-2 !whitespace-normal"
            onClick={purge.requestPurge}
            disabled={purge.selectedTables.size === 0}
          >
            <Trash2 className="size-4" />
            {t('purge_btn')}
          </Button>
        </div>
      </div>

      {/* Gestion des Produits */}
      <ProductsCard products={products} />

      {/* Seuils de stock min/max */}
      <StockLevelsCard recalc={recalc} />

      {/* Rétention automatique */}
      <RetentionCard retention={retention} />

      {/* Selection Summary */}
      <div className="bg-slate-100/50 rounded-2xl">
        <div className="p-3">
          <p className="text-sm">
            <span className="font-bold text-indigo-600">{purge.selectedTables.size}</span> {t('selection_summary', { count: purge.selectedTables.size })}
          </p>
          {purge.dateFrom && <p className="text-xs text-slate-500">{t('from')}: {purge.dateFrom}</p>}
          {purge.dateTo && <p className="text-xs text-slate-500">{t('to')}: {purge.dateTo}</p>}
        </div>
      </div>
    </div>
  );
}
