import React from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, Printer, Trash2, RotateCcw, User, Calendar, SearchX, Receipt, Clock } from 'lucide-react';
import type { Facture } from '../../types';

interface SalesTableProps {
    factures: Facture[];
    onView: (facture: Facture) => void;
    onPrint: (facture: Facture) => void;
    onPrintTicket: (facture: Facture) => void;
    onRefund: (facture: Facture) => void;
    onDuplicate: (facture: Facture) => void;
    onDelete: (id: number) => void;
    onBulkDelete?: (ids: number[]) => void;
    loading: boolean;
}

export const SalesTable: React.FC<SalesTableProps> = ({
    factures,
    onView,
    onPrint,
    onPrintTicket,
    onRefund,
    onDuplicate,
    onDelete,
    onBulkDelete,
    loading
}) => {
    const { t } = useTranslation();
    const [selectedIds, setSelectedIds] = React.useState<number[]>([]);

    // Helper functions
    const formatDateOnlyFr = (dateString: string) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('fr-FR', {
            day: '2-digit', month: '2-digit', year: 'numeric'
        });
    };

    const formatTimeOnlyFr = (dateString: string) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleTimeString('fr-FR', {
            hour: '2-digit', minute: '2-digit'
        });
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            // Select only drafts or cancellable? Or all?
            // Usually select all visible.
            setSelectedIds(factures.map(f => f.id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleSelect = (id: number) => {
        setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
        );
    };

    const handleBulkDelete = () => {
        if (onBulkDelete && selectedIds.length > 0) {
            onBulkDelete(selectedIds);
            setSelectedIds([]); // Reset after action trigger (optimistic)
        }
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
                    <tr className="bg-base-200 border-b border-base-300 text-left text-xs font-semibold text-base-content/60 uppercase tracking-wider">
                         <th className="px-4 py-4 w-10">
                            <input 
                                type="checkbox" 
                                className="checkbox checkbox-xs checkbox-primary"
                                onChange={handleSelectAll}
                                checked={factures.length > 0 && selectedIds.length === factures.length}
                            />
                        </th>
                        <th className="px-6 py-4 rounded-tl-2xl">
                            {selectedIds.length > 0 ? (
                                <span className="text-primary font-bold normal-case text-sm">
                                    {selectedIds.length} sélectionné(s)
                                </span>
                            ) : t('sales.table.invoice_number')}
                        </th>
                        <th className="px-6 py-4">{t('sales.table.client')}</th>
                        <th className="px-6 py-4 hidden xl:table-cell">{t('sales.table.operator', {defaultValue: "Vendeur"})}</th>
                        <th className="px-6 py-4 text-center">{t('sales.table.amount')}</th>
                        <th className="px-6 py-4 text-center hidden lg:table-cell">{t('sales.table.discount', {defaultValue: "Remise"})}</th>
                        <th className="px-6 py-4 text-center hidden md:table-cell">{t('sales.table.status')}</th>

                        <th className="px-6 py-4 text-right rounded-tr-2xl">
                             {selectedIds.length > 0 && onBulkDelete ? (
                                <button 
                                    onClick={handleBulkDelete}
                                    className="btn btn-xs btn-error text-white gap-1 animate-in fade-in zoom-in"
                                >
                                    <Trash2 className="w-3 h-3" />
                                    Supprimer ({selectedIds.length})
                                </button>
                            ) : t('sales.table.actions')}
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-base-200">
                    {factures.map((facture) => (
                        <tr 
                            key={facture.id}
                            className={`group transition-colors duration-150 ${selectedIds.includes(facture.id) ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-base-200/50'}`}
                        >
                             <td className="px-4 py-4">
                                <input 
                                    type="checkbox" 
                                    className="checkbox checkbox-xs checkbox-primary"
                                    checked={selectedIds.includes(facture.id)}
                                    onChange={() => handleSelect(facture.id)}
                                />
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex flex-col">
                                    <span className="font-bold text-base-content flex items-center gap-2">
                                        #{facture.numero_facture || facture.id}
                                    </span>
                                    <span className="text-xs text-base-content/60 flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
                                        <span className="flex items-center gap-1.5">
                                            <Calendar className="w-3 h-3" />
                                            {formatDateOnlyFr(facture.date)}
                                        </span>
                                        <span className="flex items-center gap-1.5 text-primary/70 font-medium">
                                            <Clock className="w-3 h-3" />
                                            {formatTimeOnlyFr(facture.date)}
                                        </span>
                                    </span>
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                        <User className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <div className="font-medium text-base-content">
                                            {facture.client_name || facture.client_name_override || t('common.passerby_client')}
                                        </div>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4 hidden xl:table-cell">
                                <div className="text-sm text-base-content/70">
                                    {facture.created_by_name || '-'}
                                </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                                <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-base-200 text-base-content font-mono font-bold text-sm border border-base-300 group-hover:bg-base-100 group-hover:border-primary/30 group-hover:text-primary group-hover:shadow-sm transition-all">
                                    {parseFloat(facture.total_ttc).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} F
                                </span>
                            </td>
                            <td className="px-6 py-4 text-center hidden lg:table-cell">
                                {parseFloat(facture.remise) > 0 ? (
                                    <span className="text-error font-medium">-{parseFloat(facture.remise).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} F</span>
                                ) : (
                                    <span className="text-base-content/30">-</span>
                                )}
                            </td>
                            <td className="px-6 py-4 text-center hidden md:table-cell">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border
                                    ${facture.status === 'PAY' ? 'bg-success/10 text-success border-success/20' : 
                                    facture.status === 'ANN' ? 'bg-error/10 text-error border-error/20' :
                                    facture.status === 'BROU' ? 'bg-base-200 text-base-content/60 border-base-300' :
                                    'bg-warning/10 text-warning border-warning/20'}`}
                                >
                                    {facture.status_display}
                                </span>
                            </td>

                            <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => onView(facture)}
                                        className="p-2 text-base-content/60 hover:text-secondary hover:bg-secondary/10 rounded-lg transition-all"
                                        title={t('common.details')}
                                    >
                                        <Eye className="w-4 h-4" />
                                    </button>
                                    
                            {/* Dropdown d'impression */}
                                    <div className="dropdown dropdown-end dropdown-hover">
                                        <div tabIndex={0} role="button" className="p-2 text-base-content/60 hover:text-primary hover:bg-primary/10 rounded-lg transition-all" title={t('common.print')}>
                                            <Printer className="w-4 h-4" />
                                        </div>
                                        <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-40 border border-base-200">
                                            <li>
                                                <a onClick={() => onPrint(facture)} className="flex items-center gap-2">
                                                    <Printer className="w-4 h-4" />
                                                    Format A4
                                                </a>
                                            </li>
                                            <li>
                                                <a onClick={() => onPrintTicket(facture)} className="flex items-center gap-2">
                                                    <Receipt className="w-4 h-4" />
                                                    Ticket Caisse
                                                </a>
                                            </li>
                                        </ul>
                                    </div>

                                    {/* Dupliquer / Copier */}
                                    <button
                                        onClick={() => onDuplicate(facture)}
                                        className="p-2 text-base-content/60 hover:text-info hover:bg-info/10 rounded-lg transition-all"
                                        title={t('common.duplicate', { defaultValue: 'Dupliquer' })}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                                    </button>

                                    {facture.status !== 'ANN' && facture.status !== 'BROU' && (
                                        <button
                                            onClick={() => onRefund(facture)}
                                            className="p-2 text-base-content/60 hover:text-warning hover:bg-warning/10 rounded-lg transition-all"
                                            title={t('common.refund')}
                                        >
                                            <RotateCcw className="w-4 h-4" />
                                        </button>
                                    )}

                                    <button
                                        onClick={() => onDelete(facture.id)}
                                        className="p-2 text-base-content/60 hover:text-error hover:bg-error/10 rounded-lg transition-all"
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
