import React from 'react';
import { useTranslation } from 'react-i18next';
import { Search, RotateCcw, Printer, History, Users, Calendar } from 'lucide-react';
import type { Client } from '../../types';

interface CreancesFiltersProps {
    clients: Client[];
    selectedClient: string;
    onClientChange: (id: string) => void;
    dateDebut: string;
    onDateDebutChange: (date: string) => void;
    dateFin: string;
    onDateFinChange: (date: string) => void;
    showHistory: boolean;
    onHistoryToggle: (show: boolean) => void;
    onRefresh: () => void;
    onPrintStatement: () => void;
    loading: boolean;
}

export const CreancesFilters: React.FC<CreancesFiltersProps> = ({
    clients,
    selectedClient,
    onClientChange,
    dateDebut,
    onDateDebutChange,
    dateFin,
    onDateFinChange,
    showHistory,
    onHistoryToggle,
    onRefresh,
    onPrintStatement,
    loading
}) => {
    const { t } = useTranslation(['creances', 'common']);

    return (
        <div className="p-6 bg-base-100">
            <div className="flex flex-col xl:flex-row gap-6">
                {/* Main Filters Section */}
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Client Selector */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-base-content/50 flex items-center gap-2 ml-1">
                            <Users className="size-3.5" /> {t('creances:filters.client_label')}
                        </label>
                        {selectedClient ? (
                            <button 
                                onClick={() => onClientChange('')}
                                className="btn btn-sm btn-outline btn-block border-base-200 hover:bg-base-200 hover:text-base-content gap-2 rounded-xl transition-all font-bold text-xs"
                            >
                                <RotateCcw className="size-3.5" />
                                {t('creances:filters.back_to_list')}
                            </button>
                        ) : (
                            <div className="relative group">
                                <select
                                    value={selectedClient}
                                    onChange={(e) => onClientChange(e.target.value)}
                                    className="select select-sm select-bordered w-full pl-10 h-10 rounded-xl focus:ring-2 focus:ring-primary/20 transition-all border-base-200 font-bold text-xs"
                                >
                                    <option value="">{t('creances:filters.client_placeholder')}</option>
                                    {clients.map((client) => (
                                        <option key={client.id} value={client.id}>
                                            {client.name}
                                        </option>
                                    ))}
                                </select>
                                <Search className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-base-content/50 group-focus-within:text-primary transition-colors" />
                            </div>
                        )}
                    </div>

                    {/* Date Ranges */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-base-content/50 flex items-center gap-2 ml-1">
                            <Calendar className="size-3.5" /> {t('creances:filters.start_date')}
                        </label>
                        <input
                            type="date"
                            value={dateDebut}
                            onChange={(e) => onDateDebutChange(e.target.value)}
                            className="input input-sm input-bordered w-full h-10 rounded-xl focus:ring-2 focus:ring-primary/20 transition-all font-mono border-base-200 text-xs font-bold"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-base-content/50 flex items-center gap-2 ml-1">
                            <Calendar className="size-3.5" /> {t('creances:filters.end_date')}
                        </label>
                        <input
                            type="date"
                            value={dateFin}
                            onChange={(e) => onDateFinChange(e.target.value)}
                            className="input input-sm input-bordered w-full h-10 rounded-xl focus:ring-2 focus:ring-primary/20 transition-all font-mono border-base-200 text-xs font-bold"
                        />
                    </div>

                    {/* Status Toggle */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-base-content/50 flex items-center gap-2 ml-1">
                            <History className="size-3.5" /> {t('creances:history_toggle')}
                        </label>
                        <div 
                            className={`flex items-center gap-1 p-1 bg-base-200/50 rounded-xl cursor-pointer transition-all h-10 ${showHistory ? 'ring-2 ring-primary/20' : ''}`}
                            onClick={() => onHistoryToggle(!showHistory)}
                        >
                            <div className={`flex-1 text-center py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${!showHistory ? 'bg-base-100 shadow-sm text-primary' : 'text-base-content/50 hover:text-base-content/60'}`}>
                                {t('creances:invoice_list.pending_badge')}
                            </div>
                            <div className={`flex-1 text-center py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${showHistory ? 'bg-base-100 shadow-sm text-primary' : 'text-base-content/50 hover:text-base-content/60'}`}>
                                {t('creances:history_toggle')}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Actions Section */}
                <div className="flex flex-row xl:flex-col justify-end gap-3 shrink-0 pt-4 xl:pt-0 xl:pl-6 xl:border-l border-base-200">
                    <button 
                        onClick={onRefresh} 
                        className={`btn btn-sm h-10 px-6 rounded-xl ${loading ? 'btn-disabled' : 'btn-primary'} gap-2 shadow-md shadow-primary/10 transition-all hover:scale-105 active:scale-95 font-black uppercase tracking-widest text-[10px]`}
                    >
                        {loading ? <span className="loading loading-spinner loading-xs"></span> : <Search className="size-4" />}
                        {t('creances:filters.search')}
                    </button>
                    {selectedClient && (
                        <button 
                            onClick={onPrintStatement} 
                            className="btn btn-sm h-10 px-6 rounded-xl btn-accent gap-2 shadow-md shadow-accent/10 transition-all hover:scale-105 active:scale-95 font-black uppercase tracking-widest text-[10px]"
                        >
                            <Printer className="size-4" />
                            {t('creances:print_statement')}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
