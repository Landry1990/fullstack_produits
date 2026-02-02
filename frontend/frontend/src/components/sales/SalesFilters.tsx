import React, { useEffect, useState } from 'react';
import { Search, Calendar, Filter, User, Trash2, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { safeStorage } from '../../utils/storage';

interface SalesFiltersProps {
    filters: {
        startDate: string;
        setStartDate: (date: string) => void;
        endDate: string;
        setEndDate: (date: string) => void;
        searchTerm: string;
        setSearchTerm: (term: string) => void;
        statusFilter: string;
        setStatusFilter: (status: string) => void;
        sellerFilter: string;
        setSellerFilter: (seller: string) => void;
    };
    onDeleteDrafts: () => void;
    onRefresh: () => void;
}

export const SalesFilters: React.FC<SalesFiltersProps> = ({ filters, onDeleteDrafts, onRefresh }) => {
    const { t } = useTranslation();
    const { 
        startDate, setStartDate, 
        endDate, setEndDate, 
        searchTerm, setSearchTerm,
        statusFilter, setStatusFilter,
        sellerFilter, setSellerFilter
    } = filters;

    const [users, setUsers] = useState<any[]>([]);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const token = safeStorage.getItem('authToken');
                const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
                const response = await axios.get(`${apiBaseUrl}/users/`, {
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
                        placeholder={t('sales.filters.search_placeholder')}
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
                            <option value="ALL">{t('sales.filters.status_all')}</option>
                            <option value="BROU">{t('sales.status.draft')}</option>
                            <option value="VAL">{t('sales.status.validated')}</option>
                            <option value="PAY">{t('sales.status.paid')}</option>
                            <option value="ANN">{t('sales.status.cancelled')}</option>
                        </select>
                    </div>

                    {/* Seller Filter */}
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <User className="h-4 w-4 text-base-content/40" />
                        </div>
                        <select
                            value={sellerFilter || ''}
                            onChange={(e) => setSellerFilter(e.target.value)}
                            className="select select-bordered w-full pl-10 select-sm"
                        >
                            <option value="">Tous les vendeurs</option>
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
                    <button
                        onClick={onDeleteDrafts}
                        className="btn btn-ghost btn-sm text-error hover:bg-error/10"
                        title={t('sales.delete_drafts')}
                    >
                        <Trash2 className="w-5 h-5" />
                    </button>

                    <button
                        onClick={onRefresh}
                        className="btn btn-ghost btn-sm text-base-content/60"
                        title="Actualiser"
                    >
                        <RefreshCw className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
};
