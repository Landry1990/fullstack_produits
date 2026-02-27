import React from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Check, X, Printer, MessageCircle, MoreVertical } from 'lucide-react';
import type { Promis } from '../../types';

interface PromisTableProps {
    promisList: Promis[];
    loading: boolean;
    selectedIds: Set<number>;
    onToggleSelection: (id: number) => void;
    onToggleSelectAll: () => void;
    onDeliver: (id: number) => void;
    onCancel: (id: number) => void;
    onPrint: (id: number) => void;
    onSms: (promis: Promis) => void;
}

export const PromisTable: React.FC<PromisTableProps> = ({
    promisList,
    loading,
    selectedIds,
    onToggleSelection,
    onToggleSelectAll,
    onDeliver,
    onCancel,
    onPrint,
    onSms
}) => {
    const { t } = useTranslation();

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'ATT': return 'bg-warning/10 text-warning border-warning/20';
            case 'DEL': return 'bg-success/10 text-success border-success/20';
            case 'ANN': return 'bg-error/10 text-error border-error/20';
            default: return 'bg-base-200 text-base-content/60 border-base-300';
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-base-content/60 gap-4">
                <span className="loading loading-spinner loading-md text-primary" />
                <p>Chargement des promis...</p>
            </div>
        );
    }

    if (promisList.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-base-content/60 gap-4">
                <div className="w-16 h-16 rounded-full bg-base-200 flex items-center justify-center">
                    <svg className="w-8 h-8 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                </div>
                <p>{t('promis.messages.empty', 'Aucun promis trouvé')}</p>
            </div>
        );
    }

    const attPromisCount = promisList.filter(p => p.status === 'ATT').length;
    const allSelected = attPromisCount > 0 && selectedIds.size === attPromisCount;

    return (
        <div className="overflow-x-auto w-full">
            <table className="table table-zebra table-pin-rows w-full text-sm">
                <thead>
                    <tr className="bg-base-200/50 text-base-content/70">
                        <th className="w-12 text-center rounded-tl-xl">
                            <label className="cursor-pointer label p-0 justify-center">
                                <input 
                                    type="checkbox" 
                                    className="checkbox checkbox-sm checkbox-primary" 
                                    checked={allSelected}
                                    onChange={onToggleSelectAll}
                                    disabled={attPromisCount === 0}
                                />
                            </label>
                        </th>
                        <th>{t('promis.table.date', 'Date')}</th>
                        <th>{t('promis.table.client', 'Client')}</th>
                        <th>{t('promis.table.phone', 'Téléphone')}</th>
                        <th>{t('promis.table.product', 'Produit')}</th>
                        <th className="text-center">{t('promis.table.qty', 'Qté')}</th>
                        <th className="text-center">{t('promis.table.status', 'Statut')}</th>
                        <th className="text-right rounded-tr-xl">{t('promis.table.actions', 'Actions')}</th>
                    </tr>
                </thead>
                <tbody className="text-base-content font-medium">
                    {promisList.map(p => (
                        <tr key={p.id} className={`hover:bg-base-200/50 transition-colors group ${selectedIds.has(p.id) ? 'bg-primary/5' : ''}`}>
                            <td className="text-center">
                                {p.status === 'ATT' && (
                                    <label className="cursor-pointer label p-0 justify-center">
                                        <input 
                                            type="checkbox" 
                                            className="checkbox checkbox-sm checkbox-primary" 
                                            checked={selectedIds.has(p.id)}
                                            onChange={() => onToggleSelection(p.id)}
                                        />
                                    </label>
                                )}
                            </td>
                            <td>
                                <div className="flex flex-col">
                                    <span className="font-semibold text-base-content">{format(new Date(p.date_promis), 'dd/MM/yyyy', { locale: fr })}</span>
                                    <span className="text-xs text-base-content/60">{format(new Date(p.date_promis), 'HH:mm', { locale: fr })}</span>
                                </div>
                            </td>
                            <td>
                                <div className="font-medium">{p.client_display}</div>
                            </td>
                            <td>
                                <div className="text-base-content/80 font-mono text-xs">{p.client_phone_display || '-'}</div>
                            </td>
                            <td>
                                <div className="max-w-[200px] truncate" title={p.produit_name}>
                                    <span className="font-semibold">{p.produit_name}</span>
                                </div>
                                {p.produit_cip && <div className="text-xs text-base-content/50 font-mono mt-0.5">{p.produit_cip}</div>}
                            </td>
                            <td className="text-center">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-base-200 text-base-content font-mono font-bold text-xs border border-base-300">
                                    {p.quantite}
                                </span>
                            </td>
                            <td className="text-center">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border uppercase tracking-wider ${getStatusStyle(p.status)}`}>
                                    {p.status_display}
                                </span>
                                {p.status === 'DEL' && p.date_livraison && (
                                    <div className="text-[10px] text-success mt-1 opacity-80">
                                        Livré le {format(new Date(p.date_livraison), 'dd/MM/yyyy', { locale: fr })}
                                    </div>
                                )}
                            </td>
                            <td className="text-right">
                                {p.status === 'ATT' ? (
                                    <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                        <button 
                                            className="p-1.5 text-success hover:bg-success/10 rounded-lg transition-colors"
                                            onClick={() => onDeliver(p.id)}
                                            title={t('promis.actions.deliver', 'Délivrer')}
                                        >
                                            <Check className="w-[18px] h-[18px]" />
                                        </button>
                                        <button 
                                            className="p-1.5 text-error hover:bg-error/10 rounded-lg transition-colors"
                                            onClick={() => onCancel(p.id)}
                                            title={t('promis.actions.cancel', 'Annuler')}
                                        >
                                            <X className="w-[18px] h-[18px]" />
                                        </button>
                                        
                                        <div className="dropdown dropdown-end dropdown-hover">
                                            <div tabIndex={0} role="button" className="p-1.5 text-base-content/60 hover:bg-base-200 rounded-lg transition-colors">
                                                <MoreVertical className="w-[18px] h-[18px]" />
                                            </div>
                                            <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow-lg bg-base-100 rounded-xl w-44 border border-base-200">
                                                <li>
                                                    <a onClick={() => onPrint(p.id)} className="flex items-center gap-2 hover:bg-primary/10 hover:text-primary">
                                                        <Printer className="w-4 h-4" />
                                                        Imprimer Ticket
                                                    </a>
                                                </li>
                                                {p.client_phone_display && (
                                                    <li>
                                                        <a onClick={() => onSms(p)} className="flex items-center gap-2 hover:bg-info/10 hover:text-info">
                                                            <MessageCircle className="w-4 h-4" />
                                                            Envoyer SMS
                                                        </a>
                                                    </li>
                                                )}
                                            </ul>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-end">
                                        <button 
                                            className="p-1.5 text-base-content/40 hover:text-base-content/80 hover:bg-base-200 rounded-lg transition-colors"
                                            onClick={() => onPrint(p.id)}
                                            title={t('promis.actions.print', 'Imprimer')}
                                        >
                                            <Printer className="w-[18px] h-[18px]" />
                                        </button>
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
