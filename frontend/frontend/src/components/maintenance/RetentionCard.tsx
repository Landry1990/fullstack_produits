import { useTranslation } from 'react-i18next';
import { Clock, Eye, Save, RefreshCw, Loader2, Trash2 } from 'lucide-react';
import { Button } from '../shadcn/button';
import { Input } from '../shadcn/input';
import { Checkbox } from '../shadcn/checkbox';
import { Badge } from '../shadcn/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../shadcn/table';
import { formatNumber } from '../../utils/formatters';
import { formatDate } from '../../utils/dateUtils';
import { RETENTION_DAY_FIELDS } from './types';
import type { UseRetentionReturn } from './useRetention';

interface RetentionCardProps {
  retention: UseRetentionReturn;
}

export function RetentionCard({ retention }: RetentionCardProps) {
  const { t } = useTranslation(['maintenance', 'common']);
  const { pharmacySettings, setPharmacySettings } = retention;

  return (
    <div className="bg-white shadow-xl rounded-2xl border border-amber-500/20">
      <div className="p-6 space-y-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Clock className="size-5 text-amber-600" />
          {t('retention.title')}
        </h2>
        <p className="text-xs text-slate-500">{t('retention.description')}</p>

        {/* Toggle */}
        <label className="flex items-center gap-3 cursor-pointer p-0">
          <Checkbox
            checked={pharmacySettings?.retention_enabled || false}
            onCheckedChange={(checked) => retention.handleRetentionToggle(!!checked)}
            disabled={!pharmacySettings || retention.savingRetention}
          />
          <span className="text-sm text-slate-700">{t('retention.enable')}</span>
          {retention.savingRetention && <Loader2 className="size-3 animate-spin text-slate-400" />}
        </label>

        {/* Durées de conservation */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
            {t('retention.days_title')}
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {RETENTION_DAY_FIELDS.map(field => (
              <div key={field}>
                <label htmlFor={`retention-${field}`} className="block">
                  <span className="text-xs text-slate-600">{t(`retention.days_labels.${field}`)}</span>
                </label>
                <Input
                  id={`retention-${field}`}
                  type="number"
                  min={0}
                  className="h-8 text-sm"
                  value={pharmacySettings?.[field] ?? ''}
                  onChange={e => {
                    const n = parseInt(e.target.value, 10);
                    setPharmacySettings(prev => ({
                      ...prev,
                      [field]: e.target.value === '' || isNaN(n) ? undefined : n,
                    }));
                  }}
                />
              </div>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2 mt-2"
            onClick={retention.saveRetentionDays}
            disabled={retention.savingRetention || !pharmacySettings}
          >
            {retention.savingRetention ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
            {t('save_settings')}
          </Button>
        </div>

        <div className="border-t border-slate-200 my-0"></div>

        {/* Aperçu des données expirées */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <Eye className="size-4" />
              {t('retention.preview_title')}
            </h3>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-1"
              onClick={() => retention.fetchRetentionPreview()}
              disabled={retention.retentionPreviewLoading}
            >
              {retention.retentionPreviewLoading ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
            </Button>
          </div>

          {retention.retentionPreview && !retention.retentionPreview.enabled && (
            <p className="text-xs text-amber-600 mb-2">{t('retention.disabled_hint')}</p>
          )}

          {retention.retentionPreview ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">{t('retention.col_category')}</TableHead>
                  <TableHead className="text-xs">{t('retention.col_cutoff')}</TableHead>
                  <TableHead className="text-xs text-right">{t('retention.col_count')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(retention.retentionPreview.categories || []).map(c => (
                  <TableRow key={c.key}>
                    <TableCell className="text-xs font-medium">
                      {t('retention.categories.' + c.key, c.label)}
                      {c.deferred && (
                        <Badge variant="outline" className="text-xs ml-1">
                          {t('retention.manual_only')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {c.deferred ? '-' : formatDate(c.cutoff_date)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={c.count > 0 ? 'destructive' : 'secondary'} className="text-xs">
                        {formatNumber(c.count)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : retention.retentionPreviewLoading ? (
            <p className="text-xs text-slate-400 italic">{t('retention.loading')}</p>
          ) : (
            <p className="text-xs text-slate-400">{t('retention.empty')}</p>
          )}
        </div>

        {/* Résultat de la purge */}
        {retention.retentionOutput && (
          <div className="max-h-32 overflow-y-auto rounded-lg bg-slate-900 p-2 text-caption font-mono text-emerald-400 whitespace-pre-wrap">
            {retention.retentionOutput}
          </div>
        )}

        <Button
          variant="destructive"
          size="sm"
          className="w-full gap-2 !whitespace-normal"
          onClick={retention.openRetentionModal}
          disabled={retention.retentionRunning}
        >
          {retention.retentionRunning ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
          {t('retention.run_now')}
        </Button>
      </div>
    </div>
  );
}
