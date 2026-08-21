import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Package, TrendingUp, Calendar, Search, ShoppingCart, Truck, Boxes,
  ChevronLeft, ChevronRight, RotateCcw, ChevronDown, ChevronUp, AlertTriangle
} from 'lucide-react';
import api from '../../services/api';
import { gooeyToast } from 'goey-toast';
import { cn } from '../../lib/utils';
import { formatCurrency } from '../../utils/formatters';

import { Button } from '../shadcn/button';
import { Input } from '../shadcn/input';
import { Badge } from '../shadcn/badge';
import { Checkbox } from '../shadcn/checkbox';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription
} from '../shadcn/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/Table';
import { logger } from '../../utils/logger'

interface CadencierItem {
  produit_id: number;
  produit_nom: string;
  cip1: string;
  stock: number;
  stock_minimum: number;
  stock_maximum: number;
  rotation_moyenne: number;
  rotation_jour: number;
  couverture_jours: number;
  couverture_cible: number;
  stock_cible: number;
  quantite_suggeree: number;
  prix_achat: number;
  montant_ht: number;
  fournisseur_id: number | null;
  fournisseur_nom: string | null;
  rayon_id: number | null;
  rayon_nom: string | null;
  urgence: 'rupture' | 'alerte' | 'surveillance' | 'ok';
  is_supplier_exclusive: boolean;
  tva: string;
  taux_marge: string;
}

interface FiltreCadencier {
  type: 'grossiste' | 'divers';
  coverage_days: number;
  rayon: string;
  fournisseur: string;
  search: string;
  only_below_target: boolean;
}

