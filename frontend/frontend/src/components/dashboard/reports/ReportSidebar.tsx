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
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {QUERIES.map(query => (
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
