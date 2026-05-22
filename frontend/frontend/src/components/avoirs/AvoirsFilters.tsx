import React from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Plus } from 'lucide-react';
import type { UseAvoirsDataReturn } from '../../hooks/useAvoirsData';

interface AvoirsFiltersProps {
    searchQuery: string;
    setSearchQuery: UseAvoirsDataReturn['setListSearchQuery'];
    onRefresh: () => void;
    onNew: () => void;
}

export const AvoirsFilters: React.FC<AvoirsFiltersProps> = ({
    searchQuery,
    setSearchQuery,
    onRefresh,
    onNew
}) => {
    const { t } = useTranslation(['stock', 'common']);

    return (
        <div className="p-4 bg-base-100 border-b border-base-200">
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="flex flex-1 gap-4 items-center w-full md:w-auto">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-base-content/50" />
                        <input
                            type="text"
                            placeholder={t('stock:avoirs.search_placeholder')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full rounded-lg border border-base-300 bg-base-100 pl-9 text-sm font-medium text-base-content focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all bg-base-200 focus:bg-base-100 transition-colors"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                    <button 
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-base-content/70 hover:bg-base-200 rounded-lg text-sm font-medium transition-colors btn-square btn-ghost text-base-content/60 hover:text-primary hover:bg-primary/10 transition-colors"
                        onClick={onRefresh}
                        title={t('common:refresh')}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                    </button>
                    <button 
                        className="inline-flex items-center justify-center gap-2 h-9 px-4 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary-focus hover:shadow-md transition-all shadow-sm"
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
