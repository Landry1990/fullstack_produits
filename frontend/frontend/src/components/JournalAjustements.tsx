import { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useAjustementsData } from '../hooks/useAjustementsData';
import { AjustementsFilters } from './adjustments/AjustementsFilters';
import { AjustementsTable } from './adjustments/AjustementsTable';

export default function JournalAjustements() {
    const { t } = useTranslation(['stock', 'common']);
    const {
        adjustments,
        loading,
        totalCount,
        totalPages,
        currentPage,
        filters,
        setFilters,
        pagination,
        actions
    } = useAjustementsData();

    return (
        <div className="h-screen bg-slate-100 p-2 sm:p-3 lg:p-4 flex flex-col overflow-hidden">
            <Toaster position="top-right" />

            <div className="max-w-[1600px] mx-auto w-full flex flex-col h-full gap-2 lg:gap-4">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-2 lg:gap-6 shrink-0">
                    <div>
                        <div className="flex items-center gap-2 lg:gap-3 mb-1 lg:mb-2">
                            <div className="size-8 lg:size-10 rounded-xl lg:rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-200">
                                <span className="text-base lg:text-xl">📋</span>
                            </div>
                            <div>
                                <h1 className="text-lg lg:text-2xl font-black tracking-tight text-slate-800">
                                    {t('ajustements.title')}
                                </h1>
                                <p className="text-[10px] lg:text-xs font-semibold text-slate-400 uppercase tracking-widest hidden lg:block">
                                    {t('ajustements.subtitle')}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Search & Filter Bar */}
                <div className="bg-white rounded-xl lg:rounded-2xl shadow-sm border border-slate-200 overflow-hidden shrink-0">
                    <AjustementsFilters
                        searchQuery={filters.searchQuery}
                        onSearchChange={setFilters.setSearchQuery}
                        dateStart={filters.dateStart}
                        onDateStartChange={setFilters.setDateStart}
                        dateEnd={filters.dateEnd}
                        onDateEndChange={setFilters.setDateEnd}
                        filterReasonType={filters.filterReasonType}
                        onReasonTypeChange={setFilters.setFilterReasonType}
                        onReset={() => {
                            setFilters.setSearchQuery('');
                            setFilters.setFilterReasonType('');
                            setFilters.setDateStart('');
                            setFilters.setDateEnd('');
                        }}
                        onRefresh={() => actions.fetchAdjustments(currentPage)}
                        onExport={actions.handleExportExcel}
                        loading={loading}
                    />
                </div>

                {/* Table Section */}
                <div className="bg-white rounded-xl lg:rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col flex-1 min-h-0">
                    <AjustementsTable
                        adjustments={adjustments}
                        loading={loading}
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalCount={totalCount}
                        onPageChange={pagination.setCurrentPage}
                    />
                </div>
            </div>
        </div>
    );
}
