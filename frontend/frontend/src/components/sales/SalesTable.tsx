import React from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, Printer, Trash2, RotateCcw, User, Calendar, Receipt, Clock, Copy, FileDigit, Truck } from 'lucide-react';
import type { Facture } from '../../types';
import { formatCurrency, normalizeNumberInput } from '../../utils/formatters';
import { formatDate, formatTime } from '../../utils/dateUtils';
import ActionIcon from '../ui/ActionIcon';
import SelectionHeader from '../ui/SelectionHeader';
import { Checkbox } from '../ui/Checkbox';
import { cn } from '../../lib/utils';

// Composant séparé pour éviter les re-renders inutiles
interface BulkActionsMenuProps {
    selectedIds: number[];
    factures: Facture[];
    onView: (facture: Facture) => void;
    onPrint: (facture: Facture) => void;
    onPrintTicket: (facture: Facture) => void;
    onPrintBL: (facture: Facture) => void;
    onDuplicate: (facture: Facture) => void;
    onGenerateAvoir: (facture: Facture) => void;
    onRefund: (facture: Facture) => void;
    onDelete: (id: number) => void;
    onBulkDelete: () => void;
}

const BulkActionsMenu: React.FC<BulkActionsMenuProps> = React.memo(({
    selectedIds, factures, onView, onPrint, onPrintTicket, onPrintBL,
    onDuplicate, onGenerateAvoir, onRefund, onDelete, onBulkDelete
}) => {
    const { t } = useTranslation(['sales', 'common']);

    if (selectedIds.length === 1) {
        const selectedFacture = factures.find(f => f.id === selectedIds[0]);
        if (!selectedFacture) return null;
        return (
            <>
                <li className="text-[10px] font-medium text-slate-500 px-4 py-2 uppercase tracking-widest">{t('common:single_selection', { defaultValue: 'Sélection' })}</li>
                <li><a onClick={() => onView(selectedFacture)} className="gap-3 py-3"><Eye className="size-4 text-slate-500" />{t('common:details')}</a></li>
                <li><a onClick={() => onPrint(selectedFacture)} className="gap-3 py-3"><Printer className="size-4 text-emerald-600" />Format A4</a></li>
                <li><a onClick={() => onPrintTicket(selectedFacture)} className="gap-3 py-3"><Receipt className="size-4 text-emerald-600" />Ticket Caisse</a></li>
                <li><a onClick={() => onPrintBL(selectedFacture)} className="gap-3 py-3"><Truck className="size-4 text-emerald-600" />Bon de livraison</a></li>
                <li><a onClick={() => onDuplicate(selectedFacture)} className="gap-3 py-3"><Copy className="size-4 text-blue-500" />{t('common:duplicate', { defaultValue: 'Dupliquer' })}</a></li>
                {(selectedFacture.status === 'VALIDEE' || selectedFacture.status === 'PAY' || selectedFacture.status === 'VAL' || selectedFacture.status === 'PAYEE') && (
                    <li><a onClick={() => onGenerateAvoir(selectedFacture)} className="gap-3 py-3"><FileDigit className="size-4 text-emerald-600" />Générer un avoir</a></li>
                )}
                {selectedFacture.status !== 'ANN' && selectedFacture.status !== 'BROU' && (
                    <li><a onClick={() => onRefund(selectedFacture)} className="gap-3 py-3"><RotateCcw className="size-4 text-amber-500" />{t('common:refund', { defaultValue: "Modifier/Retour" })}</a></li>
                )}
                <div className="border-t border-slate-200 my-1"></div>
                <li><a onClick={() => onDelete(selectedFacture.id)} className="gap-3 py-3 text-red-600 hover:bg-red-50 font-bold"><Trash2 className="size-4" />{t('common:delete')}</a></li>
            </>
        );
    }
    return (
        <>
            <li className="text-[10px] font-medium text-slate-500 px-4 py-2 uppercase tracking-widest">{t('common:bulk_actions')}</li>
            <li><a onClick={onBulkDelete} className="gap-3 py-3 text-red-600 hover:bg-red-50 font-bold"><Trash2 className="size-4" />{t('sales:confirm_bulk_delete', { count: selectedIds.length })}</a></li>
        </>
    );
});

