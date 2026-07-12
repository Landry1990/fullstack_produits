import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Package, TrendingUp, Calendar, Search, Filter, ShoppingCart, Truck, Boxes,
  ChevronLeft, ChevronRight, ArrowRight, RotateCcw, AlertTriangle
} from 'lucide-react';
import api from '../../services/api';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { cn } from '../../lib/utils';

import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { Select } from '../ui/Select';
import { Badge } from '../ui/Badge';
import { Checkbox } from '../ui/Checkbox';
import SkeletonTable from '../ui/SkeletonTable';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/Table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/Tabs';

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
      console.error('Erreur chargement filtres cadencier:', error);
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
      console.error('Erreur chargement cadencier:', error);
      toast.error(t('stock:cadencier.error_loading', 'Erreur de chargement du cadencier'));
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
      toast.error(t('stock:cadencier.no_selection', 'Veuillez sélectionner au moins un produit'));
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

  const handleFilterChange = (key: keyof FiltreCadencier, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setSelectedIds(new Set());
    setPage(1);
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  const urgenceBadge = (urgence: CadencierItem['urgence']) => {
    const config = {
      rupture: { variant: 'error' as const, label: t('stock:cadencier.urgence.rupture', 'Rupture') },
      alerte: { variant: 'error' as const, label: t('stock:cadencier.urgence.alerte', 'Alerte') },
      surveillance: { variant: 'warning' as const, label: t('stock:cadencier.urgence.surveillance', 'Surveillance') },
      ok: { variant: 'success' as const, label: t('stock:cadencier.urgence.ok', 'OK') },
    };
    const c = config[urgence];
    return <Badge variant={c.variant} size="sm">{c.label}</Badge>;
  };

  return (
    <div className="p-4 h-full flex flex-col space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
          <TrendingUp className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('stock:cadencier.title', 'Cadencier de Stock')}</h1>
          <p className="text-sm text-muted-foreground">{t('stock:cadencier.subtitle', 'Planification des approvisionnements par rotation et couverture')}</p>
        </div>
      </div>

      <Card className="p-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-3">
            <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-transparent focus-within:ring-1 focus-within:ring-emerald-500">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                type="text"
                placeholder={t('stock:cadencier.search_placeholder', 'Rechercher un produit, CIP...')}
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="h-full border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0"
              />
            </div>
          </div>

          <div className="md:col-span-2">
            <Select
              label={t('stock:cadencier.type', 'Type')}
              value={filters.type}
              onChange={(e) => handleFilterChange('type', e.target.value)}
              size="sm"
            >
              <option value="grossiste">{t('stock:cadencier.type_grossiste', 'Grossiste')}</option>
              <option value="divers">{t('stock:cadencier.type_divers', 'Divers')}</option>
            </Select>
          </div>

          <div className="md:col-span-2">
            <Select
              label={t('stock:cadencier.coverage', 'Couverture')}
              value={String(filters.coverage_days)}
              onChange={(e) => handleFilterChange('coverage_days', parseInt(e.target.value))}
              size="sm"
            >
              <option value="7">7 jours</option>
              <option value="15">15 jours</option>
              <option value="30">30 jours</option>
              <option value="45">45 jours</option>
              <option value="60">60 jours</option>
              <option value="90">90 jours</option>
            </Select>
          </div>

          <div className="md:col-span-2">
            <Select
              label={t('stock:cadencier.rayon', 'Rayon')}
              value={filters.rayon}
              onChange={(e) => handleFilterChange('rayon', e.target.value)}
              size="sm"
            >
              <option value="">{t('common:all', 'Tous')}</option>
              {rayons.map(r => <option key={r.id} value={String(r.id)}>{r.name}</option>)}
            </Select>
          </div>

          <div className="md:col-span-2">
            <Select
              label={t('stock:cadencier.fournisseur', 'Fournisseur')}
              value={filters.fournisseur}
              onChange={(e) => handleFilterChange('fournisseur', e.target.value)}
              size="sm"
            >
              <option value="">{t('common:all', 'Tous')}</option>
              {fournisseurs.map(f => <option key={f.id} value={String(f.id)}>{f.name}</option>)}
            </Select>
          </div>

          <div className="md:col-span-1 flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchCadencier(1)}
              className="gap-1 h-9 px-2 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
              title={t('common:refresh', 'Rafraîchir')}
            >
              <RotateCcw className="h-4 w-4 text-emerald-600" />
            </Button>
          </div>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <Checkbox
            checked={filters.only_below_target}
            onChange={(checked) => handleFilterChange('only_below_target', checked)}
          />
          <label className="text-xs text-muted-foreground cursor-pointer select-none">
            {t('stock:cadencier.only_below_target', 'Uniquement les produits sous le seuil')}
          </label>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Card className="p-4 flex flex-col justify-center border-slate-200">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 bg-emerald-50 rounded-md">
              <Boxes className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{t('stock:cadencier.total_products', 'Produits à commander')}</p>
          </div>
          <h2 className="text-2xl font-bold text-slate-800">{totalCount}</h2>
          <p className="text-xs text-slate-400">{totalQuantite} {t('stock:cadencier.units', 'unités suggérées')}</p>
        </Card>

        <Card className="p-4 flex flex-col justify-center border-slate-200">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 bg-emerald-50 rounded-md">
              <Calendar className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{t('stock:cadencier.total_ht', 'Montant total HT')}</p>
          </div>
          <h2 className="text-2xl font-bold text-slate-800">{totalHt.toLocaleString('fr-FR')} F</h2>
          <p className="text-xs text-slate-400">{t('stock:cadencier.coverage', 'Couverture')}: {filters.coverage_days} jours</p>
        </Card>

        <Card className="p-4 flex flex-col justify-center lg:col-span-2 border-slate-200">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 bg-emerald-50 rounded-md">
              <ShoppingCart className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{t('stock:cadencier.selection', 'Sélection')}</p>
          </div>
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-slate-800">{selectedItems.length} <span className="text-base font-normal text-slate-500">{t('stock:cadencier.products', 'produits')}</span></h2>
            <span className="text-xl font-bold text-slate-800">{selectedTotal.toLocaleString('fr-FR')} F</span>
          </div>
          <div className="mt-2 flex gap-2">
            <Button
              onClick={() => handleGenerateOrder('LOC')}
              disabled={selectedItems.length === 0}
              variant="outline"
              size="sm"
              className="gap-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
            >
              <Truck className="h-4 w-4" />
              {t('stock:cadencier.generate_grossiste', 'Commande Grossiste')}
            </Button>
            <Button
              onClick={() => handleGenerateOrder('DIV')}
              disabled={selectedItems.length === 0}
              variant="outline"
              size="sm"
              className="gap-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
            >
              <ShoppingCart className="h-4 w-4" />
              {t('stock:cadencier.generate_divers', 'Commande Divers')}
            </Button>
          </div>
        </Card>
      </div>

      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden p-0">
        <div className="px-4 py-3 border-b flex justify-between items-center bg-muted/30">
          <h3 className="font-semibold flex items-center gap-2 text-sm">
            <Package className="h-4 w-4 text-emerald-600" />
            {t('stock:cadencier.list', 'Lignes du cadencier')}
          </h3>
          <span className="text-xs text-muted-foreground">
            {t('stock:cadencier.showing', { count: items.length, total: totalCount })}
          </span>
        </div>

        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-white shadow-sm">
              <TableRow className="bg-white hover:bg-white">
                <TableHead className="w-10 py-2">
                  <Checkbox
                    checked={items.length > 0 && selectedIds.size === items.length}
                    onChange={toggleAll}
                  />
                </TableHead>
                <TableHead className="py-2">{t('stock:cadencier.product', 'Produit')}</TableHead>
                <TableHead className="text-right py-2">{t('stock:cadencier.stock', 'Stock')}</TableHead>
                <TableHead className="text-right py-2">{t('stock:cadencier.rotation', 'Rotation')}</TableHead>
                <TableHead className="text-right py-2">{t('stock:cadencier.coverage', 'Couverture')}</TableHead>
                <TableHead className="text-right py-2">{t('stock:cadencier.target', 'Cible')}</TableHead>
                <TableHead className="text-right py-2">{t('stock:cadencier.suggested', 'Qté suggérée')}</TableHead>
                <TableHead className="text-right py-2">{t('stock:cadencier.unit_price', 'Prix achat')}</TableHead>
                <TableHead className="text-right py-2">{t('stock:cadencier.amount', 'Montant HT')}</TableHead>
                <TableHead className="py-2">{t('stock:cadencier.urgency', 'Urgence')}</TableHead>
                <TableHead className="py-2">{t('stock:cadencier.supplier', 'Fournisseur')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={11}>
                      <SkeletonTable rows={1} columns={11} />
                    </TableCell>
                  </TableRow>
                ))
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-muted-foreground py-12">
                    {t('stock:cadencier.empty', 'Aucun produit à afficher dans le cadencier')}
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow
                    key={item.produit_id}
                    className={cn(
                      'cursor-pointer transition-colors',
                      selectedIds.has(item.produit_id) ? 'bg-emerald-50/50' : 'hover:bg-slate-50/50'
                    )}
                    onClick={() => toggleSelection(item.produit_id)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(item.produit_id)}
                        onChange={() => toggleSelection(item.produit_id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{item.produit_nom}</div>
                      <div className="text-xs text-muted-foreground font-mono">{item.cip1 || '-'}</div>
                      {item.rayon_nom && <div className="text-[10px] text-muted-foreground mt-1">{item.rayon_nom}</div>}
                    </TableCell>
                    <TableCell className={cn(
                      'text-right font-medium',
                      item.stock <= 0 ? 'text-red-600' : item.stock < item.stock_minimum ? 'text-amber-600' : 'text-slate-700'
                    )}>
                      {item.stock}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      <div>{item.rotation_moyenne.toFixed(2)}/mois</div>
                      <div className="text-[10px]">({item.rotation_jour.toFixed(2)}/j)</div>
                    </TableCell>
                    <TableCell className="text-right">
                      {item.couverture_jours === 9999 ? '∞' : `${item.couverture_jours} j`}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {item.stock_cible}
                    </TableCell>
                    <TableCell className="text-right font-bold text-emerald-600">
                      {item.quantite_suggeree}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {item.prix_achat.toLocaleString('fr-FR')}
                    </TableCell>
                    <TableCell className="text-right font-bold text-emerald-600">
                      {item.montant_ht.toLocaleString('fr-FR')} F
                    </TableCell>
                    <TableCell>{urgenceBadge(item.urgence)}</TableCell>
                    <TableCell>
                      <div className="text-sm">{item.fournisseur_nom || '-'}</div>
                      {item.is_supplier_exclusive && (
                        <Badge variant="outline" size="sm" className="mt-1">{t('stock:cadencier.exclusive', 'Exclusif')}</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="px-6 py-4 border-t flex items-center justify-between bg-muted/30">
            <span className="text-sm text-muted-foreground">
              Page {page} / {totalPages} · {totalCount} {t('common:results', 'résultats')}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => fetchCadencier(Math.max(1, page - 1))} disabled={page <= 1}>
                <ChevronLeft className="h-4 w-4 mr-1" /> {t('common:previous', 'Précédent')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => fetchCadencier(Math.min(totalPages, page + 1))} disabled={page >= totalPages}>
                {t('common:next', 'Suivant')} <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default Cadencier;

