import { useTranslation } from 'react-i18next';
import { Rocket, RefreshCw, ScrollText, Loader2 } from 'lucide-react';
import { Button } from '../shadcn/button';
import type { UseManualUpdateReturn } from './useManualUpdate';

interface ManualUpdateCardProps {
  update: UseManualUpdateReturn;
}

export function ManualUpdateCard({ update }: ManualUpdateCardProps) {
  const { t } = useTranslation(['maintenance', 'common']);

  return (
    <div className="bg-white shadow-xl rounded-2xl border border-emerald-500/20 w-full break-words">
      <div className="p-6 space-y-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Rocket className="size-5 text-emerald-600" />
          {t('manual_update_title')}
        </h2>

        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            {t('manual_update_desc')}
          </p>

          <Button
            variant="default"
            size="sm"
            className="w-full gap-2 !whitespace-normal"
            onClick={update.openUpdateConfirm}
            disabled={update.updateRunning}
          >
            {update.updateRunning ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            {update.updateRunning ? t('updating') : t('run_update')}
          </Button>

          {update.updateRunning && (
            <div className="mt-4 space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex justify-between items-center text-caption font-bold uppercase tracking-widest text-emerald-600">
                <span>{update.updateStep}</span>
                <span>{Math.round(update.updateProgress)}%</span>
              </div>
              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden shadow-inner">
                <div className="h-full bg-emerald-600 rounded-full transition-all" style={{ width: `${update.updateProgress}%` }} />
              </div>
              <div className="max-h-32 overflow-y-auto rounded-lg bg-slate-900 p-2 text-caption font-mono text-emerald-400">
                {update.updateLog.length === 0 ? t('waiting_logs') : (
                  update.updateLog.slice(-20).map((line) => (
                    <div key={`log-${line}`} className="truncate">{line}</div>
                  ))
                )}
              </div>
            </div>
          )}

          {update.updateError && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">
              {update.updateError}
            </div>
          )}

          <div className="border-t border-slate-200 my-0"></div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2 mb-2">
              <ScrollText className="size-4" />
              {t('latest_changes')}
            </h3>
            <div className="max-h-48 overflow-y-auto rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-700 whitespace-pre-wrap">
              {update.changelog || t('changelog_unavailable')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
