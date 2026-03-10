import React from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, History, CheckCircle2, AlertCircle, ChevronRight, Trash2, Package } from 'lucide-react';
import type { Inventaire } from '../../types';
import { formatCurrency } from '../../utils/formatters';

interface InventaireListTableProps {
    inventaires: Inventaire[];
    loading: boolean;
    selectedIds: Set<number>;
    onSelectAll: () => void;
    onSelect: (id: number) => void;
    onEdit: (inventaire: Inventaire) => void;
    onDelete: (id: number) => void;
    deleting?: boolean;
}

export const InventaireListTable: React.FC<InventaireListTableProps> = ({
    inventaires,
    loading,
    selectedIds,
    onSelectAll,
    onSelect,
    onEdit,
    onDelete,
    deleting = false
}) => {
    const { t } = useTranslation();

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 animate-in fade-in duration-500">
                <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4"></div>
                <p className="font-medium animate-pulse">{t('common.loading')}</p>
            </div>
        );
    }

    if (inventaires.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 bg-white/50 m-4 rounded-2xl border border-dashed border-gray-200">
                <div className="bg-gray-50 p-4 rounded-full mb-4">
                    <Package className="w-10 h-10 text-gray-300" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">{t('stock.inventaire.list.empty', { defaultValue: 'Aucun inventaire trouvé' })}</h3>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto text-sm">
            <table className="w-full">
                <thead>
                    <tr className="bg-base-200 border-b border-base-300 text-left text-xs font-semibold text-base-content/60 uppercase tracking-wider">
                        <th className="px-4 py-4 w-10">
                            <input 
                                type="checkbox" 
                                className="checkbox checkbox-xs checkbox-primary" 
                                checked={inventaires.length > 0 && selectedIds.size === inventaires.length}
                                onChange={onSelectAll}
                            />
                        </th>
                        <th className="px-6 py-4 rounded-tl-2xl">
                            {selectedIds.size > 0 ? (
                                <span className="text-primary font-bold normal-case text-sm">
                                    {t('common.selection_count', { count: selectedIds.size, defaultValue: '{{count}} sélectionné(s)' })}
                                </span>
                            ) : t('stock.inventaire.list.date')}
                        </th>
                        <th className="px-6 py-4">{t('stock.inventaire.list.desc')}</th>
                        <th className="px-6 py-4 text-right">{t('stock.inventaire.list.val_theo')}</th>
                        <th className="px-6 py-4 text-right">{t('stock.inventaire.list.val_phys')}</th>
                        <th className="px-6 py-4 text-right">{t('stock.inventaire.list.ecart')}</th>
                        <th className="px-6 py-4 text-center">{t('stock.inventaire.list.status')}</th>
                        <th className="px-6 py-4 text-right rounded-tr-2xl">{t('stock.inventaire.list.actions')}</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-base-200">
                    {inventaires.map(inv => (
                        <tr 
                            key={inv.id} 
                            className={`group hover:bg-base-200/50 transition-colors cursor-pointer ${selectedIds.has(inv.id) ? 'bg-primary/5' : ''}`} 
                            onClick={() => onEdit(inv)}
                        >
                            <td className="px-4 py-4" onClick={e => e.stopPropagation()}>
                                <input 
                                    type="checkbox" 
                                    className="checkbox checkbox-xs checkbox-primary" 
                                    checked={selectedIds.has(inv.id)}
                                    onChange={() => onSelect(inv.id)}
                                />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex flex-col">
                                    <span className="font-bold text-base-content flex items-center gap-2">
                                         #{inv.id}
                                    </span>
                                    <span className="text-xs text-base-content/60 flex items-center gap-1.5 mt-0.5">
                                        <Calendar className="w-3 h-3" />
                                        {new Date(inv.date).toLocaleDateString('fr-FR')}
                                    </span>
                                </div>
                            </td>
                            <td className="px-6 py-4 max-w-xs truncate font-medium">
                                {inv.description || '-'}
                                <div className="text-[10px] text-base-content/40 mt-1 flex items-center gap-1">
                                    <History className="h-3 w-3" />
                                    Par {inv.created_by_name || '-'}
                                </div>
                            </td>
                            <td className="px-6 py-4 text-right font-bold text-base-content">
                                {formatCurrency(inv.total_valeur_theorique || 0)}
                            </td>
                            <td className="px-6 py-4 text-right font-bold text-base-content">
                                {formatCurrency(inv.total_valeur_physique || 0)}
                            </td>
                            <td className="px-6 py-4 text-right">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-lg font-mono font-bold text-sm border shadow-xs transition-all
                                    ${(inv.total_ecart_valeur || 0) < 0 ? 'bg-error/10 text-error border-error/20' : 
                                      (inv.total_ecart_valeur || 0) > 0 ? 'bg-success/10 text-success border-success/20' : 
                                      'bg-base-200 text-base-content/40 border-base-300'}`}
                                >
                                    {(inv.total_ecart_valeur || 0) > 0 ? '+' : ''}{formatCurrency(inv.total_ecart_valeur || 0)}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border gap-1.5
                                    ${inv.status === 'VALIDEE' ? 'bg-success/10 text-success border-success/20' : 'bg-warning/10 text-warning border-warning/20'}`}
                                >
                                    {inv.status === 'VALIDEE' ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                                    {inv.status}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-right" onClick={e => e.stopPropagation()}>
                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        className="p-2 text-base-content/60 hover:text-primary hover:bg-primary/10 rounded-lg transition-all" 
                                        onClick={() => onEdit(inv)}
                                        title={t('common.details')}
                                    >
                                        <ChevronRight className="h-5 w-5" />
                                    </button>
                                    <button 
                                        className="p-2 text-base-content/60 hover:text-error hover:bg-error/10 rounded-lg transition-all" 
                                        onClick={() => onDelete(inv.id)} 
                                        disabled={inv.status === 'VALIDEE' || deleting}
                                        title={t('rayons.table.delete')}
                                    >
                                        {deleting ? <span className="loading loading-spinner loading-xs"></span> : <Trash2 className="h-4 w-4" />}
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
