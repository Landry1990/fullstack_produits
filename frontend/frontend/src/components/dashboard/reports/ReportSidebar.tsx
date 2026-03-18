import React from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, ChevronRight } from 'lucide-react';
import { QUERIES } from '../../../hooks/useCentreRapports';
import type { QueryDefinition } from '../../../hooks/useCentreRapports';

interface ReportSidebarProps {
    selectedQuery: QueryDefinition | null;
    onSelect: (query: QueryDefinition) => void;
}

export const ReportSidebar: React.FC<ReportSidebarProps> = ({ selectedQuery, onSelect }) => {
    const { t } = useTranslation(['reports', 'common']);

    return (
        <div className="w-80 bg-base-100 border-r border-base-300 flex flex-col shrink-0 print:hidden overflow-hidden">
            <div className="p-4 border-b border-base-200">
                <h2 className="text-xs font-bold text-base-content/40 uppercase tracking-widest">
                    {t('queries_title', 'Rapports Disponibles')}
                </h2>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {QUERIES.map(query => (
                    <button
                        key={query.id}
                        onClick={() => onSelect(query)}
                        className={`w-full text-left p-4 border-b border-base-200 transition-all group flex items-start gap-3 ${
                            selectedQuery?.id === query.id 
                                ? 'bg-primary/5 border-l-4 border-l-primary' 
                                : 'hover:bg-base-200/50 border-l-4 border-l-transparent'
                        }`}
                    >
                        <div className={`p-2 rounded-lg shrink-0 ${
                            selectedQuery?.id === query.id ? 'bg-primary text-white' : 'bg-base-200 text-base-content/40 group-hover:text-primary transition-colors'
                        }`}>
                            <FileText className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className={`font-bold text-sm truncate ${selectedQuery?.id === query.id ? 'text-primary' : 'text-base-content'}`}>
                                {t(`queries.${query.id}.name`, { defaultValue: query.name })}
                            </div>
                            <div className="text-[10px] text-base-content/60 font-medium line-clamp-2 mt-0.5 leading-tight">
                                {t(`queries.${query.id}.description`, { defaultValue: query.description || '' })}
                            </div>
                        </div>
                        <ChevronRight className={`w-4 h-4 mt-1 shrink-0 transition-transform ${selectedQuery?.id === query.id ? 'text-primary translate-x-1' : 'text-base-content/20 opacity-0 group-hover:opacity-100'}`} />
                    </button>
                ))}
            </div>
        </div>
    );
};
