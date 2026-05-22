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
        <div className="mb-4 bg-base-200 rounded-2xl border border-base-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                    <span className="text-base font-black uppercase tracking-wider text-base-content/60">
                        📈 {t('products:detail.purchases.price_evolution', { defaultValue: 'Évolution Prix Achat' })}
                    </span>
                    {hasMultiplePoints && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            isStable ? 'bg-base-200 text-base-content/60' : isHausse ? 'bg-error/10 text-error' : 'bg-success/10 text-success'
                        }`}>
                            {isStable ? '→' : isHausse ? '▲' : '▼'} {Math.abs(variation).toFixed(1)}%
                        </span>
                    )}
                </div>
                {fournisseurs.length > 1 && (
                    <select
                        className="h-8 px-3 text-xs font-semibold border border-base-300 rounded-lg bg-base-100 text-base-content focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
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
                    Dernier : <span className="text-info font-black">{formatCurrency(lastPrix)}</span>
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
                <thead className="bg-base-100 sticky top-0 border-b border-base-300">
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
                        <tr key={achat.id} className="hover:bg-base-200 transition-colors border-b border-gray-50">
                            <td className="text-sm font-mono font-bold text-base-content/60">{formatDate(achat.commande_date)}</td>
                            <td className="text-sm font-bold truncate max-w-[150px]" title={achat.fournisseur_name}>{achat.fournisseur_name}</td>
                            <td className="text-right text-sm font-black">{achat.quantity}</td>
                            <td className="text-right text-sm font-black text-info">
                                {formatCurrency(Math.round(Number(achat.price_cost)))}
                            </td>
                            <td>
                                <span className="inline-flex items-center px-2 py-0.5 rounded border border-base-300 text-xs font-mono font-semibold text-base-content/70 bg-base-200">{achat.lot || '-'}</span>
                            </td>
                            <td className="text-sm font-bold text-base-content/50">
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
                <thead className="bg-base-100 sticky top-0 border-b border-base-300">
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
                            <tr key={lot.id} className="hover:bg-base-200 transition-colors border-b border-gray-50">
                                <td className="text-sm font-mono font-bold text-base-content/60">{formatDate(lot.date_reception)}</td>
                                <td>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded border border-base-300 text-xs font-mono font-bold text-base-content bg-base-200">{lot.lot || '-'}</span>
                                </td>
                                <td>
                                    <span className={`text-sm font-black ${isExpired ? 'text-error' : 'text-base-content'}`}>
                                        {formatDate(lot.date_expiration)}
                                    </span>
                                </td>
                                <td className="text-sm font-bold truncate max-w-[120px]" title={lot.fournisseur_nom}>{lot.fournisseur_nom}</td>
                                <td className="text-right text-sm font-black text-info">
                                    {formatCurrency(Math.round(Number(lot.price_cost || 0)))}
                                </td>
                                <td className="text-right text-sm font-bold">{lot.quantity_initial}</td>
                                <td className="text-right font-black text-sm">
                                    <span className={lot.quantity_remaining > 0 ? 'text-success' : 'text-base-content/40'}>
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
                <thead className="bg-base-100 sticky top-0 border-b border-base-300">
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
                            <tr key={index} className={`border-b border-gray-50 ${showYear ? 'border-t-2 border-base-300' : ''}`}>
                                <td className="font-black text-sm text-base-content/50">
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
            <div className="animate-spin rounded-full size-8 border-b-2 border-indigo-600"></div>
        </div>
    );

    if (!stockHistory || stockHistory.length === 0) return <p className="text-center text-base-content/50 py-8">{t('products:detail.movements.empty')}</p>;

    return (
        <div className="overflow-x-auto">
            <table className="table">
                <thead className="bg-base-100 sticky top-0 border-b border-base-300">
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
                                className={`hover:bg-base-200 transition-colors border-b border-gray-50 ${(item.facture || item.commande) ? 'cursor-pointer' : ''}`}
                                onClick={() => onMovementClick(item)}
                            >
                                <td className="whitespace-nowrap text-sm font-mono font-bold text-base-content/60">
                                    {formatDate(item.date)}
                                </td>
                                <td>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap ${
                                        item.type === 'AJUSTEMENT'
                                            ? 'bg-warning/10 text-warning border border-amber-100'
                                            : isPositive ? 'bg-success/10 text-success border border-emerald-100' : 'bg-error/10 text-error border border-red-100'
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
                                            <span className="inline-flex items-center px-2 py-0.5 rounded border border-base-300 text-xs font-mono font-bold text-base-content/60 bg-base-200 ml-auto">
                                                {item.commande_numero}
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="text-sm font-bold text-base-content/50">{item.user || item.user_nom || '-'}</td>
                                <td className="text-right font-mono text-sm font-bold text-base-content/50">{item.stock_avant}</td>
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
      <div className="bg-base-100 shrink-0 border-b border-base-300">
        <div className="flex gap-1 px-4 pt-3 pb-2 overflow-x-auto">
        {[
          { id: 'general', label: t('products:detail.tabs.general') },
          { id: 'prix', label: t('products:detail.tabs.price') },
          { id: 'achats', label: t('products:detail.tabs.purchases') },
          { id: 'lots', label: t('products:detail.tabs.lots') },
          { id: 'stats', label: t('products:detail.tabs.stats') },
          { id: 'mvmts', label: t('products:detail.tabs.movements') }
        ].map((tab) => (
          <button
            key={tab.id}
            className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-tight rounded-lg transition-colors whitespace-nowrap ${activeTab === tab.id ? 'bg-primary/10 text-primary' : 'text-base-content/60 hover:bg-base-200 hover:text-base-content'}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
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
                  <td className="font-bold text-sm text-base-content/50 uppercase tracking-wider w-1/3 py-4">{t('products:detail.general.description')}</td>
                  <td className="uppercase font-black text-sm py-4">{selectedProduit.description || '-'}</td>
                </tr>
                <tr className="border-b border-base-200">
                   <td className="font-bold text-sm text-base-content/50 uppercase tracking-wider py-4">{t('products:detail.general.rayon')}</td>
                  <td className="py-4"><span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-info/10 text-info border border-blue-100">{selectedProduit.rayon_name || '-'}</span></td>
                </tr>
                <tr className="border-b border-base-200">
                   <td className="font-bold text-sm text-base-content/50 uppercase tracking-wider py-4">{t('products:detail.general.provider')}</td>
                  <td className="py-4"><span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-base-200 text-base-content/70 border border-base-300">{selectedProduit.fournisseur_name || '-'}</span></td>
                </tr>
                <tr className="border-b border-base-200">
                   <td className="font-bold text-sm text-base-content/50 uppercase tracking-wider py-4">{t('products:detail.general.min_max')}</td>
                  <td className="font-black py-4">{selectedProduit.stock_minimum ?? 0} / {selectedProduit.stock_maximum ?? 0}</td>
                </tr>
                <tr className="border-b border-base-200">
                   <td className="font-bold text-sm text-base-content/50 uppercase tracking-wider py-4">{t('products:detail.general.alert_threshold')}</td>
                  <td className="py-4"><span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-warning/10 text-warning border border-amber-100">{selectedProduit.stock_alert ?? 0}</span></td>
                </tr>
                <tr className="border-b border-base-200">
                   <td className="font-bold text-sm text-base-content/50 uppercase tracking-wider py-4">{t('products:detail.general.expiration')}</td>
                  <td className="font-mono font-black text-sm py-4">{selectedProduit.expire_date ? (() => {
                    const d = new Date(selectedProduit.expire_date);
                    return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear().toString().slice(-2)}`;
                  })() : '-'}</td>
                </tr>
                <tr className="border-b border-base-200">
                   <td className="font-bold text-sm text-base-content/50 uppercase tracking-wider py-4">{t('products:detail.general.last_purchase')}</td>
                  <td className="font-mono font-bold text-sm py-4">{formatDate(selectedProduit.dernier_achat)}</td>
                </tr>
                <tr className="border-b border-base-200">
                   <td className="font-bold text-sm text-base-content/50 uppercase tracking-wider py-4">{t('products:detail.general.last_sale')}</td>
                  <td className="font-mono font-bold text-sm py-4">{formatDate(selectedProduit.dernier_vente)}</td>
                </tr>
                <tr className="border-b border-base-200">
                   <td className="font-bold text-sm text-base-content/50 uppercase tracking-wider py-4">{t('products:detail.general.lot_management')}</td>
                   <td className="font-bold text-sm py-4">{selectedProduit.use_lot_management ? `✅ ${t('products:detail.general.enabled')}` : `❌ ${t('products:detail.general.disabled')}`}</td>
                </tr>
                <tr className="border-b border-base-200">
                   <td className="font-bold text-sm text-base-content/50 uppercase tracking-wider py-4">{t('products:detail.general.prescription')}</td>
                   <td className="font-bold text-sm py-4">{selectedProduit.requires_prescription ? `✅ ${t('products:detail.general.yes')}` : `❌ ${t('products:detail.general.no')}`}</td>
                </tr>
                <tr>
                   <td className="font-bold text-sm text-base-content/50 uppercase tracking-wider py-4">{t('products:detail.general.surveillance')}</td>
                  <td className="font-bold text-sm py-4">{selectedProduit.surveillance_category === 'NONE' ? '-' : selectedProduit.surveillance_category}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'prix' && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-base-200 rounded-xl border border-base-200 p-5">
               <div className="text-xs font-bold uppercase tracking-wider text-base-content/50 mb-2">{t('products:detail.price.cost')}</div>
              <div className="text-info text-2xl font-bold">{formatCurrency(Math.round(Number(selectedProduit.cost_price || 0)))}</div>
            </div>
            <div className="bg-primary text-white rounded-xl p-5 shadow-sm">
               <div className="text-indigo-100 text-xs font-bold uppercase tracking-wider mb-2">{t('products:detail.price.selling')}</div>
              <div className="text-2xl font-bold">{formatCurrency(Math.round(Number(selectedProduit.selling_price || 0)))}</div>
            </div>
            <div className="bg-base-200 rounded-xl border border-base-200 p-5">
               <div className="text-xs font-bold uppercase tracking-wider text-base-content/50 mb-2">{t('products:detail.price.vat')}</div>
              <div className="text-2xl font-bold text-base-content">{selectedProduit.tva || '19.25'}%</div>
            </div>
            <div className="bg-base-200 rounded-xl border border-base-200 p-5">
               <div className="text-xs font-bold uppercase tracking-wider text-base-content/50 mb-2">{t('products:detail.price.margin_percent')}</div>
              <div className="text-2xl font-bold text-success">{Number(selectedProduit.pourcentage_marge || 0).toFixed(1)}%</div>
            </div>
            <div className="bg-base-200 rounded-xl border border-base-200 p-5">
               <div className="text-xs font-bold uppercase tracking-wider text-base-content/50 mb-2">{t('products:detail.price.margin_coeff')}</div>
              <div className="text-2xl font-bold text-success">{Number(selectedProduit.taux_marge || 0).toFixed(2)}</div>
            </div>
            <div className="bg-base-200 rounded-xl border border-base-200 p-5">
               <div className="text-xs font-bold uppercase tracking-wider text-base-content/50 mb-2">{t('products:detail.price.rotation')}</div>
               <div className="text-2xl font-bold text-info">{Number(selectedProduit.rotation_moyenne || 0).toFixed(1)}<span className="text-xs font-bold uppercase ml-1 text-base-content/50"> {t('products:detail.price.per_month')}</span></div>
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
