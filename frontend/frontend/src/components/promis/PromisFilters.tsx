import React from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Filter, RefreshCw } from 'lucide-react';
import type { UsePromisDataReturn } from '../../hooks/usePromisData';
import { Button } from '../shadcn/button';

interface PromisFiltersProps {
    filterStatus: UsePromisDataReturn['filterStatus'];
    setFilterStatus: UsePromisDataReturn['setFilterStatus'];
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    onRefresh: () => void;
}

export const PromisFilters: React.FC<PromisFiltersProps> = ({
    filterStatus,
    setFilterStatus,
    searchQuery,
    setSearchQuery,
    onRefresh
}) => {
    const { t } = useTranslation(['stock', 'common']);

    return (
        <div className="flex flex-col lg:flex-row gap-4 items-end">
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                        <Search className="size-3.5" />
                        {t('common:search')}
                    </label>
                    <input
                        type="text"
                        placeholder={t('common:search')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-900
                                   focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20
                                   transition-all"
                    />
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                        <Filter className="size-3.5" />
                        {t('stock:promis.status_all')}
                    </label>
                    <select
                        className={`
                            w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm
                            focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20
                            transition-all appearance-none cursor-pointer
                            ${filterStatus === 'ALL' ? 'text-slate-400' : 'text-slate-900'}
                        `}
                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center' }}
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value as UsePromisDataReturn['filterStatus'])}
                    >
                        <option value="ALL">{t('stock:promis.status_all')}</option>
                        <option value="ATT">{t('stock:promis.status_att')}</option>
                        <option value="DEL">{t('stock:promis.status_del')}</option>
                        <option value="ANN">{t('stock:promis.status_ann')}</option>
                    </select>
                </div>
            </div>

            <Button
                variant="outline"
                onClick={onRefresh}
                className="w-full lg:w-auto shrink-0"
            >
                <RefreshCw className="size-4" />
                {t('common:refresh')}
            </Button>
        </div>
    );
};
