import { useState, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, LineChart, Line, Legend
} from './LazyRecharts';
import { usePeakHours, useDailyComparison, useSeasonality } from '../hooks/useTemporalAnalysis';
import { formatCurrency, formatNumber } from '../utils/formatters';

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

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-base-content flex items-center gap-2">
            <span>⏱️</span>
            {t('stock:temporal_analysis.title')}
          </h1>
          <p className="text-sm text-base-content/70">
            {t('stock:temporal_analysis.subtitle')}
          </p>
        </div>
        
        {/* Tabs */}
        <div className="tabs tabs-boxed bg-base-100 p-1 border border-base-200">
          <a 
            className={`tab ${activeTab === 'hours' ? 'tab-active bg-primary text-primary-content' : ''}`}
            onClick={() => setActiveTab('hours')}
          >
            {t('stock:temporal_analysis.peak_hours')}
          </a>
          <a 
            className={`tab ${activeTab === 'days' ? 'tab-active bg-primary text-primary-content' : ''}`}
            onClick={() => setActiveTab('days')}
          >
            {t('stock:temporal_analysis.daily_comparison')}
          </a>
          <a 
            className={`tab ${activeTab === 'seasons' ? 'tab-active bg-primary text-primary-content' : ''}`}
            onClick={() => setActiveTab('seasons')}
          >
            {t('stock:temporal_analysis.seasonality')}
          </a>
        </div>
      </div>

      {/* Content */}
      <div className="card bg-base-100 shadow-sm border border-base-200">
        <div className="card-body p-4 sm:p-6">
          
          {/* TAB 1: PEAK HOURS */}
          {activeTab === 'hours' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center bg-base-200/50 p-4 rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="size-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-2xl">
                    ⚡
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{t('stock:temporal_analysis.peak_hour_title')}</h3>
                    <p className="text-sm opacity-70">
                      {loadingHours ? t('common:loading') : 
                       peakHoursData?.peak_hour ? 
                       t('stock:temporal_analysis.peak_hour_summary', { 
                          hour: peakHoursData.peak_hour, 
                          revenue: formatCurrency(Math.round(peakHoursData.peak_revenue)) 
                       }) : 
                       t('stock:temporal_analysis.no_data')}
                    </p>
                  </div>
                </div>
                <select 
                  className="select select-bordered select-sm"
                  value={hoursDays}
                  onChange={(e) => setHoursDays(Number(e.target.value))}
                >
                  <option value={7}>{t('common:last_7_days', '7 derniers jours')}</option>
                  <option value={30}>{t('common:last_30_days', '30 derniers jours')}</option>
                  <option value={90}>{t('common:last_90_days', '90 derniers jours')}</option>
                </select>
              </div>

              {loadingHours ? (
                <div className="h-80 flex items-center justify-center">
                  <span className="loading loading-spinner loading-lg text-primary"></span>
                </div>
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
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
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
              <div className="flex justify-between items-center bg-base-200/50 p-4 rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="size-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-2xl">
                    📅
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{t('stock:temporal_analysis.best_day_title')}</h3>
                    <p className="text-sm opacity-70">
                      {loadingDays ? t('common:loading') : 
                       dailyData?.best_day ? 
                       t('stock:temporal_analysis.best_day_summary', {
                          day: dailyData.best_day,
                          revenue: formatCurrency(Math.round(dailyData.best_revenue))
                       }) : 
                       t('stock:temporal_analysis.no_data')}
                    </p>
                  </div>
                </div>
                <select 
                  className="select select-bordered select-sm"
                  value={daysWeeks}
                  onChange={(e) => setDaysWeeks(Number(e.target.value))}
                >
                  <option value={4}>{t('common:last_4_weeks', '4 dernières semaines')}</option>
                  <option value={12}>{t('common:last_12_weeks', '12 dernières semaines')}</option>
                  <option value={26}>{t('common:last_6_months', '6 derniers mois')}</option>
                </select>
              </div>

              {loadingDays ? (
                <div className="h-80 flex items-center justify-center">
                  <span className="loading loading-spinner loading-lg text-primary"></span>
                </div>
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
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        formatter={(value: number) => [`${formatCurrency(Math.round(value))}`, t('stock:temporal_analysis.columns.avg_revenue')]}
                        />
                        <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  
                  {/* DataTable for Days */}
                  <div className="overflow-x-auto">
                    <table className="table table-sm w-full">
                      <thead>
                        <tr>
                          <th>{t('stock:temporal_analysis.columns.day')}</th>
                          <th className="text-right">{t('stock:temporal_analysis.columns.avg_sales')}</th>
                          <th className="text-right">{t('stock:temporal_analysis.columns.avg_basket')}</th>
                          <th className="text-right">{t('stock:temporal_analysis.columns.avg_revenue')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dailyData?.data?.map((day) => (
                          <tr key={day.day_number} className={day.is_best ? 'bg-green-50 font-medium' : ''}>
                            <td className="flex items-center gap-2">
                              {day.day}
                              {day.is_best && <span className="badge badge-sm badge-success text-white">Top</span>}
                            </td>
                            <td className="text-right">{day.sales_count}</td>
                            <td className="text-right">{formatCurrency(Math.round(day.avg_basket))}</td>
                            <td className="text-right font-bold">{formatCurrency(Math.round(day.revenue))}</td>
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
              <div className="flex justify-between items-center bg-base-200/50 p-4 rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="size-12 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-2xl">
                    🍂
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{t('stock:temporal_analysis.seasonality_title')}</h3>
                    <p className="text-sm opacity-70">
                      {loadingSeasons ? t('common:loading') : 
                       t('stock:temporal_analysis.seasonality_summary', {
                          months: seasonsMonths,
                          count: seasonalityData?.seasonal_products?.length || 0
                       })}
                    </p>
                  </div>
                </div>
                <select 
                  className="select select-bordered select-sm"
                  value={seasonsMonths}
                  onChange={(e) => setSeasonsMonths(Number(e.target.value))}
                >
                  <option value={12}>{t('common:last_12_months', '12 derniers mois')}</option>
                  <option value={24}>{t('common:last_24_months', '24 derniers mois')}</option>
                </select>
              </div>

              {loadingSeasons ? (
                <div className="h-80 flex items-center justify-center">
                  <span className="loading loading-spinner loading-lg text-primary"></span>
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Monthly Trend Chart */}
                  <div className="h-72 w-full">
                    <h4 className="text-sm font-bold uppercase text-base-content/50 mb-2">{t('stock:temporal_analysis.global_revenue_evolution')}</h4>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={seasonalityData?.monthly_trends || []}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} tickFormatter={(val: number) => `${val/1000000}M`} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                          formatter={(value: number) => [`${formatCurrency(Math.round(value))}`, t('stock:temporal_analysis.columns.avg_revenue')]}
                        />
                        <Line type="monotone" dataKey="revenue" stroke="#f97316" strokeWidth={3} dot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Seasonal Products Table */}
                  <div>
                    <h4 className="text-sm font-bold uppercase text-base-content/50 mb-2">{t('stock:temporal_analysis.top_seasonal_products')}</h4>
                    <div className="overflow-x-auto border rounded-lg">
                      <table className="table w-full">
                        <thead className="bg-base-200">
                          <tr>
                            <th>{t('stock:temporal_analysis.columns.product')}</th>
                            <th>{t('stock:temporal_analysis.columns.peak_month')}</th>
                            <th className="text-right">{t('stock:temporal_analysis.columns.peak_volume')}</th>
                            <th className="text-right">{t('stock:temporal_analysis.columns.monthly_avg')}</th>
                            <th className="text-right">{t('stock:temporal_analysis.columns.variation')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {seasonalityData?.seasonal_products?.map((prod) => (
                            <tr key={prod.id} className="hover:bg-base-100">
                              <td className="font-medium">{prod.name}</td>
                              <td>
                                <span className="badge badge-outline font-bold text-orange-600 border-orange-200 bg-orange-50">
                                  {prod.peak_month}
                                </span>
                              </td>
                              <td className="text-right">{prod.peak_quantity}</td>
                              <td className="text-right">{prod.avg_monthly}</td>
                              <td className="text-right font-bold text-orange-600">
                                +{Math.round(prod.variation_pct)}%
                              </td>
                            </tr>
                          ))}
                          {seasonalityData?.seasonal_products?.length === 0 && (
                            <tr>
                              <td colSpan={5} className="text-center py-8 text-base-content/50">
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

