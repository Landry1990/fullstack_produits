import { useTranslation } from 'react-i18next';
import { Database, Clock, Download, Save, Loader2 } from 'lucide-react';
import { Button } from '../shadcn/button';
import { Input } from '../shadcn/input';
import { Checkbox } from '../shadcn/checkbox';
import { getLocale } from '../../utils/dateUtils';
import type { UseBackupRestoreReturn } from './useBackupRestore';

interface BackupCardProps {
  backup: UseBackupRestoreReturn;
}

export function BackupCard({ backup }: BackupCardProps) {
  const { t } = useTranslation(['maintenance', 'common']);
  const { pharmacySettings, setPharmacySettings } = backup;

  return (
    <div className="bg-white shadow-xl rounded-2xl border border-indigo-500/20 w-full break-words">
      <div className="p-6 space-y-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Database className="size-5 text-indigo-600" />
          {t('backup_title')}
        </h2>

        <div className="space-y-4">
          {/* Manual Backup */}
          <div>
            <p className="text-xs text-slate-500 mb-2">{t('backup_desc')}</p>
            <Button
              variant="default"
              size="sm"
              className="w-full gap-2 !whitespace-normal"
              onClick={backup.handleManualBackup}
              disabled={backup.backupLoading}
            >
              {backup.backupLoading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              {t('backup_now')}
            </Button>

            {backup.backupLoading && (
              <div className="mt-4 space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex justify-between items-center text-caption font-bold uppercase tracking-widest text-indigo-600">
                  <span>{backup.backupStep}</span>
                  <span>{Math.round(backup.backupProgress)}%</span>
                </div>
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden shadow-inner">
                  <div className="h-full bg-indigo-600 rounded-full transition-all" style={{ width: `${backup.backupProgress}%` }} />
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 my-0"></div>

          {/* Scheduled Backup */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <Clock className="size-4" />
              {t('automatic')}
            </h3>

            <div>
              <label className="flex items-center gap-3 cursor-pointer p-0">
                <Checkbox
                  checked={pharmacySettings?.backup_enabled || false}
                  onCheckedChange={(checked) => setPharmacySettings({...pharmacySettings, backup_enabled: !!checked})}
                />
                <span className="text-sm text-slate-700">{t('enable_auto')}</span>
              </label>
            </div>

            <div>
              <label htmlFor="backup-scheduled-time" className="block py-1">
                <span className="text-xs text-slate-600">{t('scheduled_time')}</span>
              </label>
              <Input
                id="backup-scheduled-time"
                type="time"
                lang={getLocale()}
                className="h-9 text-sm w-full"
                value={pharmacySettings?.backup_time?.substring(0, 5) || "02:00"}
                onChange={e => setPharmacySettings({...pharmacySettings, backup_time: e.target.value})}
              />
            </div>

            <div>
              <label htmlFor="backup-secondary-path" className="block py-1">
                <span className="text-xs text-slate-600">{t('secondary_path')}</span>
              </label>
              <Input
                id="backup-secondary-path"
                type="text"
                className="h-9 text-sm w-full"
                disableUppercase
                placeholder="/mnt/backups"
                value={pharmacySettings?.secondary_backup_path || ""}
                onChange={e => setPharmacySettings({...pharmacySettings, secondary_backup_path: e.target.value})}
              />
              <p className="text-caption text-slate-400 mt-1">
                {t('maintenance:backup_path_description')}
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 mt-2 !whitespace-normal"
              onClick={backup.saveBackupSettings}
              disabled={backup.savingSettings || !pharmacySettings}
            >
              {backup.savingSettings ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              {t('save_settings')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
