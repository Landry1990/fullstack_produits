import { useTranslation } from 'react-i18next';
import { AlertTriangle, ShieldAlert, Database, Loader2 } from 'lucide-react';
import { Button } from '../shadcn/button';
import { Input } from '../shadcn/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../shadcn/dialog';

interface RestoreConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  fileName?: string;
  password: string;
  onPasswordChange: (value: string) => void;
  restoring: boolean;
  onConfirm: () => void;
}

export function RestoreConfirmDialog({
  open,
  onClose,
  fileName,
  password,
  onPasswordChange,
  restoring,
  onConfirm,
}: RestoreConfirmDialogProps) {
  const { t } = useTranslation(['maintenance', 'common']);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="border-2 border-red-500/50 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-red-600">
            <div className="p-2 rounded-full bg-red-100">
              <AlertTriangle className="size-6 text-red-600" />
            </div>
            {t('restore_title')}
          </DialogTitle>
          <DialogDescription>
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-3 mt-2 shadow-sm">
              <ShieldAlert className="size-5 text-red-600 shrink-0" />
              <span className="text-sm text-red-700">
                {t('confirm_msg')}
                <div className="font-mono mt-1 font-bold text-xs">{fileName}</div>
              </span>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="mb-4">
          <label htmlFor="restore-password" className="block">
            <span className="text-sm font-semibold text-slate-700">{t('password_label')}</span>
          </label>
          <Input
            id="restore-password"
            type="password"
            className="border-red-300"
            placeholder={t('placeholders.password_required')}
            value={password}
            onChange={e => onPasswordChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') onConfirm(); }}
            autoFocus
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button
            variant="destructive"
            className="gap-2 px-8"
            onClick={onConfirm}
            disabled={restoring || !password}
          >
            {restoring ? <Loader2 className="size-4 animate-spin" /> : <Database className="size-4" />}
            {t('restore_now')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
