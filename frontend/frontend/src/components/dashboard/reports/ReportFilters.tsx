import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import DatePicker, { registerLocale } from 'react-datepicker';
import { fr } from 'date-fns/locale';
import 'react-datepicker/dist/react-datepicker.css';
import type { QueryDefinition, Client, Supplier, User, Famille } from '../../../hooks/useCentreRapports';
import { Search, User as UserIcon, Truck, Users, Tag, Save, History, Trash2, LayoutPanelTop, Filter, Plus, X } from 'lucide-react';
import { Button } from '../../ui/Button';
import { Input } from '../../shadcn/input';
import { Select } from '../../ui/Select';
import { Checkbox } from '../../shadcn/checkbox';
import { Badge } from '../../shadcn/badge';
import { logger } from '../../../utils/logger'

registerLocale('fr', fr);

interface Preset {
    id: string;
    queryId: string;
    name: string;
    params?: Record<string, unknown>;
}

interface Condition {
    field: string;
    operator: string;
    value: string;
}

interface ReportFiltersProps {
    selectedQuery: QueryDefinition;
    params: Record<string, unknown>;
    onParamsChange: (params: Record<string, unknown>) => void;
    safeDate: (dateStr: unknown) => Date | null;
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
    supplierSearch: {
        query: string;
        filtered: Supplier[];
        showDropdown: boolean;
        selectedName: string;
    };
    supplierActions: {
        setQuery: (q: string) => void;
        setShowDropdown: (show: boolean) => void;
        setSelectedName: (name: string) => void;
    };
    userSearch: {
        query: string;
        filtered: User[];
        showDropdown: boolean;
        selectedName: string;
    };
    userActions: {
        setQuery: (q: string) => void;
        setShowDropdown: (show: boolean) => void;
        setSelectedName: (name: string) => void;
    };
    familleSearch: {
        query: string;
        filtered: Famille[];
        showDropdown: boolean;
        selectedName: string;
    };
    familleActions: {
        setQuery: (q: string) => void;
        setShowDropdown: (show: boolean) => void;
        setSelectedName: (name: string) => void;
    };
    presets: {
        save: (name: string) => void;
        delete: (id: string) => void;
        apply: (preset: unknown) => void;
    };
    presetList: Record<string, unknown>[];
}

