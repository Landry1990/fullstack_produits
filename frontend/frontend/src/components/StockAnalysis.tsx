import { useTranslation } from 'react-i18next';
import {
    PackageSearch, ShoppingBag, X, ChevronLeft, ChevronRight,
    TrendingUp, AlertTriangle, Package, Clock, FileSpreadsheet
} from 'lucide-react';
import { formatCurrency } from '../utils/formatters';
import { formatDate } from '../utils/dateUtils';
import { exportToExcel } from '../utils/excelExport';
import { usePharmacySettings } from '../hooks/usePharmacySettings';
import { useStockAnalysis } from '../hooks/useStockAnalysis';
import { StockAnalysisFilters } from './stock/StockAnalysisFilters';
import { StockAnalysisTable } from './stock/StockAnalysisTable';
import StockHealthDashboard from './stock/StockHealthDashboard';
import {
    Card, CardContent, CardHeader, CardTitle, CardDescription
} from './shadcn/card';
import { Button } from './shadcn/button';
import { Badge } from './shadcn/badge';
import { Tabs, TabsList, TabsTrigger } from './shadcn/tabs';

const tabs = [
    { id: 'pilotage' as const, label: 'Pilotage', icon: TrendingUp },
    { id: 'unsold' as const, label: 'Invendus', icon: Clock },
    { id: 'overstock' as const, label: 'Surstock', icon: Package },
    { id: 'shortage' as const, label: 'Ruptures', icon: AlertTriangle },
];

