import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, ChevronRight, X, Search } from 'lucide-react';
import { QUERIES } from '../../../hooks/useCentreRapports';
import type { QueryDefinition } from '../../../hooks/useCentreRapports';

interface ReportSidebarProps {
    selectedQuery: QueryDefinition | null;
    onSelect: (query: QueryDefinition) => void;
    onClose?: () => void;
}

export const ReportSidebar: React.FC<ReportSidebarProps> = ({ selectedQuery, onSelect, onClose }) => {
    const { t } = useTranslation(['reports', 'common']);
    const [search, setSearch] = useState('');

    const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

    const filteredQueries = useMemo(() => {
        const q = normalize(search);
        if (!q) return QUERIES;
        return QUERIES.filter(query => {
            const name = t(`queries.${query.id}.name`, { defaultValue: query.name });
            const description = t(`queries.${query.id}.description`, { defaultValue: query.description || '' });
            return normalize(name).includes(q) || normalize(description).includes(q);
        });
    }, [search, t]);

    return (
        <div
            className={[
                // Mobile: tiroir plein hauteur
                'h-full w-80 max-w-[85vw] bg-white border-r border-slate-200 flex flex-col shrink-0 print:hidden overflow-hidden',
                // Desktop: sidebar classique
                'md:static md:translate-x-0 md:shadow-none',
            ].join(' ')}
        >
            <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-3">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    {t('queries_title', 'Rapports Disponibles')}
                </h2>
                {onClose && (
                    <button
                        type="button"
                        onClick={onClose}
                        className="md:hidden size-8 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors -mr-1"
                        aria-label={t('common:close', { defaultValue: 'Fermer' }) as string}
                    >
                        <X className="size-4" />
                    </button>
                )}
            </div>
            <div className="p-3 border-b border-slate-200">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={t('search_placeholder', { defaultValue: 'Rechercher un rapport...' }) as string}
                        className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 bg-white text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                </div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {filteredQueries.length === 0 && search && (
                    <div className="p-6 text-center text-sm text-slate-500">
                        {t('search_no_results', { defaultValue: 'Aucun rapport trouvé' })}
                    </div>
                )}
                {filteredQueries.map(query => (
                    <button
                        key={query.id}
                        onClick={() => onSelect(query)}
                        className={`w-full text-left p-4 border-b border-slate-200 transition-all group flex items-start gap-3 ${
                            selectedQuery?.id === query.id 
                                ? 'bg-emerald-50 border-l-4 border-l-emerald-600' 
                                : 'hover:bg-slate-100 border-l-4 border-l-transparent'
                        }`}
                    >
                        <div className={`p-2 rounded-lg shrink-0 ${
                            selectedQuery?.id === query.id ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400 group-hover:text-emerald-600 transition-colors'
                        }`}>
                            <FileText className="size-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className={`font-bold text-sm truncate ${selectedQuery?.id === query.id ? 'text-emerald-600' : 'text-slate-800'}`}>
                                {t(`queries.${query.id}.name`, { defaultValue: query.name })}
                            </div>
                            <div className="text-[10px] text-slate-500 font-medium line-clamp-2 mt-0.5 leading-tight">
                                {t(`queries.${query.id}.description`, { defaultValue: query.description || '' })}
                            </div>
                        </div>
                        <ChevronRight className={`size-4 mt-1 shrink-0 transition-transform ${selectedQuery?.id === query.id ? 'text-emerald-600 translate-x-1' : 'text-slate-300 opacity-0 group-hover:opacity-100'}`} />
                    </button>
                ))}
            </div>
        </div>
    );
};
