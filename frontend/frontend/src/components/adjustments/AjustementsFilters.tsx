import React from 'react';
import { Search, RotateCcw, Calendar, Filter } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
    const { t } = useTranslation(['stock', 'common']);

    const hasFilters = searchQuery || dateStart || dateEnd || filterReasonType;

    return (
        <div className="flex flex-col lg:flex-row gap-6 p-4 sm:p-6">
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Search */}
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 ml-1">
                        <Search className="size-3" /> {t('ajustements.filters.search_label')}
                    </label>
                    <div className="relative group">
                        <input
                            type="text"
                            placeholder={t('ajustements.filters.search_placeholder')}
                            value={searchQuery}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                        />
                        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-500 transition-colors" />
                    </div>
                </div>

                {/* Dates */}
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 ml-1">
                        <Calendar className="size-3" /> {t('ajustements.filters.date_start')}
                    </label>
                    <input
                        type="date"
                        value={dateStart}
                        onChange={(e) => onDateStartChange(e.target.value)}
                        className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-sm font-mono text-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    />
                </div>

                <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 ml-1">
                        <Calendar className="size-3" /> {t('ajustements.filters.date_end')}
                    </label>
                    <input
                        type="date"
                        value={dateEnd}
                        onChange={(e) => onDateEndChange(e.target.value)}
                        className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-sm font-mono text-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    />
                </div>

                {/* Motif */}
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 ml-1">
                        <Filter className="size-3" /> {t('ajustements.filters.reason_label')}
                    </label>
                    <select
                        value={filterReasonType}
                        onChange={(e) => onReasonTypeChange(e.target.value)}
                        className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    >
                        <option value="">{t('ajustements.filters.all_reasons')}</option>
                        <option value="INVENTAIRE">{t('ajustements.filters.reasons.INVENTAIRE')}</option>
                        <option value="CASSE">{t('ajustements.filters.reasons.CASSE')}</option>
                        <option value="VOL">{t('ajustements.filters.reasons.VOL')}</option>
                        <option value="CONFUSION">{t('ajustements.filters.reasons.CONFUSION')}</option>
                        <option value="ERR_ENTREE">{t('ajustements.filters.reasons.ERR_ENTREE')}</option>
                        <option value="AVARIE">{t('ajustements.filters.reasons.AVARIE')}</option>
                        <option value="USAGE_INT">{t('ajustements.filters.reasons.USAGE_INT')}</option>
                        <option value="PERIME">{t('ajustements.filters.reasons.PERIME')}</option>
                    </select>
                </div>
            </div>

            <div className="flex flex-col lg:flex-col justify-stretch gap-2 shrink-0 w-full lg:w-auto border-t lg:border-t-0 lg:border-l border-slate-100 pt-4 lg:pt-0 lg:pl-6">
                <button
                    onClick={onRefresh}
                    disabled={loading}
                    className="inline-flex items-center justify-center h-9 px-4 rounded-xl text-sm font-bold gap-2 shadow-sm w-full sm:w-auto bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 transition-colors"
                >
                    {loading ? <span className="animate-spin rounded-full size-4 border-b-2 border-white"></span> : <RotateCcw className="size-4" />}
                    {t('ajustements.filters.refresh')}
                </button>
                <button
                    onClick={onExport}
                    disabled={loading}
                    className="inline-flex items-center justify-center h-9 px-4 rounded-xl text-sm font-bold gap-2 shadow-sm w-full sm:w-auto bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-60 transition-colors"
                >
                    <Search className="size-4" />
                    {t('ajustements.filters.export')}
                </button>
                {hasFilters && (
                    <button
                        onClick={onReset}
                        className="inline-flex items-center justify-center h-9 px-4 rounded-xl text-sm font-bold gap-2 w-full sm:w-auto text-red-500 hover:bg-red-50 transition-colors"
                    >
                        <RotateCcw className="size-4" />
                        {t('ajustements.filters.reset')}
                    </button>
                )}
            </div>
        </div>
    );
};