const StockAnalysis = () => {
    const { t } = useTranslation(['stock', 'common']);
    const {
        activeTab,
        setActiveTab,
        fournisseurs,
        selectedFournisseur,
        setSelectedFournisseur,
        data,
        loading,
        error,
        selectedItems,
        unsoldDays,
        setUnsoldDays,
        page,
        setPage,
        actions
    } = useStockAnalysis();

    const currentTab = tabs.find(t => t.id === activeTab) || tabs[0];
    const TabIcon = currentTab.icon;
    const { settings } = usePharmacySettings();

    const handleExportExcel = () => {
        if (!data || activeTab === 'pilotage') return;
        const tabLabel = t(`stock:analyse.tabs.${activeTab}`, currentTab.label);
        let records: Record<string, string | number>[] = [];

        if (activeTab === 'unsold') {
            records = data.items.map(item => ({
                [t('stock:analyse.columns.product', 'Produit')]: item.name,
                CIP: item.cip || '-',
                [t('stock:analyse.columns.current_stock', 'Stock actuel')]: item.stock,
                [t('stock:analyse.columns.last_purchase', 'Dernier achat')]: formatDate(item.dernier_achat),
                [t('stock:analyse.columns.last_sale', 'Dernière vente')]: formatDate(item.derniere_vente),
                [t('stock:analyse.columns.inactive_since', 'Inactif depuis')]: item.days_since_sale != null ? `${item.days_since_sale} j` : '-',
                [t('stock:analyse.columns.cost_price', "Prix d'achat")]: item.cost_price,
                [t('stock:analyse.columns.stock_value', 'Valeur stock')]: item.value,
            }));
        } else if (activeTab === 'overstock') {
            records = data.items.map(item => ({
                [t('stock:analyse.columns.product', 'Produit')]: item.name,
                CIP: item.cip || '-',
                [t('stock:analyse.columns.current_stock', 'Stock actuel')]: item.stock,
                [t('stock:analyse.columns.avg_rotation', 'Rotation moyenne')]: item.rotation ?? '-',
                [t('stock:analyse.columns.threshold', 'Seuil')]: item.threshold ?? '-',
                [t('stock:analyse.columns.excess_qty', 'Excès quantité')]: item.excess_qty ?? '-',
                [t('stock:analyse.columns.excess_value', 'Valeur excès')]: item.value,
            }));
        } else {
            records = data.items.map(item => ({
                [t('stock:analyse.columns.product', 'Produit')]: item.name,
                CIP: item.cip || '-',
                [t('stock:analyse.columns.current_stock', 'Stock actuel')]: item.stock,
                [t('stock:analyse.columns.avg_daily_sales', 'Ventes journalières moy.')]: item.avg_daily_sales ?? '-',
                [t('stock:analyse.columns.days_until_stockout', 'Jours avant rupture')]: item.days_until_stockout ?? '-',
                [t('stock:analyse.columns.urgency', 'Urgence')]: item.urgency ?? '-',
                [t('stock:analyse.columns.value_at_risk', 'Valeur à risque')]: item.value,
            }));
        }

        const dateStr = new Date().toISOString().slice(0, 10);
        exportToExcel(records, settings, {
            filename: `analyse_stock_${activeTab}_${dateStr}.xlsx`,
            title: `${t('stock:analyse.title', 'Analyse de stock')} - ${tabLabel}`,
            sheetName: activeTab,
        });
    };

    return (
        <div className="h-screen overflow-hidden bg-slate-50 p-2 sm:p-3 lg:p-4">

            <div className="h-full max-w-[1600px] mx-auto space-y-3 overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="size-10 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-600/20">
                            <PackageSearch className="size-5" />
                        </div>
                        <div>
                            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                                {t('stock:analyse.title')}
                            </h1>
                            <p className="text-xs font-medium text-slate-500 mt-0.5">
                                {t('stock:analyse.subtitle')}
                            </p>
                        </div>
                    </div>

                    {activeTab !== 'pilotage' && data && !loading && (
                        <div className="flex items-center gap-2 self-start sm:self-auto">
                            <Badge variant="outline" className="text-xs">
                                {data.total_items} articles · {formatCurrency(Math.round(data.total_value))}
                            </Badge>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleExportExcel}
                                disabled={!data.items.length}
                                title={t('stock:analyse.export_excel', 'Exporter Excel')}
                            >
                                <FileSpreadsheet className="size-4 mr-1.5 text-emerald-600" />
                                <span className="hidden sm:inline">{t('stock:analyse.export_excel', 'Excel')}</span>
                            </Button>
                        </div>
                    )}
                </div>

                {/* Navigation Tabs — shadcn */}
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
                    <TabsList className="bg-white border border-slate-200 p-1 h-9 w-full sm:w-auto">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            return (
                                <TabsTrigger
                                    key={tab.id}
                                    value={tab.id}
                                    className="gap-1.5 px-3 py-1 text-xs data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow"
                                >
                                    <Icon className="size-3.5" />
                                    <span className="hidden sm:inline">{t(`stock:analyse.tabs.${tab.id}`, tab.label)}</span>
                                    <span className="sm:hidden">{tab.label}</span>
                                </TabsTrigger>
                            );
                        })}
                    </TabsList>
                </Tabs>

                {activeTab === 'pilotage' ? (
                    <div className="flex-1 min-h-0 overflow-y-auto pr-1">
                        <StockHealthDashboard />
                    </div>
                ) : (
                    <div className="flex-1 min-h-0 overflow-hidden flex flex-col space-y-4">
                        {/* Filters Card */}
                        <Card className="py-3">
                            <CardHeader className="pb-2">
                                <div className="flex items-center gap-3">
                                    <div className="size-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                        <TabIcon className="size-5" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-base">
                                            {t(`stock:analyse.tabs.${activeTab}`, currentTab.label)}
                                        </CardTitle>
                                        <CardDescription className="text-xs">
                                            Filtrer et analyser les articles de cette catégorie
                                        </CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="pb-2">
                                <StockAnalysisFilters
                                    activeTab={activeTab}
                                    fournisseurs={fournisseurs}
                                    selectedFournisseur={selectedFournisseur}
                                    onFournisseurChange={setSelectedFournisseur}
                                    unsoldDays={unsoldDays}
                                    onUnsoldDaysChange={setUnsoldDays}
                                    onRefresh={actions.fetchData}
                                    loading={loading}
                                />
                            </CardContent>
                        </Card>

                        {/* Stats Cards */}
                        {!loading && data && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                <Card>
                                    <CardContent className="p-3 flex items-center gap-3">
                                        <div className="size-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                                            <Package className="size-4" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">
                                                Articles
                                            </p>
                                            <p className="text-xl font-bold text-slate-900">{data.total_items}</p>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardContent className="p-3 flex items-center gap-3">
                                        <div className="size-9 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                                            <TrendingUp className="size-4" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">
                                                {activeTab === 'unsold' ? 'Valeur invendus' :
                                                 activeTab === 'overstock' ? 'Valeur excédents' :
                                                 'Valeur totale'}
                                            </p>
                                            <p className="text-xl font-bold text-red-600">
                                                {formatCurrency(Math.round(data.total_value))}
                                            </p>
                                        </div>
                                    </CardContent>
                                </Card>

                                {activeTab === 'shortage' && (
                                    <Card>
                                        <CardContent className="p-3 flex items-center gap-3">
                                            <div className="size-9 rounded-lg bg-red-100 text-red-700 flex items-center justify-center shrink-0">
                                                <AlertTriangle className="size-4" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">
                                                    {t('stock:analyse.shortage.rupture_count', 'En rupture')}
                                                </p>
                                                <p className="text-xl font-bold text-red-700">{data.rupture_count ?? 0}</p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}

                                {activeTab === 'shortage' && (
                                    <Card>
                                        <CardContent className="p-3 flex items-center gap-3">
                                            <div className="size-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                                                <AlertTriangle className="size-4" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">
                                                    {t('stock:analyse.shortage.critical_count', 'Alertes critiques')}
                                                </p>
                                                <p className="text-xl font-bold text-amber-600">{data.critical_count ?? 0}</p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}
                            </div>
                        )}

                        {/* Table Card */}
                        <Card className="overflow-hidden flex flex-col flex-1 min-h-0">
                            {error && (
                                <div className="m-4 flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700">
                                    <X className="size-5 shrink-0" />
                                    <span className="text-sm font-medium">{error}</span>
                                </div>
                            )}

                            <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
                                <StockAnalysisTable
                                    items={data?.items || []}
                                    loading={loading}
                                    activeTab={activeTab}
                                    selectedItems={selectedItems}
                                    onToggleSelect={actions.toggleSelectItem}
                                    onToggleSelectAll={actions.toggleSelectAll}
                                />
                            </div>

                            {/* Pagination */}
                            {!loading && data && data.total_pages && data.total_pages > 1 && (
                                <div className="px-4 py-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                                    <p className="text-sm text-slate-500">
                                        Page <span className="font-semibold text-slate-900">{data.current_page}</span> sur <span className="font-semibold text-slate-900">{data.total_pages}</span>
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                                            disabled={page === 1}
                                        >
                                            <ChevronLeft className="size-4" />
                                        </Button>
                                        <span className="min-w-[3rem] text-center text-sm font-semibold text-slate-900">
                                            {page}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setPage((p) => Math.min(data.total_pages || 1, p + 1))}
                                            disabled={page === data.total_pages}
                                        >
                                            <ChevronRight className="size-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </Card>
                    </div>
                )}

                {/* Floating Action Bar */}
                {(activeTab === 'shortage' || activeTab === 'overstock') && selectedItems.size > 0 && (
                    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4">
                        <Card className="bg-slate-900 text-white border-slate-800 shadow-2xl">
                            <CardContent className="p-4 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="size-10 rounded-lg bg-emerald-600 flex items-center justify-center font-bold">
                                        {selectedItems.size}
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold">{t('stock:analyse.shortage.selected')}</p>
                                        <p className="text-xs text-slate-400">Prêts à être ajoutés à une commande</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={actions.handleGenerateOrder}
                                    >
                                        <ShoppingBag className="size-4" />
                                        {t('stock:analyse.shortage.generate_order')}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-slate-400 hover:text-white hover:bg-white/10"
                                        onClick={() => actions.toggleSelectAll()}
                                    >
                                        <X className="size-5" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StockAnalysis;
