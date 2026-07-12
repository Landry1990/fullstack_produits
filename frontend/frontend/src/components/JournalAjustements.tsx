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
        <div className="h-screen bg-slate-100 p-3 sm:p-4 lg:p-6 flex flex-col overflow-hidden">
            <Toaster position="top-right" />

            <div className="max-w-[1600px] mx-auto w-full flex flex-col h-full gap-4">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 shrink-0">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="size-10 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-200">
                                <span className="text-xl">📋</span>
                            </div>
                            <div>
                                <h1 className="text-2xl font-black tracking-tight text-slate-800">
                                    {t('ajustements.title')}
                                </h1>
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                                    {t('ajustements.subtitle')}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Search & Filter Bar */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden shrink-0">
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
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col flex-1 min-h-0">
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
