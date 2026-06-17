import React, { useEffect, useState } from 'react';
import { Search, Calendar, Filter, User, Trash2, RefreshCw, ArrowUpDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';

interface InventaireFiltersProps {
    filters: {
        startDate: string;
        setStartDate: (date: string) => void;
        endDate: string;
        setEndDate: (date: string) => void;
        searchTerm: string;
        setSearchTerm: (term: string) => void;
        statusFilter: string;
        setStatusFilter: (status: string) => void;
        creatorFilter: string;
        setCreatorFilter: (creator: string) => void;
        ordering: string;
        setOrdering: (order: string) => void;
    };
    onDeleteDrafts?: () => void;
    onRefresh: () => void;
}

export const InventaireFilters: React.FC<InventaireFiltersProps> = ({ filters, onDeleteDrafts, onRefresh }) => {
    const { t } = useTranslation(['stock', 'common']);
    const { 
        startDate, setStartDate, 
        endDate, setEndDate, 
        searchTerm, setSearchTerm,
        statusFilter, setStatusFilter,
        creatorFilter, setCreatorFilter,
        ordering, setOrdering
    } = filters;

    const [users, setUsers] = useState<any[]>([]);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const response = await api.get('users/');
                setUsers(Array.isArray(response.data) ? response.data : response.data.results || []);
            } catch (error) {
                console.error("Failed to load users for filter", error);
            }
        };
        fetchUsers();
    }, []);

    return (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-4">
            {/* Top Row: Search & Dates */}
            <div className="flex flex-col md:flex-row gap-4">
                {/* Search Bar */}
                <div className="flex-1 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                        type="text"
                        placeholder={t('inventaire.filters.search_placeholder')}
                        className="w-full h-10 pl-10 pr-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Date Range */}
                <div className="flex items-center gap-2 bg-white p-1.5 rounded-lg border border-slate-200 px-3">
                    <Calendar className="h-5 w-5 text-slate-400" />
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="bg-transparent border-none text-sm focus:ring-0 px-2 outline-none text-slate-700"
                    />
                    <span className="text-slate-300">-</span>
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="bg-transparent border-none text-sm focus:ring-0 px-2 outline-none text-slate-700"
                    />
                </div>
            </div>

            {/* Bottom Row: Advanced Filters & Actions */}
            <div className="flex flex-col md:flex-row gap-4 items-center">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 w-full">
                    {/* Status Filter */}
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Filter className="h-4 w-4 text-slate-400" />
                        </div>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full h-9 pl-10 pr-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                        >
                            <option value="">{t('inventaire.filters.status_all')}</option>
                            <option value="EN_COURS">{t('inventaire.status.draft', { defaultValue: 'En cours' })}</option>
                            <option value="VALIDEE">{t('inventaire.status.validated', { defaultValue: 'Validée' })}</option>
                        </select>
                    </div>

                    {/* Creator Filter */}
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <User className="h-4 w-4 text-slate-400" />
                        </div>
                        <select
                            value={creatorFilter || ''}
                            onChange={(e) => setCreatorFilter(e.target.value)}
                            className="w-full h-9 pl-10 pr-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                        >
                            <option value="">{t('inventaire.filters.creators_all')}</option>
                            {users.map(u => (
                                <option key={u.id} value={u.id}>
                                    {u.first_name} {u.last_name} ({u.username})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Ordering Filter */}
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <ArrowUpDown className="h-4 w-4 text-slate-400" />
                        </div>
                        <select
                            value={ordering}
                            onChange={(e) => setOrdering(e.target.value)}
                            className="w-full h-9 pl-10 pr-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                        >
                            <option value="-date">{t('inventaire.filters.sort_date_desc', 'Plus récent')}</option>
                            <option value="date">{t('inventaire.filters.sort_date_asc', 'Plus ancien')}</option>
                            <option value="-total_ecart_valeur">{t('inventaire.filters.sort_valeur_desc', 'Écart valeur (-)')}</option>
                            <option value="total_ecart_valeur">{t('inventaire.filters.sort_valeur_asc', 'Écart valeur (+)')}</option>
                            <option value="-total_ecart_quantite">{t('inventaire.filters.sort_qty_desc', 'Écart qté (-)')}</option>
                            <option value="total_ecart_quantite">{t('inventaire.filters.sort_qty_asc', 'Écart qté (+)')}</option>
                        </select>
                    </div>

                </div>

                {/* Actions Buttons */}
                <div className="flex gap-2 shrink-0 border-l border-slate-200 pl-4">
                    {onDeleteDrafts && (
                        <button
                            onClick={onDeleteDrafts}
                            className="inline-flex items-center justify-center h-9 w-9 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                            title={t('inventaire.filters.delete_drafts', { defaultValue: 'Supprimer les brouillons' })}
                        >
                            <Trash2 className="size-5" />
                        </button>
                    )}

                    <button
                        onClick={onRefresh}
                        className="inline-flex items-center justify-center h-9 w-9 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
                        title={t('common:refresh', { defaultValue: 'Actualiser' })}
                    >
                        <RefreshCw className="size-5" />
                    </button>
                </div>
            </div>
        </div>
    );
};

