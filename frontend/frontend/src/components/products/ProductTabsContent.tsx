import React, { useState, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useRecharts } from '../../hooks/useRecharts';
import type { ProduitModel, StockLot } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { formatDate } from '../../utils/dateUtils';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { Button } from '../ui/Button';
import { Input } from '../shadcn/input';
import { Select } from '../ui/Select';
import { Loader2, Check, X, Pencil } from 'lucide-react';

interface ProductTabsContentProps {
  selectedProduit: ProduitModel;
  activeTab: string;
  setActiveTab: (tab: unknown) => void;
  lots: StockLot[];
  monthlyStats: unknown[];
  achats: unknown[];
  stockHistory: unknown[];
  loadingHistory: boolean;
  onMovementClick: (item: unknown) => void;
}

// Helper components - Defined first to avoid hoisting issues

const PriceEvolutionChart = ({ achats, t }: { achats: unknown[]; t: unknown }) => {
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
            .slice().sort((a, b) => new Date(a.commande_date).getTime() - new Date(b.commande_date).getTime())
            .map((a) => ({
                date: new Date(a.commande_date).toLocaleDateString(undefined, { month: 'short', year: '2-digit' }),
                prix: Math.round(Number(a.price_cost)),
                fournisseur: a.fournisseur_name,
                fullDate: formatDate(a.commande_date),
            }));
    }, [achats, selectedFournisseur]);

    const Recharts = useRecharts();
    if (!Recharts) return <div className="flex items-center justify-center p-8"><Loader2 className="size-8 animate-spin text-slate-400" /></div>;
    const { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } = Recharts;

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
        <div className="mb-4 bg-slate-100 rounded-2xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                    <span className="text-base font-black uppercase tracking-wider text-slate-400">
                        📈 {t('products:detail.purchases.price_evolution', { defaultValue: 'Évolution Prix Achat' })}
                    </span>
                    {hasMultiplePoints && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            isStable ? 'bg-slate-200 text-slate-500' : isHausse ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                        }`}>
                            {isStable ? '→' : isHausse ? '▲' : '▼'} {Math.abs(variation).toFixed(1)}%
                        </span>
                    )}
                </div>
                {fournisseurs.length > 1 && (
                    <Select
                        size="sm"
                        value={selectedFournisseur}
                        onChange={(e) => setSelectedFournisseur(e.target.value)}
                    >
                        <option value="all">{t('products:detail.purchases.all_providers', { defaultValue: 'Tous les fournisseurs' })}</option>
                        {fournisseurs.map((f) => (
                            <option key={f} value={f}>{f}</option>
                        ))}
                    </Select>
                )}
            </div>

            <div className="flex gap-4 mb-3 text-xs">
                <span className="font-bold text-slate-400">
                    {t('products:detail.purchases.min')} <span className="text-emerald-600 font-black">{formatCurrency(minPrix)}</span>
                </span>
                <span className="font-bold text-slate-400">
                    {t('products:detail.purchases.max')} <span className="text-red-600 font-black">{formatCurrency(maxPrix)}</span>
                </span>
                <span className="font-bold text-slate-400">
                    {t('products:detail.purchases.latest')} <span className="text-blue-600 font-black">{formatCurrency(lastPrix)}</span>
                </span>
            </div>

            <ResponsiveContainer width="100%" height={180}>
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="date" fontSize={10} tick={{ fontWeight: 700 }} />
                    <YAxis
                        fontSize={10}
                        tickFormatter={(v: number) => formatCurrency(v)}
                        domain={[
                            (dataMin: number) => Math.floor(dataMin * 0.95),
                            (dataMax: number) => Math.ceil(dataMax * 1.05),
                        ]}
                        width={70}
                    />
                    <Tooltip
                        formatter={(value: number) => [formatCurrency(value), t('products:detail.purchases.price_label')]}
                        labelFormatter={(label: string, payload: readonly unknown[]) => {
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

const PurchasesTabContent = ({ achats, t }: { achats: unknown[]; t: unknown }) => {
    if (!achats || achats.length === 0) return <p className="text-center text-slate-400 py-8">{t('products:detail.purchases.empty')}</p>;

    return (
        <div>
            <PriceEvolutionChart achats={achats} t={t} />
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead className="bg-white sticky top-0 border-b border-slate-200">
                    <tr className="text-slate-400">
                        <th className="text-[11px] font-black uppercase tracking-wider text-left py-2">{t('products:detail.purchases.date')}</th>
                        <th className="text-[11px] font-black uppercase tracking-wider text-left py-2">{t('products:detail.purchases.provider')}</th>
                        <th className="text-[11px] font-black uppercase tracking-wider text-right py-2">{t('products:detail.purchases.qty')}</th>
                        <th className="text-[11px] font-black uppercase tracking-wider text-right py-2">{t('products:detail.purchases.price')}</th>
                        <th className="text-[11px] font-black uppercase tracking-wider text-left py-2">{t('products:detail.purchases.lot')}</th>
                        <th className="text-[11px] font-black uppercase tracking-wider text-left py-2">{t('products:detail.purchases.exp')}</th>
                    </tr>
                </thead>
                <tbody>
                    {achats.map((achat) => (
                        <tr key={achat.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100">
                            <td className="text-sm font-mono font-bold text-slate-500 py-2">{formatDate(achat.commande_date)}</td>
                            <td className="text-sm font-bold truncate max-w-[150px] py-2" title={achat.fournisseur_name}>{achat.fournisseur_name}</td>
                            <td className="text-right text-sm font-black py-2">{achat.quantity}</td>
                            <td className="text-right text-sm font-black text-blue-600 py-2">
                                {formatCurrency(Math.round(Number(achat.price_cost)))}
                            </td>
                            <td className="py-2">
                                <span className="inline-flex items-center px-2 py-0.5 rounded border border-slate-200 text-xs font-mono font-semibold text-slate-500 bg-slate-100">{achat.lot || '-'}</span>
                            </td>
                            <td className="text-sm font-bold text-slate-400 py-2">
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

const LotsTabContent = ({ lots, produitId, t }: { lots: StockLot[]; produitId: number; t: unknown }) => {
    const queryClient = useQueryClient();
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editValues, setEditValues] = useState<{ lot: string; date_expiration: string }>({ lot: '', date_expiration: '' });
    const [saving, setSaving] = useState(false);
    const [localLots, setLocalLots] = useState<StockLot[]>(lots);

    React.useEffect(() => { setLocalLots(lots); }, [lots]);

    const startEdit = useCallback((lot: StockLot) => {
        setEditingId(lot.id);
        setEditValues({
            lot: lot.lot || '',
            date_expiration: lot.date_expiration ? lot.date_expiration.slice(0, 10) : '',
        });
    }, []);

    const cancelEdit = useCallback(() => {
        setEditingId(null);
    }, []);

    const saveEdit = useCallback(async (lotId: number) => {
        setSaving(true);
        try {
            const payload: Record<string, string | null> = { lot: editValues.lot };
            if (editValues.date_expiration) {
                payload.date_expiration = editValues.date_expiration;
            } else {
                payload.date_expiration = null;
            }
            await api.patch(`stock-lots/${lotId}/`, payload);
            setLocalLots(prev => prev.map(l => l.id === lotId ? { ...l, ...payload } : l));
            setEditingId(null);
            queryClient.invalidateQueries({ queryKey: ['produit-lots', produitId] });
            toast.success('Lot mis à jour');
        } catch {
            toast.error('Erreur lors de la mise à jour');
        } finally {
            setSaving(false);
        }
    }, [editValues, queryClient, produitId]);

    if (!localLots || localLots.length === 0) return <p className="text-center text-slate-400 py-8">{t('products:detail.lots.empty')}</p>;

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead className="bg-white sticky top-0 border-b border-slate-200">
                    <tr className="text-slate-400">
                        <th className="text-[11px] font-black uppercase tracking-wider text-left py-2">{t('products:detail.lots.date_reception')}</th>
                        <th className="text-[11px] font-black uppercase tracking-wider text-left py-2">{t('products:detail.lots.lot_number')}</th>
                        <th className="text-[11px] font-black uppercase tracking-wider text-left py-2">{t('products:detail.lots.expiration')}</th>
                        <th className="text-[11px] font-black uppercase tracking-wider text-left py-2">{t('products:detail.lots.provider')}</th>
                        <th className="text-[11px] font-black uppercase tracking-wider text-right py-2">{t('products:detail.purchases.price', { defaultValue: 'Prix' })}</th>
                        <th className="text-[11px] font-black uppercase tracking-wider text-right py-2">{t('products:detail.lots.initial_qty')}</th>
                        <th className="text-[11px] font-black uppercase tracking-wider text-right py-2">{t('products:detail.lots.remaining_qty')}</th>
                        <th className="text-[11px] font-black uppercase tracking-wider w-16"></th>
                    </tr>
                </thead>
                <tbody>
                    {localLots.map((lot) => {
                        const isExpired = lot.date_expiration ? new Date(lot.date_expiration) < new Date() : false;
                        const isEditing = editingId === lot.id;
                        return (
                            <tr key={lot.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100">
                                <td className="text-sm font-mono font-bold text-slate-500 py-2">{formatDate(lot.date_reception)}</td>
                                <td className="py-2">
                                    {isEditing ? (
                                        <Input
                                            type="text"
                                            className="w-28 font-mono text-xs h-8"
                                            value={editValues.lot}
                                            onChange={e => setEditValues(v => ({ ...v, lot: e.target.value }))}
                                            autoFocus
                                        />
                                    ) : (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded border border-slate-200 text-xs font-mono font-bold text-slate-700 bg-slate-100">{lot.lot || '-'}</span>
                                    )}
                                </td>
                                <td className="py-2">
                                    {isEditing ? (
                                        <Input
                                            type="date"
                                            className="w-36 text-xs h-8"
                                            value={editValues.date_expiration}
                                            onChange={e => setEditValues(v => ({ ...v, date_expiration: e.target.value }))}
                                        />
                                    ) : (
                                        <span className={`text-sm font-black ${isExpired ? 'text-red-600' : 'text-slate-800'}`}>
                                            {formatDate(lot.date_expiration)}
                                        </span>
                                    )}
                                </td>
                                <td className="text-sm font-bold truncate max-w-[120px] py-2" title={lot.fournisseur_nom}>{lot.fournisseur_nom}</td>
                                <td className="text-right text-sm font-black text-blue-600 py-2">
                                    {formatCurrency(Math.round(Number(lot.price_cost || 0)))}
                                </td>
                                <td className="text-right text-sm font-bold py-2">{lot.quantity_initial}</td>
                                <td className="text-right font-black text-sm py-2">
                                    <span className={lot.quantity_remaining > 0 ? 'text-emerald-600' : 'text-slate-300'}>
                                        {lot.quantity_remaining}
                                    </span>
                                </td>
                                <td className="text-center py-2">
                                    {isEditing ? (
                                        <div className="flex items-center gap-1 justify-center">
                                            <Button
                                                variant="ghost" size="sm"
                                                className="size-7 p-0 text-emerald-600"
                                                onClick={() => saveEdit(lot.id)}
                                                disabled={saving}
                                                title="Enregistrer"
                                            ><Check className="size-3.5" /></Button>
                                            <Button
                                                variant="ghost" size="sm"
                                                className="size-7 p-0"
                                                onClick={cancelEdit}
                                                disabled={saving}
                                                title="Annuler"
                                            ><X className="size-3.5" /></Button>
                                        </div>
                                    ) : (
                                        <Button
                                            variant="ghost" size="sm"
                                            className="size-7 p-0 text-slate-400 hover:text-indigo-600"
                                            onClick={() => startEdit(lot)}
                                            title="Modifier lot / date péremption"
                                        ><Pencil className="size-3" /></Button>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

const StatsTabContent = ({ monthlyStats, t }: { monthlyStats: unknown[]; t: unknown }) => {
    if (!monthlyStats || monthlyStats.length === 0) return <p className="text-center text-slate-400 py-4">{t('products:detail.stats.empty')}</p>;

    let currentYear: number | null = null;
    return (
        <div className="overflow-x-auto max-h-80">
            <table className="w-full text-sm">
                <thead className="bg-white sticky top-0 border-b border-slate-200">
                    <tr className="text-slate-400">
                    <th className="text-[11px] font-black uppercase whitespace-nowrap text-left py-2"></th>
                    <th className="text-[11px] font-black uppercase whitespace-nowrap text-left py-2">{t('products:detail.stats.month')}</th>
                    <th className="text-[11px] font-black uppercase text-right text-indigo-600 whitespace-nowrap py-2">{t('products:detail.stats.qty_sold')}</th>
                    <th className="text-[11px] font-black uppercase text-right text-amber-600 whitespace-nowrap py-2">{t('products:detail.stats.qty_ordered')}</th>
                    <th className="text-[11px] font-black uppercase text-right text-blue-600 whitespace-nowrap py-2">{t('products:detail.stats.nb_clients')}</th>
                    </tr>
                </thead>
                <tbody>
                    {(monthlyStats || []).map((stat) => {
                        const showYear = stat.year !== currentYear;
                        currentYear = stat.year;
                        return (
                            <tr key={`${stat.year}-${stat.month_name}`} className={`border-b border-slate-100 ${showYear ? 'border-t-2 border-slate-200' : ''}`}>
                                <td className="font-black text-sm text-slate-400 py-2">
                                    {showYear ? stat.year : ''}
                                </td>
                                <td className="text-sm font-bold py-2">{stat.month_name}</td>
                                <td className="text-right font-mono font-black text-sm text-indigo-600 py-2">{stat.qte_v}</td>
                                <td className="text-right font-mono font-bold text-sm text-amber-600 py-2">{stat.qte_c}</td>
                                <td className="text-right font-mono font-bold text-sm text-blue-600 py-2">{stat.nb_c}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            <div className="mt-2 text-[10px] text-slate-400 flex justify-around">
                <span>{t('products:detail.stats.legend_sold')}</span>
                <span>{t('products:detail.stats.legend_ordered')}</span>
                <span>{t('products:detail.stats.legend_count')}</span>
            </div>
        </div>
    );
};

const MovementsTabContent = ({ stockHistory, loadingHistory, onMovementClick, t }: { stockHistory: unknown[]; loadingHistory: boolean; onMovementClick: (item: unknown) => void; t: unknown }) => {
    if (loadingHistory) return (
        <div className="flex justify-center py-12">
            <Loader2 className="size-8 animate-spin text-indigo-600" />
        </div>
    );

    if (!stockHistory || stockHistory.length === 0) return <p className="text-center text-slate-400 py-8">{t('products:detail.movements.empty')}</p>;

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead className="bg-white sticky top-0 border-b border-slate-200">
                    <tr className="text-slate-400">
                        <th className="text-[11px] font-black uppercase tracking-wider text-left py-2">{t('products:detail.movements.date')}</th>
                        <th className="text-[11px] font-black uppercase tracking-wider text-left py-2">{t('products:detail.movements.type')}</th>
                        <th className="text-[11px] font-black uppercase tracking-wider text-left py-2">{t('products:detail.movements.label')}</th>
                        <th className="text-[11px] font-black uppercase tracking-wider text-left py-2">{t('products:detail.movements.operator')}</th>
                        <th className="text-[11px] font-black uppercase tracking-wider text-right py-2">{t('products:detail.movements.before')}</th>
                        <th className="text-[11px] font-black uppercase tracking-wider text-right py-2">{t('products:detail.movements.qty')}</th>
                        <th className="text-[11px] font-black uppercase tracking-wider text-right py-2">{t('products:detail.movements.after')}</th>
                    </tr>
                </thead>
                <tbody>
                    {(stockHistory || []).map((item) => {
                        const isPositive = item.type === 'AJUSTEMENT' 
                            ? item.quantity > 0 
                            : ['ENTREE', 'RETOUR', 'TRANSFORMATION_ENTREE'].includes(item.type);
                        
                        const cleanedLibelle = (item.libelle || '')
                            .replace(/\s*\(FAC.*?\)/gi, '')
                            .replace(/\s*-\s*Lot:.*?(?=\s*-\s*|$)/gi, '')
                            .trim();

                        return (
                            <tr 
                                key={item.id || `${item.date}-${item.type}`} 
                                className={`hover:bg-slate-50 transition-colors border-b border-slate-100 ${(item.facture || item.commande) ? 'cursor-pointer' : ''}`}
                                onClick={() => onMovementClick(item)}
                            >
                                <td className="whitespace-nowrap text-sm font-mono font-bold text-slate-500 py-2">
                                    {formatDate(item.date)}
                                </td>
                                <td className="py-2">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap ${
                                        item.type === 'AJUSTEMENT'
                                            ? 'bg-amber-50 text-amber-600 border border-amber-100'
                                            : isPositive ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'
                                    }`}>
                                        {t(`products:detail.movements.types.${item.type}`, { defaultValue: item.type })}
                                    </span>
                                </td>
                                <td className="text-sm font-bold py-2" title={item.libelle}>
                                    <div className="flex items-center gap-1">
                                        {(item.facture || item.commande) && (
                                            <span className="text-indigo-600" title={item.facture ? t('products:detail.movements.view_invoice') : t('products:detail.movements.view_order')}>🔍</span>
                                        )}
                                        {cleanedLibelle}
                                        {item.commande_numero && (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded border border-slate-200 text-xs font-mono font-bold text-slate-500 bg-slate-100 ml-auto">
                                                {item.commande_numero}
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="text-sm font-bold text-slate-400 py-2">{item.user || item.user_nom || '-'}</td>
                                <td className="text-right font-mono text-sm font-bold text-slate-400 py-2">{item.stock_avant}</td>
                                <td className={`text-right font-black text-sm py-2 ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {isPositive ? '+' : ''}{item.quantity}
                                </td>
                                <td className="text-right font-mono font-black text-sm py-2">{item.stock_apres}</td>
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
      <div className="bg-white shrink-0 border-b border-slate-200">
        <div className="flex gap-1 px-4 pt-3 pb-2 overflow-x-auto">
        {[
          { id: 'general', label: t('products:detail.tabs.general') },
          { id: 'prix', label: t('products:detail.tabs.price') },
          { id: 'achats', label: t('products:detail.tabs.purchases') },
          { id: 'lots', label: t('products:detail.tabs.lots') },
          { id: 'stats', label: t('products:detail.tabs.stats') },
          { id: 'mvmts', label: t('products:detail.tabs.movements') }
        ].map((tab) => (
          <Button
            key={tab.id}
            variant="ghost" size="sm"
            className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-tight rounded-lg transition-colors whitespace-nowrap ${activeTab === tab.id ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-800'}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </Button>
        ))}
      </div>
    </div>

      {/* Contenu des onglets */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'general' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-slate-200">
                  <td className="font-bold text-sm text-slate-400 uppercase tracking-wider w-1/3 py-4">{t('products:detail.general.description')}</td>
                  <td className="uppercase font-black text-sm py-4">{selectedProduit.description || '-'}</td>
                </tr>
                <tr className="border-b border-slate-200">
                   <td className="font-bold text-sm text-slate-400 uppercase tracking-wider py-4">{t('products:detail.general.rayon')}</td>
                  <td className="py-4"><span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-100">{selectedProduit.rayon_name || '-'}</span></td>
                </tr>
                <tr className="border-b border-slate-200">
                   <td className="font-bold text-sm text-slate-400 uppercase tracking-wider py-4">{t('products:detail.general.provider')}</td>
                  <td className="py-4"><span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">{selectedProduit.fournisseur_name || '-'}</span></td>
                </tr>
                <tr className="border-b border-slate-200">
                   <td className="font-bold text-sm text-slate-400 uppercase tracking-wider py-4">{t('products:detail.general.min_max')}</td>
                  <td className="font-black py-4">{selectedProduit.stock_minimum ?? 0} / {selectedProduit.stock_maximum ?? 0}</td>
                </tr>
                <tr className="border-b border-slate-200">
                   <td className="font-bold text-sm text-slate-400 uppercase tracking-wider py-4">{t('products:detail.general.alert_threshold')}</td>
                  <td className="py-4"><span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-100">{selectedProduit.stock_alert ?? 0}</span></td>
                </tr>
                <tr className="border-b border-slate-200">
                   <td className="font-bold text-sm text-slate-400 uppercase tracking-wider py-4">{t('products:detail.general.expiration')}</td>
                  <td className="font-mono font-black text-sm py-4">{selectedProduit.expire_date ? (() => {
                    const d = new Date(selectedProduit.expire_date);
                    return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear().toString().slice(-2)}`;
                  })() : '-'}</td>
                </tr>
                <tr className="border-b border-slate-200">
                   <td className="font-bold text-sm text-slate-400 uppercase tracking-wider py-4">{t('products:detail.general.last_purchase')}</td>
                  <td className="font-mono font-bold text-sm py-4">{formatDate(selectedProduit.dernier_achat)}</td>
                </tr>
                <tr className="border-b border-slate-200">
                   <td className="font-bold text-sm text-slate-400 uppercase tracking-wider py-4">{t('products:detail.general.last_sale')}</td>
                  <td className="font-mono font-bold text-sm py-4">{formatDate(selectedProduit.dernier_vente)}</td>
                </tr>
                <tr className="border-b border-slate-200">
                   <td className="font-bold text-sm text-slate-400 uppercase tracking-wider py-4">{t('products:detail.general.lot_management')}</td>
                  <td className="font-bold text-sm py-4">{selectedProduit.use_lot_management ? `✅ ${t('products:detail.general.enabled')}` : `❌ ${t('products:detail.general.disabled')}`}</td>
                </tr>
                <tr className="border-b border-slate-200">
                   <td className="font-bold text-sm text-slate-400 uppercase tracking-wider py-4">{t('products:detail.general.prescription')}</td>
                  <td className="font-bold text-sm py-4">{selectedProduit.requires_prescription ? `✅ ${t('products:detail.general.yes')}` : `❌ ${t('products:detail.general.no')}`}</td>
                </tr>
                <tr>
                   <td className="font-bold text-sm text-slate-400 uppercase tracking-wider py-4">{t('products:detail.general.surveillance')}</td>
                  <td className="font-bold text-sm py-4">{selectedProduit.surveillance_category === 'NONE' ? '-' : selectedProduit.surveillance_category}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'prix' && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-slate-100 rounded-xl border border-slate-200 p-5">
               <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">{t('products:detail.price.cost')}</div>
              <div className="text-blue-600 text-2xl font-bold">{formatCurrency(Math.round(Number(selectedProduit.cost_price || 0)))}</div>
            </div>
            <div className="bg-indigo-600 text-white rounded-xl p-5 shadow-sm">
               <div className="text-indigo-100 text-xs font-bold uppercase tracking-wider mb-2">{t('products:detail.price.selling')}</div>
              <div className="text-2xl font-bold">{formatCurrency(Math.round(Number(selectedProduit.selling_price || 0)))}</div>
            </div>
            <div className="bg-slate-100 rounded-xl border border-slate-200 p-5">
               <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">{t('products:detail.price.vat')}</div>
              <div className="text-2xl font-bold text-slate-800">{selectedProduit.tva || '19.25'}%</div>
            </div>
            <div className="bg-slate-100 rounded-xl border border-slate-200 p-5">
               <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">{t('products:detail.price.margin_percent')}</div>
              <div className="text-2xl font-bold text-emerald-600">{Number(selectedProduit.pourcentage_marge || 0).toFixed(1)}%</div>
            </div>
            <div className="bg-slate-100 rounded-xl border border-slate-200 p-5">
               <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">{t('products:detail.price.margin_coeff')}</div>
              <div className="text-2xl font-bold text-emerald-600">{Number(selectedProduit.taux_marge || 0).toFixed(2)}</div>
            </div>
            <div className="bg-slate-100 rounded-xl border border-slate-200 p-5">
               <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">{t('products:detail.price.rotation')}</div>
               <div className="text-2xl font-bold text-blue-600">{Number(selectedProduit.rotation_moyenne || 0).toFixed(1)}<span className="text-xs font-bold uppercase ml-1 text-slate-400"> {t('products:detail.price.per_month')}</span></div>
            </div>
          </div>
        )}

        {activeTab === 'achats' && <PurchasesTabContent achats={achats} t={t} />}
        
        {activeTab === 'lots' && <LotsTabContent lots={lots} produitId={selectedProduit.id} t={t} />}

        {activeTab === 'stats' && <StatsTabContent monthlyStats={monthlyStats} t={t} />}

        {activeTab === 'mvmts' && <MovementsTabContent stockHistory={stockHistory} loadingHistory={loadingHistory} onMovementClick={onMovementClick} t={t} />}
      </div>
    </div>
  );
};
