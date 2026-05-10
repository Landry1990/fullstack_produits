import React from 'react';
import { useTranslation } from 'react-i18next';
import DatePicker, { registerLocale } from 'react-datepicker';
import { fr } from 'date-fns/locale';
import 'react-datepicker/dist/react-datepicker.css';
import type { QueryDefinition, Client } from '../../../hooks/useCentreRapports';
import { Search, User, Truck, Users, Tag, Save, History, Trash2, LayoutPanelTop, Filter, Plus, X } from 'lucide-react';

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
    supplierSearch: {
        query: string;
        filtered: any[];
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
        filtered: any[];
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
        filtered: any[];
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
        apply: (preset: any) => void;
    };
    presetList: any[];
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

    if (selectedQuery.params.length === 0) return null;

    const setParam = (key: string, value: any) => {
        onParamsChange({ ...params, [key]: value });
    };

    const getSafeConditions = () => {
        try {
            const conds = params.conditions;
            if (!conds) return [];
            return typeof conds === 'string' ? JSON.parse(conds) : conds;
        } catch (e) {
            console.error("Erreur de parsing des conditions:", e);
            return [];
        }
    };

    const currentConditions = getSafeConditions();

    return (
        <div className="flex flex-col gap-6">
            {/* Presets Toolbar */}
            <div className="flex flex-wrap items-center gap-3 border-b border-base-200 pb-4">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-base-content/40">
                    <History className="size-3" />
                    Mes Configurations :
                </div>
                {presetList.filter(p => p.queryId === selectedQuery.id).map(preset => (
                    <div key={preset.id} className="group flex items-center gap-1">
                        <button
                            onClick={() => presets.apply(preset)}
                            className="btn btn-xs rounded-full bg-base-200 hover:bg-primary hover:text-white border-none transition-all px-3"
                        >
                            {preset.name}
                        </button>
                        <button 
                            onClick={() => presets.delete(preset.id)}
                            className="btn btn-xs btn-circle btn-ghost opacity-0 group-hover:opacity-100 text-error transition-all"
                        >
                            <Trash2 className="size-3" />
                        </button>
                    </div>
                ))}
                <button 
                    onClick={() => {
                        const name = prompt('Nom de cette configuration ?');
                        if (name) presets.save(name);
                    }}
                    className="btn btn-xs btn-primary btn-outline rounded-full gap-2"
                >
                    <Save className="size-3" />
                    Sauvegarder
                </button>
            </div>

            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-4 sm:gap-6 sm:items-end w-full">
            {selectedQuery.params.filter(param => {
                const source = params.source || 'ventes';
                if (param.key === 'source') return true;
                
                if (source === 'ventes') {
                    return !['fournisseur_id'].includes(param.key);
                }
                if (source === 'achats') {
                    return !['vendeur_id', 'client_id'].includes(param.key);
                }
                if (source === 'stock') {
                    return !['vendeur_id', 'client_id'].includes(param.key);
                }
                if (source === 'produits') {
                    return !['date_debut', 'date_fin', 'vendeur_id', 'client_id', 'fournisseur_id'].includes(param.key);
                }
                return true;
            }).map(param => (
                <div key={param.key} className="form-control w-full sm:w-auto sm:min-w-[200px] min-w-0">
                    <label className="label py-1">
                        <span className="label-text text-[10px] font-bold uppercase tracking-widest text-base-content/50">
                            {t(`params.${param.key}`, { defaultValue: param.label })}
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
                                    <Search className="size-4" />
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
                                    placeholder={t('params.client_id', 'Rechercher un client...')}
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
                                                    <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                                        <User className="size-4" />
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

                        {param.type === 'fournisseur_id' && (
                            <div className="relative group">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/30 group-focus-within:text-primary transition-colors">
                                    <Search className="size-4" />
                                </div>
                                <input
                                    type="text"
                                    value={supplierSearch.query || supplierSearch.selectedName}
                                    onChange={e => {
                                        supplierActions.setQuery(e.target.value);
                                        supplierActions.setSelectedName('');
                                        setParam(param.key, '');
                                    }}
                                    onFocus={() => supplierSearch.query.length > 0 && supplierActions.setShowDropdown(true)}
                                    placeholder={t('params.fournisseur_id', 'Rechercher un fournisseur...')}
                                    className="input input-bordered input-md w-full pl-10 rounded-xl font-bold bg-base-200/50"
                                />
                                {supplierSearch.showDropdown && supplierSearch.filtered.length > 0 && (
                                    <ul className="absolute z-50 w-full bg-base-100 shadow-xl rounded-2xl mt-2 max-h-60 overflow-auto border border-base-200 py-2 animate-in fade-in zoom-in duration-200">
                                        {supplierSearch.filtered.map(supplier => (
                                            <li key={supplier.id}>
                                                <button
                                                    type="button"
                                                    className="w-full text-left px-4 py-3 hover:bg-base-200 transition-colors flex items-center gap-3"
                                                    onClick={() => {
                                                        setParam(param.key, supplier.id);
                                                        supplierActions.setSelectedName(supplier.name);
                                                        supplierActions.setQuery('');
                                                        supplierActions.setShowDropdown(false);
                                                    }}
                                                >
                                                    <div className="size-8 rounded-full bg-success/10 flex items-center justify-center text-success">
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
                            <div className="relative group">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/30 group-focus-within:text-primary transition-colors">
                                    <Search className="size-4" />
                                </div>
                                <input
                                    type="text"
                                    value={userSearch.query || userSearch.selectedName}
                                    onChange={e => {
                                        userActions.setQuery(e.target.value);
                                        userActions.setSelectedName('');
                                        setParam(param.key, '');
                                    }}
                                    onFocus={() => userSearch.query.length > 0 && userActions.setShowDropdown(true)}
                                    placeholder={t('params.vendeur_id', 'Rechercher un vendeur...')}
                                    className="input input-bordered input-md w-full pl-10 rounded-xl font-bold bg-base-200/50"
                                />
                                {userSearch.showDropdown && userSearch.filtered.length > 0 && (
                                    <ul className="absolute z-50 w-full bg-base-100 shadow-xl rounded-2xl mt-2 max-h-60 overflow-auto border border-base-200 py-2 animate-in fade-in zoom-in duration-200">
                                        {userSearch.filtered.map(user => (
                                            <li key={user.id}>
                                                <button
                                                    type="button"
                                                    className="w-full text-left px-4 py-3 hover:bg-base-200 transition-colors flex items-center gap-3"
                                                    onClick={() => {
                                                        setParam(param.key, user.id);
                                                        userActions.setSelectedName(user.username);
                                                        userActions.setQuery('');
                                                        userActions.setShowDropdown(false);
                                                    }}
                                                >
                                                    <div className="size-8 rounded-full bg-info/10 flex items-center justify-center text-info">
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
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/30 group-focus-within:text-primary transition-colors">
                                    <Search className="size-4" />
                                </div>
                                <input
                                    type="text"
                                    value={familleSearch.query || familleSearch.selectedName}
                                    onChange={e => {
                                        familleActions.setQuery(e.target.value);
                                        familleActions.setSelectedName('');
                                        setParam(param.key, '');
                                    }}
                                    onFocus={() => familleSearch.query.length > 0 && familleActions.setShowDropdown(true)}
                                    placeholder={t('params.famille_id', 'Rechercher une famille...')}
                                    className="input input-bordered input-md w-full pl-10 rounded-xl font-bold bg-base-200/50"
                                />
                                {familleSearch.showDropdown && familleSearch.filtered.length > 0 && (
                                    <ul className="absolute z-50 w-full bg-base-100 shadow-xl rounded-2xl mt-2 max-h-60 overflow-auto border border-base-200 py-2 animate-in fade-in zoom-in duration-200">
                                        {familleSearch.filtered.map(famille => (
                                            <li key={famille.id}>
                                                <button
                                                    type="button"
                                                    className="w-full text-left px-4 py-3 hover:bg-base-200 transition-colors flex items-center gap-3"
                                                    onClick={() => {
                                                        setParam(param.key, famille.id);
                                                        familleActions.setSelectedName(famille.nom);
                                                        familleActions.setQuery('');
                                                        familleActions.setShowDropdown(false);
                                                    }}
                                                >
                                                    <div className="size-8 rounded-full bg-warning/10 flex items-center justify-center text-warning">
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

                        {param.type === 'checkbox' && (
                            <div className="flex items-center gap-3 bg-base-200/50 px-4 h-12 rounded-xl border border-base-300">
                                <input
                                    type="checkbox"
                                    checked={!!params[param.key]}
                                    onChange={e => setParam(param.key, e.target.checked)}
                                    className="checkbox checkbox-primary checkbox-sm rounded-lg"
                                />
                                <span className="text-xs font-bold uppercase tracking-tight text-base-content/70">
                                    {t(`params.${param.key}_active`, { defaultValue: 'Activé' })}
                                </span>
                            </div>
                        )}

                        {param.type === 'fields_selector' && param.options && (
                            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                                {/* Condition Builder */}
                                <div className="dropdown dropdown-bottom dropdown-start">
                                    <label tabIndex={0} className="btn btn-outline btn-sm rounded-xl gap-2 h-12 px-6 border-base-300 hover:bg-base-200 hover:border-base-content/20 text-base-content/70">
                                        <Filter className="size-4 text-primary" />
                                        <span>{t('dynamic_constructor.conditions_title')}</span>
                                        {currentConditions.length > 0 && (
                                            <div className="badge badge-secondary badge-sm ml-1">{currentConditions.length}</div>
                                        )}
                                    </label>
                                    <div tabIndex={0} className="dropdown-content z-[100] p-6 shadow-2xl bg-base-100 rounded-3xl border border-base-300 w-[320px] sm:w-[580px] mt-2 animate-in slide-in-from-top-2 duration-300">
                                        <div className="flex items-center justify-between mb-6">
                                            <div className="text-xs font-black uppercase tracking-widest text-base-content/40 flex items-center gap-2">
                                                <Filter className="size-3" />
                                                {t('dynamic_constructor.conditions_title')}
                                            </div>
                                            
                                            {/* Global Logic Toggle (AND/OR) */}
                                            <div className="flex items-center bg-base-200 rounded-xl p-1 gap-1">
                                                <button 
                                                    className={`btn btn-xs rounded-lg px-3 transition-all ${(!params.logic || params.logic === 'AND') ? 'bg-primary text-white' : 'btn-ghost'}`}
                                                    onClick={() => setParam('logic', 'AND')}
                                                >
                                                    {t('dynamic_constructor.logic_and')}
                                                </button>
                                                <button 
                                                    className={`btn btn-xs rounded-lg px-3 transition-all ${params.logic === 'OR' ? 'bg-secondary text-white' : 'btn-ghost'}`}
                                                    onClick={() => setParam('logic', 'OR')}
                                                >
                                                    {t('dynamic_constructor.logic_or')}
                                                </button>
                                            </div>

                                            <button 
                                                className="btn btn-ghost btn-xs text-error"
                                                onClick={() => setParam('conditions', '[]')}
                                            >
                                                {t('dynamic_constructor.reset_conditions')}
                                            </button>
                                        </div>

                                        <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                                            {currentConditions.map((cond: any, idx: number) => {
                                                const showValueInput = !['isnull', 'notnull'].includes(cond.operator);
                                                
                                                return (
                                                    <div key={idx} className="flex flex-wrap items-center gap-2 p-3 bg-base-200/50 rounded-2xl border border-base-200 animate-in zoom-in-95 duration-200">
                                                        <select 
                                                            className="select select-sm select-bordered rounded-xl flex-1 min-w-[140px] font-bold text-[11px] uppercase bg-base-100"
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
                                                        </select>

                                                        <select 
                                                            className="select select-sm select-bordered rounded-xl w-32 font-bold text-[11px] bg-base-100"
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
                                                        </select>

                                                        {showValueInput ? (
                                                            <input 
                                                                type="text"
                                                                className="input input-sm input-bordered rounded-xl w-24 font-bold text-[11px] bg-base-100"
                                                                placeholder={t('dynamic_constructor.value_placeholder')}
                                                                value={cond.value}
                                                                onChange={(e) => {
                                                                    const newConds = [...currentConditions];
                                                                    newConds[idx] = { ...newConds[idx], value: e.target.value };
                                                                    setParam('conditions', JSON.stringify(newConds));
                                                                }}
                                                            />
                                                        ) : (
                                                            <div className="w-24 px-2 py-1 bg-base-300/30 rounded-lg text-[10px] font-black uppercase text-center text-base-content/40 border border-base-300 border-dashed">
                                                                {t('dynamic_constructor.no_value')}
                                                            </div>
                                                        )}

                                                        <button 
                                                            className="btn btn-ghost btn-sm btn-circle text-error hover:bg-error/10 ml-auto"
                                                            onClick={() => {
                                                                const newConds = currentConditions.filter((_: any, i: number) => i !== idx);
                                                                setParam('conditions', JSON.stringify(newConds));
                                                            }}
                                                        >
                                                            <X className="size-4" />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <button 
                                            className="btn btn-primary btn-sm btn-block rounded-xl gap-2 mt-6 h-10 shadow-lg shadow-primary/20"
                                            onClick={() => {
                                                const newConds = [...currentConditions, { field: '', operator: 'gte', value: '' }];
                                                setParam('conditions', JSON.stringify(newConds));
                                            }}
                                        >
                                            <Plus className="size-4" />
                                            {t('dynamic_constructor.add_condition')}
                                        </button>
                                    </div>
                                </div>

                                {/* Fields Selector Dropdown */}
                                <div className="dropdown dropdown-bottom dropdown-end">
                                    <label tabIndex={0} className="btn btn-outline btn-sm rounded-xl gap-2 h-12 px-6 border-base-300 hover:bg-base-200 hover:border-base-content/20 text-base-content/70">
                                        <LayoutPanelTop className="size-4" />
                                        <span>{t('dynamic_constructor.select_columns')}</span>
                                        <div className="badge badge-primary badge-sm ml-1">
                                            {(params[param.key] || '').split(',').filter(Boolean).length}
                                        </div>
                                    </label>
                                    <div tabIndex={0} className="dropdown-content z-[100] p-4 shadow-2xl bg-base-100 rounded-2xl border border-base-300 w-[300px] sm:w-[450px] mt-2 animate-in slide-in-from-top-2 duration-300">
                                        <div className="text-xs font-black uppercase tracking-widest text-base-content/40 mb-4 flex items-center gap-2">
                                            <LayoutPanelTop className="size-3" />
                                            {t('dynamic_constructor.table_composition')}
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[350px] overflow-y-auto custom-scrollbar pr-2">
                                            {param.options.filter(opt => {
                                                const source = params.source || 'ventes';
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
                                            }).map(opt => {
                                                const currentFields = (params[param.key] || '').split(',').filter(Boolean);
                                                const isChecked = currentFields.includes(opt.value);
                                                
                                                return (
                                                    <label key={opt.value} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${isChecked ? 'bg-primary/5 border-primary/30 shadow-sm' : 'bg-base-200/30 border-base-200 hover:border-base-content/10'}`}>
                                                        <input
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={e => {
                                                                let newFields;
                                                                if (e.target.checked) {
                                                                    newFields = [...currentFields, opt.value];
                                                                } else {
                                                                    newFields = currentFields.filter((f: string) => f !== opt.value);
                                                                }
                                                                setParam(param.key, newFields.join(','));
                                                            }}
                                                            className="checkbox checkbox-primary checkbox-xs rounded-md"
                                                        />
                                                        <span className={`text-[11px] font-bold uppercase tracking-tight ${isChecked ? 'text-primary' : 'text-base-content/60'}`}>
                                                            {opt.label}
                                                        </span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                        <div className="mt-4 pt-4 border-t border-base-200 flex justify-between items-center">
                                            <div className="text-[9px] font-bold uppercase text-base-content/30 italic">
                                                * Sélectionnez les colonnes à afficher
                                            </div>
                                            <button 
                                                className="btn btn-ghost btn-xs text-primary"
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
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

