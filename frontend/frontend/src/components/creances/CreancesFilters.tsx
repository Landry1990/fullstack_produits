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
    const { t } = useTranslation();

    return (
        <div className="flex flex-col lg:flex-row gap-6 p-6">
            {/* Main Filters Section */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Client Selector */}
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-base-content/40 flex items-center gap-1.5 ml-1">
                        <Users className="w-3 h-3" /> {t('creances.filters.client_label')}
                    </label>
                    {selectedClient ? (
                        <button 
                            onClick={() => onClientChange('')}
                            className="btn btn-sm btn-outline btn-block border-base-300 hover:bg-base-200 hover:text-base-content gap-2"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            {t('creances.filters.back_to_list')}
                        </button>
                    ) : (
                        <div className="relative group">
                            <select
                                value={selectedClient}
                                onChange={(e) => onClientChange(e.target.value)}
                                className="select select-sm select-bordered w-full pl-9 focus:ring-2 focus:ring-primary/20 transition-all"
                            >
                                <option value="">{t('creances.filters.client_placeholder')}</option>
                                {clients.map((client) => (
                                    <option key={client.id} value={client.id}>
                                        {client.name}
                                    </option>
                                ))}
                            </select>
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/30 group-focus-within:text-primary transition-colors" />
                        </div>
                    )}
                </div>

                {/* Date Ranges */}
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-base-content/40 flex items-center gap-1.5 ml-1">
                        <Calendar className="w-3 h-3" /> {t('creances.filters.start_date')}
                    </label>
                    <input
                        type="date"
                        value={dateDebut}
                        onChange={(e) => onDateDebutChange(e.target.value)}
                        className="input input-sm input-bordered w-full focus:ring-2 focus:ring-primary/20 transition-all font-mono"
                    />
                </div>

                <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-base-content/40 flex items-center gap-1.5 ml-1">
                        <Calendar className="w-3 h-3" /> {t('creances.filters.end_date')}
                    </label>
                    <input
                        type="date"
                        value={dateFin}
                        onChange={(e) => onDateFinChange(e.target.value)}
                        className="input input-sm input-bordered w-full focus:ring-2 focus:ring-primary/20 transition-all font-mono"
                    />
                </div>

                {/* Status Toggle */}
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-base-content/40 flex items-center gap-1.5 ml-1">
                        <History className="w-3 h-3" /> {t('creances.history_toggle')}
                    </label>
                    <div 
                        className={`flex items-center gap-2 p-1.5 bg-base-200 rounded-lg cursor-pointer transition-all ${showHistory ? 'ring-2 ring-primary/20' : ''}`}
                        onClick={() => onHistoryToggle(!showHistory)}
                    >
                        <div className={`flex-1 text-center py-1 rounded-md text-[10px] font-bold uppercase transition-all ${!showHistory ? 'bg-white shadow-sm text-primary' : 'text-base-content/40'}`}>
                            En cours
                        </div>
                        <div className={`flex-1 text-center py-1 rounded-md text-[10px] font-bold uppercase transition-all ${showHistory ? 'bg-white shadow-sm text-primary' : 'text-base-content/40'}`}>
                            Historique
                        </div>
                    </div>
                </div>
            </div>

            {/* Actions Section */}
            <div className="flex flex-row lg:flex-col justify-end gap-2 shrink-0 border-t lg:border-t-0 lg:border-l border-base-200 pt-4 lg:pt-0 lg:pl-6">
                <button 
                    onClick={onRefresh} 
                    className={`btn btn-sm ${loading ? 'btn-disabled' : 'btn-primary'} gap-2 shadow-sm`}
                >
                    {loading ? <span className="loading loading-spinner loading-xs"></span> : <Search className="w-4 h-4" />}
                    {t('creances.filters.search')}
                </button>
                {selectedClient && (
                    <button 
                        onClick={onPrintStatement} 
                        className="btn btn-sm btn-accent gap-2 shadow-sm"
                    >
                        <Printer className="w-4 h-4" />
                        {t('creances.print_statement')}
                    </button>
                )}
            </div>
        </div>
    );
};
