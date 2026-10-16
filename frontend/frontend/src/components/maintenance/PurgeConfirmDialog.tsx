import { useTranslation } from 'react-i18next';
import { ShieldAlert, AlertTriangle, Trash2, Loader2 } from 'lucide-react';
import { Button } from '../shadcn/button';
import { Input } from '../shadcn/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../shadcn/dialog';
import type { PurgeTable } from './types';

interface PurgeConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  password: string;
  onPasswordChange: (value: string) => void;
  purging: boolean;
  selectedTables: Set<string>;
  tableMap: Map<string, PurgeTable>;
  dateFrom: string;
  dateTo: string;
  onConfirm: () => void;
}

export function PurgeConfirmDialog({
  open,
  onClose,
  password,
  onPasswordChange,
  purging,
  selectedTables,
  tableMap,
  dateFrom,
  dateTo,
  onConfirm,
}: PurgeConfirmDialogProps) {
  const { t } = useTranslation(['maintenance', 'common']);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="max-w-full sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-red-100">
              <ShieldAlert className="size-6 text-red-600" />
            </div>
            {t('confirm_title')}
          </DialogTitle>
          <DialogDescription>
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-3 mt-2">
              <AlertTriangle className="size-5 text-red-600 shrink-0" />
              <span className="text-sm text-red-700">
                {t('confirm_msg')}
              </span>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="bg-slate-100 rounded-lg p-3 mb-4 max-h-32 overflow-y-auto">
          <p className="text-xs font-semibold mb-1">{t('common:concerned_tables')} :</p>
          <ul className="text-xs space-y-0.5">
             {Array.from(selectedTables).map(key => {
               const tbl = tableMap.get(key);
               return <li key={key}>• {t('tables.' + key, tbl?.label || key)}</li>;
             })}
          </ul>
          {(dateFrom || dateTo) && (
            <p className="text-xs mt-2 text-slate-500">
              {t('period')} : {dateFrom || '...'} → {dateTo || '...'}
            </p>
          )}
        </div>

        <div className="mb-4">
          <label htmlFor="purge-password" className="block">
            <span className="text-sm font-semibold text-slate-700">{t('password_label')}</span>
          </label>
          <Input
            id="purge-password"
            type="password"
            placeholder={t('placeholders.enter_password')}
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
            {t('confirm_purge')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