interface SalesTableProps {
    factures: Facture[];
    onView: (facture: Facture) => void;
    onPrint: (facture: Facture) => void;
    onPrintBL: (facture: Facture) => void;
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
    onPrintBL,
    onPrintTicket,
    onRefund,
    onDuplicate,
    onGenerateAvoir,
    onDelete,
    onBulkDelete,
    loading
}) => {
    const { t } = useTranslation(['sales', 'common']);
    const [selectedIds, setSelectedIds] = React.useState<number[]>([]);


    // Normaliser les statuts pour gérer toutes les variantes
    const normalizeStatus = (status: string): string => {
        const s = status?.toUpperCase();
        if (['PAY', 'PAYEE', 'PAYÉE'].includes(s)) return 'PAY';
        if (['VAL', 'VALIDE', 'VALIDÉE', 'VALIDEE'].includes(s)) return 'VAL';
        if (['ANN', 'ANNULEE', 'ANNULÉE'].includes(s)) return 'ANN';
        if (['BROU', 'BROUILLON'].includes(s)) return 'BROU';
        if (['PROF', 'PROFORMA'].includes(s)) return 'PROF';
        return s || 'UNKNOWN';
    };

    const getStatusLabel = (status: string) => {
        const normalized = normalizeStatus(status);
        switch (normalized) {
            case 'PAY': return t('sales:status.paid', 'Paid');
            case 'VAL': return t('sales:status.validated', 'Validated');
            case 'BROU': return t('sales:status.draft', 'Draft');
            case 'ANN': return t('sales:status.cancelled', 'Cancelled');
            case 'PROF': return t('sales:status.proforma', 'Proforma');
            default: return status;
        }
    };

    const getStatusStyle = (status: string) => {
        const normalized = normalizeStatus(status);
        switch (normalized) {
            case 'PAY': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
            case 'ANN': return 'bg-red-50 text-red-600 border-red-100';
            case 'BROU': return 'bg-slate-100 text-slate-500 border-slate-200';
            case 'PROF': return 'bg-blue-50 text-blue-600 border-blue-100';
            default: return 'bg-amber-50 text-amber-600 border-amber-100';
        }
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
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

    if (loading)         return (
             <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                <div className="size-10 border-2 border-slate-200 border-t-emerald-600 rounded-full animate-spin mb-3"></div>
                <p className="text-sm font-medium text-slate-500">{t('common:loading')}</p>
            </div>
         );

    if (factures.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500 bg-slate-50 m-4 rounded-2xl border border-dashed border-slate-200">
                <h3 className="text-base font-semibold text-slate-700 mb-1">{t('sales:no_sales_found')}</h3>
                <p className="text-sm text-slate-500">{t('sales:try_different_filters')}</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-220px)] min-h-[450px]">
            <table className="w-full border-separate border-spacing-0">
                <thead className="sticky top-0 z-30">
                    <tr className="bg-slate-100 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        <th className="px-4 py-4 w-10 sticky top-0 bg-slate-100 border-b border-slate-200">
                            <input
                                type="checkbox"
                                aria-label={t('sales:select_all', { defaultValue: 'Tout sélectionner' })}
                                className="size-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
                                onChange={(e) => handleSelectAll(e.target.checked)}
                                checked={factures.length > 0 && selectedIds.length === factures.length}
                            />
                        </th>
                        {selectedIds.length > 0 ? (
                            <SelectionHeader
                                selectedCount={selectedIds.length}
                                onClear={() => setSelectedIds([])}
                                colSpan={9}
                                actions={
                                    <BulkActionsMenu
                                        selectedIds={selectedIds}
                                        factures={factures}
                                        onView={onView}
                                        onPrint={onPrint}
                                        onPrintTicket={onPrintTicket}
                                        onPrintBL={onPrintBL}
                                        onDuplicate={onDuplicate}
                                        onGenerateAvoir={onGenerateAvoir}
                                        onRefund={onRefund}
                                        onDelete={onDelete}
                                        onBulkDelete={handleBulkDelete}
                                    />
                                }
                            >
                                {/* Empty children as SelectionHeader handles its own content when selectedCount > 0 */}
                                <></>
                            </SelectionHeader>
                        ) : (
                            <>
                                <th className="px-6 py-4 sticky top-0 bg-slate-100 border-b border-slate-200">{t('sales:table.invoice_number')}</th>
                                <th className="px-6 py-4 sticky top-0 bg-slate-100 border-b border-slate-200">{t('sales:table.client')}</th>
                                <th className="px-6 py-4 sticky top-0 bg-slate-100 border-b border-slate-200 hidden xl:table-cell">{t('sales:table.operator')}</th>
                                <th className="px-6 py-4 sticky top-0 bg-slate-100 border-b border-slate-200 text-center">{t('sales:table.amount')}</th>
                                <th className="px-6 py-4 sticky top-0 bg-slate-100 border-b border-slate-200 text-center">{t('sales:table.amount_settled')}</th>
                                <th className="px-6 py-4 sticky top-0 bg-slate-100 border-b border-slate-200 text-center">{t('sales:table.amount_on_account')}</th>
                                <th className="px-6 py-4 sticky top-0 bg-slate-100 border-b border-slate-200 text-center">{t('sales:table.discount')}</th>
                                <th className="px-6 py-4 sticky top-0 bg-slate-100 border-b border-slate-200 text-center hidden md:table-cell">{t('sales:table.status')}</th>
                                <th className="px-6 py-4 sticky top-0 bg-slate-100 border-b border-slate-200 text-right pr-6">{t('sales:table.actions')}</th>
                            </>
                        )}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                    {factures.map((facture) => (
                        <tr
                            key={facture.id}
                            className={cn("group transition-colors duration-150", selectedIds.includes(facture.id) ? 'bg-emerald-50 hover:bg-emerald-100/50' : 'hover:bg-slate-50')}
                        >
                             <td className="px-4 py-4">
                                <input
                                    type="checkbox"
                                    aria-label={t('sales:select_invoice', { defaultValue: 'Sélectionner la facture', number: facture.numero_facture || facture.id })}
                                    className="size-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
                                    checked={selectedIds.includes(facture.id)}
                                    onChange={() => handleSelect(facture.id)}
                                />
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex flex-col">
                                    <span className="font-bold text-slate-700 flex items-center gap-2">
                                        #{facture.numero_facture || facture.id}
                                    </span>
                                    <span className="text-xs text-slate-500 flex flex-nowrap items-center gap-x-3 gap-y-1 mt-0.5 whitespace-nowrap">
                                        <span className="flex items-center gap-1.5 shrink-0">
                                            <Calendar className="size-3" />
                                            {formatDate(facture.date)}
                                        </span>
                                        <span className="flex items-center gap-1.5 text-emerald-600 font-medium shrink-0">
                                            <Clock className="size-3" />
                                            {formatTime(facture.date)}
                                        </span>
                                    </span>
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                    <div className={cn("size-8 rounded-full flex items-center justify-center", facture.ayant_droit_details ? 'bg-sky-100 text-sky-600' : 'bg-emerald-100 text-emerald-600')}>
                                        <User className="size-4" />
                                    </div>
                                    <div className="flex flex-col">
                                        <div className="font-medium text-slate-700 whitespace-nowrap">
                                            {facture.ayant_droit_details?.nom || facture.client_name || facture.client_name_override || t('common:passerby_client')}
                                        </div>
                                        {facture.ayant_droit_details && (
                                            <div className="text-[10px] text-slate-500 uppercase font-black tracking-tight leading-none mt-0.5">
                                                {facture.client_name}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4 hidden xl:table-cell">
                                <div className="text-sm text-slate-600">
                                    {facture.created_by_name || '-'}
                                </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                                <span className="inline-flex items-center px-1.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-mono font-bold text-sm border border-slate-200 group-hover:bg-white group-hover:border-emerald-200 group-hover:text-emerald-600 group-hover:shadow-sm transition-all whitespace-nowrap">
                                    {formatCurrency(normalizeNumberInput(facture.total_ttc))}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-center whitespace-nowrap">
                                {facture.montant_regle === null || facture.montant_regle === undefined ? (
                                    <span className="text-slate-400 italic text-sm">-</span>
                                ) : (
                                    <span className="text-emerald-600 font-bold font-mono text-sm uppercase">
                                        {formatCurrency(normalizeNumberInput(facture.montant_regle))}
                                    </span>
                                )}
                            </td>
                            <td className="px-6 py-4 text-center whitespace-nowrap">
                                <span className={cn("font-bold font-mono text-sm uppercase", normalizeNumberInput(facture.montant_en_compte || '0') > 0 ? 'text-amber-600' : 'text-slate-400')}>
                                    {formatCurrency(normalizeNumberInput(facture.montant_en_compte || '0'))}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-center whitespace-nowrap">
                                <span className="text-red-600 font-medium font-mono text-sm uppercase">
                                    {formatCurrency(normalizeNumberInput(facture.remise || '0'))}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-center hidden md:table-cell">
                                <span className={cn("inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border", getStatusStyle(facture.status))}>
                                    {getStatusLabel(facture.status)}
                                </span>
                            </td>

                            <td className="px-6 py-4 text-right">
                                {selectedIds.length === 0 && (
                                    <div className="flex justify-end gap-1 text-slate-200 group-hover:opacity-100 transition-opacity">
                                        <ActionIcon
                                            icon={Eye}
                                            onClick={() => onView(facture)}
                                            title={t('common:details')}
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
                                        <ActionIcon
                                            icon={Truck}
                                            onClick={() => onPrintBL(facture)}
                                            title="Bon de livraison"
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

