import React from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Filter, RefreshCw } from 'lucide-react';
import type { UsePromisDataReturn } from '../../hooks/usePromisData';
import { Input } from '../shadcn/input';
import { Select } from '../shadcn/select';
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
        <div className="p-4 bg-white border-b border-slate-100">
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="flex flex-1 gap-4 items-center w-full md:w-auto">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none z-10" />
                        <Input
                            type="text"
                            disableUppercase
                            placeholder={t('common:search')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 border-slate-200 bg-slate-50 focus-visible:ring-emerald-500/30 focus-visible:border-emerald-500"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <Filter className="size-4 text-slate-400" />
                        <Select
                            className="min-w-[140px] border-slate-200 bg-slate-50 focus-visible:ring-emerald-500/30"
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value as UsePromisDataReturn['filterStatus'])}
                        >
                            <option value="ALL">{t('stock:promis.status_all')}</option>
                            <option value="ATT">{t('stock:promis.status_att')}</option>
                            <option value="DEL">{t('stock:promis.status_del')}</option>
                            <option value="ANN">{t('stock:promis.status_ann')}</option>
                        </Select>
                    </div>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={onRefresh}
                        title={t('common:refresh')}
                        className="border-slate-200 text-slate-500 hover:text-emerald-600 hover:border-emerald-500"
                    >
                        <RefreshCw className="size-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
};
