import React, { useEffect, useState } from 'react';
import { Search, Calendar, Filter, User, Trash2, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { safeStorage } from '../../utils/storage';

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
        creatorFilter, setCreatorFilter
    } = filters;

    const [users, setUsers] = useState<any[]>([]);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const token = safeStorage.getItem('authToken');
                const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api';
                const response = await axios.get(`${String(apiBaseUrl).replace(/\/$/, '')}/users/`, {
                    headers: { Authorization: `Token ${token}` }
                });
                setUsers(Array.isArray(response.data) ? response.data : response.data.results || []);
            } catch (error) {
                console.error("Failed to load users for filter", error);
            }
        };
        fetchUsers();
    }, []);

    return (
        <div className="bg-base-100 p-4 rounded-xl shadow-sm border border-base-300 space-y-4">
            {/* Top Row: Search & Dates */}
            <div className="flex flex-col md:flex-row gap-4">
                {/* Search Bar */}
                <div className="flex-1 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-base-content/40" />
                    </div>
                    <input
                        type="text"
                        placeholder={t('inventaire.filters.search_placeholder')}
                        className="input input-bordered pl-10 w-full bg-base-100 focus:border-primary focus:ring-1 focus:ring-primary"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Date Range */}
                <div className="flex items-center gap-2 bg-base-100 p-1.5 rounded-lg border border-base-300 px-3">
                    <Calendar className="h-5 w-5 text-base-content/60" />
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="bg-transparent border-none text-sm focus:ring-0 px-2 outline-none text-base-content"
                    />
                    <span className="text-base-content/40">-</span>
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="bg-transparent border-none text-sm focus:ring-0 px-2 outline-none text-base-content"
                    />
                </div>
            </div>

            {/* Bottom Row: Advanced Filters & Actions */}
            <div className="flex flex-col md:flex-row gap-4 items-center">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 w-full">
                    {/* Status Filter */}
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Filter className="h-4 w-4 text-base-content/40" />
                        </div>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="select select-bordered w-full pl-10 select-sm"
                        >
                            <option value="">{t('inventaire.filters.status_all')}</option>
                            <option value="EN_COURS">{t('inventaire.status.draft', { defaultValue: 'En cours' })}</option>
                            <option value="VALIDEE">{t('inventaire.status.validated', { defaultValue: 'Validée' })}</option>
                        </select>
                    </div>

                    {/* Creator Filter */}
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <User className="h-4 w-4 text-base-content/40" />
                        </div>
                        <select
                            value={creatorFilter || ''}
                            onChange={(e) => setCreatorFilter(e.target.value)}
                            className="select select-bordered w-full pl-10 select-sm"
                        >
                            <option value="">{t('inventaire.filters.creators_all')}</option>
                            {users.map(u => (
                                <option key={u.id} value={u.id}>
                                    {u.first_name} {u.last_name} ({u.username})
                                </option>
                            ))}
                        </select>
                    </div>

                </div>

                {/* Actions Buttons */}
                <div className="flex gap-2 shrink-0 border-l border-base-300 pl-4">
                    {onDeleteDrafts && (
                        <button
                            onClick={onDeleteDrafts}
                            className="btn btn-ghost btn-sm text-error hover:bg-error/10"
                            title={t('inventaire.filters.delete_drafts', { defaultValue: 'Supprimer les brouillons' })}
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    )}

                    <button
                        onClick={onRefresh}
                        className="btn btn-ghost btn-sm text-base-content/60"
                        title={t('common.refresh', { defaultValue: 'Actualiser' })}
                    >
                        <RefreshCw className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
};
