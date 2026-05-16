import { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  Archive, 
  Medal, 
  ArrowRight,
  Package,
  CalendarDays,
  TrendingUp
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';

interface StockIntelligenceProps {
  stats: any;
  lowStockItems: any[];
  expiringLots: any[];
  promisDisponibles: any[];
  expirationMonths: number;
  setExpirationMonths: (val: number) => void;
  getServerDate: () => Date;
  reapproStats?: { product_count: number; total_units_suggested: number };
  t: any;
  formatCurrencyLocal: (val: number) => string;
}

export default function StockIntelligence({
  stats,
  lowStockItems,
  expiringLots,
  promisDisponibles,
  expirationMonths,
  setExpirationMonths,
  getServerDate,
  reapproStats,
  t,
  formatCurrencyLocal
}: StockIntelligenceProps) {
  const navigate = useNavigate();

  const DORMANT_DAYS = 90;
  const [dormantItems, setDormantItems] = useState<any[]>([]);
  const [dormantTotal, setDormantTotal] = useState(0);

  const [overstockItems, setOverstockItems] = useState<any[]>([]);
  const [overstockTotal, setOverstockTotal] = useState(0);

  useEffect(() => {
    api.get('stock-analysis/unsold/', {
      params: { days: DORMANT_DAYS, page: 1, page_size: 50 }
    }).then(res => {
      const items = (res.data?.items ?? []) as any[];
      const sorted = items.toSorted((a, b) => (b.stock ?? 0) - (a.stock ?? 0)).slice(0, 5);
      setDormantItems(sorted);
      setDormantTotal(res.data?.total_value ?? 0);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    api.get('stock-analysis/overstock/', {
      params: { page: 1, page_size: 50 }
    }).then(res => {
      const items = (res.data?.items ?? []) as any[];
      const sorted = items.toSorted((a, b) => (b.excess_value ?? 0) - (a.excess_value ?? 0)).slice(0, 5);
      setOverstockItems(sorted);
      setOverstockTotal(res.data?.total_value ?? 0);
    }).catch(() => {});
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 auto-rows-fr">
        {/* Expiring Lots (Alertes Périssables) - Swapped to first position */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-full flex flex-col">
          <div className="p-6 flex flex-col h-full">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <div
                className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => navigate('/app/perimes')}
              >
                <div className="p-2 bg-red-50 text-red-600 rounded-lg">
                  <CalendarDays className="size-5" />
                </div>
                <div>
                  <h2 className="text-xs font-bold text-gray-900 tracking-tight uppercase">{t('alerts.expiry_title')}</h2>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('alerts.expiry_subtitle')}</p>
                </div>
              </div>
            </div>

            <div className="mb-4 shrink-0">
              <select
                className="w-full rounded-lg border border-gray-200 bg-white h-8 text-[10px] font-bold uppercase tracking-widest text-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50 outline-none transition-all"
                value={expirationMonths}
                onChange={(e) => setExpirationMonths(Number(e.target.value))}
              >
                <option value={1}>{t('manager_dashboard.expiry_periods.month_1')}</option>
                <option value={2}>{t('manager_dashboard.expiry_periods.months_2')}</option>
                <option value={3}>{t('manager_dashboard.expiry_periods.months_3')}</option>
                <option value={6}>{t('manager_dashboard.expiry_periods.months_6')}</option>
                <option value={12}>{t('manager_dashboard.expiry_periods.year_1')}</option>
              </select>
            </div>

            <div className="space-y-2 flex-grow overflow-y-auto pr-1 custom-scrollbar h-[350px]">
              {expiringLots.length === 0 ? (
                <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 text-center py-6 border-2 border-dashed border-gray-100 rounded-xl h-full flex items-center justify-center">
                  <CalendarDays className="size-8 mb-2 opacity-20" />
                  {t('alerts.no_expiry_alerts')}
                </div>
              ) : (
                expiringLots.slice(0, 10).map((lot: any) => {
                  const today = getServerDate();
                  const daysUntilExpiry = lot.date_expiration 
                    ? Math.floor((new Date(lot.date_expiration).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                    : 0;
                  
                  let urgencyStyle = 'bg-amber-50 border-amber-100 text-amber-900';
                  let dotStyle = 'bg-amber-500';
                  
                  if (daysUntilExpiry <= 7) {
                    urgencyStyle = 'bg-red-50 border-red-200 text-red-900 shadow-sm';
                    dotStyle = 'bg-red-500';
                  } else if (daysUntilExpiry <= 30) {
                    urgencyStyle = 'bg-orange-50 border-orange-200 text-orange-900';
                    dotStyle = 'bg-orange-500';
                  }
                  
                  return (
                    <div key={lot.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all hover:scale-[1.02] ${urgencyStyle}`}>
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`size-1.5 rounded-full shrink-0 ${dotStyle} ${daysUntilExpiry <= 7 ? 'animate-ping' : ''}`}></div>
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-bold block truncate">{lot.produit_nom}</span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">LOT {lot.lot || 'N/A'}</span>
                            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">
                              EXP: {lot.date_expiration ? (() => { const d = new Date(lot.date_expiration); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; })() : 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="bg-white/50 text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-widest ml-3 shrink-0 whitespace-nowrap border border-current opacity-70">
                        {daysUntilExpiry <= 0 ? t('alerts.expired') : t('alerts.days_left', { count: daysUntilExpiry })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="mt-4 shrink-0">
              <Link to="/app/perimes" className="inline-flex items-center justify-center w-full px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-500 text-[9px] font-bold uppercase tracking-widest rounded-lg border border-gray-200 transition-colors">
                {t('alerts.manage_perimes')}
              </Link>
            </div>
          </div>
        </div>

        {/* Dormant Stock (Rossignols) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-full flex flex-col">
          <div className="p-6 flex flex-col h-full">
            <div className="flex items-center justify-between mb-6 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-50 text-slate-600 rounded-lg">
                  <Archive className="size-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-900 tracking-tight uppercase">{t('dashboard.charts.dormant_stock', { defaultValue: 'Stock Dormant' })}</h2>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t('dashboard.charts.dormant_desc', { defaultValue: 'Rossignols (+6 mois)' })}</p>
                </div>
              </div>
              {dormantTotal > 0 && (
                <div className="text-right">
                  <span className="text-xs font-black text-slate-700 block">{formatCurrencyLocal(dormantTotal)}</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{t('dashboard.charts.immobilized', { defaultValue: 'Bloqués' })}</span>
                </div>
              )}
            </div>

            <div className="space-y-3 flex-grow overflow-y-auto pr-1 custom-scrollbar h-[350px]">
              {dormantItems.length > 0 ? (
                dormantItems.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-200 hover:border-gray-300 transition-all group">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-bold text-gray-900 truncate">{p.name}</span>
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                      <span className="text-[10px] font-bold text-gray-900">{p.stock}u</span>
                      <span className="text-[9px] font-bold text-slate-500">{formatCurrencyLocal(p.value)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12 opacity-20 text-center h-full">
                  <Archive className="size-12 mb-2" />
                  <span className="text-[10px] font-black uppercase tracking-widest">{t('dashboard.charts.no_dormant', { defaultValue: 'Aucun rossignol' })}</span>
                </div>
              )}
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-100 shrink-0">
              <Link to="/app/stock-analysis?tab=unsold&days=90" className="inline-flex items-center justify-center w-full px-3 py-2 bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold gap-2 rounded-lg border border-gray-100 transition-colors">
                {t('dashboard.charts.see_all_dormant', { defaultValue: 'Voir la liste complète' })}
                <ArrowRight className="size-3" />
              </Link>
            </div>
          </div>
        </div>

        {/* Surstock (Excédents) */}
        <div className="bg-white rounded-xl shadow-sm border border-orange-200 overflow-hidden h-full flex flex-col">
          <div className="p-6 flex flex-col h-full">
            <div className="flex items-center justify-between mb-6 shrink-0">
              <div
                className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => navigate('/app/stock-analysis?tab=overstock')}
              >
                <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
                  <TrendingUp className="size-5" />
                </div>
                <div>
                  <h2 className="text-xs font-bold text-gray-900 tracking-tight uppercase">Surstock</h2>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Produits en excédent</p>
                </div>
              </div>
              {overstockTotal > 0 && (
                <div className="text-right">
                  <span className="text-xs font-black text-orange-700 block">{formatCurrencyLocal(overstockTotal)}</span>
                  <span className="text-[9px] font-bold text-orange-400 uppercase tracking-wider">Capital bloqué</span>
                </div>
              )}
            </div>

            <div className="space-y-3 flex-grow overflow-y-auto pr-1 custom-scrollbar h-[350px]">
              {overstockItems.length > 0 ? (
                overstockItems.map((p: any, i: number) => (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-orange-50/60 border border-orange-100 hover:border-orange-300 transition-all group">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-black text-orange-500 bg-orange-100 size-6 flex items-center justify-center rounded-lg border border-orange-200 shrink-0">{i + 1}</span>
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-gray-900 truncate block">{p.name}</span>
                        <span className="text-[9px] font-bold text-orange-500/70 uppercase tracking-widest">
                          {p.excess_qty != null ? `+${p.excess_qty} unités en excès` : `Stock: ${p.stock}u`}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end shrink-0 ml-2">
                      <span className="text-[10px] font-bold text-orange-700">{formatCurrencyLocal(p.excess_value ?? p.value ?? 0)}</span>
                      <span className="text-[9px] font-bold text-gray-400">excédent</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12 opacity-20 text-center h-full">
                  <TrendingUp className="size-12 mb-2" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Aucun surstock détecté</span>
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-orange-100 shrink-0">
              <Link
                to="/app/stock-analysis?tab=overstock"
                className="inline-flex items-center justify-center w-full px-3 py-2 bg-white hover:bg-orange-50 text-orange-700 text-xs font-bold gap-2 rounded-lg border border-orange-100 transition-colors"
              >
                Voir tous les surstocks
                <ArrowRight className="size-3" />
              </Link>
            </div>
          </div>
        </div>

        {/* Promis Disponibles Alert */}
        {promisDisponibles.length > 0 && (
          <div className="bg-emerald-50 rounded-xl shadow-sm border border-emerald-100 overflow-hidden h-full flex flex-col">
            <div className="p-6 flex flex-col h-full">
              <div
                className="flex items-center justify-between mb-4 cursor-pointer hover:opacity-80 transition-opacity shrink-0"
                onClick={() => navigate('/app/promis')}
              >
                <div className="flex items-center gap-2">
                  <ShoppingBag className="size-5 text-emerald-600" />
                  <h2 className="text-sm font-bold text-emerald-800 tracking-tight uppercase">{t('alerts.promis_title')}</h2>
                </div>
                <span className="bg-emerald-600 text-white px-2 py-0.5 rounded-lg text-[10px] font-bold">{promisDisponibles.length}</span>
              </div>
              <div className="space-y-2 flex-grow overflow-y-auto pr-1 custom-scrollbar h-[350px]">
                {promisDisponibles.slice(0, 5).map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-white border border-emerald-100 shadow-sm transition-all hover:border-emerald-300">
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-bold text-gray-900 block truncate">{p.produit_nom}</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">{p.client.length > 15 ? p.client.substring(0, 15) + '...' : p.client}</span>
                        <span className="text-[10px] text-gray-400">•</span>
                        <span className="text-[10px] font-bold text-gray-500">{p.quantite} {t('alerts.units')}</span>
                      </div>
                    </div>
                    <div className="bg-emerald-50 text-emerald-700 font-bold text-[9px] px-2 py-1 rounded-lg uppercase tracking-widest">
                      {t('alerts.days_left', { count: p.jours_attente })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 shrink-0">
                <Link to="/app/promis" className="inline-flex items-center justify-center w-full px-3 py-2 text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded-lg font-bold text-[10px] uppercase tracking-widest transition-colors">
                  {t('alerts.deliver_promis')}
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Reappro Rayon Alert */}
        {reapproStats && reapproStats.product_count > 0 && (
          <div className="bg-blue-50 rounded-xl shadow-sm border border-blue-100 overflow-hidden h-full flex flex-col">
            <div className="p-6 flex flex-col h-full">
              <div
                className="flex items-center justify-between mb-4 cursor-pointer hover:opacity-80 transition-opacity shrink-0"
                onClick={() => navigate('/app/reappro-rayon')}
              >
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                    <Package className="size-5" />
                  </div>
                  <h2 className="text-sm font-bold text-blue-800 tracking-tight uppercase">Réappro Rayon</h2>
                </div>
                <span className="bg-blue-600 text-white px-2.5 py-1 rounded-lg text-xs font-bold animate-pulse">
                  {reapproStats.product_count}
                </span>
              </div>

              <div className="flex-grow flex flex-col items-center justify-center p-4 text-center h-[350px]">
                <div className="size-20 bg-blue-100/50 rounded-full flex items-center justify-center mb-4 border-4 border-white shadow-inner">
                  <Package className="size-10 text-blue-500" />
                </div>
                <p className="text-sm font-bold text-blue-900 leading-tight">
                  {reapproStats.product_count} produits en attente de transfert
                </p>
                <p className="text-[10px] text-blue-600 font-medium mt-1">
                  Le niveau en rayon est passé sous le seuil critique
                </p>

                {reapproStats.total_units_suggested > 0 && (
                  <div className="mt-4 px-4 py-2 bg-blue-100/30 rounded-xl border border-blue-100/50">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600 block">Suggestion totale</span>
                    <span className="text-lg font-bold text-blue-800">+{reapproStats.total_units_suggested} <small className="text-xs">unités</small></span>
                  </div>
                )}
              </div>

              <div className="mt-4 shrink-0">
                <Link to="/app/reappro-rayon" className="inline-flex items-center justify-center w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-[10px] uppercase tracking-widest gap-2 transition-colors">
                  Aller au menu réappro
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Stock Alerts */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-full flex flex-col">
          <div className="p-6 flex flex-col h-full">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <div
                className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => navigate('/app/ruptures')}
              >
                <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                  <Package className="size-5" />
                </div>
                <div>
                  <h2 className="text-xs font-bold text-gray-900 tracking-tight uppercase">{t('alerts.stock_title')}</h2>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('alerts.stock_subtitle')}</p>
                </div>
              </div>
              {stats && (stats.low_stock?.value || 0) > 0 && (
                <span className="bg-amber-500 text-white px-2 py-0.5 rounded-lg text-[10px] font-bold animate-pulse">{stats.low_stock?.value || 0}</span>
              )}
            </div>
            <div className="space-y-3 flex-grow overflow-y-auto pr-1 custom-scrollbar h-[350px]">
              {lowStockItems.length === 0 ? (
                <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 text-center py-6 border-2 border-dashed border-gray-100 rounded-xl h-full flex items-center justify-center">
                  <ShoppingBag className="size-8 mb-2 opacity-20" />
                  {t('alerts.no_stock_alerts')}
                </div>
              ) : (
                lowStockItems.slice(0, 10).map((item, i) => (
                  <div key={i} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${item.stock <= 0 ? 'bg-red-50 border-red-100 shadow-sm' : 'bg-amber-50 border-amber-100'}`}>
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${item.stock <= 0 ? 'text-red-700' : 'text-amber-700'}`}>
                      {item.stock <= 0 ? t('alerts.rupture') : t('alerts.remaining_stock', { count: item.stock })}
                    </span>
                    {item.days_remaining > 0 && item.stock > 0 && (
                      <span className="text-[9px] font-bold text-gray-300 uppercase tracking-widest">
                        {Math.round(item.days_remaining)} {t('alerts.remaining_days')}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
            <div className="flex gap-2 mt-4 shrink-0">
              {lowStockItems.length > 0 && (
                <button
                  className="inline-flex items-center justify-center flex-1 px-3 py-2 bg-indigo-600 text-white text-[9px] font-bold uppercase tracking-widest rounded-lg hover:bg-indigo-700 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate('/app/commandes/locales', {
                      state: {
                        createFromStockAlert: {
                          products: lowStockItems.map(item => ({
                            id: item.id,
                            name: item.name,
                            stock: item.stock
                          }))
                        }
                      }
                    });
                  }}
                >
                  {t('alerts.order')}
                </button>
              )}
              <Link
                to="/app/ruptures"
                className="inline-flex items-center justify-center flex-1 px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-500 text-[9px] font-bold uppercase tracking-widest rounded-lg border border-gray-200 transition-colors"
              >
                {t('alerts.view_all')}
              </Link>
            </div>
          </div>
        </div>

        {/* Top Products Today - Swapped to last position */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-full flex flex-col">
          <div className="p-6 flex flex-col h-full">
            <div className="flex items-center gap-3 mb-6 shrink-0">
              <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                <Medal className="size-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900 tracking-tight uppercase">{t('dashboard.charts.top_products', { defaultValue: 'Top Produits' })}</h2>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('dashboard.charts.today_bestsellers', { defaultValue: 'Vos meilleures ventes du jour' })}</p>
              </div>
            </div>
            <div className="space-y-3 flex-grow overflow-y-auto pr-1 custom-scrollbar h-[350px]">
              {stats?.top_products && stats.top_products.length > 0 ? (
                stats.top_products.map((p: any, i: number) => (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-200 hover:border-amber-200 transition-all group">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-bold text-amber-600 bg-amber-50 size-6 flex items-center justify-center rounded-lg border border-amber-100">{i + 1}</span>
                      <span className="text-xs font-bold text-gray-900 truncate">{p.name}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] font-bold text-gray-900">{p.qty}u</span>
                      <span className="text-[9px] font-bold text-indigo-600">{formatCurrencyLocal(p.revenue)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12 opacity-20 text-center h-full">
                  <ShoppingBag className="size-12 mb-2" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">{t('dashboard.charts.no_sales', { defaultValue: 'Aucune vente enregistrée' })}</span>
                </div>
              )}
            </div>
          </div>
        </div>
    </div>
  );
}
