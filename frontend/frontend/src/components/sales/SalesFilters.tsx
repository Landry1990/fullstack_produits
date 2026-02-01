import React from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Filter, Trash2, Calendar, RefreshCw } from 'lucide-react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
// import fr from 'date-fns/locale/fr'; // Note: locale handling might need adjusting

interface SalesFiltersProps {
    startDate: string;
    setStartDate: (date: string) => void;
    endDate: string;
    setEndDate: (date: string) => void;
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    statusFilter: string;
    setStatusFilter: (status: string) => void;
    onDeleteDrafts: () => void;
    onRefresh: () => void;
}

export const SalesFilters: React.FC<SalesFiltersProps> = ({
    startDate, setStartDate,
    endDate, setEndDate,
    searchTerm, setSearchTerm,
    statusFilter, setStatusFilter,
    onDeleteDrafts,
    onRefresh
}) => {
    const { t } = useTranslation();

    return (
        <div className="flex flex-col xl:flex-row justify-between gap-4 p-5">
            {/* Search */}
            <div className="flex-1 min-w-[300px]">
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 group-focus-within:text-blue-500 transition-colors" />
                    <input
                        type="text"
                        placeholder={t('sales.filters.search_placeholder', { defaultValue: "Rechercher une vente..." })} // Fallback text
                        className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none text-gray-700 shadow-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                {/* Date Filters */}
                <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-gray-200 shadow-sm">
                    <div className="px-3 text-gray-400">
                        <Calendar className="w-4 h-4" />
                    </div>
                    <input 
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="border-none bg-transparent text-sm font-medium text-gray-600 focus:ring-0 cursor-pointer"
                    />
                    <span className="text-gray-300">→</span>
                    <input 
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="border-none bg-transparent text-sm font-medium text-gray-600 focus:ring-0 cursor-pointer"
                    />
                </div>

                {/* Status Filter */}
                <div className="relative min-w-[160px]">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                        <Filter className="w-4 h-4" />
                    </div>
                    <select
                        className="w-full pl-10 pr-8 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 text-sm font-medium text-gray-600 appearance-none cursor-pointer shadow-sm outline-none"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="ALL">{t('sales.filters.status_all')}</option>
                        <option value="PAY">{t('sales.status.paid')}</option>
                        <option value="VAL">{t('sales.status.validated')}</option> {/* Assuming VAL is Validated */}
                        <option value="BROU">{t('sales.status.draft')}</option>
                        <option value="ANN">{t('sales.status.cancelled')}</option>
                        <option value="PROF">PROFORMA</option>
                    </select>
                </div>

                <div className="w-px h-8 bg-gray-200 mx-1"></div>

                {/* Actions */}
                <button
                    onClick={onDeleteDrafts}
                    className="flexItems-center justify-center p-2.5 text-red-600 hover:bg-red-50 hover:text-red-700 border border-transparent hover:border-red-100 rounded-xl transition-all"
                    title={t('sales.delete_drafts')}
                >
                    <Trash2 className="w-5 h-5" />
                </button>

                 <button
                    onClick={onRefresh}
                    className="flex items-center justify-center p-2.5 text-gray-500 hover:bg-gray-100 border border-transparent hover:border-gray-200 rounded-xl transition-all"
                    title="Actualiser"
                >
                    <RefreshCw className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
};
