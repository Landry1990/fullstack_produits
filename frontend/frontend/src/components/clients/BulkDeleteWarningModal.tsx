import { useTranslation } from 'react-i18next';
import { Users, DollarSign } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { WarningModalShell, StatCard, InfoBox } from './WarningModalShell';

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

  if (!isOpen) return null;

  const blockedCount = clientsWithUnpaid.length;
  const canDeleteCount = clientCount - blockedCount;

  return (
    <WarningModalShell
      title={t('clients:delete_warning.title')}
      subtitle={t('clients:delete_warning.subtitle')}
      onClose={onClose}
      closeLabel={t('common:close')}
      actionLabel={t('clients:delete_warning.understood')}
    >
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard
          icon={<Users className="size-5" />}
          title={t('clients:delete_warning.blocked_title')}
          value={blockedCount}
          subtitle={t('clients:delete_warning.selected_count', { count: clientCount })}
        />
        <StatCard
          icon={<DollarSign className="size-5" />}
          title={t('clients:delete_warning.total_due')}
          value={formatCurrency(totalDue)}
        />
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
        <InfoBox boxClassName="bg-success/10 border-emerald-200" textClassName="text-success" label={t('clients:delete_warning.note_label')}>
          {t('clients:delete_warning.deletable_info', { count: canDeleteCount })}
        </InfoBox>
      )}

      {/* Warning message */}
      <InfoBox boxClassName="bg-info/10 border-blue-200" textClassName="text-info" label={t('clients:delete_warning.action_required')}>
        {t('clients:delete_warning.blocked_info')}
      </InfoBox>
    </WarningModalShell>
  );
}
