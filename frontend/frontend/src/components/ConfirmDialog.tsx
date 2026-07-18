import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './shadcn/dialog';
import { Button } from './shadcn/button';
import { AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'info' | 'success'
  onConfirm: () => void
  onCancel: () => void
}

const variantConfig = {
  danger: {
    icon: XCircle,
    iconClass: 'text-red-600 bg-red-50',
    confirmClass: 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20',
  },
  warning: {
    icon: AlertTriangle,
    iconClass: 'text-amber-600 bg-amber-50',
    confirmClass: 'bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20',
  },
  info: {
    icon: Info,
    iconClass: 'text-blue-600 bg-blue-50',
    confirmClass: 'bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/20',
  },
  success: {
    icon: CheckCircle,
    iconClass: 'text-emerald-600 bg-emerald-50',
    confirmClass: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20',
  },
};

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirmer',
  cancelText = 'Annuler',
  variant = 'warning',
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  const config = variantConfig[variant];
  const Icon = config.icon;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-0">
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center size-10 rounded-xl shrink-0 ${config.iconClass}`}>
              <Icon className="size-5" />
            </div>
            <DialogTitle className="text-base font-bold text-slate-900">
              {title}
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="px-6 py-4">
          <DialogDescription className="text-sm text-slate-600 whitespace-pre-line leading-relaxed">
            {message}
          </DialogDescription>
        </div>

        <DialogFooter className="px-6 pb-6 pt-2 gap-2 sm:gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="text-slate-600 hover:text-slate-900"
          >
            {cancelText}
          </Button>
          <Button
            size="sm"
            onClick={onConfirm}
            className={config.confirmClass}
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

