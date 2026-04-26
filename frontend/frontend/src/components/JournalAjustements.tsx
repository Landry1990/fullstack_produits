import { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useAjustementsData } from '../hooks/useAjustementsData';
import { AjustementsQuickStats } from './adjustments/AjustementsQuickStats';
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
        stats,
        filters,
        setFilters,
        pagination,
        actions
    } = useAjustementsData();

    return (
        <div className="min-h-screen bg-base-200 p-3 sm:p-4 lg:p-8">
            <Toaster position="top-right" />
            
            <div className="max-w-[1600px] mx-auto space-y-8">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20">
                                <span className="text-2xl">📋</span>
                            </div>
                            <div>
                                <h1 className="text-3xl font-black tracking-tight text-base-content">
                                    {t('ajustements.title')}
                                </h1>
                                <p className="text-sm font-semibold text-base-content/40 uppercase tracking-widest">
                                    {t('ajustements.subtitle')}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Stats Dashboard */}
                <AjustementsQuickStats 
                    totalCount={stats.total_count}
                    positiveSum={stats.positive_sum}
                    negativeSum={stats.negative_sum}
                />

                {/* Search & Filter Bar */}
                <div className="bg-base-100 rounded-[32px] shadow-sm border border-base-200 overflow-hidden">
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
                <div className="bg-base-100 rounded-[32px] shadow-sm border border-base-200 overflow-hidden flex flex-col min-h-0 sm:min-h-[480px] lg:min-h-[600px]">
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
