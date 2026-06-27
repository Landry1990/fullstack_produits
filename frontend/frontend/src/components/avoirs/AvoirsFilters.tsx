import React from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Plus, RotateCcw } from 'lucide-react';
import type { UseAvoirsDataReturn } from '../../hooks/useAvoirsData';

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
        <div className="px-4 py-3 bg-base-100 border-b border-base-200">
            <div className="flex flex-wrap gap-2 items-center justify-between">
                {/* Recherche */}
                <div className="relative w-56">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-base-content/40" />
                    <input
                        type="text"
                        placeholder={t('stock:avoirs.search_placeholder')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-9 rounded-lg border border-base-300 bg-base-200 pl-8 pr-3 text-sm font-medium text-base-content focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-base-100 transition-all"
                    />
                </div>

                {/* Filtre statut */}
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="h-9 rounded-lg border border-base-300 bg-base-200 px-3 text-sm font-semibold text-base-content focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-base-100 transition-all"
                >
                    <option value="">{t('common:all_statuses', { defaultValue: 'Tous statuts' })}</option>
                    <option value="BROUILLON">{t('stock:avoirs.statuses.brouillon', { defaultValue: 'Brouillon' })}</option>
                    <option value="VAL">{t('stock:avoirs.statuses.valide', { defaultValue: 'Validé' })}</option>
                </select>

                {/* Filtre type */}
                <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="h-9 rounded-lg border border-base-300 bg-base-200 px-3 text-sm font-semibold text-base-content focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-base-100 transition-all"
                >
                    <option value="">{t('common:all_types', { defaultValue: 'Tous types' })}</option>
                    <option value="PERIME">{t('stock:avoirs.types.perime', { defaultValue: 'Périmé' })}</option>
                    <option value="CASSE">{t('stock:avoirs.types.casse', { defaultValue: 'Cassé' })}</option>
                    <option value="ERREUR_LIVRAISON">{t('stock:avoirs.types.erreur_livraison', { defaultValue: 'Erreur livraison' })}</option>
                    <option value="AVARIE">{t('stock:avoirs.types.avarie', { defaultValue: 'Avarie' })}</option>
                    <option value="NON_FACTURE">{t('stock:avoirs.types.non_facture', { defaultValue: 'Non facturé' })}</option>
                    <option value="AUTRE">{t('stock:avoirs.types.autre', { defaultValue: 'Autre' })}</option>
                </select>

                <div className="flex items-center gap-2 ml-auto">
                    <button
                        className="h-9 w-9 flex items-center justify-center rounded-lg text-base-content/50 hover:text-primary hover:bg-primary/10 transition-colors"
                        onClick={onRefresh}
                        title={t('common:refresh')}
                    >
                        <RotateCcw className="size-4" />
                    </button>
                    <button
                        className="inline-flex items-center justify-center gap-2 h-9 px-4 bg-primary text-white rounded-lg text-sm font-bold hover:opacity-90 transition-all shadow-sm"
                        onClick={onNew}
                    >
                        <Plus className="size-4" />
                        <span className="hidden sm:inline">{t('stock:avoirs.create_btn')}</span>
                        <span className="sm:hidden">{t('common:add')}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
