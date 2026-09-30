import { useTranslation } from 'react-i18next';
import { FileText, DollarSign } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { formatDate } from '../../utils/dateUtils';
import { WarningModalShell, StatCard, InfoBox } from './WarningModalShell';

interface Invoice {
  id: number;
  numero: string;
  date: string;
  total_ttc: number;
  paid: number;
  remainder: number;
}

interface ClientDeleteWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientName: string;
  invoiceCount: number;
  totalDue: number;
  invoices: Invoice[];
}

export default function ClientDeleteWarningModal({
  isOpen,
  onClose,
  clientName,
  invoiceCount,
  totalDue,
  invoices
}: ClientDeleteWarningModalProps) {
  const { t } = useTranslation(['clients', 'common']);

  if (!isOpen) return null;

  return (
    <WarningModalShell
      title={t('clients:delete_warning.title_single')}
      subtitle={t('clients:delete_warning.subtitle_single')}
      onClose={onClose}
      closeLabel={t('common:close')}
      actionLabel={t('clients:delete_warning.understood')}
    >
      {/* Client info */}
      <div className="bg-base-200/50 rounded-xl p-4">
        <p className="text-sm text-base-content/60 mb-1">{t('clients:delete_warning.client_label')}</p>
        <p className="font-black text-lg">{clientName}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard
          icon={<FileText className="size-5" />}
          title={t('clients:delete_warning.unpaid_invoices_label')}
          value={invoiceCount}
        />
        <StatCard
          icon={<DollarSign className="size-5" />}
          title={t('clients:delete_warning.total_due')}
          value={formatCurrency(totalDue)}
        />
      </div>

      {/* Invoice list */}
      {invoices.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-bold text-base-content/60 uppercase tracking-wider">
            {t('clients:delete_warning.invoice_details')}
          </p>
          <div className="max-h-48 overflow-y-auto space-y-2">
            {invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="flex items-center justify-between p-3 bg-base-200/50 rounded-lg"
              >
                <div>
                  <p className="font-bold text-sm">
                    {t('clients:delete_warning.invoice_no', { num: invoice.numero || invoice.id })}
                  </p>
                  <p className="text-xs text-base-content/50">
                    {formatDate(invoice.date)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-black text-error text-sm">
                    {formatCurrency(invoice.remainder)}
                  </p>
                  <p className="text-xs text-base-content/50">
                    {t('clients:delete_warning.of_amount', { amount: formatCurrency(invoice.total_ttc) })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warning message */}
      <InfoBox boxClassName="bg-info/10 border-blue-200" textClassName="text-info" label={t('clients:delete_warning.action_required')}>
        {t('clients:delete_warning.blocked_info_single')}
      </InfoBox>
    </WarningModalShell>
  );
}