export const ReportFilters: React.FC<ReportFiltersProps> = ({
    selectedQuery,
    params,
    onParamsChange,
    safeDate,
    clientSearch,
    clientActions,
    supplierSearch,
    supplierActions,
    userSearch,
    userActions,
    familleSearch,
    familleActions,
    presets,
    presetList
}) => {
    const { t } = useTranslation(['reports', 'common', 'products']);
    const [conditionsOpen, setConditionsOpen] = useState(false);
    const [fieldsOpen, setFieldsOpen] = useState(false);
    const conditionsRef = useRef<HTMLDivElement>(null);
    const fieldsRef = useRef<HTMLDivElement>(null);
    const vendeurRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (conditionsRef.current && !conditionsRef.current.contains(e.target as Node)) setConditionsOpen(false);
            if (fieldsRef.current && !fieldsRef.current.contains(e.target as Node)) setFieldsOpen(false);
            if (vendeurRef.current && !vendeurRef.current.contains(e.target as Node)) userActions.setShowDropdown(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (selectedQuery.params.length === 0) return null;

    const setParam = (key: string, value: unknown) => {
        onParamsChange({ ...params, [key]: value });
    };

    const getSafeConditions = (): Condition[] => {
        try {
            const conds = params.conditions;
            if (!conds) return [];
            return typeof conds === 'string' ? JSON.parse(conds) : conds as Condition[];
        } catch (e) {
            logger.error(t('reports.err_parse_conditions', { defaultValue: 'Erreur de parsing des conditions:' }), e);
            return [];
        }
    };

    const currentConditions = getSafeConditions();

    const sourceForParams = params.source || 'ventes';
    const filteredParams = selectedQuery.params.filter(param => {
                if (param.key === 'source') return true;
                if (sourceForParams === 'ventes') return !['fournisseur_id'].includes(param.key);
                if (sourceForParams === 'achats') return !['vendeur_id', 'client_id'].includes(param.key);
                if (sourceForParams === 'stock') return !['vendeur_id', 'client_id'].includes(param.key);
                if (sourceForParams === 'produits') return !['date_debut', 'date_fin', 'vendeur_id', 'client_id', 'fournisseur_id'].includes(param.key);
                return true;
            });

    return (
        <div className="flex flex-col gap-6">
            {/* Presets Toolbar */}
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 pb-4">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-300">
                    <History className="size-3" />
                    {t('reports.my_configs', { defaultValue: 'Mes Configurations :' })}
                </div>
                {presetList.flatMap(p => {
                    const preset = p as unknown as Preset;
                    return preset.queryId === selectedQuery.id ? [(
                    <div key={preset.id} className="group flex items-center gap-1">
                        <Button
                            variant="ghost" size="sm"
                            onClick={() => presets.apply(preset)}
                            className="rounded-full bg-slate-100 hover:bg-indigo-600 hover:text-white border-none transition-all px-3"
                        >
                            {preset.name}
                        </Button>
                        <button
                            onClick={() => presets.delete(preset.id)}
                            className="size-7 p-0 rounded-full opacity-0 group-hover:opacity-100 text-red-600 hover:bg-red-50 transition-all flex items-center justify-center"
                        >
                            <Trash2 className="size-3" />
                        </button>
                    </div>
                )] : [];
                })}
                <Button 
                    variant="outline" size="sm"
                    onClick={() => {
                        const name = prompt(t('reports.preset_prompt_name', { defaultValue: 'Nom de cette configuration ?' }));
                        if (name) presets.save(name);
                    }}
                    className="rounded-full gap-2"
                >
                    <Save className="size-3" />
                    {t('reports.preset_save_btn', { defaultValue: 'Sauvegarder' })}
                </Button>
            </div>

            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-4 sm:gap-6 sm:items-end w-full">
            {filteredParams.map(param => (
                <div key={param.key} className="w-full sm:w-auto sm:min-w-[200px] min-w-0">
                    <label className="block py-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            {t(`params.${param.key}`, { defaultValue: param.label })}
                            {param.required && <span className="text-red-600 ml-1">*</span>}
                        </span>
                    </label>

                        {param.type === 'month' && (
                            <DatePicker
                                selected={safeDate(params[param.key] ? (params[param.key] as string) + '-01' : null)}
                                onChange={(date: Date | null) => {
                                    if (date) {
                                        const formatted = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                                        setParam(param.key, formatted);
                                    }
                                }}
                                dateFormat="MM/yyyy"
                                showMonthYearPicker
                                locale="fr"
                                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 font-bold h-10 px-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
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
                                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 font-bold h-10 px-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
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
                                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 font-bold h-10 px-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                            />
                        )}

                        {param.type === 'number' && (
                            <Input
                                type="number"
                                value={params[param.key] !== undefined && params[param.key] !== null ? (params[param.key] as string | number) : ''}
                                onChange={e => setParam(param.key, e.target.value === '' ? '' : Number(e.target.value))}
                                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 font-bold h-10 px-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                            />
                        )}

                        {param.type === 'text' && (
                            <Input
                                type="text"
                                value={(params[param.key] as string) || ''}
                                onChange={e => setParam(param.key, e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 font-bold h-10 px-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                            />
                        )}

                        {param.type === 'client_id' && (
                            <div className="relative group">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors">
                                    <Search className="size-4" />
                                </div>
                                <Input
                                    type="text"
                                    value={clientSearch.query || clientSearch.selectedName}
                                    onChange={e => {
                                        clientActions.setQuery(e.target.value);
                                        clientActions.setSelectedName('');
                                        setParam(param.key, '');
                                    }}
                                    onFocus={() => clientSearch.query.length > 0 && clientActions.setShowDropdown(true)}
                                    placeholder={t('params.client_id', 'Rechercher un client...')}
                                    className="w-full pl-10 rounded-lg border border-slate-200 bg-slate-50/50 font-bold h-10 px-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                />
                                {clientSearch.showDropdown && clientSearch.filtered.length > 0 && (
                                    <ul className="absolute z-50 w-full bg-white shadow-xl rounded-2xl mt-2 max-h-60 overflow-auto border border-slate-200 py-2 animate-in fade-in zoom-in duration-200">
                                        {clientSearch.filtered.map(client => (
                                            <li key={client.id}>
                                                <button
                                                    type="button"
                                                    className="w-full text-left px-4 py-3 hover:bg-slate-100 transition-colors flex items-center gap-3"
                                                    onClick={() => {
                                                        setParam(param.key, client.id);
                                                        clientActions.setSelectedName(client.name);
                                                        clientActions.setQuery('');
                                                        clientActions.setShowDropdown(false);
                                                    }}
                                                >
                                                    <div className="size-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                                                        <UserIcon className="size-4" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="font-bold text-sm">{client.name}</div>
                                                        {client.phone && <div className="text-[10px] text-slate-300 font-bold">{client.phone}</div>}
                                                    </div>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}

                        {param.type === 'fournisseur_id' && (
                            <div className="relative group">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors">
                                    <Search className="size-4" />
                                </div>
                                <Input
                                    type="text"
                                    value={supplierSearch.query || supplierSearch.selectedName}
                                    onChange={e => {
                                        supplierActions.setQuery(e.target.value);
                                        supplierActions.setSelectedName('');
                                        setParam(param.key, '');
                                    }}
                                    onFocus={() => supplierSearch.query.length > 0 && supplierActions.setShowDropdown(true)}
                                    placeholder={t('params.fournisseur_id', 'Rechercher un fournisseur...')}
                                    className="w-full pl-10 rounded-lg border border-slate-200 bg-slate-50/50 font-bold h-10 px-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                />
                                {supplierSearch.showDropdown && supplierSearch.filtered.length > 0 && (
                                    <ul className="absolute z-50 w-full bg-white shadow-xl rounded-2xl mt-2 max-h-60 overflow-auto border border-slate-200 py-2 animate-in fade-in zoom-in duration-200">
                                        {supplierSearch.filtered.map(supplier => (
                                            <li key={supplier.id}>
                                                <button
                                                    type="button"
                                                    className="w-full text-left px-4 py-3 hover:bg-slate-100 transition-colors flex items-center gap-3"
                                                    onClick={() => {
                                                        setParam(param.key, supplier.id);
                                                        supplierActions.setSelectedName(supplier.name);
                                                        supplierActions.setQuery('');
                                                        supplierActions.setShowDropdown(false);
                                                    }}
                                                >
                                                    <div className="size-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                                                        <Truck className="size-4" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="font-bold text-sm">{supplier.name}</div>
                                                    </div>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}

                        {param.type === 'vendeur_id' && (
                            <div ref={vendeurRef} className="relative group">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors pointer-events-none">
                                    <Users className="size-4" />
                                </div>
                                <Input
                                    type="text"
                                    value={userSearch.query || userSearch.selectedName}
                                    onChange={e => {
                                        userActions.setQuery(e.target.value);
                                        userActions.setSelectedName('');
                                        setParam(param.key, '');
                                    }}
                                    onFocus={() => userActions.setShowDropdown(true)}
                                    placeholder={t('params.vendeur_id', 'Tous les vendeurs...')}
                                    className="w-full pl-10 rounded-lg border border-slate-200 bg-slate-50/50 font-bold h-10 px-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                />
                                {userSearch.showDropdown && (
                                    <ul className="absolute z-50 w-full bg-white shadow-xl rounded-2xl mt-2 max-h-60 overflow-auto border border-slate-200 py-2 animate-in fade-in zoom-in duration-200">
                                        <li>
                                            <button
                                                type="button"
                                                className="w-full text-left px-4 py-3 hover:bg-slate-100 transition-colors flex items-center gap-3"
                                                onClick={() => {
                                                    setParam(param.key, '');
                                                    userActions.setSelectedName('');
                                                    userActions.setQuery('');
                                                    userActions.setShowDropdown(false);
                                                }}
                                            >
                                                <div className="size-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                                    <Users className="size-4" />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="font-bold text-sm text-slate-600">{t('params.all_vendors', 'Tous les vendeurs')}</div>
                                                </div>
                                            </button>
                                        </li>
                                        {(userSearch.query.length > 0 ? userSearch.filtered : []).map(user => (
                                            <li key={user.id}>
                                                <button
                                                    type="button"
                                                    className="w-full text-left px-4 py-3 hover:bg-slate-100 transition-colors flex items-center gap-3"
                                                    onClick={() => {
                                                        setParam(param.key, user.id);
                                                        userActions.setSelectedName(user.username);
                                                        userActions.setQuery('');
                                                        userActions.setShowDropdown(false);
                                                    }}
                                                >
                                                    <div className="size-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                                                        <Users className="size-4" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="font-bold text-sm">{user.username}</div>
                                                    </div>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}

                        {param.type === 'famille_id' && (
                            <div className="relative group">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors">
                                    <Search className="size-4" />
                                </div>
                                <Input
                                    type="text"
                                    value={familleSearch.query || familleSearch.selectedName}
                                    onChange={e => {
                                        familleActions.setQuery(e.target.value);
                                        familleActions.setSelectedName('');
                                        setParam(param.key, '');
                                    }}
                                    onFocus={() => familleSearch.query.length > 0 && familleActions.setShowDropdown(true)}
                                    placeholder={t('params.famille_id', 'Rechercher une famille...')}
                                    className="w-full pl-10 rounded-lg border border-slate-200 bg-slate-50/50 font-bold h-10 px-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                />
                                {familleSearch.showDropdown && familleSearch.filtered.length > 0 && (
                                    <ul className="absolute z-50 w-full bg-white shadow-xl rounded-2xl mt-2 max-h-60 overflow-auto border border-slate-200 py-2 animate-in fade-in zoom-in duration-200">
                                        {familleSearch.filtered.map(famille => (
                                            <li key={famille.id}>
                                                <button
                                                    type="button"
                                                    className="w-full text-left px-4 py-3 hover:bg-slate-100 transition-colors flex items-center gap-3"
                                                    onClick={() => {
                                                        setParam(param.key, famille.id);
                                                        familleActions.setSelectedName(famille.nom);
                                                        familleActions.setQuery('');
                                                        familleActions.setShowDropdown(false);
                                                    }}
                                                >
                                                    <div className="size-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-600">
                                                        <Tag className="size-4" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="font-bold text-sm">{famille.nom}</div>
                                                    </div>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}

                        {param.type === 'select' && param.options && (
                            <Select
                                value={(params[param.key] as string) || ''}
                                onChange={e => setParam(param.key, e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 font-bold h-10 px-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                            >
                                {param.options.map(opt => (
                                    <option key={opt.value} value={opt.value}>
                                        {t(`reports.query_options.${selectedQuery.id}.${param.key}.${opt.value}`, { defaultValue: opt.label })}
                                    </option>
                                ))}
                            </Select>
                        )}

                        {param.type === 'checkbox' && (
                            <div className="flex items-center gap-3 bg-slate-50/50 px-4 h-12 rounded-lg border border-slate-200">
                                <Checkbox
                                    checked={!!params[param.key]}
                                    onCheckedChange={(checked) => setParam(param.key, !!checked)}
                                />
                                <span className="text-xs font-bold uppercase tracking-tight text-slate-500">
                                    {t(`params.${param.key}_active`, { defaultValue: t('common:active', { defaultValue: 'Activé' }) })}
                                </span>
                            </div>
                        )}

                        {param.type === 'fields_selector' && param.options && (
                            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                                {/* Condition Builder */}
                                <div ref={conditionsRef} className="relative">
                                    <button type="button" onClick={() => setConditionsOpen(v => !v)} className="inline-flex items-center gap-2 h-12 px-6 rounded-xl border border-slate-200 hover:bg-slate-100 hover:border-slate-300 text-slate-500 cursor-pointer text-sm font-medium transition-all">
                                        <Filter className="size-4 text-indigo-600" />
                                        <span>{t('dynamic_constructor.conditions_title')}</span>
                                        {currentConditions.length > 0 && (
                                            <Badge variant="secondary" className="ml-1">{currentConditions.length}</Badge>
                                        )}
                                    </button>
                                    {conditionsOpen && (
                                    <div className="absolute z-[100] left-0 top-full p-6 shadow-2xl bg-white rounded-3xl border border-slate-200 w-[min(90vw,580px)] mt-2 animate-in slide-in-from-top-2 duration-300">
                                        <div className="flex items-center justify-between mb-6">
                                            <div className="text-xs font-black uppercase tracking-widest text-slate-300 flex items-center gap-2">
                                                <Filter className="size-3" />
                                                {t('dynamic_constructor.conditions_title')}
                                            </div>
                                            
                                            {/* Global Logic Toggle (AND/OR) */}
                                            <div className="flex items-center bg-slate-100 rounded-xl p-1 gap-1">
                                                <Button 
                                                    variant="ghost" size="sm"
                                                    className={`rounded-lg px-3 transition-all ${(!params.logic || params.logic === 'AND') ? 'bg-indigo-600 text-white' : ''}`}
                                                    onClick={() => setParam('logic', 'AND')}
                                                >
                                                    {t('dynamic_constructor.logic_and')}
                                                </Button>
                                                <Button 
                                                    variant="ghost" size="sm"
                                                    className={`rounded-lg px-3 transition-all ${params.logic === 'OR' ? 'bg-slate-700 text-white' : ''}`}
                                                    onClick={() => setParam('logic', 'OR')}
                                                >
                                                    {t('dynamic_constructor.logic_or')}
                                                </Button>
                                            </div>

                                            <button 
                                                className="text-xs font-medium text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors"
                                                onClick={() => setParam('conditions', '[]')}
                                            >
                                                {t('dynamic_constructor.reset_conditions')}
                                            </button>
                                        </div>

                                        <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                                            {currentConditions.map((cond: Condition, idx: number) => {
                                                const showValueInput = !['isnull', 'notnull'].includes(cond.operator);
                                                
                                                return (
                                                    <div key={`cond-${cond.field}-${cond.operator}`} className="flex flex-wrap items-center gap-2 p-3 bg-slate-50/50 rounded-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
                                                        <Select 
                                                            className="rounded-lg flex-1 min-w-[140px] font-bold text-[11px] uppercase bg-white h-8 px-2 text-xs border border-slate-200"
                                                            value={cond.field}
                                                            onChange={(e) => {
                                                                const newConds = [...currentConditions];
                                                                newConds[idx] = { ...newConds[idx], field: e.target.value };
                                                                setParam('conditions', JSON.stringify(newConds));
                                                            }}
                                                        >
                                                            <option value="">{t('dynamic_constructor.field_placeholder')}</option>
                                                            <option value="quantite">{t('dynamic_constructor.fields.quantite')}</option>
                                                            <option value="total_ht">{t('dynamic_constructor.fields.total_ht')}</option>
                                                            <option value="prix_vente">{t('dynamic_constructor.fields.prix_vente')}</option>
                                                            <option value="cout_achat">{t('dynamic_constructor.fields.cout_achat')}</option>
                                                            <option value="pourcentage_marge">{t('dynamic_constructor.fields.pourcentage_marge')}</option>
                                                            <option value="tva">{t('dynamic_constructor.fields.tva')}</option>
                                                            <option value="cip">{t('dynamic_constructor.fields.cip')}</option>
                                                            <option value="stock_minimum">{t('dynamic_constructor.fields.stock_minimum')}</option>
                                                        </Select>

                                                        <Select 
                                                            className="rounded-lg w-32 font-bold text-[11px] bg-white h-8 px-2 text-xs border border-slate-200"
                                                            value={cond.operator}
                                                            onChange={(e) => {
                                                                const newConds = [...currentConditions];
                                                                newConds[idx] = { ...newConds[idx], operator: e.target.value };
                                                                setParam('conditions', JSON.stringify(newConds));
                                                            }}
                                                        >
                                                            <option value="gte">≥</option>
                                                            <option value="lte">≤</option>
                                                            <option value="gt">&gt;</option>
                                                            <option value="lt">&lt;</option>
                                                            <option value="eq">=</option>
                                                            <option value="isnull">{t('dynamic_constructor.operators.isnull')}</option>
                                                            <option value="notnull">{t('dynamic_constructor.operators.notnull')}</option>
                                                        </Select>

                                                        {showValueInput ? (
                                                            <Input 
                                                                type="text"
                                                                className="rounded-lg w-24 font-bold text-[11px] bg-white h-8 px-2 text-xs border border-slate-200"
                                                                placeholder={t('dynamic_constructor.value_placeholder')}
                                                                value={cond.value}
                                                                onChange={(e) => {
                                                                    const newConds = [...currentConditions];
                                                                    newConds[idx] = { ...newConds[idx], value: e.target.value };
                                                                    setParam('conditions', JSON.stringify(newConds));
                                                                }}
                                                            />
                                                        ) : (
                                                            <div className="w-24 px-2 py-1 bg-slate-200/50 rounded-lg text-[10px] font-black uppercase text-center text-slate-300 border border-slate-200 border-dashed">
                                                                {t('dynamic_constructor.no_value')}
                                                            </div>
                                                        )}

                                                        <button 
                                                            className="size-7 p-0 rounded-full text-red-600 hover:bg-red-50 ml-auto flex items-center justify-center transition-colors"
                                                            onClick={() => {
                                                                const newConds = currentConditions.filter((_: Condition, i: number) => i !== idx);
                                                                setParam('conditions', JSON.stringify(newConds));
                                                            }}
                                                        >
                                                            <X className="size-4" />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <Button 
                                            className="w-full rounded-xl gap-2 mt-6 h-10 shadow-lg shadow-indigo-500/20"
                                            onClick={() => {
                                                const newConds = [...currentConditions, { field: '', operator: 'gte', value: '' }];
                                                setParam('conditions', JSON.stringify(newConds));
                                            }}
                                        >
                                            <Plus className="size-4" />
                                            {t('dynamic_constructor.add_condition')}
                                        </Button>
                                    </div>
                                    )}
                                </div>

                                {/* Fields Selector Dropdown */}
                                <div ref={fieldsRef} className="relative">
                                    <button type="button" onClick={() => setFieldsOpen(v => !v)} className="inline-flex items-center gap-2 h-12 px-6 rounded-xl border border-slate-200 hover:bg-slate-100 hover:border-slate-300 text-slate-500 cursor-pointer text-sm font-medium transition-all">
                                        <LayoutPanelTop className="size-4" />
                                        <span>{t('dynamic_constructor.select_columns')}</span>
                                        <Badge className="ml-1">
                                            {((params[param.key] as string) || '').split(',').filter(Boolean).length}
                                        </Badge>
                                    </button>
                                    {fieldsOpen && (
                                    <div className="absolute z-[100] right-0 top-full p-4 shadow-2xl bg-white rounded-2xl border border-slate-200 w-[min(90vw,450px)] mt-2 animate-in slide-in-from-top-2 duration-300">
                                        <div className="text-xs font-black uppercase tracking-widest text-slate-300 mb-4 flex items-center gap-2">
                                            <LayoutPanelTop className="size-3" />
                                            {t('dynamic_constructor.table_composition')}
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[350px] overflow-y-auto custom-scrollbar pr-2">
                                            {(() => {
                                                const source = params.source || 'ventes';
                                                const filteredOptions = param.options.filter(opt => {
                                                if (source === 'ventes') {
                                                    return !['fournisseur', 'lot'].includes(opt.value);
                                                }
                                                if (source === 'achats') {
                                                    return !['vendeur', 'client', 'marge', 'pourcentage_marge', 'lot'].includes(opt.value);
                                                }
                                                if (source === 'stock') {
                                                    return !['vendeur', 'client', 'marge', 'pourcentage_marge', 'facture'].includes(opt.value);
                                                }
                                                if (source === 'produits') {
                                                    return !['date', 'facture', 'client', 'vendeur', 'lot', 'marge'].includes(opt.value);
                                                }
                                                return true;
                                            });
                                            return filteredOptions.map(opt => {
                                                const currentFields = ((params[param.key] as string) || '').split(',').filter(Boolean);
                                                const isChecked = currentFields.includes(opt.value);
                                                
                                                return (
                                                    <label key={opt.value} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${isChecked ? 'bg-indigo-50 border-indigo-200 shadow-sm' : 'bg-slate-50/30 border-slate-200 hover:border-slate-300'}`}>
                                                        <Checkbox
                                                            checked={isChecked}
                                                            onCheckedChange={(checked) => {
                                                                let newFields;
                                                                if (checked) {
                                                                    newFields = [...currentFields, opt.value];
                                                                } else {
                                                                    newFields = currentFields.filter((f: string) => f !== opt.value);
                                                                }
                                                                setParam(param.key, newFields.join(','));
                                                            }}
                                                        />
                                                        <span className={`text-[11px] font-bold uppercase tracking-tight ${isChecked ? 'text-indigo-600' : 'text-slate-500'}`}>
                                                            {t(`reports.query_options.${selectedQuery.id}.${param.key}.${opt.value}`, { defaultValue: opt.label })}
                                                        </span>
                                                    </label>
                                                );
                                            });
                                            })()}
                                        </div>
                                        <div className="mt-4 pt-4 border-t border-slate-200 flex justify-between items-center">
                                            <div className="text-[9px] font-bold uppercase text-slate-300 italic">
                                                * {t('reports.select_columns_hint', { defaultValue: 'Sélectionnez les colonnes à afficher' })}
                                            </div>
                                            <button 
                                                className="text-xs font-medium text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded-lg transition-colors"
                                                onClick={() => {
                                                    if (param.options) {
                                                        const all = param.options.map(o => o.value).join(',');
                                                        setParam(param.key, all);
                                                    }
                                                }}
                                            >
                                                {t('dynamic_constructor.check_all')}
                                            </button>
                                        </div>
                                    </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

