import React from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Eye, Edit, Trash2, CheckCircle2 } from 'lucide-react';
import type { Avoir } from '../../types';
import { formatCurrency } from '../../utils/formatters';

interface AvoirsTableProps {
    avoirs: Avoir[];
    loading: boolean;
    onView: (avoir: Avoir) => void;
    onEdit: (avoir: Avoir) => void;
    onValidate: (avoir: Avoir) => void;
    onDelete: (avoir: Avoir) => void;
}

export const AvoirsTable: React.FC<AvoirsTableProps> = ({
    avoirs,
    loading,
    onView,
    onEdit,
    onValidate,
    onDelete
}) => {
    const { t } = useTranslation();

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'BRO': return 'bg-warning/10 text-warning border-warning/20';
            case 'VAL': return 'bg-success/10 text-success border-success/20';
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

    return (
        <div className="overflow-x-auto w-full">
            <table className="table table-zebra table-pin-rows w-full text-sm">
                <thead>
                    <tr className="bg-base-200/50 text-base-content/70">
                        <th className="rounded-tl-xl">{t('avoirs.table.date', 'Date')}</th>
                        <th>{t('avoirs.table.numero', 'N° Avoir')}</th>
                        <th>{t('avoirs.table.fournisseur', 'Fournisseur')}</th>
                        <th>{t('avoirs.table.type', 'Type')}</th>
                        <th className="text-right">{t('avoirs.table.montant', 'Montant')}</th>
                        <th className="text-center">{t('avoirs.table.status', 'Statut')}</th>
                        <th className="text-right rounded-tr-xl">{t('avoirs.table.actions', 'Actions')}</th>
                    </tr>
                </thead>
                <tbody className="text-base-content font-medium">
                    {avoirs.map((avoir) => (
                        <tr key={avoir.id} className="hover:bg-base-200/50 transition-colors group cursor-pointer" onClick={() => onView(avoir)}>
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
                            </td>
                            <td>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-base-200 text-base-content/70 text-xs border border-base-300">
                                    {getTypeAvoirLabel(avoir.type_avoir)}
                                </span>
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
                                <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        className="btn btn-ghost btn-sm btn-square hover:bg-info/10 hover:text-info transition-colors"
                                        onClick={(e) => { e.stopPropagation(); onView(avoir); }}
                                        title={t('common.view', 'Voir')}
                                    >
                                        <Eye className="w-4 h-4" />
                                    </button>
                                    
                                    {avoir.status === 'BROUILLON' && (
                                        <>
                                            <button 
                                                className="btn btn-ghost btn-sm btn-square hover:bg-warning/10 hover:text-warning transition-colors"
                                                onClick={(e) => { e.stopPropagation(); onEdit(avoir); }}
                                                title={t('common.edit', 'Modifier')}
                                            >
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button 
                                                className="btn btn-ghost btn-sm btn-square hover:bg-success/10 hover:text-success transition-colors"
                                                onClick={(e) => { e.stopPropagation(); onValidate(avoir); }}
                                                title={t('common.validate', 'Valider')}
                                            >
                                                <CheckCircle2 className="w-4 h-4" />
                                            </button>
                                            <button 
                                                className="btn btn-ghost btn-sm btn-square hover:bg-error/10 hover:text-error transition-colors"
                                                onClick={(e) => { e.stopPropagation(); onDelete(avoir); }}
                                                title={t('common.delete', 'Supprimer')}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
