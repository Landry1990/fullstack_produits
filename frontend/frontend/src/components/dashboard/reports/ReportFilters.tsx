import React from 'react';
import { useTranslation } from 'react-i18next';
import DatePicker, { registerLocale } from 'react-datepicker';
import { fr } from 'date-fns/locale';
import 'react-datepicker/dist/react-datepicker.css';
import type { QueryDefinition, Client } from '../../../hooks/useCentreRapports';
import { Search, User } from 'lucide-react';

registerLocale('fr', fr);

interface ReportFiltersProps {
    selectedQuery: QueryDefinition;
    params: Record<string, any>;
    onParamsChange: (params: Record<string, any>) => void;
    safeDate: (dateStr: any) => Date | null;
    clientSearch: {
        query: string;
        filtered: Client[];
        showDropdown: boolean;
        selectedName: string;
    };
    clientActions: {
        setQuery: (q: string) => void;
        setShowDropdown: (show: boolean) => void;
        setSelectedName: (name: string) => void;
    };
}

export const ReportFilters: React.FC<ReportFiltersProps> = ({
    selectedQuery,
    params,
    onParamsChange,
    safeDate,
    clientSearch,
    clientActions
}) => {
    const { t } = useTranslation();

    if (selectedQuery.params.length === 0) return null;

    const setParam = (key: string, value: any) => {
        onParamsChange({ ...params, [key]: value });
    };

    return (
        <div className="flex flex-wrap gap-6 items-end">
            {selectedQuery.params.map(param => (
                <div key={param.key} className="form-control min-w-[200px]">
                    <label className="label py-1">
                        <span className="label-text text-[10px] font-bold uppercase tracking-widest text-base-content/50">
                            {t(`reports.params.${param.key}`, { defaultValue: param.label })}
                            {param.required && <span className="text-error ml-1">*</span>}
                        </span>
                    </label>

                        {param.type === 'month' && (
                            <DatePicker
                                selected={safeDate(params[param.key] ? params[param.key] + '-01' : null)}
                                onChange={(date: Date | null) => {
                                    if (date) {
                                        const formatted = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                                        setParam(param.key, formatted);
                                    }
                                }}
                                dateFormat="MM/yyyy"
                                showMonthYearPicker
                                locale="fr"
                                className="input input-bordered input-md w-full rounded-xl font-bold bg-base-200/50"
                            />
                        )}

                        {param.type === 'date' && (
                            <DatePicker
                                selected={safeDate(params[param.key])}
                                onChange={(date: Date | null) => {
                                    if (date) {
                                        const formatted = date.toISOString().slice(0, 10);
                                        setParam(param.key, formatted);
                                    }
                                }}
                                dateFormat="dd/MM/yyyy"
                                locale="fr"
                                className="input input-bordered input-md w-full rounded-xl font-bold bg-base-200/50"
                            />
                        )}

                        {param.type === 'datetime' && (
                            <DatePicker
                                selected={safeDate(params[param.key])}
                                onChange={(date: Date | null) => {
                                    if (date) {
                                        const year = date.getFullYear();
                                        const month = String(date.getMonth() + 1).padStart(2, '0');
                                        const day = String(date.getDate()).padStart(2, '0');
                                        const hours = String(date.getHours()).padStart(2, '0');
                                        const minutes = String(date.getMinutes()).padStart(2, '0');
                                        const formatted = `${year}-${month}-${day}T${hours}:${minutes}`;
                                        setParam(param.key, formatted);
                                    }
                                }}
                                showTimeSelect
                                timeFormat="HH:mm"
                                timeIntervals={15}
                                dateFormat="dd/MM/yyyy HH:mm"
                                locale="fr"
                                className="input input-bordered input-md w-full rounded-xl font-bold bg-base-200/50"
                            />
                        )}

                        {param.type === 'number' && (
                            <input
                                type="number"
                                value={params[param.key] !== undefined && params[param.key] !== null ? params[param.key] : ''}
                                onChange={e => setParam(param.key, e.target.value === '' ? '' : Number(e.target.value))}
                                className="input input-bordered input-md w-full rounded-xl font-bold bg-base-200/50"
                            />
                        )}

                        {param.type === 'text' && (
                            <input
                                type="text"
                                value={params[param.key] || ''}
                                onChange={e => setParam(param.key, e.target.value)}
                                className="input input-bordered input-md w-full rounded-xl font-bold bg-base-200/50"
                            />
                        )}

                        {param.type === 'client_id' && (
                            <div className="relative group">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/30 group-focus-within:text-primary transition-colors">
                                    <Search className="w-4 h-4" />
                                </div>
                                <input
                                    type="text"
                                    value={clientSearch.query || clientSearch.selectedName}
                                    onChange={e => {
                                        clientActions.setQuery(e.target.value);
                                        clientActions.setSelectedName('');
                                        setParam(param.key, '');
                                    }}
                                    onFocus={() => clientSearch.query.length > 0 && clientActions.setShowDropdown(true)}
                                    placeholder={t('reports.client_search_placeholder', 'Rechercher un client...')}
                                    className="input input-bordered input-md w-full pl-10 rounded-xl font-bold bg-base-200/50"
                                />
                                {clientSearch.showDropdown && clientSearch.filtered.length > 0 && (
                                    <ul className="absolute z-50 w-full bg-base-100 shadow-xl rounded-2xl mt-2 max-h-60 overflow-auto border border-base-200 py-2 animate-in fade-in zoom-in duration-200">
                                        {clientSearch.filtered.map(client => (
                                            <li key={client.id}>
                                                <button
                                                    type="button"
                                                    className="w-full text-left px-4 py-3 hover:bg-base-200 transition-colors flex items-center gap-3"
                                                    onClick={() => {
                                                        setParam(param.key, client.id);
                                                        clientActions.setSelectedName(client.name);
                                                        clientActions.setQuery('');
                                                        clientActions.setShowDropdown(false);
                                                    }}
                                                >
                                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                                        <User className="w-4 h-4" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="font-bold text-sm">{client.name}</div>
                                                        {client.phone && <div className="text-[10px] text-base-content/40 font-bold">{client.phone}</div>}
                                                    </div>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}

                        {param.type === 'select' && param.options && (
                            <select
                                value={params[param.key] || ''}
                                onChange={e => setParam(param.key, e.target.value)}
                                className="select select-bordered select-md w-full rounded-xl font-bold bg-base-200/50"
                            >
                                {param.options.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        )}
                </div>
            ))}
        </div>
    );
};
