import React from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { Eye, Edit, Trash2, CheckCircle2, Check } from 'lucide-react';
import type { Avoir } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import ActionIcon from '../ui/ActionIcon';
import SelectionHeader from '../ui/SelectionHeader';

// Composant séparé pour éviter les re-renders inutiles
interface BulkActionsMenuProps {
    selectedIds: Set<number>;
    avoirs: Avoir[];
    onView: (avoir: Avoir) => void;
    onEdit: (avoir: Avoir) => void;
    onValidate: (avoir: Avoir) => void;
    onDelete: (avoir: Avoir) => void;
    onBulkValidate: () => void;
    onBulkDelete: () => void;
    bulkLoading: boolean;
}

const BulkActionsMenu: React.FC<BulkActionsMenuProps> = React.memo(({
    selectedIds, avoirs, onView, onEdit, onValidate, onDelete, onBulkValidate, onBulkDelete, bulkLoading
}) => {
    const { t } = useTranslation(['stock', 'common']);

    if (selectedIds.size === 1) {
        const id = Array.from(selectedIds)[0];
        const avoir = avoirs.find(x => x.id === id);
        if (!avoir) return null;
        return (
            <>
                <li className="menu-title px-4 py-2 text-xs font-bold uppercase tracking-widest text-base-content/50">
                    {t('common:single_selection')}
                </li>
                <li>
                    <a onClick={() => onView(avoir)} className="flex items-center gap-3 py-3 hover:bg-info/10 text-info font-medium">
                        <Eye className="size-4" /> {t('common:view')}
                    </a>
                </li>
                {(avoir.status?.toUpperCase() === 'BROUILLON' || avoir.status?.toUpperCase() === 'BRO') && (
                    <>
                        <li>
                            <a onClick={() => onEdit(avoir)} className="flex items-center gap-3 py-3 hover:bg-warning/10 text-warning font-medium">
                                <Edit className="size-4" /> {t('common:edit')}
                            </a>
                        </li>
                        <li>
                            <a onClick={() => onValidate(avoir)} className="flex items-center gap-3 py-3 hover:bg-success/10 text-success font-medium">
                                <CheckCircle2 className="size-4" /> {t('common:validate')}
                            </a>
                        </li>
                        <li>
                            <a onClick={() => onDelete(avoir)} className="flex items-center gap-3 py-3 hover:bg-error/10 text-error font-medium">
                                <Trash2 className="size-4" /> {t('common:delete')}
                            </a>
                        </li>
                    </>
                )}
            </>
        );
    }
    return (
        <>
            <li className="menu-title px-4 py-2 text-xs font-bold uppercase tracking-widest text-base-content/50">
                {t('common:bulk_actions')}
            </li>
            <li>
                <a onClick={onBulkValidate} className={`flex items-center gap-3 py-3 hover:bg-success/10 text-success font-medium ${bulkLoading ? 'disabled' : ''}`}>
                    {bulkLoading ? <span className="inline-block size-3 border-2 border-base-300 border-t-indigo-600 rounded-full animate-spin" /> : <Check className="size-4" />}
                    {t('common:validate_all')}
                </a>
            </li>
            <li>
                <a onClick={onBulkDelete} className={`flex items-center gap-3 py-3 hover:bg-error/10 text-error font-medium ${bulkLoading ? 'disabled' : ''}`}>
                    {bulkLoading ? <span className="inline-block size-3 border-2 border-base-300 border-t-indigo-600 rounded-full animate-spin" /> : <Trash2 className="size-4" />}
                    {t('common:delete_all')}
                </a>
            </li>
        </>
    );
});

interface AvoirsTableProps {
    avoirs: Avoir[];
    loading: boolean;
    selectedIds: Set<number>;
    onToggleSelection: (id: number) => void;
    onToggleSelectAll: () => void;
    onView: (avoir: Avoir) => void;
    onEdit: (avoir: Avoir) => void;
    onValidate: (avoir: Avoir) => void;
    onDelete: (avoir: Avoir) => void;
    onBulkValidate: () => void;
    onBulkDelete: () => void;
    onClearSelection: () => void;
    bulkLoading: boolean;
}

