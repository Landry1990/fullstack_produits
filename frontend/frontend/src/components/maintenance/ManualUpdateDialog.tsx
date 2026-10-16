import { useTranslation } from 'react-i18next';
import { AlertTriangle, Rocket } from 'lucide-react';
import { Button } from '../shadcn/button';
import { Input } from '../shadcn/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../shadcn/dialog';

interface ManualUpdateDialogProps {
  open: boolean;
  onClose: () => void;
  password: string;
  onPasswordChange: (value: string) => void;
  onConfirm: () => void;
}

export function ManualUpdateDialog({
  open,
  onClose,
  password,
  onPasswordChange,
  onConfirm,
}: ManualUpdateDialogProps) {
  const { t } = useTranslation(['maintenance', 'common']);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="max-w-full sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-emerald-100">
              <Rocket className="size-6 text-emerald-600" />
            </div>
            {t('run_update')}
          </DialogTitle>
          <DialogDescription>
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg p-3 mt-2">
              <AlertTriangle className="size-5 text-amber-600 shrink-0" />
              <div>
                <p className="font-bold text-amber-800">{t('update_modal.sensitive')}</p>
                <p className="text-sm text-amber-700">
                  {t('update_modal.desc')}
                </p>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="mb-4">
          <label htmlFor="update-admin-password" className="block">
            <span className="text-sm font-semibold text-slate-700">{t('update_modal.confirm_password')}</span>
          </label>
          <Input
            id="update-admin-password"
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
            variant="default"
            className="gap-2"
            onClick={onConfirm}
            disabled={!password}
          >
            <Rocket className="size-4" />
            {t('update_modal.confirm_btn')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
