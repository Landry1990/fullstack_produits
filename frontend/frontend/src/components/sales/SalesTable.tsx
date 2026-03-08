import React from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, Printer, Trash2, RotateCcw, User, Calendar, SearchX, Receipt, Clock, Copy, FileDigit } from 'lucide-react';
import type { Facture } from '../../types';
import { formatCurrency, normalizeNumberInput } from '../../utils/formatters';
import ActionIcon from '../ui/ActionIcon';
import SelectionHeader from '../ui/SelectionHeader';

interface SalesTableProps {
    factures: Facture[];
    onView: (facture: Facture) => void;
    onPrint: (facture: Facture) => void;
    onPrintTicket: (facture: Facture) => void;
    onRefund: (facture: Facture) => void;
    onDuplicate: (facture: Facture) => void;
    onGenerateAvoir: (facture: Facture) => void;
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
    onGenerateAvoir,
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

    const renderBulkActions = () => {
        if (selectedIds.length === 1) {
            const selectedFacture = factures.find(f => f.id === selectedIds[0]);
            if (!selectedFacture) return null;
            return (
                <>
                    <li className="menu-title text-xs opacity-50 px-4 py-2 uppercase tracking-widest">{t('common.single_selection', { defaultValue: 'Sélection' })}</li>
                    <li>
                        <a onClick={() => onView(selectedFacture)} className="gap-3 py-3">
                            <Eye className="w-4 h-4 text-secondary" />
                            {t('common.details')}
                        </a>
                    </li>
                    <li>
                        <a onClick={() => onPrint(selectedFacture)} className="gap-3 py-3">
                            <Printer className="w-4 h-4 text-primary" />
                            Format A4
                        </a>
                    </li>
                    <li>
                        <a onClick={() => onPrintTicket(selectedFacture)} className="gap-3 py-3">
                            <Receipt className="w-4 h-4 text-primary" />
                            Ticket Caisse
                        </a>
                    </li>
                    <li>
                        <a onClick={() => onDuplicate(selectedFacture)} className="gap-3 py-3">
                            <Copy className="w-4 h-4 text-info" />
                            {t('common.duplicate', { defaultValue: 'Dupliquer' })}
                        </a>
                    </li>
                    {(selectedFacture.status === 'VALIDEE' || selectedFacture.status === 'PAY' || selectedFacture.status === 'VAL' || selectedFacture.status === 'PAYEE') && (
                        <li>
                            <a onClick={() => onGenerateAvoir(selectedFacture)} className="gap-3 py-3">
                                <FileDigit className="w-4 h-4 text-primary" />
                                Générer un avoir
                            </a>
                        </li>
                    )}
                    {selectedFacture.status !== 'ANN' && selectedFacture.status !== 'BROU' && (
                        <li>
                            <a onClick={() => onRefund(selectedFacture)} className="gap-3 py-3">
                                <RotateCcw className="w-4 h-4 text-warning" />
                                {t('common.refund', { defaultValue: "Modifier/Retour" })}
                            </a>
                        </li>
                    )}
                    <div className="divider my-0"></div>
                    <li>
                        <a onClick={() => onDelete(selectedFacture.id)} className="gap-3 py-3 text-error hover:bg-error/10 font-bold">
                            <Trash2 className="w-4 h-4" />
                            {t('common.delete')}
                        </a>
                    </li>
                </>
            );
        }
        return (
            <>
                <li className="menu-title text-xs opacity-50 px-4 py-2 uppercase tracking-widest">{t('common.bulk_actions', { defaultValue: 'Actions Groupées' })}</li>
                <li>
                    <a onClick={handleBulkDelete} className="gap-3 py-3 text-error hover:bg-error/10 font-bold">
                        <Trash2 className="w-4 h-4" />
                        Supprimer les {selectedIds.length} factures
                    </a>
                </li>
            </>
        );
    };

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
                        <SelectionHeader
                            selectedCount={selectedIds.length}
                            onClear={() => setSelectedIds([])}
                            colSpan={8}
                            actions={renderBulkActions()}
                        >
                            <div className="grid grid-cols-7 w-full h-full items-center text-xs font-semibold text-base-content/60 uppercase tracking-wider">
                                <div className="col-span-1">{t('sales.table.invoice_number')}</div>
                                <div className="col-span-1">{t('sales.table.client')}</div>
                                <div className="col-span-1 hidden xl:block">{t('sales.table.operator', {defaultValue: "Vendeur"})}</div>
                                <div className="col-span-1 text-center">{t('sales.table.amount')}</div>
                                <div className="col-span-1 text-center">Régler</div>
                                <div className="col-span-1 text-center">En compte</div>
                                <div className="col-span-1 text-right pr-4">{t('sales.table.actions')}</div>
                            </div>
                        </SelectionHeader>
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
                                    {formatCurrency(normalizeNumberInput(facture.total_ttc))}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                                <span className="text-success font-bold font-mono text-sm">
                                    {formatCurrency(normalizeNumberInput(facture.montant_regle || '0'))}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                                <span className={`${normalizeNumberInput(facture.montant_en_compte || '0') > 0 ? 'text-warning' : 'text-base-content/30'} font-bold font-mono text-sm`}>
                                    {formatCurrency(normalizeNumberInput(facture.montant_en_compte || '0'))}
                                </span>
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
                                {selectedIds.length === 0 && (
                                    <div className="flex justify-end gap-1 opacity-20 group-hover:opacity-100 transition-opacity">
                                        <ActionIcon 
                                            icon={Eye}
                                            onClick={() => onView(facture)}
                                            title={t('common.details')}
                                            variant="secondary"
                                        />
                                        <ActionIcon 
                                            icon={Printer}
                                            onClick={() => onPrint(facture)}
                                            title="Format A4"
                                            variant="primary"
                                        />
                                        <ActionIcon 
                                            icon={Receipt}
                                            onClick={() => onPrintTicket(facture)}
                                            title="Ticket Caisse"
                                            variant="primary"
                                        />
                                    </div>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
