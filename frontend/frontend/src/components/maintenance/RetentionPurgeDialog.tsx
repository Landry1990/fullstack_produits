import { useTranslation } from 'react-i18next';
import { AlertTriangle, Clock, Trash2, Loader2 } from 'lucide-react';
import { Button } from '../shadcn/button';
import { Input } from '../shadcn/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../shadcn/dialog';

interface RetentionPurgeDialogProps {
  open: boolean;
  onClose: () => void;
  password: string;
  onPasswordChange: (value: string) => void;
  running: boolean;
  onConfirm: () => void;
}

export function RetentionPurgeDialog({
  open,
  onClose,
  password,
  onPasswordChange,
  running,
  onConfirm,
}: RetentionPurgeDialogProps) {
  const { t } = useTranslation(['maintenance', 'common']);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="max-w-full sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-amber-100">
              <Clock className="size-6 text-amber-600" />
            </div>
            {t('retention.modal.title')}
          </DialogTitle>
          <DialogDescription>
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-3 mt-2">
              <AlertTriangle className="size-5 text-red-600 shrink-0" />
              <div>
                <p className="font-bold text-red-800">{t('purge_modal.irreversible')}</p>
                <p className="text-sm text-red-700">{t('retention.modal.warn')}</p>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="mb-4">
          <label htmlFor="retention-password" className="block">
            <span className="text-sm font-semibold text-slate-700">{t('retention.modal.confirm_password')}</span>
          </label>
          <Input
            id="retention-password"
            type="password"
            placeholder={t('maintenance:admin_password_placeholder')}
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
            className="gap-2"
            onClick={onConfirm}
            disabled={running || !password}
          >
            {running ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            {t('retention.modal.confirm_btn')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
