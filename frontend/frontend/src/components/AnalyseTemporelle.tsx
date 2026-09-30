import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useRecharts } from '../hooks/useRecharts';
import { usePeakHours, useDailyComparison, useSeasonality } from '../hooks/useTemporalAnalysis';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { ReportTableHead } from './common/ReportTableHead';

const TABS = [
  { id: 'hours', labelKey: 'stock:temporal_analysis.peak_hours' },
  { id: 'days', labelKey: 'stock:temporal_analysis.daily_comparison' },
  { id: 'seasons', labelKey: 'stock:temporal_analysis.seasonality' },
] as const;

const TOOLTIP_CONTENT_STYLE = { borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' };

function ChartLoading() {
  return (
    <div className="h-80 flex items-center justify-center">
      <span className="size-12 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin"></span>
    </div>
  );
}

interface PanelHeaderProps {
  icon: ReactNode;
  iconClassName: string;
  title: string;
  summary: ReactNode;
  selectValue: number;
  onSelectChange: (value: number) => void;
  selectAriaLabel: string;
  options: { value: number; label: string }[];
}

function PanelHeader({ icon, iconClassName, title, summary, selectValue, onSelectChange, selectAriaLabel, options }: PanelHeaderProps) {
  return (
    <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-100">
      <div className="flex items-center gap-4">
        <div className={`size-12 rounded-full flex items-center justify-center text-2xl ${iconClassName}`}>
          {icon}
        </div>
        <div>
          <h3 className="font-bold text-lg text-slate-800">{title}</h3>
          <p className="text-sm text-slate-500">{summary}</p>
        </div>
      </div>
      <select
        className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none"
        value={selectValue}
        onChange={(e) => onSelectChange(Number(e.target.value))}
        aria-label={selectAriaLabel}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

export default function AnalyseTemporelle() {
  const { t } = useTranslation(['stock', 'common']);
  const [activeTab, setActiveTab] = useState<'hours' | 'days' | 'seasons'>('hours');

  // State for filters
  const [hoursDays, setHoursDays] = useState(30);
  const [daysWeeks, setDaysWeeks] = useState(12);
  const [seasonsMonths, setSeasonsMonths] = useState(12);

  // Queries
  const { data: peakHoursData, isLoading: loadingHours } = usePeakHours(hoursDays);
  const { data: dailyData, isLoading: loadingDays } = useDailyComparison(daysWeeks);
  const { data: seasonalityData, isLoading: loadingSeasons } = useSeasonality(seasonsMonths);

  const Recharts = useRecharts();
  if (!Recharts) return <div className="flex items-center justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-400" /></div>;
  const { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, LineChart, Line, Legend } = Recharts;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <span>⏱️</span>
            {t('stock:temporal_analysis.title')}
          </h1>
          <p className="text-sm text-slate-500">
            {t('stock:temporal_analysis.subtitle')}
          </p>
        </div>
        
        {/* Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`h-8 px-4 rounded-lg text-xs font-bold transition-all ${
                activeTab === tab.id ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:bg-slate-200'
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="p-4 sm:p-6">
          
          {/* TAB 1: PEAK HOURS */}
          {activeTab === 'hours' && (
            <div className="space-y-6">
              <PanelHeader
                icon="⚡"
                iconClassName="bg-blue-100 text-blue-600"
                title={t('stock:temporal_analysis.peak_hour_title')}
                summary={loadingHours ? t('common:loading') :
                  peakHoursData?.peak_hour ?
                  t('stock:temporal_analysis.peak_hour_summary', {
                    hour: peakHoursData.peak_hour,
                    revenue: formatCurrency(Math.round(peakHoursData.peak_revenue))
                  }) :
                  t('stock:temporal_analysis.no_data')}
                selectValue={hoursDays}
                onSelectChange={setHoursDays}
                selectAriaLabel={t('common:period')}
                options={[
                  { value: 7, label: t('common:last_7_days', '7 derniers jours') },
                  { value: 30, label: t('common:last_30_days', '30 derniers jours') },
                  { value: 90, label: t('common:last_90_days', '90 derniers jours') },
                ]}
              />

              {loadingHours ? (
                <ChartLoading />
              ) : (
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={peakHoursData?.data || []}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="hour" tick={{ fontSize: 12 }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 12 }} tickFormatter={(val: number) => `${val/1000}k`} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                      <Tooltip
                        contentStyle={TOOLTIP_CONTENT_STYLE}
                        formatter={(value: number, name: string) => [
                          name === 'revenue' || name === 'avg_basket' ? `${formatCurrency(Math.round(value))}` : formatNumber(value),
                          name === 'revenue' ? t('stock:temporal_analysis.columns.avg_revenue') : name === 'sales_count' ? t('stock:temporal_analysis.columns.avg_sales') : t('stock:temporal_analysis.columns.avg_basket')
                        ]}
                      />
                      <Legend />
                      <Area 
                        yAxisId="left"
                        type="monotone" 
                        dataKey="revenue" 
                        name="revenue"
                        stroke="#3b82f6" 
                        fillOpacity={1} 
                        fill="url(#colorRevenue)" 
                      />
                      <Area 
                        yAxisId="right"
                        type="monotone" 
                        dataKey="sales_count" 
                        name="sales_count"
                        stroke="#10b981" 
                        fill="transparent" 
                        strokeDasharray="5 5"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: DAILY COMPARISON */}
          {activeTab === 'days' && (
            <div className="space-y-6">
              <PanelHeader
                icon="📅"
                iconClassName="bg-emerald-100 text-emerald-600"
                title={t('stock:temporal_analysis.best_day_title')}
                summary={loadingDays ? t('common:loading') :
                  dailyData?.best_day ?
                  t('stock:temporal_analysis.best_day_summary', {
                    day: dailyData.best_day,
                    revenue: formatCurrency(Math.round(dailyData.best_revenue))
                  }) :
                  t('stock:temporal_analysis.no_data')}
                selectValue={daysWeeks}
                onSelectChange={setDaysWeeks}
                selectAriaLabel={t('common:period')}
                options={[
                  { value: 4, label: t('common:last_4_weeks', '4 dernières semaines') },
                  { value: 12, label: t('common:last_12_weeks', '12 dernières semaines') },
                  { value: 26, label: t('common:last_6_months', '6 derniers mois') },
                ]}
              />

              {loadingDays ? (
                <ChartLoading />
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dailyData?.data || []}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} tickFormatter={(val: number) => `${val/1000}k`} />
                        <Tooltip
                          cursor={{fill: 'transparent'}}
                          contentStyle={TOOLTIP_CONTENT_STYLE}
                        formatter={(value: number) => [`${formatCurrency(Math.round(value))}`, t('stock:temporal_analysis.columns.avg_revenue')]}
                        />
                        <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  
                  {/* DataTable for Days */}
                  <div className="overflow-x-auto">
                    <table className="w-full border-separate border-spacing-0 text-sm">
                      <ReportTableHead columns={[
                        { key: 'day', label: t('stock:temporal_analysis.columns.day'), align: 'left' },
                        { key: 'avg_sales', label: t('stock:temporal_analysis.columns.avg_sales') },
                        { key: 'avg_basket', label: t('stock:temporal_analysis.columns.avg_basket') },
                        { key: 'avg_revenue', label: t('stock:temporal_analysis.columns.avg_revenue') },
                      ]} />
                      <tbody className="divide-y divide-slate-100">
                        {dailyData?.data?.map((day) => (
                          <tr key={day.day_number} className={`transition-colors ${day.is_best ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}>
                            <td className="py-2.5 pl-4 flex items-center gap-2 font-medium text-slate-700">
                              {day.day}
                              {day.is_best && <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-caption font-bold">Top</span>}
                            </td>
                            <td className="py-2.5 text-right text-slate-600">{day.sales_count}</td>
                            <td className="py-2.5 text-right text-slate-600">{formatCurrency(Math.round(day.avg_basket))}</td>
                            <td className="py-2.5 text-right font-bold text-slate-800 pr-4">{formatCurrency(Math.round(day.revenue))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SEASONALITY */}
          {activeTab === 'seasons' && (
            <div className="space-y-6">
              <PanelHeader
                icon="🍂"
                iconClassName="bg-amber-100 text-amber-600"
                title={t('stock:temporal_analysis.seasonality_title')}
                summary={loadingSeasons ? t('common:loading') :
                  t('stock:temporal_analysis.seasonality_summary', {
                    months: seasonsMonths,
                    count: seasonalityData?.seasonal_products?.length || 0
                  })}
                selectValue={seasonsMonths}
                onSelectChange={setSeasonsMonths}
                selectAriaLabel={t('common:period')}
                options={[
                  { value: 12, label: t('common:last_12_months', '12 derniers mois') },
                  { value: 24, label: t('common:last_24_months', '24 derniers mois') },
                ]}
              />

              {loadingSeasons ? (
                <ChartLoading />
              ) : (
                <div className="space-y-8">
                  {/* Monthly Trend Chart */}
                  <div className="h-72 w-full">
                    <h4 className="text-sm font-bold uppercase text-slate-400 mb-2">{t('stock:temporal_analysis.global_revenue_evolution')}</h4>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={seasonalityData?.monthly_trends || []}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} tickFormatter={(val: number) => `${val/1000000}M`} />
                        <Tooltip
                          contentStyle={TOOLTIP_CONTENT_STYLE}
                          formatter={(value: number) => [`${formatCurrency(Math.round(value))}`, t('stock:temporal_analysis.columns.avg_revenue')]}
                        />
                        <Line type="monotone" dataKey="revenue" stroke="#f97316" strokeWidth={3} dot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Seasonal Products Table */}
                  <div>
                    <h4 className="text-sm font-bold uppercase text-slate-400 mb-2">{t('stock:temporal_analysis.top_seasonal_products')}</h4>
                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                      <table className="w-full border-separate border-spacing-0 text-sm">
                        <ReportTableHead columns={[
                          { key: 'product', label: t('stock:temporal_analysis.columns.product'), align: 'left' },
                          { key: 'peak_month', label: t('stock:temporal_analysis.columns.peak_month'), align: 'left' },
                          { key: 'peak_volume', label: t('stock:temporal_analysis.columns.peak_volume') },
                          { key: 'monthly_avg', label: t('stock:temporal_analysis.columns.monthly_avg') },
                          { key: 'variation', label: t('stock:temporal_analysis.columns.variation') },
                        ]} />
                        <tbody className="divide-y divide-slate-100">
                          {seasonalityData?.seasonal_products?.map((prod) => (
                            <tr key={prod.id} className="hover:bg-slate-50 transition-colors">
                              <td className="py-2.5 pl-4 font-medium text-slate-700">{prod.name}</td>
                              <td className="py-2.5">
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full border border-amber-200 bg-amber-50 text-amber-700 text-xs font-bold">
                                  {prod.peak_month}
                                </span>
                              </td>
                              <td className="py-2.5 text-right text-slate-600">{prod.peak_quantity}</td>
                              <td className="py-2.5 text-right text-slate-600">{prod.avg_monthly}</td>
                              <td className="py-2.5 text-right font-bold text-amber-600 pr-4">
                                +{Math.round(prod.variation_pct)}%
                              </td>
                            </tr>
                          ))}
                          {seasonalityData?.seasonal_products?.length === 0 && (
                            <tr>
                              <td colSpan={5} className="text-center py-8 text-slate-400">
                                {t('stock:temporal_analysis.no_seasonality_detected')}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

