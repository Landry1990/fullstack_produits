import { useTranslation } from 'react-i18next';
import { Gauge, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '../shadcn/button';
import { Progress } from '../shadcn/progress';
import type { UseStockLevelsRecalcReturn } from './useStockLevelsRecalc';

interface StockLevelsCardProps {
  recalc: UseStockLevelsRecalcReturn;
}

export function StockLevelsCard({ recalc }: StockLevelsCardProps) {
  const { t } = useTranslation(['maintenance', 'common']);

  return (
    <div className="bg-white shadow-xl rounded-2xl border border-slate-200">
      <div className="p-6 space-y-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Gauge className="size-5 text-indigo-600" />
          {t('stock_levels.title')}
        </h2>
        <p className="text-xs text-slate-500">{t('stock_levels.description')}</p>

        {recalc.running && (
          <div className="space-y-1.5">
            <Progress value={recalc.progress} />
            <p className="text-xs text-slate-500">
              {recalc.step || t('stock_levels.running')} — {recalc.progress}%
            </p>
          </div>
        )}

        {!recalc.running && recalc.updated !== null && (
          <p className="text-xs font-medium text-emerald-600">
            {t('stock_levels.done', { count: recalc.updated })}
          </p>
        )}

        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2 !whitespace-normal"
          onClick={recalc.start}
          disabled={recalc.running}
        >
          {recalc.running ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          {recalc.running ? t('stock_levels.running') : t('stock_levels.run_now')}
        </Button>
      </div>
    </div>
  );
}