export const AvoirsTable: React.FC<AvoirsTableProps> = ({
    avoirs,
    loading,
    selectedIds,
    onToggleSelection,
    onToggleSelectAll,
    onView,
    onEdit,
    onValidate,
    onDelete,
    onBulkValidate,
    onBulkDelete,
    onClearSelection,
    bulkLoading
}) => {
    const { t, i18n } = useTranslation(['stock', 'common']);

    const getStatusStyle = (status: string) => {
        switch (status?.toUpperCase()) {
            case 'BROUILLON':
            case 'BRO': return 'bg-warning/10 text-warning border-amber-200';
            case 'VAL':
            case 'VALIDE':
            case 'VALIDÉ':
            case 'VALIDEE':
            case 'VALIDÉE': return 'bg-success/10 text-success border-emerald-200';
            default: return 'bg-base-200 text-base-content/60 border-base-300';
        }
    };

    const getTypeAvoirLabel = (type: string) => {
        switch (type?.toUpperCase()) {
            case 'PERIME':
            case 'PÉRIMÉ': return t('stock:avoirs.types.perime');
            case 'CASSE':
            case 'CASSÉ': return t('stock:avoirs.types.casse');
            case 'ERREUR_LIVRAISON': 
            case 'ERREUR': return t('stock:avoirs.types.erreur_livraison');
            case 'AVARIE': return t('stock:avoirs.types.avarie');
            case 'NON_FACTURE': return t('stock:avoirs.types.non_facture');
            case 'AUTRE': return t('stock:avoirs.types.autre');
            default: return type;
        }
    };

    const getTypeAvoirStyle = (type: string) => {
        switch (type?.toUpperCase()) {
            case 'PERIME':
            case 'PÉRIMÉ': return 'bg-red-50 text-red-600 border-red-200';
            case 'CASSE':
            case 'CASSÉ': return 'bg-orange-50 text-orange-600 border-orange-200';
            case 'ERREUR_LIVRAISON':
            case 'ERREUR': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
            case 'AVARIE': return 'bg-purple-50 text-purple-600 border-purple-200';
            case 'NON_FACTURE': return 'bg-blue-50 text-blue-600 border-blue-200';
            case 'AUTRE': return 'bg-slate-100 text-slate-500 border-slate-200';
            default: return 'bg-slate-100 text-slate-500 border-slate-200';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status?.toUpperCase()) {
            case 'BROUILLON':
            case 'BRO': return t('stock:avoirs.statuses.brouillon');
            case 'VAL':
            case 'VALIDE':
            case 'VALIDÉ':
            case 'VALIDEE':
            case 'VALIDÉE': return t('stock:avoirs.statuses.valide');
            default: return status;
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-base-content/60 gap-4">
                <span className="inline-block size-4 border-2 border-base-300 border-t-indigo-600 rounded-full animate-spin loading-md text-primary" />
                <p>{t('stock:avoirs.loading')}</p>
            </div>
        );
    }

    if (avoirs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-base-content/60 gap-4">
                <div className="size-16 rounded-full bg-base-200 flex items-center justify-center">
                    <svg className="size-8 text-base-content/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                </div>
                <p>{t('stock:avoirs.empty')}</p>
            </div>
        );
    }

    const draftAvoirsCount = avoirs.filter(a => {
        const s = a.status?.toUpperCase();
        return s === 'BROUILLON' || s === 'BRO';
    }).length;
    const allSelected = draftAvoirsCount > 0 && selectedIds.size === draftAvoirsCount;

    return (
        <div className="overflow-auto size-full relative">
            <table className="w-full text-sm border-separate border-spacing-0">
                <thead>
                    <tr className="bg-base-200 text-base-content/60 border-b border-base-300">
                        <th className="w-10 text-center sticky top-0 z-30 bg-base-200 border-b border-base-300 px-3">
                            <input
                                type="checkbox"
                                className="size-3.5 rounded border-base-300 text-primary focus:ring-primary cursor-pointer"
                                checked={allSelected}
                                onChange={onToggleSelectAll}
                                disabled={draftAvoirsCount === 0}
                            />
                        </th>
                        {selectedIds.size > 0 ? (
                            <SelectionHeader
                                selectedCount={selectedIds.size}
                                onClear={onClearSelection}
                                colSpan={7}
                                actions={
                                    <BulkActionsMenu
                                        selectedIds={selectedIds}
                                        avoirs={avoirs}
                                        onView={onView}
                                        onEdit={onEdit}
                                        onValidate={onValidate}
                                        onDelete={onDelete}
                                        onBulkValidate={onBulkValidate}
                                        onBulkDelete={onBulkDelete}
                                        bulkLoading={bulkLoading}
                                    />
                                }
                            >
                                <></>
                            </SelectionHeader>
                        ) : (
                            <>
                                <th className="sticky top-0 z-30 bg-base-200 border-b border-base-300 text-[10px] font-black uppercase tracking-widest text-base-content/50 px-4 py-3 w-32">{t('stock:avoirs.table.date')}</th>
                                <th className="sticky top-0 z-30 bg-base-200 border-b border-base-300 text-[10px] font-black uppercase tracking-widest text-base-content/50 px-4 py-3 w-36">{t('stock:avoirs.table.numero')}</th>
                                <th className="sticky top-0 z-30 bg-base-200 border-b border-base-300 text-[10px] font-black uppercase tracking-widest text-base-content/50 px-4 py-3">{t('stock:avoirs.table.fournisseur')}</th>
                                <th className="sticky top-0 z-30 bg-base-200 border-b border-base-300 text-[10px] font-black uppercase tracking-widest text-base-content/50 px-4 py-3 w-36">Type</th>
                                <th className="sticky top-0 z-30 bg-base-200 border-b border-base-300 text-[10px] font-black uppercase tracking-widest text-base-content/50 px-4 py-3 text-center w-16">Lignes</th>
                                <th className="sticky top-0 z-30 bg-base-200 border-b border-base-300 text-[10px] font-black uppercase tracking-widest text-base-content/50 px-4 py-3 text-right w-32">{t('stock:avoirs.table.montant')}</th>
                                <th className="sticky top-0 z-30 bg-base-200 border-b border-base-300 text-[10px] font-black uppercase tracking-widest text-base-content/50 px-4 py-3 text-center w-28">{t('stock:avoirs.table.status')}</th>
                                <th className="sticky top-0 z-30 bg-base-200 border-b border-base-300 px-4 py-3 w-28"></th>
                            </>
                        )}
                    </tr>
                </thead>
                <tbody className="text-base-content">
                    {avoirs.map((avoir) => {
                        const isDraft = avoir.status?.toUpperCase() === 'BROUILLON' || avoir.status?.toUpperCase() === 'BRO';
                        const montant = Number(avoir.total_ht) || 0;
                        const nbLignes = (avoir as any).lignes?.length ?? (avoir as any).lignes_count ?? null;
                        return (
                        <tr
                            key={avoir.id}
                            className={`border-b border-base-200 transition-colors group cursor-pointer ${
                                selectedIds.has(avoir.id)
                                    ? 'bg-primary/10 hover:bg-primary/15'
                                    : 'hover:bg-base-200/70'
                            }`}
                            onClick={() => selectedIds.size === 0 && onView(avoir)}
                        >
                            <td className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                                {isDraft && (
                                    <input
                                        type="checkbox"
                                        className="size-3.5 rounded border-base-300 text-primary focus:ring-primary cursor-pointer"
                                        checked={selectedIds.has(avoir.id)}
                                        onChange={() => onToggleSelection(avoir.id)}
                                    />
                                )}
                            </td>
                            <td className="px-4 py-2.5">
                                <div className="font-semibold text-base-content text-[13px]">
                                    {format(new Date(avoir.created_at || avoir.date), 'dd/MM/yyyy', { locale: i18n.language === 'fr' ? fr : enUS })}
                                </div>
                                <div className="text-[11px] text-base-content/50 font-medium">
                                    {format(new Date(avoir.created_at || avoir.date), 'HH:mm', { locale: i18n.language === 'fr' ? fr : enUS })}
                                </div>
                            </td>
                            <td className="px-4 py-2.5">
                                <span className="font-mono text-xs font-bold text-base-content/70 bg-base-200 px-2 py-0.5 rounded">
                                    {avoir.numero}
                                </span>
                            </td>
                            <td className="px-4 py-2.5">
                                <div className="font-semibold text-base-content text-[13px] leading-tight">
                                    {avoir.fournisseur_name || <span className="text-base-content/30 italic text-xs">—</span>}
                                </div>
                            </td>
                            <td className="px-4 py-2.5">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wide ${getTypeAvoirStyle(avoir.type_avoir)}`}>
                                    {getTypeAvoirLabel(avoir.type_avoir)}
                                </span>
                            </td>
                            <td className="px-4 py-2.5 text-center">
                                {nbLignes !== null
                                    ? <span className="inline-flex items-center justify-center size-6 rounded-full bg-base-200 text-[11px] font-bold text-base-content/70">{nbLignes}</span>
                                    : <span className="text-base-content/30">—</span>
                                }
                            </td>
                            <td className="px-4 py-2.5 text-right">
                                <span className={`font-mono font-black text-sm ${
                                    montant > 0 ? 'text-base-content' : 'text-base-content/30'
                                }`}>
                                    {formatCurrency(montant)}
                                </span>
                            </td>
                            <td className="px-4 py-2.5 text-center">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wide ${getStatusStyle(avoir.status_display || avoir.status)}`}>
                                    {getStatusLabel(avoir.status_display || avoir.status)}
                                </span>
                            </td>
                            <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                                {selectedIds.size === 0 && (
                                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <ActionIcon
                                            icon={Eye}
                                            onClick={() => onView(avoir)}
                                            title={t('common:view')}
                                            variant="info"
                                        />
                                        {isDraft && (
                                            <>
                                                <ActionIcon
                                                    icon={Edit}
                                                    onClick={() => onEdit(avoir)}
                                                    title={t('common:edit')}
                                                    variant="warning"
                                                />
                                                <ActionIcon
                                                    icon={CheckCircle2}
                                                    onClick={() => onValidate(avoir)}
                                                    title={t('common:validate')}
                                                    variant="success"
                                                />
                                                <ActionIcon
                                                    icon={Trash2}
                                                    onClick={() => onDelete(avoir)}
                                                    title={t('common:delete')}
                                                    variant="error"
                                                />
                                            </>
                                        )}
                                    </div>
                                )}
                            </td>
                        </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};
