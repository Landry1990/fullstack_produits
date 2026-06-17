import React from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, History, CheckCircle2, AlertCircle, ChevronRight, Trash2, Package, MessageCircle } from 'lucide-react';
import type { Inventaire } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { formatDate } from '../../utils/dateUtils';

interface InventaireListTableProps {
    inventaires: Inventaire[];
    loading: boolean;
    selectedIds: Set<number>;
    onSelectAll: () => void;
    onSelect: (id: number) => void;
    onEdit: (inventaire: Inventaire) => void;
    onDelete: (id: number) => void;
    onShareWhatsApp?: (id: number) => void;
    deleting?: boolean;
    sharingId?: number | null;
}

export const InventaireListTable: React.FC<InventaireListTableProps> = ({
    inventaires,
    loading,
    selectedIds,
    onSelectAll,
    onSelect,
    onEdit,
    onDelete,
    onShareWhatsApp,
    deleting = false,
    sharingId = null
}) => {
    const { t } = useTranslation(['stock', 'common']);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 animate-in fade-in duration-500">
                <div className="size-16 border-4 border-emerald-100 border-t-emerald-500 rounded-full animate-spin mb-4"></div>
                <p className="font-medium animate-pulse">{t('common:loading')}</p>
            </div>
        );
    }

    if (inventaires.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white/50 m-4 rounded-2xl border border-dashed border-slate-200">
                <div className="bg-slate-100/50 p-4 rounded-full mb-4">
                    <Package className="size-10 text-slate-300" />
                </div>
                <h3 className="text-lg font-semibold text-slate-700 mb-1">{t('inventaire.list.empty', { defaultValue: 'Aucun inventaire trouvé' })}</h3>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto text-sm">
            <table className="w-full">
                <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        <th className="px-4 py-4 w-10">
                            <input
                                type="checkbox"
                                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                checked={inventaires.length > 0 && selectedIds.size === inventaires.length}
                                onChange={onSelectAll}
                            />
                        </th>
                        <th className="px-6 py-4 rounded-tl-2xl">
                            {selectedIds.size > 0 ? (
                                <span className="text-emerald-600 font-bold normal-case text-sm">
                                    {t('common:selection_count', { count: selectedIds.size, defaultValue: '{{count}} sélectionné(s)' })}
                                </span>
                            ) : t('inventaire.list.date')}
                        </th>
                        <th className="px-6 py-4">{t('inventaire.list.desc')}</th>
                        <th className="px-6 py-4 text-right">{t('inventaire.list.val_theo')}</th>
                        <th className="px-6 py-4 text-right">{t('inventaire.list.val_phys')}</th>
                        <th className="px-6 py-4 text-right">{t('inventaire.list.ecart')}</th>
                        <th className="px-6 py-4 text-center">{t('inventaire.list.status')}</th>
                        <th className="px-6 py-4 text-right rounded-tr-2xl">{t('inventaire.list.actions')}</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {inventaires.map(inv => (
                        <tr
                            key={inv.id}
                            className={`group hover:bg-slate-50 transition-colors cursor-pointer ${selectedIds.has(inv.id) ? 'bg-emerald-50/50' : ''}`}
                            onClick={() => onEdit(inv)}
                        >
                            <td className="px-4 py-4" onClick={e => e.stopPropagation()}>
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                    checked={selectedIds.has(inv.id)}
                                    onChange={() => onSelect(inv.id)}
                                />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex flex-col">
                                    <span className="font-bold text-slate-800 flex items-center gap-2">
                                         #{inv.id}
                                    </span>
                                    <span className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                                        <Calendar className="size-3" />
                                        {formatDate(inv.date)}
                                    </span>
                                </div>
                            </td>
                            <td className="px-6 py-4 max-w-xs truncate font-medium text-slate-700">
                                {inv.description || t('inventaire.list.no_description', '-')}
                                <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                                    <History className="h-3 w-3" />
                                    {t('inventaire.list.created_by_prefix', 'Par')} {inv.created_by_name || '-'}
                                </div>
                            </td>
                            <td className="px-6 py-4 text-right font-bold text-slate-700">
                                {formatCurrency(inv.total_valeur_theorique || 0)}
                            </td>
                            <td className="px-6 py-4 text-right font-bold text-slate-700">
                                {formatCurrency(inv.total_valeur_physique || 0)}
                            </td>
                            <td className="px-6 py-4 text-right">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-lg font-mono font-bold text-sm border shadow-sm transition-all
                                    ${(inv.total_ecart_valeur || 0) < 0 ? 'bg-red-50 text-red-500 border-red-200' :
                                      (inv.total_ecart_valeur || 0) > 0 ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                                      'bg-slate-100 text-slate-400 border-slate-200'}`}
                                >
                                    {(inv.total_ecart_valeur || 0) > 0 ? '+' : ''}{formatCurrency(inv.total_ecart_valeur || 0)}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border gap-1.5
                                    ${inv.status === 'VALIDEE' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}
                                >
                                    {inv.status === 'VALIDEE' ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                                    {inv.status === 'VALIDEE' ? t('inventaire.status.validated') : t('inventaire.status.draft')}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-right" onClick={e => e.stopPropagation()}>
                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                        onClick={() => onEdit(inv)}
                                        title={t('common:details')}
                                    >
                                        <ChevronRight className="h-5 w-5" />
                                    </button>
                                    {onShareWhatsApp && inv.status === 'VALIDEE' && (
                                        <button
                                            className="p-2 text-slate-400 hover:text-[#25D366] hover:bg-[#25D366]/10 rounded-lg transition-all"
                                            onClick={(e) => { e.stopPropagation(); onShareWhatsApp(inv.id); }}
                                            disabled={sharingId === inv.id}
                                            title="Partager sur WhatsApp"
                                        >
                                            {sharingId === inv.id
                                                ? <div className="animate-spin rounded-full size-4 border-b-2 border-[#25D366]"></div>
                                                : <MessageCircle className="h-4 w-4" />}
                                        </button>
                                    )}
                                    <button
                                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all disabled:opacity-40"
                                        onClick={() => onDelete(inv.id)}
                                        disabled={inv.status === 'VALIDEE' || deleting}
                                        title={t('common:delete')}
                                    >
                                        {deleting
                                            ? <div className="animate-spin rounded-full size-4 border-b-2 border-slate-400"></div>
                                            : <Trash2 className="h-4 w-4" />}
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

