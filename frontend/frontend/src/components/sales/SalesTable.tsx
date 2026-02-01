import React from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, Printer, Trash2, RotateCcw, User, Calendar, CreditCard, SearchX } from 'lucide-react';
import type { Facture } from '../../types';

interface SalesTableProps {
    factures: Facture[];
    onView: (facture: Facture) => void;
    onPrint: (facture: Facture) => void;
    onRefund: (facture: Facture) => void;
    onDelete: (id: number) => void;
    loading: boolean;
}

export const SalesTable: React.FC<SalesTableProps> = ({
    factures,
    onView,
    onPrint,
    onRefund,
    onDelete,
    loading
}) => {
    const { t } = useTranslation();

    // Helper functions (duplicated locally or imported if utility exists)
    const formatDateFr = (dateString: string) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loading) {
         return (
             <div className="flex flex-col items-center justify-center py-20 text-gray-400 animate-in fade-in duration-500">
                <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                <p className="font-medium animate-pulse">{t('common.loading')}</p>
            </div>
         );
    }

    if (factures.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 bg-white/50 m-4 rounded-2xl border border-dashed border-gray-200">
                <div className="bg-gray-50 p-4 rounded-full mb-4">
                    <SearchX className="w-10 h-10 text-gray-300" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">{t('sales.no_sales_found')}</h3>
                <p className="text-sm">{t('sales.try_different_filters')}</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full">
                <thead>
                    <tr className="bg-gray-50/80 border-b border-gray-200 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        <th className="px-6 py-4 rounded-tl-2xl">{t('sales.table.invoice_number')}</th>
                        <th className="px-6 py-4">{t('sales.table.client')}</th>
                        <th className="px-6 py-4 text-center">{t('sales.table.amount')}</th>
                        <th className="px-6 py-4 text-center">{t('sales.table.status')}</th>
                        <th className="px-6 py-4 text-center">{t('sales.table.payment_mode')}</th>
                        <th className="px-6 py-4 text-right rounded-tr-2xl">{t('sales.table.actions')}</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {factures.map((facture) => (
                        <tr 
                            key={facture.id}
                            className="group hover:bg-blue-50/30 transition-colors duration-150"
                        >
                            <td className="px-6 py-4">
                                <div className="flex flex-col">
                                    <span className="font-bold text-gray-900 flex items-center gap-2">
                                        #{facture.numero_facture || facture.id}
                                    </span>
                                    <span className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5">
                                        <Calendar className="w-3 h-3" />
                                        {formatDateFr(facture.date)}
                                    </span>
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center text-blue-600">
                                        <User className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <div className="font-medium text-gray-900">
                                            {facture.client_name || facture.client_name_override || t('common.passerby_client')}
                                        </div>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                                <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 font-mono font-bold text-sm border border-gray-200 group-hover:bg-white group-hover:border-blue-200 group-hover:text-blue-700 group-hover:shadow-sm transition-all">
                                    {parseFloat(facture.total_ttc).toLocaleString('fr-FR')} F
                                </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold
                                    ${facture.status === 'PAY' ? 'bg-green-100 text-green-700 border border-green-100' : 
                                    facture.status === 'ANN' ? 'bg-red-100 text-red-700 border border-red-100' :
                                    facture.status === 'BROU' ? 'bg-gray-100 text-gray-600 border border-gray-200' :
                                    'bg-yellow-100 text-yellow-700 border border-yellow-100'}`}
                                >
                                    {facture.status_display}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                                {facture.paiements && facture.paiements.length > 0 ? (
                                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium bg-gray-50 text-gray-600 border border-gray-100">
                                        <CreditCard className="w-3 h-3" />
                                        {/* Display only first payment mode or combine */}
                                        {facture.paiements[0].mode_paiement_display}
                                        {facture.paiements.length > 1 && ' (+)'}
                                    </span>
                                ) : (
                                    <span className="text-gray-400 text-xs italic">-</span>
                                )}
                            </td>
                            <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => onView(facture)}
                                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                        title={t('common.details')}
                                    >
                                        <Eye className="w-4 h-4" />
                                    </button>
                                    
                                    <button
                                        onClick={() => onPrint(facture)}
                                        className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                        title={t('common.print')}
                                    >
                                        <Printer className="w-4 h-4" />
                                    </button>

                                    {facture.status !== 'ANN' && facture.status !== 'BROU' && (
                                        <button
                                            onClick={() => onRefund(facture)}
                                            className="p-2 text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all"
                                            title={t('common.refund')}
                                        >
                                            <RotateCcw className="w-4 h-4" />
                                        </button>
                                    )}

                                    <button
                                        onClick={() => onDelete(facture.id)}
                                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all group-hover:border-red-100"
                                        title={t('common.delete')}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
