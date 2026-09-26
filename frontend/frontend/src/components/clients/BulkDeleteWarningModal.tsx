import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, X, Users, DollarSign } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { Button } from '../shadcn/button';

interface ClientWithUnpaid {
  id: number;
  name: string;
  invoice_count: number;
  total_due: number;
}

interface BulkDeleteWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientCount: number;
  clientsWithUnpaid: ClientWithUnpaid[];
  totalDue: number;
}

export default function BulkDeleteWarningModal({
  isOpen,
  onClose,
  clientCount,
  clientsWithUnpaid,
  totalDue
}: BulkDeleteWarningModalProps) {
  const { t } = useTranslation(['clients', 'common']);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const blockedCount = clientsWithUnpaid.length;
  const canDeleteCount = clientCount - blockedCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        className="bg-base-100 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-200"
        role="dialog"
        aria-modal="true"
        aria-label={t('clients:delete_warning.title')}
      >
        {/* Header */}
        <div className="bg-warning/10 p-6 border-b border-warning/20">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-warning/20 rounded-xl">
              <AlertTriangle className="size-8 text-warning" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-black text-warning">
                {t('clients:delete_warning.title')}
              </h3>
              <p className="text-base-content/70 mt-1">
                {t('clients:delete_warning.subtitle')}
              </p>
            </div>
            <Button
              onClick={onClose}
              variant="ghost" size="icon" className="rounded-full"
              aria-label={t('common:close')}
            >
              <X className="size-5" />
            </Button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-error/10 border border-red-200 rounded-xl p-4">
              <div className="flex items-center gap-2 text-error mb-2">
                <Users className="size-5" />
                <span className="font-bold text-sm">{t('clients:delete_warning.blocked_title')}</span>
              </div>
              <p className="text-3xl font-black text-error">{blockedCount}</p>
              <p className="text-xs text-base-content/50">{t('clients:delete_warning.selected_count', { count: clientCount })}</p>
            </div>
            <div className="bg-error/10 border border-red-200 rounded-xl p-4">
              <div className="flex items-center gap-2 text-error mb-2">
                <DollarSign className="size-5" />
                <span className="font-bold text-sm">{t('clients:delete_warning.total_due')}</span>
              </div>
              <p className="text-3xl font-black text-error">
                {formatCurrency(totalDue)}
              </p>
            </div>
          </div>

          {/* Client list */}
          {clientsWithUnpaid.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-bold text-base-content/60 uppercase tracking-wider">
                {t('clients:delete_warning.affected_clients')}
              </p>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {clientsWithUnpaid.map((client) => (
                  <div
                    key={client.id}
                    className="flex items-center justify-between p-3 bg-base-200/50 rounded-lg"
                  >
                    <div>
                      <p className="font-bold text-sm">{client.name}</p>
                      <p className="text-xs text-base-content/50">
                        {t('clients:delete_warning.unpaid_invoices', { count: client.invoice_count })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-error text-sm">
                        {formatCurrency(client.total_due)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Info message */}
          {canDeleteCount > 0 && (
            <div className="bg-success/10 border border-emerald-200 rounded-xl p-4">
              <p className="text-sm text-success font-medium">
                <span className="font-bold">{t('clients:delete_warning.note_label')}</span> {t('clients:delete_warning.deletable_info', { count: canDeleteCount })}
              </p>
            </div>
          )}

          {/* Warning message */}
          <div className="bg-info/10 border border-blue-200 rounded-xl p-4">
            <p className="text-sm text-info font-medium">
              <span className="font-bold">{t('clients:delete_warning.action_required')}</span> {t('clients:delete_warning.blocked_info')}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-base-300 bg-base-200/50">
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center w-full gap-2 px-4 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-bold hover:bg-warning transition-colors"
          >
            <X className="size-4" />
            {t('clients:delete_warning.understood')}
          </button>
        </div>
      </div>
    </div>
  );
}
