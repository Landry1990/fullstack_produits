import React from 'react';
import { Search, RotateCcw, Calendar, Filter } from 'lucide-react';

interface AjustementsFiltersProps {
    searchQuery: string;
    onSearchChange: (value: string) => void;
    dateStart: string;
    onDateStartChange: (value: string) => void;
    dateEnd: string;
    onDateEndChange: (value: string) => void;
    filterReasonType: string;
    onReasonTypeChange: (value: string) => void;
    onReset: () => void;
    onRefresh: () => void;
    onExport: () => void;
    loading: boolean;
}

export const AjustementsFilters: React.FC<AjustementsFiltersProps> = ({
    searchQuery,
    onSearchChange,
    dateStart,
    onDateStartChange,
    dateEnd,
    onDateEndChange,
    filterReasonType,
    onReasonTypeChange,
    onReset,
    onRefresh,
    onExport,
    loading
}) => {

    const hasFilters = searchQuery || dateStart || dateEnd || filterReasonType;

    return (
        <div className="flex flex-col lg:flex-row gap-6 p-6">
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Search */}
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-base-content/40 flex items-center gap-1.5 ml-1">
                        <Search className="w-3 h-3" /> Recherche
                    </label>
                    <div className="relative group">
                        <input
                            type="text"
                            placeholder="Produit, CIP, utilisateur..."
                            value={searchQuery}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className="input input-sm input-bordered w-full pl-9 focus:ring-2 focus:ring-primary/20 transition-all"
                        />
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/30 group-focus-within:text-primary transition-colors" />
                    </div>
                </div>

                {/* Dates */}
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-base-content/40 flex items-center gap-1.5 ml-1">
                        <Calendar className="w-3 h-3" /> Date début
                    </label>
                    <input
                        type="date"
                        value={dateStart}
                        onChange={(e) => onDateStartChange(e.target.value)}
                        className="input input-sm input-bordered w-full focus:ring-2 focus:ring-primary/20 transition-all font-mono"
                    />
                </div>

                <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-base-content/40 flex items-center gap-1.5 ml-1">
                        <Calendar className="w-3 h-3" /> Date fin
                    </label>
                    <input
                        type="date"
                        value={dateEnd}
                        onChange={(e) => onDateEndChange(e.target.value)}
                        className="input input-sm input-bordered w-full focus:ring-2 focus:ring-primary/20 transition-all font-mono"
                    />
                </div>

                {/* Motif */}
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-base-content/40 flex items-center gap-1.5 ml-1">
                        <Filter className="w-3 h-3" /> Motif
                    </label>
                    <select
                        value={filterReasonType}
                        onChange={(e) => onReasonTypeChange(e.target.value)}
                        className="select select-sm select-bordered w-full focus:ring-2 focus:ring-primary/20 transition-all font-bold"
                    >
                        <option value="">Tous les motifs</option>
                        <option value="INVENTAIRE">Ajustement inventaire</option>
                        <option value="CASSE">Cassé</option>
                        <option value="VOL">Vol</option>
                        <option value="CONFUSION">Confusion</option>
                        <option value="ERR_ENTREE">Erreur d'entrée</option>
                        <option value="AVARIE">Avarié</option>
                        <option value="USAGE_INT">Usage interne</option>
                        <option value="PERIME">Périmé</option>
                    </select>
                </div>
            </div>

            <div className="flex flex-row lg:flex-col justify-end gap-2 shrink-0 border-t lg:border-t-0 lg:border-l border-base-200 pt-4 lg:pt-0 lg:pl-6">
                <button 
                    onClick={onRefresh} 
                    className={`btn btn-sm ${loading ? 'btn-disabled' : 'btn-primary'} gap-2 shadow-sm`}
                >
                    {loading ? <span className="loading loading-spinner loading-xs"></span> : <RotateCcw className="w-4 h-4" />}
                    Actualiser
                </button>
                <button 
                    onClick={onExport} 
                    className="btn btn-sm btn-success gap-2 shadow-sm"
                    disabled={loading}
                >
                    <Search className="w-4 h-4" />
                    Exporter
                </button>
                {hasFilters && (
                    <button 
                        onClick={onReset} 
                        className="btn btn-sm btn-ghost text-error gap-2"
                    >
                        <RotateCcw className="w-4 h-4" />
                        Réinitialiser
                    </button>
                )}
            </div>
        </div>
    );
};
