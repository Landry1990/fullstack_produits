import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { gooeyToast } from 'goey-toast';
import { ShieldAlert, Download, Upload, Loader2 } from 'lucide-react';
import { Button } from '../shadcn/button';
import api from '../../services/api';
import { getApiErrorDetail } from '../../utils/errorHandling';

export function CodeManagementCard() {
  const { t } = useTranslation(['maintenance', 'common']);
  const [codeBackupLoading, setCodeBackupLoading] = useState(false);
  const [codeRestoreFile, setCodeRestoreFile] = useState<File | null>(null);
  const [codeRestoring, setCodeRestoring] = useState(false);

  const handleCodeBackup = async () => {
    setCodeBackupLoading(true);
    try {
      const res = await api.get('code-backup/backup/', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `source_code_backup_${new Date().toISOString().slice(0, 10)}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      gooeyToast.success(t('code_management.backup_success'));
    } catch {
      gooeyToast.error(t('common:error_occurred'));
    } finally {
      setCodeBackupLoading(false);
    }
  };

  const handleCodeRestore = async () => {
    if (!codeRestoreFile) {
      gooeyToast.error(t('common:select_file'));
      return;
    }
    setCodeRestoring(true);
    const formData = new FormData();
    formData.append('file', codeRestoreFile);
    try {
      await api.post('code-backup/restore/', formData);
      gooeyToast.success(t('code_management.restore_success'));
      setCodeRestoreFile(null);
    } catch (err) {
      gooeyToast.error(getApiErrorDetail(err, t('common:error_occurred')));
    } finally {
      setCodeRestoring(false);
    }
  };

  return (
    <div className="bg-white shadow-xl rounded-2xl border border-slate-400/20 w-full break-words">
      <div className="p-6 space-y-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <ShieldAlert className="size-5 text-slate-600" />
          {t('code_management.title')}
        </h2>

        <div className="space-y-4">
          {/* Code Backup */}
          <div>
            <p className="text-xs text-slate-500 mb-2">{t('code_management.desc')}</p>
            <Button
              variant="secondary"
              size="sm"
              className="w-full gap-2 !whitespace-normal"
              onClick={handleCodeBackup}
              disabled={codeBackupLoading}
            >
              {codeBackupLoading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              {t('code_management.backup_now')}
            </Button>
          </div>

          <div className="border-t border-slate-200 my-0"></div>

          {/* Code Restore */}
          <div>
            <p className="text-xs text-slate-500 mb-2">{t('code_management.restore_desc')}</p>
            <div className="w-full mb-2">
              <input
                type="file"
                accept=".zip"
                className="block w-full text-sm text-slate-500 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
                onChange={e => setCodeRestoreFile(e.target.files?.[0] || null)}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 !whitespace-normal"
              onClick={handleCodeRestore}
              disabled={codeRestoring || !codeRestoreFile}
            >
              {codeRestoring ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {t('code_management.restore_now')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
