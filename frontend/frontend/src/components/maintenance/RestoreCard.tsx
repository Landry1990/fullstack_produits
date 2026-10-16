import { useTranslation } from 'react-i18next';
import { Upload, ShieldAlert, Loader2 } from 'lucide-react';
import { Button } from '../shadcn/button';
import type { UseBackupRestoreReturn } from './useBackupRestore';

interface RestoreCardProps {
  backup: UseBackupRestoreReturn;
}

export function RestoreCard({ backup }: RestoreCardProps) {
  const { t } = useTranslation(['maintenance', 'common']);

  return (
    <div className="bg-white shadow-xl rounded-2xl border border-red-500/20 w-full break-words">
      <div className="p-6 space-y-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Upload className="size-5 text-red-600" />
          {t('restore_title')}
        </h2>

        <div className="space-y-4">
          <p className="text-xs text-slate-500">{t('restore_desc')}</p>

          <div className="w-full">
            <input
              type="file"
              accept=".sql.gz"
              className="block w-full text-sm text-slate-500 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-red-50 file:text-red-700 hover:file:bg-red-100 cursor-pointer"
              onChange={e => backup.setRestoreFile(e.target.files?.[0] || null)}
            />
          </div>

          <Button
            variant="destructive"
            size="sm"
            className="w-full gap-2 !whitespace-normal"
            onClick={backup.openRestoreConfirm}
            disabled={backup.restoring || !backup.restoreFile}
          >
            {backup.restoring ? <Loader2 className="size-4 animate-spin" /> : <ShieldAlert className="size-4" />}
            {t('restore_now')}
          </Button>

          {backup.restoring && (
            <div className="mt-4 space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex justify-between items-center text-caption font-bold uppercase tracking-widest text-red-600">
                <span>{backup.restoreStep}</span>
                <span>{Math.round(backup.restoreProgress)}%</span>
              </div>
              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden shadow-inner">
                <div className="h-full bg-red-600 rounded-full transition-all" style={{ width: `${backup.restoreProgress}%` }} />
              </div>
              <p className="text-caption text-center text-red-600/60 italic">{t('restore_restart_msg')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
