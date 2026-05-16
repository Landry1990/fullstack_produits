import React from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, Printer, Trash2, RotateCcw, User, Calendar, Receipt, Clock, Copy, FileDigit, Truck } from 'lucide-react';
import type { Facture } from '../../types';
import { formatCurrency, normalizeNumberInput } from '../../utils/formatters';
import { formatDate, formatTime } from '../../utils/dateUtils';
import ActionIcon from '../ui/ActionIcon';
import SelectionHeader from '../ui/SelectionHeader';
import { Checkbox } from '../ui/Checkbox';

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
                <li className="text-[10px] font-medium text-gray-400 px-4 py-2 uppercase tracking-widest">{t('common:single_selection', { defaultValue: 'Sélection' })}</li>
                <li><a onClick={() => onView(selectedFacture)} className="gap-3 py-3"><Eye className="size-4 text-gray-500" />{t('common:details')}</a></li>
                <li><a onClick={() => onPrint(selectedFacture)} className="gap-3 py-3"><Printer className="size-4 text-indigo-500" />Format A4</a></li>
                <li><a onClick={() => onPrintTicket(selectedFacture)} className="gap-3 py-3"><Receipt className="size-4 text-indigo-500" />Ticket Caisse</a></li>
                <li><a onClick={() => onPrintBL(selectedFacture)} className="gap-3 py-3"><Truck className="size-4 text-indigo-500" />Bon de livraison</a></li>
                <li><a onClick={() => onDuplicate(selectedFacture)} className="gap-3 py-3"><Copy className="size-4 text-blue-500" />{t('common:duplicate', { defaultValue: 'Dupliquer' })}</a></li>
                {(selectedFacture.status === 'VALIDEE' || selectedFacture.status === 'PAY' || selectedFacture.status === 'VAL' || selectedFacture.status === 'PAYEE') && (
                    <li><a onClick={() => onGenerateAvoir(selectedFacture)} className="gap-3 py-3"><FileDigit className="size-4 text-indigo-500" />Générer un avoir</a></li>
                )}
                {selectedFacture.status !== 'ANN' && selectedFacture.status !== 'BROU' && (
                    <li><a onClick={() => onRefund(selectedFacture)} className="gap-3 py-3"><RotateCcw className="size-4 text-amber-500" />{t('common:refund', { defaultValue: "Modifier/Retour" })}</a></li>
                )}
                <div className="border-t border-gray-100 my-1"></div>
                <li><a onClick={() => onDelete(selectedFacture.id)} className="gap-3 py-3 text-red-600 hover:bg-red-50 font-bold"><Trash2 className="size-4" />{t('common:delete')}</a></li>
            </>
        );
    }
    return (
        <>
            <li className="text-[10px] font-medium text-gray-400 px-4 py-2 uppercase tracking-widest">{t('common:bulk_actions')}</li>
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


    const getStatusLabel = (status: string) => {
        switch (status?.toUpperCase()) {
            case 'PAY':
            case 'PAYEE':
            case 'PAYÉE': return t('sales:status.paid', 'Paid');
            case 'VAL':
            case 'VALIDE':
            case 'VALIDÉE':
            case 'VALIDEE': return t('sales:status.validated', 'Validated');
            case 'BROU':
            case 'BROUILLON': return t('sales:status.draft', 'Draft');
            case 'ANN':
            case 'ANNULEE':
            case 'ANNULÉE': return t('sales:status.cancelled', 'Cancelled');
            default: return status;
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
             <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <div className="size-10 border-2 border-gray-200 border-t-indigo-600 rounded-full animate-spin mb-3"></div>
                <p className="text-sm font-medium text-gray-500">{t('common:loading')}</p>
            </div>
         );

    if (factures.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 bg-gray-50/50 m-4 rounded-2xl border border-dashed border-gray-200">
                <h3 className="text-base font-semibold text-gray-700 mb-1">{t('sales:no_sales_found')}</h3>
                <p className="text-sm text-gray-500">{t('sales:try_different_filters')}</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-220px)] min-h-[450px]">
            <table className="w-full border-separate border-spacing-0">
                <thead className="sticky top-0 z-30">
                    <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        <th className="px-4 py-4 w-10 sticky top-0 bg-gray-50 border-b border-gray-200">
                            <input
                                type="checkbox"
                                className="size-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
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
                                <th className="px-6 py-4 sticky top-0 bg-gray-50 border-b border-gray-200">{t('sales:table.invoice_number')}</th>
                                <th className="px-6 py-4 sticky top-0 bg-gray-50 border-b border-gray-200">{t('sales:table.client')}</th>
                                <th className="px-6 py-4 sticky top-0 bg-gray-50 border-b border-gray-200 hidden xl:table-cell">{t('sales:table.operator')}</th>
                                <th className="px-6 py-4 sticky top-0 bg-gray-50 border-b border-gray-200 text-center">{t('sales:table.amount')}</th>
                                <th className="px-6 py-4 sticky top-0 bg-gray-50 border-b border-gray-200 text-center">{t('sales:table.amount_settled')}</th>
                                <th className="px-6 py-4 sticky top-0 bg-gray-50 border-b border-gray-200 text-center">{t('sales:table.amount_on_account')}</th>
                                <th className="px-6 py-4 sticky top-0 bg-gray-50 border-b border-gray-200 text-center">{t('sales:table.discount')}</th>
                                <th className="px-6 py-4 sticky top-0 bg-gray-50 border-b border-gray-200 text-center hidden md:table-cell">{t('sales:table.status')}</th>
                                <th className="px-6 py-4 sticky top-0 bg-gray-50 border-b border-gray-200 text-right pr-6">{t('sales:table.actions')}</th>
                            </>
                        )}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {factures.map((facture) => (
                        <tr 
                            key={facture.id}
                            className={`group transition-colors duration-150 ${selectedIds.includes(facture.id) ? 'bg-indigo-50/30 hover:bg-indigo-50/50' : 'hover:bg-gray-50'}`}
                        >
                             <td className="px-4 py-4">
                                <input
                                    type="checkbox"
                                    className="size-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                    checked={selectedIds.includes(facture.id)}
                                    onChange={() => handleSelect(facture.id)}
                                />
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex flex-col">
                                    <span className="font-bold text-gray-900 flex items-center gap-2">
                                        #{facture.numero_facture || facture.id}
                                    </span>
                                    <span className="text-xs text-gray-500 flex flex-nowrap items-center gap-x-3 gap-y-1 mt-0.5 whitespace-nowrap">
                                        <span className="flex items-center gap-1.5 shrink-0">
                                            <Calendar className="size-3" />
                                            {formatDate(facture.date)}
                                        </span>
                                        <span className="flex items-center gap-1.5 text-indigo-500 font-medium shrink-0">
                                            <Clock className="size-3" />
                                            {formatTime(facture.date)}
                                        </span>
                                    </span>
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                    <div className={`size-8 rounded-full flex items-center justify-center ${facture.ayant_droit_details ? 'bg-blue-50 text-blue-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                        <User className="size-4" />
                                    </div>
                                    <div className="flex flex-col">
                                        <div className="font-medium text-gray-900 whitespace-nowrap">
                                            {facture.ayant_droit_details?.nom || facture.client_name || facture.client_name_override || t('common:passerby_client')}
                                        </div>
                                        {facture.ayant_droit_details && (
                                            <div className="text-[10px] text-gray-400 uppercase font-black tracking-tight leading-none mt-0.5">
                                                {facture.client_name}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4 hidden xl:table-cell">
                                <div className="text-sm text-gray-600">
                                    {facture.created_by_name || '-'}
                                </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                                <span className="inline-flex items-center px-1.5 py-1 rounded-lg bg-gray-50 text-gray-700 font-mono font-bold text-sm border border-gray-200 group-hover:bg-white group-hover:border-indigo-200 group-hover:text-indigo-600 group-hover:shadow-sm transition-all whitespace-nowrap">
                                    {formatCurrency(normalizeNumberInput(facture.total_ttc))}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-center whitespace-nowrap">
                                <span className="text-emerald-600 font-bold font-mono text-sm uppercase">
                                    {formatCurrency(normalizeNumberInput(facture.montant_regle || '0'))}
                                </span>

                                
                            </td>
                            <td className="px-6 py-4 text-center whitespace-nowrap">
                                <span className={`${normalizeNumberInput(facture.montant_en_compte || '0') > 0 ? 'text-amber-600' : 'text-gray-300'} font-bold font-mono text-sm uppercase`}>
                                    {formatCurrency(normalizeNumberInput(facture.montant_en_compte || '0'))}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-center whitespace-nowrap">
                                <span className="text-red-600 font-medium font-mono text-sm uppercase">
                                    {formatCurrency(normalizeNumberInput(facture.remise || '0'))}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-center hidden md:table-cell">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border
                                    ${facture.status === 'PAY' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                    facture.status === 'ANN' ? 'bg-red-50 text-red-700 border-red-100' :
                                    facture.status === 'BROU' ? 'bg-gray-100 text-gray-500 border-gray-200' :
                                    'bg-amber-50 text-amber-700 border-amber-100'}`}
                                >
                                    {getStatusLabel(facture.status)}
                                </span>
                            </td>

                            <td className="px-6 py-4 text-right">
                                {selectedIds.length === 0 && (
                                    <div className="flex justify-end gap-1 opacity-20 group-hover:opacity-100 transition-opacity">
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

