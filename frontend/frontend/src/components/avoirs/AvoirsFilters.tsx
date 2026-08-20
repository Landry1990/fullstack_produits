import React from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Plus, RotateCcw } from 'lucide-react';
import type { UseAvoirsDataReturn } from '../../hooks/useAvoirsData';
import { Button } from '../shadcn/button';
import { getTypeOptions } from './utils';

interface AvoirsFiltersProps {
    searchQuery: string;
    setSearchQuery: UseAvoirsDataReturn['setListSearchQuery'];
    statusFilter: string;
    setStatusFilter: (v: string) => void;
    typeFilter: string;
    setTypeFilter: (v: string) => void;
    onRefresh: () => void;
    onNew: () => void;
}

export const AvoirsFilters: React.FC<AvoirsFiltersProps> = ({
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    typeFilter,
    setTypeFilter,
    onRefresh,
    onNew
}) => {
    const { t } = useTranslation(['stock', 'common']);

    return (
        <div className="grid grid-cols-2 md:grid-cols-12 gap-2 lg:gap-3 items-center">
            <div className="md:col-span-4">
                <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-slate-200 bg-white focus-within:ring-1 focus-within:ring-emerald-500">
                    <Search className="size-4 text-slate-400 shrink-0" />
                    <input
                        type="text"
                        placeholder={t('stock:avoirs.search_placeholder')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-full border-0 focus:outline-none focus:ring-0 p-0 text-sm bg-transparent w-full"
                    />
                </div>
            </div>

            <div className="md:col-span-3">
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className={`h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm focus:ring-1 focus:ring-emerald-500 focus:outline-none ${statusFilter === '' ? 'text-slate-400' : 'text-slate-900'}`}
                >
                    <option value="">{t('common:all_statuses', { defaultValue: 'Tous statuts' })}</option>
                    <option value="BROUILLON">{t('stock:avoirs.statuses.brouillon', { defaultValue: 'Brouillon' })}</option>
                    <option value="VAL">{t('stock:avoirs.statuses.valide', { defaultValue: 'Validé' })}</option>
                </select>
            </div>

            <div className="md:col-span-3">
                <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className={`h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm focus:ring-1 focus:ring-emerald-500 focus:outline-none ${typeFilter === '' ? 'text-slate-400' : 'text-slate-900'}`}
                >
                    <option value="">{t('common:all_types', { defaultValue: 'Tous types' })}</option>
                    {getTypeOptions().map(opt => (
                        <option key={opt.value} value={opt.value}>
                            {t(opt.labelKey, { defaultValue: opt.defaultLabel })}
                        </option>
                    ))}
                </select>
            </div>

            <div className="md:col-span-2 flex items-center justify-end gap-2">
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={onRefresh}
                    title={t('common:refresh')}
                    className="h-9 w-9 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                >
                    <RotateCcw className="size-4 text-emerald-600" />
                </Button>
                <Button
                    type="button"
                    onClick={onNew}
                    size="sm"
                    className="gap-1.5 h-9"
                >
                    <Plus className="size-4" />
                    <span className="hidden sm:inline">{t('stock:avoirs.create_btn')}</span>
                    <span className="sm:hidden">{t('common:add')}</span>
                </Button>
            </div>
        </div>
    );
};
