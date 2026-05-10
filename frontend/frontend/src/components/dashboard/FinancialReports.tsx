import React from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Download, FileSpreadsheet, FileBarChart } from 'lucide-react';

interface FinancialReportsProps {
    onExport: (type: 'csv' | 'pdf' | 'dead_stock') => void;
    exporting: boolean;
}

export const FinancialReports: React.FC<FinancialReportsProps> = ({ onExport, exporting }) => {
    const { t } = useTranslation(['dashboard', 'common']);

    const reports = [
        {
            id: 'csv',
            title: t('manager_dashboard.export_accounting_title', 'Export Comptable (CSV)'),
            desc: t('manager_dashboard.export_accounting_desc', 'Détail des ventes, TVA et modes de paiement.'),
            icon: <FileText className="size-6" />,
            color: 'primary',
            btnColor: 'btn-primary'
        },
        {
            id: 'pdf',
            title: t('manager_dashboard.report_monthly_title', 'Rapport Mensuel (PDF)'),
            desc: t('manager_dashboard.report_monthly_desc', 'Synthèse visuelle des performances du mois.'),
            icon: <FileBarChart className="size-6" />,
            color: 'secondary',
            btnColor: 'btn-secondary'
        },
        {
            id: 'dead_stock',
            title: t('manager_dashboard.dead_stock_title', 'Stocks Dormants (Excel)'),
            desc: t('manager_dashboard.dead_stock_desc', 'Produits sans vente depuis plus de 6 mois.'),
            icon: <FileSpreadsheet className="size-6" />,
            color: 'accent',
            btnColor: 'btn-accent'
        }
    ];

    return (
        <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 overflow-hidden flex flex-col">
            <div className="p-6 border-b border-base-200">
                <h3 className="text-lg font-bold text-base-content flex items-center gap-2">
                    <FileText className="size-5 text-primary" /> 
                    {t('manager_dashboard.exports_title', 'Rapports et Comptabilité')}
                </h3>
            </div>
            
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                {reports.map((report) => (
                    <div key={report.id} className="p-6 rounded-2xl bg-base-200/50 border border-base-300 hover:bg-base-100 hover:border-primary/20 transition-all flex flex-col h-full group">
                        <div className={`p-4 rounded-2xl bg-base-100 shadow-sm w-fit mb-4 text-${report.color}`}>
                            {report.icon}
                        </div>
                        <h4 className={`font-bold text-sm uppercase tracking-tight text-${report.color} mb-2`}>
                            {report.title}
                        </h4>
                        <p className="text-xs text-base-content/50 mb-6 flex-1">
                            {report.desc}
                        </p>
                        <button 
                            onClick={() => onExport(report.id as any)}
                            className={`btn ${report.btnColor} btn-sm rounded-xl w-full gap-2 font-bold shadow-sm h-10`}
                            disabled={exporting}
                        >
                            {exporting ? <span className="loading loading-spinner loading-xs"></span> : <Download className="size-4" />}
                            {t('common:download', 'Télécharger')}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

