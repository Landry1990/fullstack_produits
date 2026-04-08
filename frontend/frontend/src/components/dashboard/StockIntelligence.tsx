import { 
  ShoppingBag, 
  Archive, 
  Medal, 
  ArrowRight,
  Package,
  CalendarDays
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

interface StockIntelligenceProps {
  stats: any;
  lowStockItems: any[];
  expiringLots: any[];
  promisDisponibles: any[];
  expirationMonths: number;
  setExpirationMonths: (val: number) => void;
  getServerDate: () => Date;
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
  t,
  formatCurrencyLocal
}: StockIntelligenceProps) {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 auto-rows-fr">
        {/* Top Products Today */}
        <div className="card bg-base-100 shadow-sm border border-base-300 rounded-2xl overflow-hidden h-full flex flex-col">
          <div className="card-body p-6 flex flex-col h-full">
            <div className="flex items-center gap-3 mb-6 shrink-0">
              <div className="p-2 bg-amber-100 text-amber-600 rounded-xl">
                <Medal className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-black text-base-content tracking-tight uppercase">{t('dashboard.charts.top_products', { defaultValue: 'Top Produits' })}</h2>
                <p className="text-[10px] font-bold text-base-content/30 uppercase tracking-widest">{t('dashboard.charts.today_bestsellers', { defaultValue: 'Vos meilleures ventes du jour' })}</p>
              </div>
            </div>
            <div className="space-y-3 flex-grow overflow-y-auto pr-1 custom-scrollbar min-h-[240px] max-h-[350px]">
              {stats?.top_products && stats.top_products.length > 0 ? (
                stats.top_products.map((p: any, i: number) => (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-base-200/30 border border-base-300/50 hover:border-amber-200 transition-all group">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-black text-amber-600 bg-amber-50 w-6 h-6 flex items-center justify-center rounded-lg border border-amber-100">{i + 1}</span>
                      <span className="text-xs font-bold text-base-content truncate">{p.name}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] font-black text-base-content">{p.qty}u</span>
                      <span className="text-[9px] font-bold text-primary">{formatCurrencyLocal(p.revenue)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12 opacity-20 text-center h-full">
                  <ShoppingBag className="w-12 h-12 mb-2" />
                  <span className="text-[10px] font-black uppercase tracking-widest">{t('dashboard.charts.no_sales', { defaultValue: 'Aucune vente enregistrée' })}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Dormant Stock (Rossignols) */}
        <div className="card bg-base-100 shadow-sm border border-base-300 rounded-2xl overflow-hidden h-full flex flex-col">
          <div className="card-body p-6 flex flex-col h-full">
            <div className="flex items-center justify-between mb-6 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 text-slate-600 rounded-xl">
                  <Archive className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-base-content tracking-tight uppercase">{t('dashboard.charts.dormant_stock', { defaultValue: 'Stock Dormant' })}</h2>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t('dashboard.charts.dormant_desc', { defaultValue: 'Rossignols (+6 mois)' })}</p>
                </div>
              </div>
              {stats?.dormant_stock && stats.dormant_stock.total_value > 0 && (
                <div className="text-right">
                  <span className="text-xs font-black text-slate-700 block">{formatCurrencyLocal(stats.dormant_stock.total_value)}</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{t('dashboard.charts.immobilized', { defaultValue: 'Bloqués' })}</span>
                </div>
              )}
            </div>

            <div className="space-y-3 flex-grow overflow-y-auto pr-1 custom-scrollbar min-h-[240px] max-h-[350px]">
              {stats?.dormant_stock && stats.dormant_stock.top_products.length > 0 ? (
                stats.dormant_stock.top_products.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-base-200/30 border border-base-300/50 hover:border-slate-300 transition-all group">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-bold text-base-content truncate">{p.name}</span>
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                      <span className="text-[10px] font-black text-base-content">{p.stock}u</span>
                      <span className="text-[9px] font-bold text-slate-500">{formatCurrencyLocal(p.value)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12 opacity-20 text-center h-full">
                  <Archive className="w-12 h-12 mb-2" />
                  <span className="text-[10px] font-black uppercase tracking-widest">{t('dashboard.charts.no_dormant', { defaultValue: 'Aucun rossignol' })}</span>
                </div>
              )}
            </div>
            
            <div className="mt-4 pt-4 border-t border-base-200 shrink-0">
              <Link to="/app/analyse-stock?tab=unsold&days=180" className="btn btn-sm btn-block btn-ghost hover:bg-slate-50 hover:text-slate-700 text-xs font-bold gap-2">
                {t('dashboard.charts.see_all_dormant', { defaultValue: 'Voir la liste complète' })}
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>

        {/* Promis Disponibles Alert */}
        {promisDisponibles.length > 0 && (
          <div className="card bg-emerald-50 shadow-sm border border-emerald-100 rounded-2xl overflow-hidden h-full flex flex-col">
            <div className="card-body p-6 flex flex-col h-full">
              <div 
                className="flex items-center justify-between mb-4 cursor-pointer hover:opacity-80 transition-opacity shrink-0"
                onClick={() => navigate('/app/promis')}
              >
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-emerald-600" />
                  <h2 className="text-sm font-black text-emerald-800 tracking-tight uppercase">{t('alerts.promis_title')}</h2>
                </div>
                <span className="bg-emerald-600 text-white px-2 py-0.5 rounded-lg text-[10px] font-black">{promisDisponibles.length}</span>
              </div>
              <div className="space-y-2 flex-grow overflow-y-auto pr-1 custom-scrollbar min-h-[240px] max-h-[350px]">
                {promisDisponibles.slice(0, 5).map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-base-100 border border-emerald-100 shadow-sm transition-all hover:border-emerald-300">
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-black text-base-content block truncate">{p.produit_nom}</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">{p.client.length > 15 ? p.client.substring(0, 15) + '...' : p.client}</span>
                        <span className="text-[10px] text-base-content/30">•</span>
                        <span className="text-[10px] font-black text-base-content/50">{p.quantite} {t('alerts.units')}</span>
                      </div>
                    </div>
                    <div className="bg-emerald-50 text-emerald-700 font-black text-[9px] px-2 py-1 rounded-lg uppercase tracking-widest">
                      {t('alerts.days_left', { count: p.jours_attente })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 shrink-0">
                <Link to="/app/promis" className="btn btn-sm btn-ghost w-full text-emerald-700 bg-emerald-100 hover:bg-emerald-200 border-none font-black text-[10px] uppercase tracking-widest">
                  {t('alerts.deliver_promis')}
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 auto-rows-fr">
        {/* Stock Alerts */}
        <div className="card bg-base-100 shadow-sm border border-base-300 rounded-2xl overflow-hidden h-full flex flex-col">
          <div className="card-body p-6 flex flex-col h-full">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <div 
                className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => navigate('/app/ruptures')}
              >
                <div className="p-2 bg-amber-100 text-amber-600 rounded-xl">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xs font-black text-base-content tracking-tight uppercase">{t('alerts.stock_title')}</h2>
                  <p className="text-[10px] font-bold text-base-content/30 uppercase tracking-widest">{t('alerts.stock_subtitle')}</p>
                </div>
              </div>
              {stats && (stats.low_stock?.value || 0) > 0 && (
                <span className="bg-amber-500 text-white px-2 py-0.5 rounded-lg text-[10px] font-black animate-pulse">{stats.low_stock?.value || 0}</span>
              )}
            </div>
            <div className="space-y-3 flex-grow overflow-y-auto pr-1 custom-scrollbar min-h-[300px] max-h-[450px]">
              {lowStockItems.length === 0 ? (
                <div className="text-[10px] font-black uppercase tracking-widest text-base-content/30 text-center py-6 border-2 border-dashed border-base-200 rounded-xl h-full flex items-center justify-center">
                  <ShoppingBag className="w-8 h-8 mb-2 opacity-20" />
                  {t('alerts.no_stock_alerts')}
                </div>
              ) : (
                lowStockItems.slice(0, 10).map((item, i) => (
                  <div key={i} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${item.stock <= 0 ? 'bg-red-50 border-red-100 shadow-sm' : 'bg-amber-50 border-amber-100'}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-1.5 h-1.5 rounded-full ${item.stock <= 0 ? 'bg-red-500 animate-pulse' : 'bg-amber-500'}`}></div>
                      <div className="flex flex-col min-w-0">
                          <span className="text-xs font-black text-base-content truncate">{item.name}</span>
                          {item.status && item.status !== 'Rupture' && item.status !== t('alerts.rupture') && (
                              <span className="text-[9px] text-base-content/40 font-black uppercase tracking-widest">
                                  {item.status}
                              </span>
                          )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end shrink-0 ml-3">
                          <span className={`text-[10px] font-black uppercase tracking-widest ${item.stock <= 0 ? 'text-red-700' : 'text-amber-700'}`}>
                              {item.stock <= 0 ? t('alerts.rupture') : t('alerts.remaining_stock', { count: item.stock })}
                          </span>
                          {item.days_remaining > 0 && item.stock > 0 && (
                              <span className="text-[9px] font-bold text-base-content/20 uppercase tracking-widest">
                                  {Math.round(item.days_remaining)} {t('alerts.remaining_days')}
                              </span>
                          )}
                    </div>
                  </div>
                ) as any)
              )}
            </div>
            <div className="flex gap-2 mt-4 shrink-0">
              {lowStockItems.length > 0 && (
                <button 
                  className="btn btn-primary btn-sm flex-1 text-[9px] font-black uppercase tracking-widest rounded-lg"
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
                className="btn btn-ghost bg-base-100 hover:bg-base-200 btn-sm flex-1 text-base-content/60 text-[9px] font-black uppercase tracking-widest rounded-lg border border-base-300"
              >
                {t('alerts.view_all')}
              </Link>
            </div>
          </div>
        </div>

        {/* Expiring Lots */}
        <div className="card bg-base-100 shadow-sm border border-base-300 rounded-2xl overflow-hidden h-full flex flex-col">
          <div className="card-body p-6 flex flex-col h-full">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <div 
                className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => navigate('/app/perimes')}
              >
                <div className="p-2 bg-red-100 text-red-600 rounded-xl">
                  <CalendarDays className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xs font-black text-base-content tracking-tight uppercase">{t('alerts.expiry_title')}</h2>
                  <p className="text-[10px] font-bold text-base-content/30 uppercase tracking-widest">{t('alerts.expiry_subtitle')}</p>
                </div>
              </div>
            </div>
            
            <div className="form-control mb-4 shrink-0">
              <select 
                className="select select-bordered select-xs h-8 text-[10px] font-black uppercase tracking-widest text-base-content/50 rounded-lg bg-base-100 border-base-300 w-full focus:outline-none focus:border-primary"
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

            <div className="space-y-2 flex-grow overflow-y-auto pr-1 custom-scrollbar min-h-[300px] max-h-[450px]">
              {expiringLots.length === 0 ? (
                <div className="text-[10px] font-black uppercase tracking-widest text-base-content/30 text-center py-6 border-2 border-dashed border-base-200 rounded-xl h-full flex items-center justify-center">
                  <CalendarDays className="w-8 h-8 mb-2 opacity-20" />
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
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotStyle} ${daysUntilExpiry <= 7 ? 'animate-ping' : ''}`}></div>
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-black block truncate">{lot.produit_nom}</span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[9px] font-bold opacity-40 uppercase tracking-widest">LOT {lot.lot || 'N/A'}</span>
                            <span className="text-[9px] font-black opacity-60 uppercase tracking-widest">
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
              <Link to="/app/perimes" className="btn btn-ghost bg-base-100 hover:bg-base-200 btn-sm w-full text-base-content/60 text-[9px] font-black uppercase tracking-widest rounded-lg border border-base-300">
                {t('alerts.manage_perimes')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