const Cadencier: React.FC = () => {
  const { t } = useTranslation(['stock', 'common']);
  const navigate = useNavigate();

  const [items, setItems] = useState<CadencierItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalHt, setTotalHt] = useState(0);
  const [totalQuantite, setTotalQuantite] = useState(0);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [rayons, setRayons] = useState<{ id: number; name: string }[]>([]);
  const [fournisseurs, setFournisseurs] = useState<{ id: number; name: string }[]>([]);

  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [filters, setFilters] = useState<FiltreCadencier>({
    type: 'grossiste',
    coverage_days: 30,
    rayon: '',
    fournisseur: '',
    search: '',
    only_below_target: true,
  });

  const pageSize = 50;

  const fetchFilters = useCallback(async () => {
    try {
      const [rayonsRes, fournisseursRes] = await Promise.all([
        api.get('/rayons/'),
        api.get('/fournisseurs/'),
      ]);
      setRayons(rayonsRes.data.results || rayonsRes.data || []);
      setFournisseurs(fournisseursRes.data.results || fournisseursRes.data || []);
    } catch (error) {
      logger.error('Erreur chargement filtres cadencier:', error);
    }
  }, []);

  const fetchCadencier = useCallback(async (targetPage = 1) => {
    setLoading(true);
    try {
      const response = await api.get('/cadencier/', {
        params: {
          type: filters.type,
          coverage_days: filters.coverage_days,
          rayon: filters.rayon || undefined,
          fournisseur: filters.fournisseur || undefined,
          search: filters.search || undefined,
          only_below_target: filters.only_below_target,
          page: targetPage,
          page_size: pageSize,
        },
      });
      setItems(response.data.results || []);
      setTotalHt(response.data.total_ht || 0);
      setTotalQuantite(response.data.total_quantite || 0);
      setTotalCount(response.data.count || 0);
      setPage(targetPage);
    } catch (error) {
      logger.error('Erreur chargement cadencier:', error);
      gooeyToast.error(t('stock:cadencier.error_loading', 'Erreur de chargement du cadencier'));
    } finally {
      setLoading(false);
    }
  }, [filters, pageSize, t]);

  useEffect(() => {
    fetchFilters();
  }, [fetchFilters]);

  useEffect(() => {
    fetchCadencier(1);
  }, [fetchCadencier]);

  const toggleSelection = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === items.length && items.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map(i => i.produit_id)));
    }
  };

  const selectedItems = useMemo(() => {
    return items.filter(i => selectedIds.has(i.produit_id));
  }, [items, selectedIds]);

  const selectedTotal = useMemo(() => {
    return selectedItems.reduce((sum, i) => sum + i.montant_ht, 0);
  }, [selectedItems]);

  const handleGenerateOrder = (orderType: 'LOC' | 'DIV') => {
    if (selectedItems.length === 0) {
      gooeyToast.error(t('stock:cadencier.no_selection', 'Veuillez sélectionner au moins un produit'));
      return;
    }

    const products = selectedItems.map(i => ({
      id: i.produit_id,
      name: i.produit_nom,
      stock: i.stock,
      avg_daily_sales: i.rotation_jour,
      quantity: i.quantite_suggeree,
      price: i.prix_achat,
      fournisseur_id: i.fournisseur_id,
      fournisseur_nom: i.fournisseur_nom,
      tva: i.tva,
      taux_marge: i.taux_marge,
    }));

    const state = { createFromCadencier: { products, orderType } };

    if (orderType === 'DIV') {
      navigate('/app/divers/commandes', { state });
    } else {
      navigate('/app/commandes/locales', { state });
    }
  };

  const handleFilterChange = (key: keyof FiltreCadencier, value: unknown) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setSelectedIds(new Set());
    setPage(1);
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  const getUrgencyBadge = (urgence: CadencierItem['urgence']) => {
    switch (urgence) {
      case 'rupture':
        return <Badge className="bg-red-700 hover:bg-red-800 text-white">{t('stock:cadencier.urgence.rupture', 'RUPTURE')}</Badge>;
      case 'alerte':
        return <Badge variant="destructive">{t('stock:cadencier.urgence.alerte', 'Alerte')}</Badge>;
      case 'surveillance':
        return <Badge className="bg-amber-500 hover:bg-amber-600 text-white">{t('stock:cadencier.urgence.surveillance', 'Surveillance')}</Badge>;
      case 'ok':
        return <Badge variant="secondary">{t('stock:cadencier.urgence.ok', 'OK')}</Badge>;
      default:
        return null;
    }
  };

  const allSelected = items.length > 0 && selectedIds.size === items.length;

  const headers = [
    t('stock:cadencier.product', 'Produit'),
    t('stock:cadencier.stock', 'Stock'),
    t('stock:cadencier.rotation', 'Rotation'),
    t('stock:cadencier.coverage', 'Couverture'),
    t('stock:cadencier.target', 'Cible'),
    t('stock:cadencier.suggested', 'Qté suggérée'),
    t('stock:cadencier.unit_price', 'Prix achat'),
    t('stock:cadencier.amount', 'Montant HT'),
    t('stock:cadencier.urgency', 'Urgence'),
    t('stock:cadencier.supplier', 'Fournisseur'),
  ];
  const widths = ['w-[28%]', 'w-16', 'w-24', 'w-20', 'w-16', 'w-24', 'w-28', 'w-28', 'w-24', 'w-[14%]'];

  return (
    <div className="h-screen overflow-hidden bg-slate-50 p-2 sm:p-3 lg:p-4">
      <div className="h-full max-w-[1600px] mx-auto space-y-3 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-600/20">
              <TrendingUp className="size-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                {t('stock:cadencier.title', 'Cadencier de Stock')}
              </h1>
              <p className="text-xs font-medium text-slate-500 mt-0.5">
                {t('stock:cadencier.subtitle', 'Planification des approvisionnements par rotation et couverture')}
              </p>
            </div>
          </div>

          <button
            onClick={() => setHeaderCollapsed(!headerCollapsed)}
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-emerald-600 transition-colors px-2 py-1 rounded hover:bg-emerald-50"
            title={headerCollapsed ? t('common:show_header', 'Afficher en-tête') : t('common:hide_header', 'Masquer en-tête')}
          >
            {headerCollapsed ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
            {headerCollapsed ? t('common:show_header', 'Afficher') : t('common:hide_header', 'Masquer')}
          </button>
        </div>

        {!headerCollapsed && (
          <>
            {/* Filters Card */}
            <Card className="py-3">
              <CardContent className="pb-2">
                <div className="grid grid-cols-2 md:grid-cols-12 gap-2 lg:gap-3 items-end">
                  <div className="md:col-span-3">
                    <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-slate-200 bg-white focus-within:ring-1 focus-within:ring-emerald-500">
                      <Search className="size-4 text-slate-400 shrink-0" />
                      <input
                        type="text"
                        placeholder={t('stock:cadencier.search_placeholder', 'Rechercher un produit, CIP...')}
                        value={filters.search}
                        onChange={(e) => handleFilterChange('search', e.target.value)}
                        className="h-full border-0 focus:outline-none focus:ring-0 p-0 text-sm bg-transparent w-full"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <select
                      value={filters.type}
                      onChange={(e) => handleFilterChange('type', e.target.value)}
                      className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    >
                      <option value="grossiste">{t('stock:cadencier.type_grossiste', 'Grossiste')}</option>
                      <option value="divers">{t('stock:cadencier.type_divers', 'Divers')}</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <select
                      value={String(filters.coverage_days)}
                      onChange={(e) => handleFilterChange('coverage_days', parseInt(e.target.value))}
                      className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    >
                      <option value="7">7 jours</option>
                      <option value="15">15 jours</option>
                      <option value="30">30 jours</option>
                      <option value="45">45 jours</option>
                      <option value="60">60 jours</option>
                      <option value="90">90 jours</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <select
                      value={filters.rayon}
                      onChange={(e) => handleFilterChange('rayon', e.target.value)}
                      className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    >
                      <option value="">{t('common:all', 'Tous')}</option>
                      {rayons.map(r => <option key={r.id} value={String(r.id)}>{r.name}</option>)}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <select
                      value={filters.fournisseur}
                      onChange={(e) => handleFilterChange('fournisseur', e.target.value)}
                      className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    >
                      <option value="">{t('common:all', 'Tous')}</option>
                      {fournisseurs.map(f => <option key={f.id} value={String(f.id)}>{f.name}</option>)}
                    </select>
                  </div>

                  <div className="md:col-span-1 flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchCadencier(1)}
                      className="gap-1 h-9 px-2 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                      title={t('common:refresh', 'Rafraîchir')}
                    >
                      <RotateCcw className="size-4 text-emerald-600" />
                    </Button>
                  </div>
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <Checkbox
                    checked={filters.only_below_target}
                    onCheckedChange={(checked) => handleFilterChange('only_below_target', checked)}
                  />
                  <label className="text-xs text-slate-500 cursor-pointer select-none">
                    {t('stock:cadencier.only_below_target', 'Uniquement les produits sous le seuil')}
                  </label>
                </div>
              </CardContent>
            </Card>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Card>
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="size-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <Boxes className="size-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">
                      {t('stock:cadencier.total_products', 'Produits à commander')}
                    </p>
                    <p className="text-xl font-bold text-slate-900">{totalCount}</p>
                    <p className="text-xs text-slate-400">{totalQuantite} {t('stock:cadencier.units', 'unités suggérées')}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="size-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <Calendar className="size-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">
                      {t('stock:cadencier.total_ht', 'Montant total HT')}
                    </p>
                    <p className="text-xl font-bold text-slate-900">{formatCurrency(Math.round(totalHt))}</p>
                    <p className="text-xs text-slate-400">{t('stock:cadencier.coverage', 'Couverture')}: {filters.coverage_days} j</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="col-span-2">
                <CardContent className="p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                      <ShoppingCart className="size-4" />
                    </div>
                    <div>
                      <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">
                        {t('stock:cadencier.selection', 'Sélection')}
                      </p>
                      <p className="text-xl font-bold text-slate-900">
                        {selectedItems.length} <span className="text-sm font-normal text-slate-500">{t('stock:cadencier.products', 'produits')}</span>
                      </p>
                      <p className="text-xs text-slate-400">{formatCurrency(Math.round(selectedTotal))}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => handleGenerateOrder('LOC')}
                      disabled={selectedItems.length === 0}
                      variant="outline"
                      size="sm"
                      className="gap-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                    >
                      <Truck className="size-4" />
                      <span className="hidden sm:inline">{t('stock:cadencier.generate_grossiste', 'Commande Grossiste')}</span>
                    </Button>
                    <Button
                      onClick={() => handleGenerateOrder('DIV')}
                      disabled={selectedItems.length === 0}
                      variant="outline"
                      size="sm"
                      className="gap-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                    >
                      <ShoppingCart className="size-4" />
                      <span className="hidden sm:inline">{t('stock:cadencier.generate_divers', 'Commande Divers')}</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* Table Card */}
        <Card className="overflow-hidden flex flex-col flex-1 min-h-0">
          <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <Package className="size-4 text-emerald-600" />
              <h3 className="font-semibold text-sm text-slate-700">
                {t('stock:cadencier.list', 'Lignes du cadencier')}
              </h3>
            </div>
            <span className="text-xs text-slate-500">
              {t('stock:cadencier.showing', { count: items.length, total: totalCount })}
            </span>
          </div>

          <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
            {loading ? (
              <div className="overflow-auto flex-1 min-h-0">
                <Table className="w-full table-fixed text-sm">
                  <TableHeader className="sticky top-0 z-10">
                    <TableRow className="bg-slate-50 border-b border-slate-100 hover:bg-slate-50">
                      <TableHead className="w-12 px-3 py-2 text-center">
                        <span className="sr-only">{t('stock:cadencier.selection')}</span>
                      </TableHead>
                      {headers.map((h, i) => (
                        <TableHead
                          key={h}
                          className={`px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500 ${widths[i]} ${
                            i === 0 ? 'text-left' : i === headers.length - 1 ? 'text-right' : 'text-center'
                          }`}
                        >
                          {h}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from({ length: 8 }).map((_, i) => (
                      <TableRow key={i} className="border-b border-slate-100 animate-pulse hover:bg-transparent">
                        <TableCell className="py-2 px-3 text-center"><div className="size-4 rounded bg-slate-200 mx-auto" /></TableCell>
                        {widths.map((w, j) => (
                          <TableCell key={j} className="py-2 px-3">
                            <div className="h-4 rounded bg-slate-200" style={{ width: `${60 + Math.random() * 30}%` }} />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <div className="p-4 bg-slate-100 rounded-2xl mb-4">
                  <AlertTriangle className="size-10 text-slate-300" />
                </div>
                <h3 className="text-base font-semibold text-slate-700">
                  {t('stock:cadencier.empty', 'Aucun produit à afficher dans le cadencier')}
                </h3>
                <p className="text-sm text-slate-500 mt-1 max-w-sm">
                  {t('stock:analyse.empty.all_good', 'Tout est à jour.')}
                </p>
              </div>
            ) : (
              <div className="overflow-auto flex-1 min-h-0">
                <Table className="w-full table-fixed text-sm">
                  <TableHeader className="sticky top-0 z-10">
                    <TableRow className="bg-slate-50 border-b border-slate-100 hover:bg-slate-50">
                      <TableHead className="w-12 px-3 py-2 text-center">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={toggleAll}
                          aria-label={t('stock:cadencier.select_all')}
                        />
                      </TableHead>
                      {headers.map((h, i) => (
                        <TableHead
                          key={h}
                          className={`px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500 ${widths[i]} ${
                            i === 0 ? 'text-left' : i === headers.length - 1 ? 'text-right' : 'text-center'
                          }`}
                        >
                          {i === 0 ? (
                            <div className="flex items-center gap-1.5">
                              <Package className="size-3.5" /> {h}
                            </div>
                          ) : h}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-sm">
                    {items.map((item) => {
                      const isSelected = selectedIds.has(item.produit_id);
                      return (
                        <TableRow
                          key={item.produit_id}
                          className={cn(
                            'border-b border-slate-100 transition-colors cursor-pointer',
                            isSelected ? 'bg-emerald-50/40' : 'hover:bg-slate-50/80'
                          )}
                          onClick={() => toggleSelection(item.produit_id)}
                        >
                          <TableCell className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSelection(item.produit_id)}
                              aria-label={`Sélectionner ${item.produit_nom}`}
                            />
                          </TableCell>
                          <TableCell className="px-3 py-2">
                            <div className="font-semibold text-slate-900 truncate text-sm" title={item.produit_nom}>{item.produit_nom}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              CIP: {item.cip1 || '-'}
                              {item.rayon_nom && <span className="ml-2">· {item.rayon_nom}</span>}
                            </div>
                          </TableCell>
                          <TableCell className="px-3 py-2 text-center">
                            <Badge variant="outline" className={cn(
                              'font-mono text-xs',
                              item.stock <= 0 ? 'text-red-600 border-red-200' :
                              item.stock < item.stock_minimum ? 'text-amber-600 border-amber-200' : 'text-slate-700'
                            )}>
                              {item.stock}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-3 py-2 text-center font-mono text-xs text-slate-700">
                            {Math.ceil(item.rotation_moyenne)}
                            <span className="text-[10px] text-slate-400 ml-1">/ {t('stock:analyse.per_month', 'mois')}</span>
                          </TableCell>
                          <TableCell className="px-3 py-2 text-center">
                            <span className={cn(
                              'text-xs font-semibold',
                              item.couverture_jours === 9999 ? 'text-slate-400' :
                              item.couverture_jours < 7 ? 'text-red-600' :
                              item.couverture_jours < 14 ? 'text-amber-600' : 'text-blue-600'
                            )}>
                              {item.couverture_jours === 9999 ? '∞' : `${item.couverture_jours} j`}
                            </span>
                          </TableCell>
                          <TableCell className="px-3 py-2 text-center font-semibold text-slate-700 text-sm">
                            {item.stock_cible}
                          </TableCell>
                          <TableCell className="px-3 py-2 text-center font-bold text-emerald-600 text-sm">
                            {item.quantite_suggeree}
                          </TableCell>
                          <TableCell className="px-3 py-2 text-right font-mono text-xs text-slate-600">
                            {formatCurrency(Math.round(item.prix_achat))}
                          </TableCell>
                          <TableCell className="px-3 py-2 text-right font-semibold text-emerald-600 text-sm">
                            {formatCurrency(Math.round(item.montant_ht))}
                          </TableCell>
                          <TableCell className="px-3 py-2 text-center">
                            {getUrgencyBadge(item.urgence)}
                          </TableCell>
                          <TableCell className="px-3 py-2">
                            <div className="text-sm text-slate-700 truncate" title={item.fournisseur_nom || ''}>
                              {item.fournisseur_nom || '-'}
                            </div>
                            {item.is_supplier_exclusive && (
                              <Badge variant="outline" className="mt-0.5 text-[10px]">{t('stock:cadencier.exclusive', 'Exclusif')}</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-sm text-slate-500">
                Page <span className="font-semibold text-slate-900">{page}</span> sur <span className="font-semibold text-slate-900">{totalPages}</span>
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => fetchCadencier(Math.max(1, page - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="min-w-[3rem] text-center text-sm font-semibold text-slate-900">
                  {page}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => fetchCadencier(Math.min(totalPages, page + 1))}
                  disabled={page >= totalPages}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Cadencier;
