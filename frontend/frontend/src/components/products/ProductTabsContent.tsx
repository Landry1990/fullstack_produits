import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { ProduitModel, StockLot } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { formatDate } from '../../utils/dateUtils';

interface ProductTabsContentProps {
  selectedProduit: ProduitModel;
  activeTab: string;
  setActiveTab: (tab: any) => void;
  lots: StockLot[];
  monthlyStats: any[];
  achats: any[];
  stockHistory: any[];
  loadingHistory: boolean;
  onMovementClick: (item: any) => void;
}

// Helper components - Defined first to avoid hoisting issues

const PriceEvolutionChart = ({ achats, t }: { achats: any[]; t: any }) => {
    const [selectedFournisseur, setSelectedFournisseur] = useState<string>('all');

    const fournisseurs = useMemo(() => {
        const names = Array.from(new Set(achats.flatMap((a) => a.fournisseur_name ? [a.fournisseur_name] : [])));
        return names as string[];
    }, [achats]);

    const chartData = useMemo(() => {
        const filtered = selectedFournisseur === 'all'
            ? achats
            : achats.filter((a) => a.fournisseur_name === selectedFournisseur);
        return filtered
            .toSorted((a, b) => new Date(a.commande_date).getTime() - new Date(b.commande_date).getTime())
            .map((a) => ({
                date: new Date(a.commande_date).toLocaleDateString(undefined, { month: 'short', year: '2-digit' }),
                prix: Math.round(Number(a.price_cost)),
                fournisseur: a.fournisseur_name,
                fullDate: formatDate(a.commande_date),
            }));
    }, [achats, selectedFournisseur]);

    if (chartData.length === 0) return null;

    const prices = chartData.map((d) => d.prix);
    const minPrix = Math.min(...prices);
    const maxPrix = Math.max(...prices);
    const firstPrix = prices[0];
    const lastPrix = prices[prices.length - 1];
    const hasMultiplePoints = chartData.length > 1;
    const variation = hasMultiplePoints && firstPrix > 0 ? ((lastPrix - firstPrix) / firstPrix) * 100 : 0;
    const isHausse = variation > 0;
    const isStable = Math.abs(variation) < 1;

    return (
        <div className="mb-4 bg-base-200/30 rounded-2xl border border-base-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                    <span className="text-base font-black uppercase tracking-wider text-base-content/70">
                        📈 {t('products:detail.purchases.price_evolution', { defaultValue: 'Évolution Prix Achat' })}
                    </span>
                    {hasMultiplePoints && (
                        <span className={`badge badge-md font-black ${
                            isStable ? 'badge-ghost' : isHausse ? 'badge-error' : 'badge-success'
                        }`}>
                            {isStable ? '→' : isHausse ? '▲' : '▼'} {Math.abs(variation).toFixed(1)}%
                        </span>
                    )}
                </div>
                {fournisseurs.length > 1 && (
                    <select
                        className="select select-bordered select-xs font-bold"
                        value={selectedFournisseur}
                        onChange={(e) => setSelectedFournisseur(e.target.value)}
                    >
                        <option value="all">{t('products:detail.purchases.all_providers', { defaultValue: 'Tous les fournisseurs' })}</option>
                        {fournisseurs.map((f) => (
                            <option key={f} value={f}>{f}</option>
                        ))}
                    </select>
                )}
            </div>

            <div className="flex gap-4 mb-3 text-xs">
                <span className="font-bold text-base-content/50">
                    Min : <span className="text-success font-black">{formatCurrency(minPrix)}</span>
                </span>
                <span className="font-bold text-base-content/50">
                    Max : <span className="text-error font-black">{formatCurrency(maxPrix)}</span>
                </span>
                <span className="font-bold text-base-content/50">
                    Dernier : <span className="text-blue-600 font-black">{formatCurrency(lastPrix)}</span>
                </span>
            </div>

            <ResponsiveContainer width="100%" height={180}>
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="date" fontSize={10} tick={{ fontWeight: 700 }} />
                    <YAxis
                        fontSize={10}
                        tickFormatter={(v: number) => formatCurrency(v)}
                        domain={['auto', 'auto']}
                        width={70}
                    />
                    <Tooltip
                        formatter={(value: number) => [formatCurrency(value), t('products:detail.purchases.price', { defaultValue: 'Prix achat' })]}
                        labelFormatter={(label: string, payload: readonly any[]) => {
                            const item = payload?.[0]?.payload;
                            return item ? `${item.fullDate}${item.fournisseur ? ` — ${item.fournisseur}` : ''}` : label;
                        }}
                        contentStyle={{ fontSize: 12, fontWeight: 700 }}
                    />
                    {hasMultiplePoints && <ReferenceLine y={minPrix} stroke="#10b981" strokeDasharray="4 2" strokeWidth={1} />}
                    {hasMultiplePoints && minPrix !== maxPrix && <ReferenceLine y={maxPrix} stroke="#ef4444" strokeDasharray="4 2" strokeWidth={1} />}
                    <Line
                        type="monotone"
                        dataKey="prix"
                        stroke="#3b82f6"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                        activeDot={{ r: 6 }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

const PurchasesTabContent = ({ achats, t }: { achats: any[]; t: any }) => {
    if (!achats || achats.length === 0) return <p className="text-center text-base-content/50 py-8">{t('products:detail.purchases.empty')}</p>;

    return (
        <div>
            <PriceEvolutionChart achats={achats} t={t} />
            <div className="overflow-x-auto">
            <table className="table">
                <thead className="bg-base-200 sticky top-0 border-b border-base-300">
                    <tr>
                        <th className="text-[11px] font-black uppercase tracking-wider">{t('products:detail.purchases.date')}</th>
                        <th className="text-[11px] font-black uppercase tracking-wider">{t('products:detail.purchases.provider')}</th>
                        <th className="text-[11px] font-black uppercase tracking-wider text-right">{t('products:detail.purchases.qty')}</th>
                        <th className="text-[11px] font-black uppercase tracking-wider text-right">{t('products:detail.purchases.price')}</th>
                        <th className="text-[11px] font-black uppercase tracking-wider">{t('products:detail.purchases.lot')}</th>
                        <th className="text-[11px] font-black uppercase tracking-wider">{t('products:detail.purchases.exp')}</th>
                    </tr>
                </thead>
                <tbody>
                    {achats.map((achat) => (
                        <tr key={achat.id} className="hover:bg-base-200/50 transition-colors border-b border-base-100">
                            <td className="text-sm font-mono font-bold text-base-content/70">{formatDate(achat.commande_date)}</td>
                            <td className="text-sm font-bold truncate max-w-[150px]" title={achat.fournisseur_name}>{achat.fournisseur_name}</td>
                            <td className="text-right text-sm font-black">{achat.quantity}</td>
                            <td className="text-right text-sm font-black text-blue-600">
                                {formatCurrency(Math.round(Number(achat.price_cost)))}
                            </td>
                            <td>
                                <span className="badge badge-outline badge-md font-mono font-bold">{achat.lot || '-'}</span>
                            </td>
                            <td className="text-sm font-bold text-base-content/60">
                                {formatDate(achat.date_expiration)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            </div>
        </div>
    );
};

const LotsTabContent = ({ lots, t }: { lots: StockLot[]; t: any }) => {
    if (!lots || lots.length === 0) return <p className="text-center text-base-content/50 py-8">{t('products:detail.lots.empty')}</p>;

    return (
        <div className="overflow-x-auto">
            <table className="table">
                <thead className="bg-base-200 sticky top-0 border-b border-base-300">
                    <tr>
                        <th className="text-[11px] font-black uppercase tracking-wider">{t('products:detail.lots.date_reception')}</th>
                        <th className="text-[11px] font-black uppercase tracking-wider">{t('products:detail.lots.lot_number')}</th>
                        <th className="text-[11px] font-black uppercase tracking-wider">{t('products:detail.lots.expiration')}</th>
                        <th className="text-[11px] font-black uppercase tracking-wider">{t('products:detail.lots.provider')}</th>
                        <th className="text-[11px] font-black uppercase tracking-wider text-right">{t('products:detail.purchases.price', { defaultValue: 'Prix' })}</th>
                        <th className="text-[11px] font-black uppercase tracking-wider text-right">{t('products:detail.lots.initial_qty')}</th>
                        <th className="text-[11px] font-black uppercase tracking-wider text-right">{t('products:detail.lots.remaining_qty')}</th>
                    </tr>
                </thead>
                <tbody>
                    {lots.map((lot) => {
                        const isExpired = lot.date_expiration ? new Date(lot.date_expiration) < new Date() : false;
                        return (
                            <tr key={lot.id} className="hover:bg-base-200/50 transition-colors border-b border-base-100">
                                <td className="text-sm font-mono font-bold text-base-content/70">{formatDate(lot.date_reception)}</td>
                                <td>
                                    <span className="badge badge-outline badge-md font-mono font-black">{lot.lot || '-'}</span>
                                </td>
                                <td>
                                    <span className={`text-sm font-black ${isExpired ? 'text-error' : 'text-base-content'}`}>
                                        {formatDate(lot.date_expiration)}
                                    </span>
                                </td>
                                <td className="text-sm font-bold truncate max-w-[120px]" title={lot.fournisseur_nom}>{lot.fournisseur_nom}</td>
                                <td className="text-right text-sm font-black text-blue-600">
                                    {formatCurrency(Math.round(Number(lot.price_cost || 0)))}
                                </td>
                                <td className="text-right text-sm font-bold">{lot.quantity_initial}</td>
                                <td className="text-right font-black text-sm">
                                    <span className={lot.quantity_remaining > 0 ? 'text-success' : 'text-base-content/30'}>
                                        {lot.quantity_remaining}
                                    </span>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

const StatsTabContent = ({ monthlyStats, t }: { monthlyStats: any[]; t: any }) => {
    if (!monthlyStats || monthlyStats.length === 0) return <p className="text-center text-base-content/50 py-4">{t('products:detail.stats.empty')}</p>;

    let currentYear: number | null = null;
    return (
        <div className="overflow-x-auto max-h-80">
            <table className="table w-full">
                <thead className="bg-base-200 sticky top-0 border-b border-base-300">
                    <tr>
                    <th className="text-[11px] font-black uppercase whitespace-nowrap"></th>
                    <th className="text-[11px] font-black uppercase whitespace-nowrap">{t('products:detail.stats.month')}</th>
                    <th className="text-[11px] font-black uppercase text-right text-primary whitespace-nowrap">{t('products:detail.stats.qty_sold')}</th>
                    <th className="text-[11px] font-black uppercase text-right text-warning whitespace-nowrap">{t('products:detail.stats.qty_ordered')}</th>
                    <th className="text-[11px] font-black uppercase text-right text-info whitespace-nowrap">{t('products:detail.stats.nb_clients')}</th>
                    </tr>
                </thead>
                <tbody>
                    {(monthlyStats || []).map((stat, index) => {
                        const showYear = stat.year !== currentYear;
                        currentYear = stat.year;
                        return (
                            <tr key={index} className={`border-b border-base-100 ${showYear ? 'border-t-2 border-base-300' : ''}`}>
                                <td className="font-black text-sm text-base-content/60">
                                    {showYear ? stat.year : ''}
                                </td>
                                <td className="text-sm font-bold">{stat.month_name}</td>
                                <td className="text-right font-mono font-black text-sm text-primary">{stat.qte_v}</td>
                                <td className="text-right font-mono font-bold text-sm text-warning">{stat.qte_c}</td>
                                <td className="text-right font-mono font-bold text-sm text-info">{stat.nb_c}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            <div className="mt-2 text-[10px] text-base-content/50 flex justify-around">
                <span>{t('products:detail.stats.legend_sold')}</span>
                <span>{t('products:detail.stats.legend_ordered')}</span>
                <span>{t('products:detail.stats.legend_count')}</span>
            </div>
        </div>
    );
};

const MovementsTabContent = ({ stockHistory, loadingHistory, onMovementClick, t }: { stockHistory: any[]; loadingHistory: boolean; onMovementClick: (item: any) => void; t: any }) => {
    if (loadingHistory) return (
        <div className="flex justify-center py-12">
            <span className="loading loading-spinner loading-lg"></span>
        </div>
    );

    if (!stockHistory || stockHistory.length === 0) return <p className="text-center text-base-content/50 py-8">{t('products:detail.movements.empty')}</p>;

    return (
        <div className="overflow-x-auto">
            <table className="table">
                <thead className="bg-base-200 sticky top-0 border-b border-base-300">
                    <tr>
                        <th className="text-[11px] font-black uppercase tracking-wider">{t('products:detail.movements.date')}</th>
                        <th className="text-[11px] font-black uppercase tracking-wider">{t('products:detail.movements.type')}</th>
                        <th className="text-[11px] font-black uppercase tracking-wider">{t('products:detail.movements.label')}</th>
                        <th className="text-[11px] font-black uppercase tracking-wider">{t('products:detail.movements.operator')}</th>
                        <th className="text-[11px] font-black uppercase tracking-wider text-right">{t('products:detail.movements.before')}</th>
                        <th className="text-[11px] font-black uppercase tracking-wider text-right">{t('products:detail.movements.qty')}</th>
                        <th className="text-[11px] font-black uppercase tracking-wider text-right">{t('products:detail.movements.after')}</th>
                    </tr>
                </thead>
                <tbody>
                    {(stockHistory || []).map((item, index) => {
                        const isPositive = item.type === 'AJUSTEMENT' 
                            ? item.quantity > 0 
                            : ['ENTREE', 'RETOUR', 'TRANSFORMATION_ENTREE'].includes(item.type);
                        
                        const cleanedLibelle = (item.libelle || '')
                            .replace(/\s*\(FAC.*?\)/gi, '')
                            .replace(/\s*-\s*Lot:.*?(?=\s*-\s*|$)/gi, '')
                            .trim();

                        return (
                            <tr 
                                key={index} 
                                className={`hover:bg-base-200/50 transition-colors border-b border-base-100 ${(item.facture || item.commande) ? 'cursor-pointer' : ''}`}
                                onClick={() => onMovementClick(item)}
                            >
                                <td className="whitespace-nowrap text-sm font-mono font-bold text-base-content/70">
                                    {formatDate(item.date)}
                                </td>
                                <td>
                                    <span className={`badge badge-md whitespace-nowrap font-black tracking-tight ${
                                        item.type === 'AJUSTEMENT' 
                                            ? 'badge-warning text-warning-content'
                                            : isPositive ? 'badge-success text-white' : 'badge-error text-white'
                                    }`}>
                                        {t(`products:detail.movements.types.${item.type}`, { defaultValue: item.type })}
                                    </span>
                                </td>
                                <td className="text-sm font-bold" title={item.libelle}>
                                    <div className="flex items-center gap-1">
                                        {(item.facture || item.commande) && (
                                            <span className="text-primary" title={item.facture ? t('products:detail.movements.view_invoice') : t('products:detail.movements.view_order')}>🔍</span>
                                        )}
                                        {cleanedLibelle}
                                        {item.commande_numero && (
                                            <span className="badge badge-ghost badge-md font-mono font-black ml-auto">
                                                {item.commande_numero}
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="text-sm font-bold text-base-content/60">{item.user || item.user_nom || '-'}</td>
                                <td className="text-right font-mono text-sm font-bold opacity-50">{item.stock_avant}</td>
                                <td className={`text-right font-black text-sm ${isPositive ? 'text-success' : 'text-error'}`}>
                                    {isPositive ? '+' : ''}{item.quantity}
                                </td>
                                <td className="text-right font-mono font-black text-sm">{item.stock_apres}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

// Main Component
export const ProductTabsContent: React.FC<ProductTabsContentProps> = ({
  selectedProduit,
  activeTab,
  setActiveTab,
  lots,
  monthlyStats,
  achats,
  stockHistory,
  loadingHistory,
  onMovementClick
}) => {
  const { t } = useTranslation(['products', 'common']);

  return (
    <div className="flex flex-col h-full">
      {/* Onglets */}
      <div className="bg-base-200 shrink-0 border-b border-base-300">
        <div role="tablist" className="tabs tabs-boxed bg-transparent rounded-none px-4 pt-2 flex-nowrap overflow-x-auto scrollbar-hide">
        {[
          { id: 'general', label: t('products:detail.tabs.general') },
          { id: 'prix', label: t('products:detail.tabs.price') },
          { id: 'achats', label: t('products:detail.tabs.purchases') },
          { id: 'lots', label: t('products:detail.tabs.lots') },
          { id: 'stats', label: t('products:detail.tabs.stats') },
          { id: 'mvmts', label: t('products:detail.tabs.movements') }
        ].map((tab) => (
          <a
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`tab font-black uppercase text-xs tracking-tight ${activeTab === tab.id ? 'tab-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </a>
        ))}
      </div>
    </div>

      {/* Contenu des onglets */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'general' && (
          <div className="overflow-x-auto">
            <table className="table">
              <tbody>
                <tr className="border-b border-base-200">
                  <td className="font-bold text-sm text-base-content/40 uppercase tracking-wider w-1/3 py-4">{t('products:detail.general.description')}</td>
                  <td className="uppercase font-black text-sm py-4">{selectedProduit.description || '-'}</td>
                </tr>
                <tr className="border-b border-base-200">
                   <td className="font-bold text-sm text-base-content/40 uppercase tracking-wider py-4">{t('products:detail.general.rayon')}</td>
                  <td className="py-4"><span className="badge badge-info badge-md font-black">{selectedProduit.rayon_name || '-'}</span></td>
                </tr>
                <tr className="border-b border-base-200">
                   <td className="font-bold text-sm text-base-content/40 uppercase tracking-wider py-4">{t('products:detail.general.provider')}</td>
                  <td className="py-4"><span className="badge badge-ghost badge-md font-black">{selectedProduit.fournisseur_name || '-'}</span></td>
                </tr>
                <tr className="border-b border-base-200">
                   <td className="font-bold text-sm text-base-content/40 uppercase tracking-wider py-4">{t('products:detail.general.min_max')}</td>
                  <td className="font-black py-4">{selectedProduit.stock_minimum ?? 0} / {selectedProduit.stock_maximum ?? 0}</td>
                </tr>
                <tr className="border-b border-base-200">
                   <td className="font-bold text-sm text-base-content/40 uppercase tracking-wider py-4">{t('products:detail.general.alert_threshold')}</td>
                  <td className="py-4"><span className="badge badge-warning badge-md font-black">{selectedProduit.stock_alert ?? 0}</span></td>
                </tr>
                <tr className="border-b border-base-200">
                   <td className="font-bold text-sm text-base-content/40 uppercase tracking-wider py-4">{t('products:detail.general.expiration')}</td>
                  <td className="font-mono font-black text-sm py-4">{selectedProduit.expire_date ? (() => {
                    const d = new Date(selectedProduit.expire_date);
                    return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear().toString().slice(-2)}`;
                  })() : '-'}</td>
                </tr>
                <tr className="border-b border-base-200">
                   <td className="font-bold text-sm text-base-content/40 uppercase tracking-wider py-4">{t('products:detail.general.last_purchase')}</td>
                  <td className="font-mono font-bold text-sm py-4">{formatDate(selectedProduit.dernier_achat)}</td>
                </tr>
                <tr className="border-b border-base-200">
                   <td className="font-bold text-sm text-base-content/40 uppercase tracking-wider py-4">{t('products:detail.general.last_sale')}</td>
                  <td className="font-mono font-bold text-sm py-4">{formatDate(selectedProduit.dernier_vente)}</td>
                </tr>
                <tr className="border-b border-base-200">
                   <td className="font-bold text-sm text-base-content/40 uppercase tracking-wider py-4">{t('products:detail.general.lot_management')}</td>
                   <td className="font-bold text-sm py-4">{selectedProduit.use_lot_management ? `✅ ${t('products:detail.general.enabled')}` : `❌ ${t('products:detail.general.disabled')}`}</td>
                </tr>
                <tr className="border-b border-base-200">
                   <td className="font-bold text-sm text-base-content/40 uppercase tracking-wider py-4">{t('products:detail.general.prescription')}</td>
                   <td className="font-bold text-sm py-4">{selectedProduit.requires_prescription ? `✅ ${t('products:detail.general.yes')}` : `❌ ${t('products:detail.general.no')}`}</td>
                </tr>
                <tr>
                   <td className="font-bold text-sm text-base-content/40 uppercase tracking-wider py-4">{t('products:detail.general.surveillance')}</td>
                  <td className="font-bold text-sm py-4">{selectedProduit.surveillance_category === 'NONE' ? '-' : selectedProduit.surveillance_category}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'prix' && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <div className="stat bg-base-200/30 rounded-2xl border border-base-200 p-6">
               <div className="stat-title text-sm font-bold uppercase tracking-wider text-base-content/40">{t('products:detail.price.cost')}</div>
              <div className="stat-value text-blue-600 text-3xl font-black">{formatCurrency(Math.round(Number(selectedProduit.cost_price || 0)))}</div>
            </div>
            <div className="stat bg-primary text-primary-content rounded-2xl p-6 shadow-lg shadow-primary/20">
               <div className="stat-title text-primary-content/80 text-sm font-bold uppercase tracking-wider">{t('products:detail.price.selling')}</div>
              <div className="stat-value text-3xl font-black">{formatCurrency(Math.round(Number(selectedProduit.selling_price || 0)))}</div>
            </div>
            <div className="stat bg-base-200/30 rounded-2xl border border-base-200 p-6">
               <div className="stat-title text-sm font-bold uppercase tracking-wider text-base-content/40">{t('products:detail.price.vat')}</div>
              <div className="stat-value text-2xl font-black">{selectedProduit.tva || '19.25'}%</div>
            </div>
            <div className="stat bg-base-200/30 rounded-2xl border border-base-200 p-6">
               <div className="stat-title text-sm font-bold uppercase tracking-wider text-base-content/40">{t('products:detail.price.margin_percent')}</div>
              <div className="stat-value text-2xl font-black text-success">{Number(selectedProduit.pourcentage_marge || 0).toFixed(1)}%</div>
            </div>
            <div className="stat bg-base-200/30 rounded-2xl border border-base-200 p-6">
               <div className="stat-title text-sm font-bold uppercase tracking-wider text-base-content/40">{t('products:detail.price.margin_coeff')}</div>
              <div className="stat-value text-2xl font-black text-success">{Number(selectedProduit.taux_marge || 0).toFixed(2)}</div>
            </div>
            <div className="stat bg-base-200/30 rounded-2xl border border-base-200 p-6">
               <div className="stat-title text-sm font-bold uppercase tracking-wider text-base-content/40">{t('products:detail.price.rotation')}</div>
               <div className="stat-value text-2xl font-black text-info">{Number(selectedProduit.rotation_moyenne || 0).toFixed(1)}<span className="text-xs font-bold uppercase ml-1 opacity-50"> {t('products:detail.price.per_month')}</span></div>
            </div>
          </div>
        )}

        {activeTab === 'achats' && <PurchasesTabContent achats={achats} t={t} />}
        
        {activeTab === 'lots' && <LotsTabContent lots={lots} t={t} />}

        {activeTab === 'stats' && <StatsTabContent monthlyStats={monthlyStats} t={t} />}

        {activeTab === 'mvmts' && <MovementsTabContent stockHistory={stockHistory} loadingHistory={loadingHistory} onMovementClick={onMovementClick} t={t} />}
      </div>
    </div>
  );
};
