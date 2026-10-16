import { useTranslation } from 'react-i18next';
import { AlertTriangle, Trash2, Loader2 } from 'lucide-react';
import { Button } from '../shadcn/button';
import { Input } from '../shadcn/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../shadcn/dialog';

interface ProductPurgeDialogProps {
  open: boolean;
  onClose: () => void;
  purgeSansVentes: boolean;
  password: string;
  onPasswordChange: (value: string) => void;
  purging: boolean;
  onConfirm: () => void;
}

export function ProductPurgeDialog({
  open,
  onClose,
  purgeSansVentes,
  password,
  onPasswordChange,
  purging,
  onConfirm,
}: ProductPurgeDialogProps) {
  const { t } = useTranslation(['maintenance', 'common']);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="max-w-full sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-red-100">
              <Trash2 className="size-6 text-red-600" />
            </div>
            {t('purge_products_btn')}
          </DialogTitle>
          <DialogDescription>
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-3 mt-2">
              <AlertTriangle className="size-5 text-red-600 shrink-0" />
              <div>
                <p className="font-bold text-red-800">{t('purge_modal.irreversible')}</p>
                <p className="text-sm text-red-700">
                  {purgeSansVentes
                    ? t('purge_modal.warn_unlinked')
                    : t('purge_modal.warn_all')}
                </p>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="mb-4">
          <label htmlFor="purge-produits-password" className="block">
            <span className="text-sm font-semibold text-slate-700">{t('purge_modal.confirm_password')}</span>
          </label>
          <Input
            id="purge-produits-password"
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
            disabled={purging || !password}
          >
            {purging ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            {t('purge_modal.confirm_btn')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
