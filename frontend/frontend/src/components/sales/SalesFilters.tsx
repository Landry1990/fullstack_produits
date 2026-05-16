import React from 'react';
import { Search, Calendar, Filter, User, Trash2, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUsers } from '../../hooks/useUsers';
import { getLocale } from '../../utils/dateUtils';

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
    users?: { id: number; username: string; first_name: string; last_name: string }[];
}

export const SalesFilters: React.FC<SalesFiltersProps> = ({ filters, onDeleteDrafts, onRefresh, users: propUsers }) => {
    const { t } = useTranslation(['sales', 'common']);
    const { 
        startDate, setStartDate, 
        endDate, setEndDate, 
        searchTerm, setSearchTerm,
        statusFilter, setStatusFilter,
        sellerFilter, setSellerFilter
    } = filters;

    // Use prop users if provided (from page_init), fallback to useUsers hook
    const { users: hookUsers } = useUsers();
    const users = propUsers && propUsers.length > 0 ? propUsers : hookUsers;

    return (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-4">
            {/* Top Row: Search & Dates */}
            <div className="flex flex-col md:flex-row gap-4">
                {/* Search Bar */}
                <div className="flex-1 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        placeholder={t('sales:filters.search_placeholder')}
                        className="w-full rounded-lg border border-gray-200 bg-white pl-10 h-10 text-sm text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50 outline-none transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Date Range */}
                <div className="flex items-center gap-2 bg-white p-1.5 rounded-lg border border-gray-200 px-3">
                    <Calendar className="h-5 w-5 text-gray-500" />
                    <input
                        type="date"
                        lang={getLocale()}
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="bg-transparent border-none text-sm focus:ring-0 px-2 outline-none text-gray-700"
                    />
                    <span className="text-gray-400">-</span>
                    <input
                        type="date"
                        lang={getLocale()}
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="bg-transparent border-none text-sm focus:ring-0 px-2 outline-none text-gray-700"
                    />
                </div>
            </div>

            {/* Bottom Row: Advanced Filters & Actions */}
            <div className="flex flex-col md:flex-row gap-4 items-center">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 w-full">
                    {/* Status Filter */}
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Filter className="h-4 w-4 text-gray-400" />
                        </div>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full rounded-lg border border-gray-200 bg-white pl-10 h-9 text-xs text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50 outline-none transition-all appearance-none"
                        >
                            <option value="ALL">{t('sales:filters.status_all')}</option>
                            <option value="BROU">{t('sales:status.draft')}</option>
                            <option value="VAL">{t('sales:status.validated')}</option>
                            <option value="PAY">{t('sales:status.paid')}</option>
                            <option value="ANN">{t('sales:status.cancelled')}</option>
                        </select>
                    </div>

                    {/* Seller Filter */}
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <User className="h-4 w-4 text-gray-400" />
                        </div>
                        <select
                            value={sellerFilter || ''}
                            onChange={(e) => setSellerFilter(e.target.value)}
                            className="w-full rounded-lg border border-gray-200 bg-white pl-10 h-9 text-xs text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50 outline-none transition-all appearance-none"
                        >
                            <option value="">{t('sales:filters.all_sellers')}</option>
                            {users.map(u => (
                                <option key={u.id} value={u.id}>
                                    {u.first_name} {u.last_name} ({u.username})
                                </option>
                            ))}
                        </select>
                    </div>

                </div>

                {/* Actions Buttons */}
                <div className="flex gap-2 shrink-0 border-l border-gray-200 pl-4">
                    <button
                        onClick={onDeleteDrafts}
                        className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                        title={t('sales:actions.delete_drafts')}
                    >
                        <Trash2 className="size-5" />
                    </button>

                    <button
                        onClick={onRefresh}
                        className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
                        title={t('common:refresh')}
                    >
                        <RefreshCw className="size-5" />
                    </button>
                </div>
            </div>
        </div>
    );
};
