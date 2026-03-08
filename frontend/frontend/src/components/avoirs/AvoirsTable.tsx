import React from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Eye, Edit, Trash2, CheckCircle2, X, Check } from 'lucide-react';
import type { Avoir } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import ActionIcon from '../ui/ActionIcon';
import SelectionHeader from '../ui/SelectionHeader';

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
    const { t } = useTranslation();

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'BRO':
            case 'BROUILLON': return 'bg-warning/10 text-warning border-warning/20';
            case 'VAL':
            case 'VALIDÉ': return 'bg-success/10 text-success border-success/20';
            default: return 'bg-base-200 text-base-content/60 border-base-300';
        }
    };

    const getTypeAvoirLabel = (type: string) => {
        switch (type) {
            case 'PERIME': return 'Périmé';
            case 'CASSE': return 'Cassé';
            case 'ERREUR_LIVRAISON': return 'Erreur Livraison';
            case 'AUTRE': return 'Autre';
            default: return type;
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-base-content/60 gap-4">
                <span className="loading loading-spinner loading-md text-primary" />
                <p>Chargement des avoirs...</p>
            </div>
        );
    }

    if (avoirs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-base-content/60 gap-4">
                <div className="w-16 h-16 rounded-full bg-base-200 flex items-center justify-center">
                    <svg className="w-8 h-8 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                </div>
                <p>{t('avoirs.empty', 'Aucun avoir trouvé')}</p>
            </div>
        );
    }

    const draftAvoirsCount = avoirs.filter(a => a.status === 'BROUILLON' || a.status === 'BRO').length;
    const allSelected = draftAvoirsCount > 0 && selectedIds.size === draftAvoirsCount;

    const renderBulkActions = () => {
        if (selectedIds.size === 1) {
            const id = Array.from(selectedIds)[0];
            const avoir = avoirs.find(x => x.id === id);
            if (!avoir) return null;
            return (
                <>
                    <li className="menu-title px-4 py-2 text-xs font-bold uppercase tracking-widest text-base-content/40">
                        {t('common.single_selection', { defaultValue: 'Sélection' })}
                    </li>
                    <li>
                        <a onClick={() => onView(avoir)} className="flex items-center gap-3 py-3 hover:bg-info/10 text-info font-medium">
                            <Eye className="w-4 h-4" /> {t('common.view', 'Voir')}
                        </a>
                    </li>
                    {(avoir.status === 'BROUILLON' || avoir.status === 'BRO') && (
                        <>
                            <li>
                                <a onClick={() => onEdit(avoir)} className="flex items-center gap-3 py-3 hover:bg-warning/10 text-warning font-medium">
                                    <Edit className="w-4 h-4" /> {t('common.edit', 'Modifier')}
                                </a>
                            </li>
                            <li>
                                <a onClick={() => onValidate(avoir)} className="flex items-center gap-3 py-3 hover:bg-success/10 text-success font-medium">
                                    <CheckCircle2 className="w-4 h-4" /> {t('common.validate', 'Valider')}
                                </a>
                            </li>
                            <li>
                                <a onClick={() => onDelete(avoir)} className="flex items-center gap-3 py-3 hover:bg-error/10 text-error font-medium">
                                    <Trash2 className="w-4 h-4" /> {t('common.delete', 'Supprimer')}
                                </a>
                            </li>
                        </>
                    )}
                </>
            );
        }
        return (
            <>
                <li className="menu-title px-4 py-2 text-xs font-bold uppercase tracking-widest text-base-content/40">
                    {t('common.bulk_actions', { defaultValue: 'Actions Groupées' })}
                </li>
                <li>
                    <a onClick={onBulkValidate} className={`flex items-center gap-3 py-3 hover:bg-success/10 text-success font-medium ${bulkLoading ? 'disabled' : ''}`}>
                        {bulkLoading ? <span className="loading loading-spinner loading-xs" /> : <Check className="w-4 h-4" />}
                        {t('common.validate_all', 'Valider tous')}
                    </a>
                </li>
                <li>
                    <a onClick={onBulkDelete} className={`flex items-center gap-3 py-3 hover:bg-error/10 text-error font-medium ${bulkLoading ? 'disabled' : ''}`}>
                        {bulkLoading ? <span className="loading loading-spinner loading-xs" /> : <Trash2 className="w-4 h-4" />}
                        {t('common.delete_all', 'Supprimer tous')}
                    </a>
                </li>
            </>
        );
    };

    return (
        <div className="overflow-auto w-full h-full relative">
            <table className="table table-zebra table-pin-rows w-full text-sm">
                <thead>
                    <tr className="bg-base-200 text-base-content/70 border-b border-base-300">
                        <th className="w-12 text-center rounded-tl-xl sticky top-0 z-30 bg-base-200 opacity-100 border-b border-base-300">
                            <label className="cursor-pointer label p-0 justify-center">
                                <input 
                                    type="checkbox" 
                                    className="checkbox checkbox-sm checkbox-primary" 
                                    checked={allSelected}
                                    onChange={onToggleSelectAll}
                                    disabled={draftAvoirsCount === 0}
                                />
                            </label>
                        </th>
                        <SelectionHeader
                            selectedCount={selectedIds.size}
                            onClear={onClearSelection}
                            colSpan={6}
                            actions={renderBulkActions()}
                        >
                            <div className="grid grid-cols-6 w-full h-full items-center text-[10px] font-black uppercase tracking-widest text-base-content/40">
                                <div className="col-span-1">{t('avoirs.table.date', { defaultValue: 'Date' })}</div>
                                <div className="col-span-1">{t('avoirs.table.numero', { defaultValue: 'N° Avoir' })}</div>
                                <div className="col-span-1">{t('avoirs.table.fournisseur', { defaultValue: 'Fournisseur' })}</div>
                                <div className="col-span-1">{t('avoirs.table.type', { defaultValue: 'Type' })}</div>
                                <div className="col-span-1 text-right">{t('avoirs.table.montant', { defaultValue: 'Montant' })}</div>
                                <div className="col-span-1 text-center">{t('avoirs.table.status', { defaultValue: 'Statut' })}</div>
                            </div>
                        </SelectionHeader>
                    </tr>
                </thead>
                <tbody className="text-base-content font-medium">
                    {avoirs.map((avoir) => (
                        <tr 
                            key={avoir.id} 
                            className={`hover:bg-base-200/50 transition-colors group cursor-pointer ${selectedIds.has(avoir.id) ? 'bg-primary/5' : ''}`}
                            onClick={() => selectedIds.size === 0 && onView(avoir)}
                        >
                            <td className="text-center" onClick={(e) => e.stopPropagation()}>
                                {(avoir.status === 'BROUILLON' || avoir.status === 'BRO') && (
                                    <label className="cursor-pointer label p-0 justify-center">
                                        <input 
                                            type="checkbox" 
                                            className="checkbox checkbox-sm checkbox-primary" 
                                            checked={selectedIds.has(avoir.id)}
                                            onChange={() => onToggleSelection(avoir.id)}
                                        />
                                    </label>
                                )}
                            </td>
                            <td>
                                <div className="flex flex-col">
                                    <span className="font-semibold text-base-content">
                                        {format(new Date(avoir.created_at || avoir.date), 'dd/MM/yyyy', { locale: fr })}
                                    </span>
                                    <span className="text-xs text-base-content/60">
                                        {format(new Date(avoir.created_at || avoir.date), 'HH:mm', { locale: fr })}
                                    </span>
                                </div>
                            </td>
                            <td>
                                <span className="font-mono text-base-content/80 font-semibold">{avoir.numero}</span>
                            </td>
                            <td>
                                <div className="font-bold">{avoir.fournisseur_name}</div>
                                <div className="text-[10px] opacity-50 uppercase tracking-tight">{getTypeAvoirLabel(avoir.type_avoir)}</div>
                            </td>
                            <td className="text-right font-bold text-primary">
                                {formatCurrency(Number(avoir.total_ht) || 0)}
                            </td>
                            <td className="text-center">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border uppercase tracking-wider ${getStatusStyle(avoir.status_display || avoir.status)}`}>
                                    {avoir.status_display || avoir.status}
                                </span>
                            </td>
                            <td className="text-right" onClick={(e) => e.stopPropagation()}>
                                {selectedIds.size === 0 && (
                                    <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                        <ActionIcon 
                                            icon={Eye}
                                            onClick={(e) => onView(avoir)}
                                            title={t('common.view', 'Voir')}
                                            variant="info"
                                        />
                                        
                                        {(avoir.status === 'BROUILLON' || avoir.status === 'BRO') && (
                                            <>
                                                <ActionIcon 
                                                    icon={Edit}
                                                    onClick={(e) => onEdit(avoir)}
                                                    title={t('common.edit', 'Modifier')}
                                                    variant="warning"
                                                />
                                                <ActionIcon 
                                                    icon={CheckCircle2}
                                                    onClick={(e) => onValidate(avoir)}
                                                    title={t('common.validate', 'Valider')}
                                                    variant="success"
                                                />
                                                <ActionIcon 
                                                    icon={Trash2}
                                                    onClick={(e) => onDelete(avoir)}
                                                    title={t('common.delete', 'Supprimer')}
                                                    variant="error"
                                                />
                                            </>
                                        )}
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
