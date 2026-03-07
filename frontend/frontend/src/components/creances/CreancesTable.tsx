import React from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, DollarSign, ArrowUpRight, ChevronRight, Hash, Calendar, Users } from 'lucide-react';
import type { Creance, Client } from '../../types';

interface CreancesTableProps {
    mode: 'clients' | 'invoices';
    groupedClients: { client: Client, total: number, paye: number, reste: number, count: number }[];
    filteredCreances: Creance[];
    loading: boolean;
    showHistory: boolean;
    selectedIds: number[];
    onSelectAll: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onSelectOne: (id: number) => void;
    onViewClient: (id: string) => void;
    onViewDetails: (creance: Creance) => void;
    onPay: (creance: Creance) => void;
    sortConfig: { key: string, direction: 'asc' | 'desc' };
    onSort: (key: any) => void;
}

export const CreancesTable: React.FC<CreancesTableProps> = ({
    mode,
    groupedClients,
    filteredCreances,
    loading,
    showHistory,
    selectedIds,
    onSelectAll,
    onSelectOne,
    onViewClient,
    onViewDetails,
    onPay,
    sortConfig,
    onSort
}) => {
    const { t } = useTranslation();

    const SortIcon = ({ column }: { column: string }) => {
        if (sortConfig.key !== column) return null;
        return <ArrowUpRight className={`w-3 h-3 transition-transform ${sortConfig.direction === 'desc' ? 'rotate-180' : ''}`} />;
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
                <span className="loading loading-spinner loading-lg text-primary"></span>
                <p className="text-sm font-medium text-base-content/40 uppercase tracking-widest animate-pulse">
                    Chargement des données...
                </p>
            </div>
        );
    }

    if (mode === 'clients') {
        if (groupedClients.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center py-20 bg-base-100 rounded-2xl border border-dashed border-base-300">
                    <div className="p-4 bg-base-200 rounded-full mb-4">
                        <Users className="w-8 h-8 text-base-content/20" />
                    </div>
                    <p className="text-base-content/50 font-medium">{t('creances.client_list.empty')}</p>
                </div>
            );
        }

        return (
            <div className="overflow-auto h-full w-full relative">
                <table className="table table-pin-rows table-zebra w-full">
                    <thead>
                        <tr className="bg-base-200 border-b border-base-300">
                            <th className="sticky top-0 z-30 bg-base-200 opacity-100 border-b border-base-300 text-[10px] font-black uppercase tracking-widest text-base-content/40">{t('creances.client_list.client')}</th>
                            <th className="sticky top-0 z-30 bg-base-200 opacity-100 border-b border-base-300 text-[10px] font-black uppercase tracking-widest text-base-content/40 text-right">{t('creances.client_list.nb_invoices')}</th>
                            <th className="sticky top-0 z-30 bg-base-200 opacity-100 border-b border-base-300 text-[10px] font-black uppercase tracking-widest text-base-content/40 text-right">{t('creances.client_list.total_amount')}</th>
                            <th className="sticky top-0 z-30 bg-base-200 opacity-100 border-b border-base-300 text-[10px] font-black uppercase tracking-widest text-base-content/40 text-right">{t('creances.client_list.already_paid')}</th>
                            <th className="sticky top-0 z-30 bg-base-200 opacity-100 border-b border-base-300 text-[10px] font-black uppercase tracking-widest text-base-content/40 text-right">{t('creances.client_list.remaining_due')}</th>
                            <th className="sticky top-0 z-30 bg-base-200 opacity-100 border-b border-base-300 text-[10px] font-black uppercase tracking-widest text-base-content/40 text-center">{t('creances.client_list.actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm">
                        {groupedClients.map((groupe) => (
                            <tr 
                                key={groupe.client.id} 
                                className="hover:bg-base-200/50 transition-colors cursor-pointer group"
                                onClick={() => onViewClient(groupe.client.id.toString())}
                            >
                                <td className="font-bold text-base py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-black text-xs uppercase shadow-sm">
                                            {groupe.client.name.substring(0, 2)}
                                        </div>
                                        {groupe.client.name}
                                    </div>
                                </td>
                                <td className="text-right font-mono text-base-content/60">{groupe.count}</td>
                                <td className="text-right font-semibold">{(Math.round(groupe.total)).toLocaleString()} F</td>
                                <td className="text-right text-success font-semibold">{(Math.round(groupe.paye)).toLocaleString()} F</td>
                                <td className="text-right">
                                    <span className="bg-warning/10 text-warning px-3 py-1 rounded-lg font-black text-base shadow-sm border border-warning/20">
                                        {(Math.round(groupe.reste)).toLocaleString()} F
                                    </span>
                                </td>
                                <td className="text-center">
                                    <button 
                                        className="btn btn-sm btn-circle btn-ghost opacity-0 group-hover:opacity-100 transition-all hover:bg-primary/10 hover:text-primary"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onViewClient(groupe.client.id.toString());
                                        }}
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    }

    // mode === 'invoices'
    if (filteredCreances.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-base-100 rounded-2xl border border-dashed border-base-300">
                <div className="p-4 bg-base-200 rounded-full mb-4">
                    <Hash className="w-8 h-8 text-base-content/20" />
                </div>
                <p className="text-base-content/50 font-medium">{t('creances.invoice_list.empty')}</p>
            </div>
        );
    }

    return (
        <div className="overflow-auto h-full w-full relative">
            <table className="table table-pin-rows table-zebra w-full">
                <thead>
                    <tr className="bg-base-200 border-b border-base-300">
                        {!showHistory && (
                            <th className="sticky top-0 z-30 bg-base-200 opacity-100 border-b border-base-300 w-12 text-center">
                                <input 
                                    type="checkbox" 
                                    className="checkbox checkbox-xs checkbox-primary" 
                                    onChange={onSelectAll}
                                    checked={filteredCreances.length > 0 && selectedIds.length === filteredCreances.filter(c => parseFloat(c.reste_a_payer) > 0).length}
                                />
                            </th>
                        )}
                        <th className="sticky top-0 z-30 bg-base-200 opacity-100 border-b border-base-300 text-[10px] font-black uppercase tracking-widest text-base-content/40 cursor-pointer hover:text-primary transition-colors" onClick={() => onSort('date')}>
                            <div className="flex items-center gap-1.5"><Calendar className="w-3 h-3" /> {t('creances.invoice_list.date')} <SortIcon column="date" /></div>
                        </th>
                        <th className="sticky top-0 z-30 bg-base-200 opacity-100 border-b border-base-300 text-[10px] font-black uppercase tracking-widest text-base-content/40 cursor-pointer hover:text-primary transition-colors" onClick={() => onSort('numero_facture')}>
                            <div className="flex items-center gap-1.5"><Hash className="w-3 h-3" /> {t('creances.invoice_list.invoice_number')} <SortIcon column="numero_facture" /></div>
                        </th>
                        <th className="sticky top-0 z-30 bg-base-200 opacity-100 border-b border-base-300 text-[10px] font-black uppercase tracking-widest text-base-content/40 cursor-pointer hover:text-primary transition-colors" onClick={() => onSort('ayant_droit')}>
                            <div className="flex items-center gap-1.5"><Users className="w-3 h-3" /> {t('creances.invoice_list.beneficiary')} <SortIcon column="ayant_droit" /></div>
                        </th>
                        <th className="sticky top-0 z-30 bg-base-200 opacity-100 border-b border-base-300 text-[10px] font-black uppercase tracking-widest text-base-content/40 text-right cursor-pointer hover:text-primary transition-colors" onClick={() => onSort('total_ttc')}>
                            <div className="flex items-center justify-end gap-1.5">{t('creances.invoice_list.total')} <SortIcon column="total_ttc" /></div>
                        </th>
                        <th className="sticky top-0 z-30 bg-base-200 opacity-100 border-b border-base-300 text-[10px] font-black uppercase tracking-widest text-base-content/40 text-right cursor-pointer hover:text-primary transition-colors" onClick={() => onSort('montant_paye')}>
                            <div className="flex items-center justify-end gap-1.5">{t('creances.invoice_list.paid')} <SortIcon column="montant_paye" /></div>
                        </th>
                        <th className="sticky top-0 z-30 bg-base-200 opacity-100 border-b border-base-300 text-[10px] font-black uppercase tracking-widest text-base-content/40 text-right cursor-pointer hover:text-primary transition-colors" onClick={() => onSort('reste_a_payer')}>
                            <div className="flex items-center justify-end gap-1.5">{t('creances.invoice_list.remaining')} <SortIcon column="reste_a_payer" /></div>
                        </th>
                        <th className="sticky top-0 z-30 bg-base-200 opacity-100 border-b border-base-300 text-[10px] font-black uppercase tracking-widest text-base-content/40 text-center">{t('creances.invoice_list.status')}</th>
                        <th className="sticky top-0 z-30 bg-base-200 opacity-100 border-b border-base-300 text-[10px] font-black uppercase tracking-widest text-base-content/40 text-center">{t('creances.invoice_list.actions')}</th>
                    </tr>
                </thead>
                <tbody className="text-sm">
                    {filteredCreances.map((creance) => {
                        const isSelected = selectedIds.includes(creance.id);
                        const remaining = parseFloat(creance.reste_a_payer);
                        const isPaid = remaining <= 0;

                        return (
                            <tr key={creance.id} className={`hover:bg-base-200/50 transition-colors group ${isSelected ? 'bg-primary/5' : ''}`}>
                                {!showHistory && (
                                    <td className="text-center">
                                        <input 
                                            type="checkbox" 
                                            className="checkbox checkbox-xs checkbox-primary" 
                                            checked={isSelected}
                                            onChange={() => onSelectOne(creance.id)}
                                            disabled={isPaid}
                                        />
                                    </td>
                                )}
                                <td className="font-mono text-base-content/60">{new Date(creance.date).toLocaleDateString('fr-FR')}</td>
                                <td className="font-bold text-primary tracking-tight">{creance.numero_facture || '-'}</td>
                                <td className="font-medium">{creance.ayant_droit_details?.nom || '-'}</td>
                                <td className="text-right font-semibold">{(Math.round(parseFloat(creance.total_ttc))).toLocaleString()} F</td>
                                <td className="text-right text-success font-semibold">{(Math.round(parseFloat(creance.montant_paye))).toLocaleString()} F</td>
                                <td className="text-right">
                                    <span className={`${isPaid ? 'opacity-30' : 'text-warning'} font-black`}>
                                        {(Math.round(remaining)).toLocaleString()} F
                                    </span>
                                </td>
                                <td className="text-center">
                                    <div className={`badge badge-sm font-bold border-none uppercase tracking-tighter ${
                                        isPaid ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'
                                    }`}>
                                        {isPaid ? 'Payée' : 'En attente'}
                                    </div>
                                </td>
                                <td>
                                    <div className="flex gap-1 justify-center">
                                        <button
                                            onClick={() => onViewDetails(creance)}
                                            className="btn btn-xs btn-circle btn-ghost hover:bg-primary/10 hover:text-primary transition-all shadow-sm group/btn"
                                            title="Voir les paiements"
                                        >
                                            <Eye className="w-3.5 h-3.5" />
                                        </button>
                                        {!isPaid && (
                                            <button
                                                onClick={() => onPay(creance)}
                                                className="btn btn-xs btn-circle btn-primary shadow-sm hover:scale-110 active:scale-95 transition-all"
                                                title="Ajouter un paiement"
                                            >
                                                <DollarSign className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};
