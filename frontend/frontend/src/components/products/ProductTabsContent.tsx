import React, { useState, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useRecharts } from '../../hooks/useRecharts';
import type { ProduitModel, StockLot, AchatProduit } from '../../types';
import type { MonthlyStat } from '../../services/produitService';
import type { StockMovement } from '../../hooks/useProduits';
import { formatCurrency } from '../../utils/formatters';
import { formatDate } from '../../utils/dateUtils';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input } from '../shadcn/input';
import { Select } from '../ui/Select';
import { Card, CardContent } from '../shadcn/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../ui/Table';
import { Loader2, Check, X, Pencil } from 'lucide-react';
import type { TFunction } from 'i18next';

interface ProductTabsContentProps {
  selectedProduit: ProduitModel;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  lots: StockLot[];
  monthlyStats: MonthlyStat[];
  achats: AchatProduit[];
  stockHistory: StockMovement[];
  loadingHistory: boolean;
  onMovementClick: (item: StockMovement) => void;
}

// Helper components - Defined first to avoid hoisting issues

const PriceEvolutionChart = ({ achats, t }: { achats: AchatProduit[]; t: TFunction }) => {
    const [selectedFournisseur, setSelectedFournisseur] = useState<string>('all');

    const fournisseurs = useMemo(() => {
        const names = Array.from(new Set(achats.flatMap((a) => a.fournisseur_name ? [a.fournisseur_name] : [])));
        return names;
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
        <Card className="mb-4 bg-slate-100 border-slate-200">
            <CardContent className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                        <span className="text-base font-black uppercase tracking-wider text-slate-400">
                            📈 {t('products:detail.purchases.price_evolution', { defaultValue: 'Évolution Prix Achat' })}
                        </span>
                        {hasMultiplePoints && (
                            <Badge variant={isStable ? 'secondary' : isHausse ? 'error' : 'success'} size="sm">
                                {isStable ? '→' : isHausse ? '▲' : '▼'} {Math.abs(variation).toFixed(1)}%
                            </Badge>
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
                            labelFormatter={(label: string, payload: readonly { payload?: { fullDate?: string; fournisseur?: string } }[]) => {
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
            </CardContent>
        </Card>
    );
};

const PurchasesTabContent = ({ achats, t }: { achats: AchatProduit[]; t: TFunction }) => {
    if (!achats || achats.length === 0) return <p className="text-center text-slate-400 py-8">{t('products:detail.purchases.empty')}</p>;

    return (
        <div>
            <PriceEvolutionChart achats={achats} t={t} />
            <Table>
                <TableHeader className="sticky top-0 z-10">
                    <TableRow>
                        <TableHead className="w-28">{t('products:detail.purchases.date')}</TableHead>
                        <TableHead className="w-40">{t('products:detail.purchases.provider')}</TableHead>
                        <TableHead className="text-right w-20">{t('products:detail.purchases.qty')}</TableHead>
                        <TableHead className="text-right w-28">{t('products:detail.purchases.price')}</TableHead>
                        <TableHead className="w-40">{t('products:detail.purchases.lot')}</TableHead>
                        <TableHead className="w-32">{t('products:detail.purchases.exp')}</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {achats.map((achat) => (
                        <TableRow key={achat.id}>
                            <TableCell className="text-sm font-mono font-bold text-slate-500 py-2 px-3">{formatDate(achat.commande_date)}</TableCell>
                            <TableCell className="text-sm font-bold truncate py-2 px-3" title={achat.fournisseur_name}>{achat.fournisseur_name}</TableCell>
                            <TableCell className="text-right text-sm font-black py-2 px-3">{achat.quantity}</TableCell>
                            <TableCell className="text-right text-sm font-black text-blue-600 py-2 px-3">
                                {formatCurrency(Math.round(Number(achat.price_cost)))}
                            </TableCell>
                            <TableCell className="py-2 px-3">
                                <span className="inline-flex items-center px-2 py-0.5 rounded border border-slate-200 text-xs font-mono font-semibold text-slate-500 bg-slate-100">{achat.lot || '-'}</span>
                            </TableCell>
                            <TableCell className="text-sm font-bold text-slate-400 py-2 px-3">
                                {formatDate(achat.date_expiration)}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
};

const LotsTabContent = ({ lots, produitId, t }: { lots: StockLot[]; produitId: number; t: TFunction }) => {
    const queryClient = useQueryClient();
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editValues, setEditValues] = useState<{ lot: string; date_expiration: string }>({ lot: '', date_expiration: '' });
    const [saving, setSaving] = useState(false);
    const [showFinishedLots, setShowFinishedLots] = useState(false);
    const [localLots, setLocalLots] = useState<StockLot[]>(lots);

    React.useEffect(() => { setLocalLots(lots); }, [lots]);

    const visibleLots = useMemo(() => {
        if (showFinishedLots) return localLots;
        return localLots.filter((lot) => lot.quantity_remaining > 0);
    }, [localLots, showFinishedLots]);

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
            toast.success(t('products:messages.lot_update_success'));
        } catch {
            toast.error(t('products:messages.lot_update_error'));
        } finally {
            setSaving(false);
        }
    }, [editValues, queryClient, produitId, t]);

    if (!localLots || localLots.length === 0) return <p className="text-center text-slate-400 py-8">{t('products:detail.lots.empty')}</p>;

    return (
        <div className="flex flex-col h-full">
            <div className="flex justify-end mb-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowFinishedLots(v => !v)}
                >
                    {showFinishedLots ? t('products:detail.lots.hide_finished') : t('products:detail.lots.show_finished')}
                </Button>
            </div>
            <Table>
                <TableHeader className="sticky top-0 z-10">
                    <TableRow>
                        <TableHead className="w-28">{t('products:detail.lots.date_reception')}</TableHead>
                    <TableHead className="w-36">{t('products:detail.lots.lot_number')}</TableHead>
                    <TableHead className="w-32">{t('products:detail.lots.expiration')}</TableHead>
                    <TableHead className="w-40">{t('products:detail.lots.provider')}</TableHead>
                    <TableHead className="text-right w-28">{t('products:detail.purchases.price', { defaultValue: 'Prix' })}</TableHead>
                    <TableHead className="text-right w-20">{t('products:detail.lots.initial_qty')}</TableHead>
                    <TableHead className="text-right w-20">{t('products:detail.lots.remaining_qty')}</TableHead>
                    <TableHead className="w-16 text-center"></TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {visibleLots.map((lot) => {
                    const isExpired = lot.date_expiration ? new Date(lot.date_expiration) < new Date() : false;
                    const isEditing = editingId === lot.id;
                    return (
                        <TableRow key={lot.id}>
                            <TableCell className="text-sm font-mono font-bold text-slate-500 py-2 px-3">{formatDate(lot.date_reception)}</TableCell>
                            <TableCell className="py-2 px-3">
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
                            </TableCell>
                            <TableCell className="py-2 px-3">
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
                            </TableCell>
                            <TableCell className="text-sm font-bold truncate py-2 px-3" title={lot.fournisseur_nom}>{lot.fournisseur_nom}</TableCell>
                            <TableCell className="text-right text-sm font-black text-blue-600 py-2 px-3">
                                {formatCurrency(Math.round(Number(lot.price_cost || 0)))}
                            </TableCell>
                            <TableCell className="text-right text-sm font-bold py-2 px-3">{lot.quantity_initial}</TableCell>
                            <TableCell className="text-right font-black text-sm py-2 px-3">
                                <span className={lot.quantity_remaining > 0 ? 'text-emerald-600' : 'text-slate-300'}>
                                    {lot.quantity_remaining}
                                </span>
                            </TableCell>
                            <TableCell className="text-center py-2 px-3">
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
                            </TableCell>
                        </TableRow>
                    );
                })}
            </TableBody>
        </Table>
        </div>
    );
};

const StatsTabContent = ({ monthlyStats, t }: { monthlyStats: MonthlyStat[]; t: TFunction }) => {
    if (!monthlyStats || monthlyStats.length === 0) return <p className="text-center text-slate-400 py-4">{t('products:detail.stats.empty')}</p>;

    let currentYear: number | null = null;
    return (
        <div className="max-h-80 overflow-y-auto custom-scrollbar">
            <Table>
                <TableHeader className="sticky top-0 z-10">
                    <TableRow>
                        <TableHead className="w-16"></TableHead>
                        <TableHead className="w-32">{t('products:detail.stats.month')}</TableHead>
                        <TableHead className="text-right w-24 text-indigo-600">{t('products:detail.stats.qty_sold')}</TableHead>
                        <TableHead className="text-right w-24 text-amber-600">{t('products:detail.stats.qty_ordered')}</TableHead>
                        <TableHead className="text-right w-24 text-blue-600">{t('products:detail.stats.nb_clients')}</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {(monthlyStats || []).map((stat) => {
                        const showYear = stat.year !== currentYear;
                        currentYear = stat.year;
                        return (
                            <TableRow
                                key={`${stat.year}-${stat.month_name}`}
                                className={`${showYear ? 'border-t-2 border-slate-200' : ''}`}
                            >
                                <TableCell className="font-black text-sm text-slate-400 py-2 px-3">
                                    {showYear ? stat.year : ''}
                                </TableCell>
                                <TableCell className="text-sm font-bold py-2 px-3">{stat.month_name}</TableCell>
                                <TableCell className="text-right font-mono font-black text-sm text-indigo-600 py-2 px-3">{stat.qte_v}</TableCell>
                                <TableCell className="text-right font-mono font-bold text-sm text-amber-600 py-2 px-3">{stat.qte_c}</TableCell>
                                <TableCell className="text-right font-mono font-bold text-sm text-blue-600 py-2 px-3">{stat.nb_c}</TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
            <div className="mt-2 text-[10px] text-slate-400 flex justify-around">
                <span>{t('products:detail.stats.legend_sold')}</span>
                <span>{t('products:detail.stats.legend_ordered')}</span>
                <span>{t('products:detail.stats.legend_count')}</span>
            </div>
        </div>
    );
};

const MovementsTabContent = ({ stockHistory, loadingHistory, onMovementClick, t }: { stockHistory: StockMovement[]; loadingHistory: boolean; onMovementClick: (item: StockMovement) => void; t: TFunction }) => {
    if (loadingHistory) return (
        <div className="flex justify-center py-12">
            <Loader2 className="size-8 animate-spin text-indigo-600" />
        </div>
    );

    if (!stockHistory || stockHistory.length === 0) return <p className="text-center text-slate-400 py-8">{t('products:detail.movements.empty')}</p>;

    return (
        <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
            <Table>
                <TableHeader className="sticky top-0 z-10">
                    <TableRow>
                        <TableHead className="w-28">{t('products:detail.movements.date')}</TableHead>
                        <TableHead className="w-44">{t('products:detail.movements.type')}</TableHead>
                        <TableHead className="min-w-[180px]">{t('products:detail.movements.label')}</TableHead>
                        <TableHead className="w-32">{t('products:detail.movements.operator')}</TableHead>
                        <TableHead className="text-right w-20">{t('products:detail.movements.before')}</TableHead>
                        <TableHead className="text-right w-20">{t('products:detail.movements.qty')}</TableHead>
                        <TableHead className="text-right w-20">{t('products:detail.movements.after')}</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {(stockHistory || []).map((item) => {
                        const isPositive = item.type === 'AJUSTEMENT'
                            ? item.quantity > 0
                            : ['ENTREE', 'RETOUR', 'TRANSFORMATION_ENTREE'].includes(item.type);

                        const cleanedLibelle = (item.libelle || '')
                            .replace(/^Vente\s+/i, '')
                            .replace(/^Réception\s+/i, '')
                            .replace(/^Décharge\s+/i, '')
                            .replace(/\s*\(FAC.*?\)/gi, '')
                            .replace(/\s*-\s*Lot:.*?(?=\s*-\s*|$)/gi, '')
                            .trim();

                        const badgeVariant = item.type === 'AJUSTEMENT'
                            ? 'warning'
                            : isPositive ? 'success' : 'error';

                        return (
                            <TableRow
                                key={item.id || `${item.date}-${item.type}`}
                            >
                                <TableCell className="whitespace-nowrap text-sm font-mono font-bold text-slate-500 py-2 px-3">
                                    {formatDate(item.date)}
                                </TableCell>
                                <TableCell className="py-2 px-3">
                                    <Badge variant={badgeVariant} size="sm" className="whitespace-nowrap">
                                        {t(`products:detail.movements.types.${item.type}`, { defaultValue: item.type })}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-sm font-bold py-2 px-3" title={item.libelle}>
                                    <div className="flex items-center gap-1">
                                        {(item.facture || item.commande) && (
                                            <span
                                                className="text-indigo-600 cursor-pointer hover:text-indigo-800"
                                                title={item.facture ? t('products:detail.movements.view_invoice') : t('products:detail.movements.view_order')}
                                                onClick={(e) => { e.stopPropagation(); onMovementClick(item); }}
                                            >🔍</span>
                                        )}
                                        <span className="truncate">{cleanedLibelle}</span>
                                        {item.commande_numero && (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded border border-slate-200 text-xs font-mono font-bold text-slate-500 bg-slate-100 ml-auto">
                                                {item.commande_numero}
                                            </span>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className="text-sm font-bold text-slate-400 py-2 px-3 truncate">{item.user || item.user_nom || '-'}</TableCell>
                                <TableCell className="text-right font-mono text-sm font-bold text-slate-400 py-2 px-3">{item.stock_avant}</TableCell>
                                <TableCell className={`text-right font-black text-sm py-2 px-3 ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {isPositive ? '+' : ''}{item.quantity}
                                </TableCell>
                                <TableCell className="text-right font-mono font-black text-sm py-2 px-3">{item.stock_apres}</TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
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
          <Table>
            <TableBody>
              <TableRow>
                <TableCell className="w-1/3 font-bold text-sm text-slate-400 uppercase tracking-wider">{t('products:detail.general.description')}</TableCell>
                <TableCell className="uppercase font-black text-sm">{selectedProduit.description || '-'}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="w-1/3 font-bold text-sm text-slate-400 uppercase tracking-wider">{t('products:detail.general.rayon')}</TableCell>
                <TableCell><span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-100">{selectedProduit.rayon_name || '-'}</span></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="w-1/3 font-bold text-sm text-slate-400 uppercase tracking-wider">{t('products:detail.general.provider')}</TableCell>
                <TableCell><span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">{selectedProduit.fournisseur_name || '-'}</span></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="w-1/3 font-bold text-sm text-slate-400 uppercase tracking-wider">{t('products:detail.general.min_max')}</TableCell>
                <TableCell className="font-black">{selectedProduit.stock_minimum ?? 0} / {selectedProduit.stock_maximum ?? 0}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="w-1/3 font-bold text-sm text-slate-400 uppercase tracking-wider">{t('products:detail.general.alert_threshold')}</TableCell>
                <TableCell><span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-100">{selectedProduit.stock_alert ?? 0}</span></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="w-1/3 font-bold text-sm text-slate-400 uppercase tracking-wider">{t('products:detail.general.expiration')}</TableCell>
                <TableCell className="font-mono font-black text-sm">{selectedProduit.expire_date ? (() => {
                  const d = new Date(selectedProduit.expire_date);
                  return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear().toString().slice(-2)}`;
                })() : '-'}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="w-1/3 font-bold text-sm text-slate-400 uppercase tracking-wider">{t('products:detail.general.last_purchase')}</TableCell>
                <TableCell className="font-mono font-bold text-sm">{formatDate(selectedProduit.dernier_achat)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="w-1/3 font-bold text-sm text-slate-400 uppercase tracking-wider">{t('products:detail.general.last_sale')}</TableCell>
                <TableCell className="font-mono font-bold text-sm">{formatDate(selectedProduit.dernier_vente)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="w-1/3 font-bold text-sm text-slate-400 uppercase tracking-wider">{t('products:detail.general.lot_management')}</TableCell>
                <TableCell className="font-bold text-sm">{selectedProduit.use_lot_management ? `✅ ${t('products:detail.general.enabled')}` : `❌ ${t('products:detail.general.disabled')}`}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="w-1/3 font-bold text-sm text-slate-400 uppercase tracking-wider">{t('products:detail.general.prescription')}</TableCell>
                <TableCell className="font-bold text-sm">{selectedProduit.requires_prescription ? `✅ ${t('products:detail.general.yes')}` : `❌ ${t('products:detail.general.no')}`}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="w-1/3 font-bold text-sm text-slate-400 uppercase tracking-wider">{t('products:detail.general.surveillance')}</TableCell>
                <TableCell className="font-bold text-sm">{selectedProduit.surveillance_category === 'NONE' ? '-' : selectedProduit.surveillance_category}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}

        {activeTab === 'prix' && (
          <Table>
            <TableBody>
              <TableRow>
                <TableCell className="w-1/3 font-bold text-sm text-slate-400 uppercase tracking-wider">{t('products:detail.price.cost')}</TableCell>
                <TableCell className="font-black text-xl text-blue-600">{formatCurrency(Math.round(Number(selectedProduit.cost_price || 0)))}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="w-1/3 font-bold text-sm text-slate-400 uppercase tracking-wider">{t('products:detail.price.selling')}</TableCell>
                <TableCell className="font-black text-2xl text-indigo-600">{formatCurrency(Math.round(Number(selectedProduit.selling_price || 0)))}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="w-1/3 font-bold text-sm text-slate-400 uppercase tracking-wider">{t('products:detail.price.vat')}</TableCell>
                <TableCell className="font-black text-xl text-slate-800">{selectedProduit.tva || '19.25'}%</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="w-1/3 font-bold text-sm text-slate-400 uppercase tracking-wider">{t('products:detail.price.margin_percent')}</TableCell>
                <TableCell className="font-black text-xl text-emerald-600">{Number(selectedProduit.pourcentage_marge || 0).toFixed(1)}%</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="w-1/3 font-bold text-sm text-slate-400 uppercase tracking-wider">{t('products:detail.price.margin_coeff')}</TableCell>
                <TableCell className="font-black text-xl text-emerald-600">{Number(selectedProduit.taux_marge || 0).toFixed(2)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="w-1/3 font-bold text-sm text-slate-400 uppercase tracking-wider">{t('products:detail.price.rotation')}</TableCell>
                <TableCell className="font-black text-xl text-blue-600">{Number(selectedProduit.rotation_moyenne || 0).toFixed(1)}<span className="text-xs font-bold uppercase ml-1 text-slate-400">{t('products:detail.price.per_month')}</span></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}

        {activeTab === 'achats' && <PurchasesTabContent achats={achats} t={t} />}
        
        {activeTab === 'lots' && <LotsTabContent lots={lots} produitId={selectedProduit.id} t={t} />}

        {activeTab === 'stats' && <StatsTabContent monthlyStats={monthlyStats} t={t} />}

        {activeTab === 'mvmts' && <MovementsTabContent stockHistory={stockHistory} loadingHistory={loadingHistory} onMovementClick={onMovementClick} t={t} />}
      </div>
    </div>
  );
};
