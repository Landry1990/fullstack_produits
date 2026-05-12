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
                <li className="menu-title text-xs opacity-50 px-4 py-2 uppercase tracking-widest">{t('common:single_selection', { defaultValue: 'Sélection' })}</li>
                <li><a onClick={() => onView(selectedFacture)} className="gap-3 py-3"><Eye className="size-4 text-secondary" />{t('common:details')}</a></li>
                <li><a onClick={() => onPrint(selectedFacture)} className="gap-3 py-3"><Printer className="size-4 text-primary" />Format A4</a></li>
                <li><a onClick={() => onPrintTicket(selectedFacture)} className="gap-3 py-3"><Receipt className="size-4 text-primary" />Ticket Caisse</a></li>
                <li><a onClick={() => onPrintBL(selectedFacture)} className="gap-3 py-3"><Truck className="size-4 text-primary" />Bon de livraison</a></li>
                <li><a onClick={() => onDuplicate(selectedFacture)} className="gap-3 py-3"><Copy className="size-4 text-info" />{t('common:duplicate', { defaultValue: 'Dupliquer' })}</a></li>
                {(selectedFacture.status === 'VALIDEE' || selectedFacture.status === 'PAY' || selectedFacture.status === 'VAL' || selectedFacture.status === 'PAYEE') && (
                    <li><a onClick={() => onGenerateAvoir(selectedFacture)} className="gap-3 py-3"><FileDigit className="size-4 text-primary" />Générer un avoir</a></li>
                )}
                {selectedFacture.status !== 'ANN' && selectedFacture.status !== 'BROU' && (
                    <li><a onClick={() => onRefund(selectedFacture)} className="gap-3 py-3"><RotateCcw className="size-4 text-warning" />{t('common:refund', { defaultValue: "Modifier/Retour" })}</a></li>
                )}
                <div className="divider my-0"></div>
                <li><a onClick={() => onDelete(selectedFacture.id)} className="gap-3 py-3 text-error hover:bg-error/10 font-bold"><Trash2 className="size-4" />{t('common:delete')}</a></li>
            </>
        );
    }
    return (
        <>
            <li className="menu-title text-xs opacity-50 px-4 py-2 uppercase tracking-widest">{t('common:bulk_actions')}</li>
            <li><a onClick={onBulkDelete} className="gap-3 py-3 text-error hover:bg-error/10 font-bold"><Trash2 className="size-4" />{t('sales:confirm_bulk_delete', { count: selectedIds.length })}</a></li>
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

    if (loading) {
         return (
             <div className="flex flex-col items-center justify-center py-20 text-base-content/40 animate-in fade-in duration-500">
                <div className="size-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                <p className="font-medium animate-pulse">{t('common:loading')}</p>
            </div>
         );
    }

    if (factures.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-base-content/40 bg-base-100/50 m-4 rounded-2xl border border-dashed border-base-200">
                <h3 className="text-lg font-semibold text-base-content mb-1">{t('sales:no_sales_found')}</h3>
                <p className="text-sm">{t('sales:try_different_filters')}</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-220px)] min-h-[450px]">
            <table className="w-full border-separate border-spacing-0">
                <thead className="sticky top-0 z-30">
                    <tr className="bg-base-200 text-left text-xs font-semibold text-base-content/60 uppercase tracking-wider">
                        <th className="px-4 py-4 w-10 sticky top-0 bg-base-200 border-b border-base-300">
                            <input 
                                type="checkbox" 
                                className="checkbox checkbox-xs checkbox-primary"
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
                                <th className="px-6 py-4 sticky top-0 bg-base-200 border-b border-base-300">{t('sales:table.invoice_number')}</th>
                                <th className="px-6 py-4 sticky top-0 bg-base-200 border-b border-base-300">{t('sales:table.client')}</th>
                                <th className="px-6 py-4 sticky top-0 bg-base-200 border-b border-base-300 hidden xl:table-cell">{t('sales:table.operator')}</th>
                                <th className="px-6 py-4 sticky top-0 bg-base-200 border-b border-base-300 text-center">{t('sales:table.amount')}</th>
                                <th className="px-6 py-4 sticky top-0 bg-base-200 border-b border-base-300 text-center">{t('sales:table.amount_settled')}</th>
                                <th className="px-6 py-4 sticky top-0 bg-base-200 border-b border-base-300 text-center">{t('sales:table.amount_on_account')}</th>
                                <th className="px-6 py-4 sticky top-0 bg-base-200 border-b border-base-300 text-center">{t('sales:table.discount')}</th>
                                <th className="px-6 py-4 sticky top-0 bg-base-200 border-b border-base-300 text-center hidden md:table-cell">{t('sales:table.status')}</th>
                                <th className="px-6 py-4 sticky top-0 bg-base-200 border-b border-base-300 text-right pr-6">{t('sales:table.actions')}</th>
                            </>
                        )}
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
                                    <span className="text-xs text-base-content/60 flex flex-nowrap items-center gap-x-3 gap-y-1 mt-0.5 whitespace-nowrap">
                                        <span className="flex items-center gap-1.5 shrink-0">
                                            <Calendar className="size-3" />
                                            {formatDate(facture.date)}
                                        </span>
                                        <span className="flex items-center gap-1.5 text-primary/70 font-medium shrink-0">
                                            <Clock className="size-3" />
                                            {formatTime(facture.date)}
                                        </span>
                                    </span>
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                    <div className={`size-8 rounded-full flex items-center justify-center ${facture.ayant_droit_details ? 'bg-info/10 text-info' : 'bg-primary/10 text-primary'}`}>
                                        <User className="size-4" />
                                    </div>
                                    <div className="flex flex-col">
                                        <div className="font-medium text-base-content whitespace-nowrap">
                                            {facture.ayant_droit_details?.nom || facture.client_name || facture.client_name_override || t('common:passerby_client')}
                                        </div>
                                        {facture.ayant_droit_details && (
                                            <div className="text-[10px] text-base-content/50 uppercase font-black tracking-tight leading-none mt-0.5">
                                                {facture.client_name}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4 hidden xl:table-cell">
                                <div className="text-sm text-base-content/70">
                                    {facture.created_by_name || '-'}
                                </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                                <span className="inline-flex items-center px-1.5 py-1 rounded-lg bg-base-200 text-base-content font-mono font-bold text-sm border border-base-300 group-hover:bg-base-100 group-hover:border-primary/30 group-hover:text-primary group-hover:shadow-sm transition-all whitespace-nowrap">
                                    {formatCurrency(normalizeNumberInput(facture.total_ttc))}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-center whitespace-nowrap">
                                <span className="text-success font-bold font-mono text-sm uppercase">
                                    {formatCurrency(normalizeNumberInput(facture.montant_regle || '0'))}
                                </span>

                                
                            </td>
                            <td className="px-6 py-4 text-center whitespace-nowrap">
                                <span className={`${normalizeNumberInput(facture.montant_en_compte || '0') > 0 ? 'text-warning' : 'text-base-content/30'} font-bold font-mono text-sm uppercase`}>
                                    {formatCurrency(normalizeNumberInput(facture.montant_en_compte || '0'))}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-center whitespace-nowrap">
                                <span className="text-error font-medium font-mono text-sm uppercase">
                                    {formatCurrency(normalizeNumberInput(facture.remise || '0'))}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-center hidden md:table-cell">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border
                                    ${facture.status === 'PAY' ? 'bg-success/10 text-success border-success/20' : 
                                    facture.status === 'ANN' ? 'bg-error/10 text-error border-error/20' :
                                    facture.status === 'BROU' ? 'bg-base-200 text-base-content/60 border-base-300' :
                                    'bg-warning/10 text-warning border-warning/20'}`}
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

