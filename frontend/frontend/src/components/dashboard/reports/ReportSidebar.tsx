import React from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, ChevronRight, X } from 'lucide-react';
import { QUERIES } from '../../../hooks/useCentreRapports';
import type { QueryDefinition } from '../../../hooks/useCentreRapports';

interface ReportSidebarProps {
    selectedQuery: QueryDefinition | null;
    onSelect: (query: QueryDefinition) => void;
    onClose?: () => void;
}

export const ReportSidebar: React.FC<ReportSidebarProps> = ({ selectedQuery, onSelect, onClose }) => {
    const { t } = useTranslation(['reports', 'common']);

    return (
        <div
            className={[
                // Mobile: tiroir plein hauteur
                'h-full w-80 max-w-[85vw] bg-base-100 border-r border-base-300 flex flex-col shrink-0 print:hidden overflow-hidden',
                // Desktop: sidebar classique
                'md:static md:translate-x-0 md:shadow-none',
            ].join(' ')}
        >
            <div className="p-4 border-b border-base-200 flex items-center justify-between gap-3">
                <h2 className="text-xs font-bold text-base-content/40 uppercase tracking-widest">
                    {t('queries_title', 'Rapports Disponibles')}
                </h2>
                {onClose && (
                    <button
                        type="button"
                        onClick={onClose}
                        className="md:hidden btn btn-ghost btn-sm btn-circle -mr-1"
                        aria-label={t('common:close', { defaultValue: 'Fermer' }) as string}
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
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
