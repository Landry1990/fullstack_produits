import { AlertTriangle, X, FileText, DollarSign } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { formatDate } from '../../utils/dateUtils';

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
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-base-100 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="bg-warning/10 p-6 border-b border-warning/20">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-warning/20 rounded-xl">
              <AlertTriangle className="w-8 h-8 text-warning" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-black text-warning">
                Impossible de supprimer
              </h3>
              <p className="text-base-content/70 mt-1">
                Ce client a des factures non réglées
              </p>
            </div>
            <button
              onClick={onClose}
              className="btn btn-ghost btn-circle btn-sm"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Client info */}
          <div className="bg-base-200/50 rounded-xl p-4">
            <p className="text-sm text-base-content/60 mb-1">Client</p>
            <p className="font-black text-lg">{clientName}</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-error/5 border border-error/20 rounded-xl p-4">
              <div className="flex items-center gap-2 text-error mb-2">
                <FileText className="w-5 h-5" />
                <span className="font-bold text-sm">Factures impayées</span>
              </div>
              <p className="text-3xl font-black text-error">{invoiceCount}</p>
            </div>
            <div className="bg-error/5 border border-error/20 rounded-xl p-4">
              <div className="flex items-center gap-2 text-error mb-2">
                <DollarSign className="w-5 h-5" />
                <span className="font-bold text-sm">Montant total dû</span>
              </div>
              <p className="text-3xl font-black text-error">
                {formatCurrency(totalDue)}
              </p>
            </div>
          </div>

          {/* Invoice list */}
          {invoices.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-bold text-base-content/60 uppercase tracking-wider">
                Détails des factures
              </p>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {invoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between p-3 bg-base-200/50 rounded-lg"
                  >
                    <div>
                      <p className="font-bold text-sm">
                        Facture #{invoice.numero || invoice.id}
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
                        sur {formatCurrency(invoice.total_ttc)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warning message */}
          <div className="bg-info/10 border border-info/20 rounded-xl p-4">
            <p className="text-sm text-info font-medium">
              <span className="font-bold">Action requise :</span> Veuillez régler toutes les factures avant de pouvoir supprimer ce client.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-base-200 bg-base-50/50">
          <button
            onClick={onClose}
            className="btn btn-warning w-full gap-2 font-black"
          >
            <X className="w-4 h-4" />
            J'ai compris
          </button>
        </div>
      </div>
    </div>
  );
}
