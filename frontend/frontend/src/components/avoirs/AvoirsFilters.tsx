import React from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Plus, RotateCcw } from 'lucide-react';
import type { UseAvoirsDataReturn } from '../../hooks/useAvoirsData';
import { Button } from '../shadcn/button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
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
        <div className="px-4 py-3 bg-white border-b border-slate-200">
            <div className="flex flex-wrap gap-3 items-center justify-between">
                <Input
                    type="text"
                    placeholder={t('stock:avoirs.search_placeholder')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    icon={<Search className="size-4" />}
                    size="sm"
                    containerClassName="w-full sm:w-64"
                    className="pl-10"
                />

                <Select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    size="sm"
                    className="w-full sm:w-40"
                >
                    <option value="">{t('common:all_statuses', { defaultValue: 'Tous statuts' })}</option>
                    <option value="BROUILLON">{t('stock:avoirs.statuses.brouillon', { defaultValue: 'Brouillon' })}</option>
                    <option value="VAL">{t('stock:avoirs.statuses.valide', { defaultValue: 'Validé' })}</option>
                </Select>

                <Select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    size="sm"
                    className="w-full sm:w-48"
                >
                    <option value="">{t('common:all_types', { defaultValue: 'Tous types' })}</option>
                    {getTypeOptions().map(opt => (
                        <option key={opt.value} value={opt.value}>
                            {t(opt.labelKey, { defaultValue: opt.defaultLabel })}
                        </option>
                    ))}
                </Select>

                <div className="flex items-center gap-2 ml-auto">
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={onRefresh}
                        title={t('common:refresh')}
                    >
                        <RotateCcw className="size-4" />
                    </Button>
                    <Button
                        type="button"
                        onClick={onNew}
                        size="sm"
                        className="gap-2"
                    >
                        <Plus className="size-4" />
                        <span className="hidden sm:inline">{t('stock:avoirs.create_btn')}</span>
                        <span className="sm:hidden">{t('common:add')}</span>
                    </Button>
                </div>
            </div>
        </div>
    );
};
