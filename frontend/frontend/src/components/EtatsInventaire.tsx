import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { cn } from '../lib/utils';
import { Button } from './shadcn/button';
import { Badge } from './shadcn/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './shadcn/card';
import {
  FileSpreadsheet, Printer, RefreshCw, ChevronDown, Layers,
  Package, TrendingUp, AlertCircle, CheckCircle2, BarChart3,
  SlidersHorizontal, Eye, EyeOff, Building2, Tag, FlaskConical,
  Grid3X3, Info, Download
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { exportToExcel } from '../utils/excelExport';
import { usePharmacySettings } from '../hooks/usePharmacySettings';

// ─── Types ────────────────────────────────────────────────────────────────────

type GroupByOption = 'rayon' | 'forme' | 'groupe' | 'fournisseur';
type StockFilterOption = 'tous' | 'zero' | 'non_zero';
type SourceOption = 'stock' | 'inventaire';

interface EntityOption { id: number; name: string; }
interface InventaireOption { id: number; reference: string; description: string; date: string; status: string; }

// ─── Sous-composant : Sélecteur Radio Card ────────────────────────────────────

function RadioCard({
  value, current, label, description, icon, accent = 'emerald', onChange,
}: {
  value: string; current: string; label: string; description?: string;
  icon: React.ReactNode; accent?: 'emerald' | 'blue' | 'violet' | 'amber';
  onChange: (v: string) => void;
}) {
  const active = current === value;
  const accents: Record<string, string> = {
    emerald: 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20',
    blue:    'border-blue-500 bg-blue-50 ring-2 ring-blue-500/20',
    violet:  'border-violet-500 bg-violet-50 ring-2 ring-violet-500/20',
    amber:   'border-amber-500 bg-amber-50 ring-2 ring-amber-500/20',
  };
  const dotColors: Record<string, string> = {
    emerald: 'bg-emerald-500', blue: 'bg-blue-500', violet: 'bg-violet-500', amber: 'bg-amber-500',
  };
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={cn(
        'w-full text-left flex items-start gap-2 lg:gap-3 p-2 lg:p-3 rounded-xl border-2 transition-all duration-150 cursor-pointer',
        active ? accents[accent] : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
      )}
    >
      <div className={cn(
        'mt-0.5 shrink-0 size-7 lg:size-8 rounded-lg flex items-center justify-center transition-colors',
        active ? `${dotColors[accent].replace('bg-', 'bg-').replace('500','100')} text-${accent}-600` : 'bg-slate-100 text-slate-400'
      )}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('text-xs lg:text-sm font-semibold truncate', active ? 'text-slate-800' : 'text-slate-600')}>{label}</p>
        {description && <p className="text-[10px] lg:text-[11px] text-slate-400 mt-0.5 truncate">{description}</p>}
      </div>
      {active && (
        <div className={cn('shrink-0 size-4 rounded-full flex items-center justify-center mt-1', dotColors[accent])}>
          <div className="size-1.5 rounded-full bg-white" />
        </div>
      )}
    </button>
  );
}

// ─── Sous-composant : Badge résumé ────────────────────────────────────────────

function SummaryLine({ label, value, color }: { label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    blue:    'bg-blue-100 text-blue-700',
    violet:  'bg-violet-100 text-violet-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    amber:   'bg-amber-100 text-amber-700',
    slate:   'bg-slate-100 text-slate-600',
  };
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-slate-500 font-medium">{label}</span>
      <span className={cn('px-2 py-0.5 rounded-full font-semibold max-w-[160px] truncate text-right', colors[color] || colors.slate)}>
        {value}
      </span>
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function EtatsInventaire() {
  const { settings } = usePharmacySettings();
  const [source, setSource] = useState<SourceOption>('stock');
  const [groupBy, setGroupBy] = useState<GroupByOption>('rayon');
  const [stockFilter, setStockFilter] = useState<StockFilterOption>('tous');
  const [selectedEntity, setSelectedEntity] = useState<number | null>(null);
  const [selectedInventaire, setSelectedInventaire] = useState<number | null>(null);

  const [entities, setEntities] = useState<EntityOption[]>([]);
  const [inventaires, setInventaires] = useState<InventaireOption[]>([]);
  const [loadingEntities, setLoadingEntities] = useState(false);
  const [loadingInventaires, setLoadingInventaires] = useState(false);
  const [exporting, setExporting] = useState(false);

  // ── Charger les entités selon le regroupement ──────────────────────────────
  useEffect(() => {
    const fetch = async () => {
      setLoadingEntities(true);
      setSelectedEntity(null);
      const endpointMap: Record<GroupByOption, string> = {
        rayon: 'rayons/', forme: 'formes/', groupe: 'groupes/', fournisseur: 'fournisseurs/',
      };
      try {
        const res = await api.get(endpointMap[groupBy], { params: { page_size: 300 } });
        const data = res.data.results || res.data;
        setEntities(data.map((i: any) => ({ id: i.id, name: i.name || i.nom })));
      } catch { setEntities([]); }
      finally { setLoadingEntities(false); }
    };
    fetch();
  }, [groupBy]);

  // ── Charger les inventaires si source = inventaire ─────────────────────────
  useEffect(() => {
    if (source !== 'inventaire') return;
    const fetch = async () => {
      setLoadingInventaires(true);
      try {
        const res = await api.get('inventaires/', { params: { page_size: 100, ordering: '-date' } });
        const data = res.data.results || res.data;
        setInventaires(data.map((inv: any) => ({
          id: inv.id,
          reference: inv.reference || `#${inv.id}`,
          description: inv.description || '',
          date: inv.date ? new Date(inv.date).toLocaleDateString('fr-FR') : '',
          status: inv.status,
        })));
      } catch { setInventaires([]); }
      finally { setLoadingInventaires(false); }
    };
    fetch();
  }, [source]);

  // ── Paramètres communs ─────────────────────────────────────────────────────
  const buildParams = useCallback(() => {
    const p: Record<string, string> = { group_by: groupBy, stock_filter: stockFilter };
    if (selectedEntity) p.filter_id = String(selectedEntity);
    if (source === 'inventaire' && selectedInventaire) p.inventaire_id = String(selectedInventaire);
    return p;
  }, [groupBy, stockFilter, selectedEntity, source, selectedInventaire]);

  // ── Export Excel ───────────────────────────────────────────────────────────
  const handleExportExcel = async () => {
    if (source === 'inventaire' && !selectedInventaire) {
      toast.error('Veuillez sélectionner un inventaire');
      return;
    }
    setExporting(true);
    try {
      const res = await api.get('inventaires/listing-json/', {
        params: buildParams(),
      });
      const toRow = (r: any): Record<string, string | number | boolean> =>
        source === 'inventaire'
          ? {
              'CIP':          String(r.cip ?? ''),
              'Désignation':  String(r.name ?? ''),
              'N° Lot':       String(r.lot_numero ?? ''),
              'Exp. Lot':     String(r.lot_expiration ?? ''),
              'Stock Théo.':  Number(r.stock_theorique ?? 0),
              'Qté Comptée':  Number(r.quantite_physique ?? 0),
              'Écart':        Number(r.ecart ?? 0),
              'PMP':          Number(r.pmp ?? 0),
              'Val. Écart':   Number(r.valeur_ecart ?? 0),
            }
          : {
              'CIP':          String(r.cip ?? ''),
              'Désignation':  String(r.name ?? ''),
              'Forme':        String(r.forme ?? ''),
              'Rayon':        String(r.rayon ?? ''),
              'N° Lot':       String(r.lot_numero ?? ''),
              'Exp. Lot':     String(r.lot_expiration ?? ''),
              'Stock Lot':    Number(r.stock ?? 0),
              'Stock Rés.':   Number(r.stock_reserve ?? 0),
              'PMP':          Number(r.pmp ?? 0),
              'Val. Stock':   Number(r.valeur_stock ?? 0),
              'Prix Vente':   Number(r.prix_vente ?? 0),
            };
      const rows = (res.data as any[]).map(toRow);

      const groupLabel: Record<string, string> = {
        rayon: 'Rayon', forme: 'Forme', groupe: 'Groupe', fournisseur: 'Fournisseur'
      };
      const titleLabel = source === 'inventaire'
        ? `Listing Inventaire — par ${groupLabel[groupBy] ?? groupBy}`
        : `Listing Stock (Lots) — par ${groupLabel[groupBy] ?? groupBy}`;

      exportToExcel(rows, settings, {
        filename: `listing_${source}_${groupBy}_${new Date().toISOString().slice(0, 10)}.xlsx`,
        sheetName: 'Listing',
        title: titleLabel,
        printA4Portrait: true,
      });
      toast.success('Fichier Excel téléchargé !');
    } catch {
      toast.error("Erreur lors de l'export Excel");
    } finally {
      setExporting(false);
    }
  };

  // ── Impression ─────────────────────────────────────────────────────────────
  const handlePrint = () => {
    const params = buildParams();
    const qs = new URLSearchParams(params).toString();
    const invId = source === 'inventaire' && selectedInventaire ? selectedInventaire : 0;
    window.open(`/app/printing/${invId}?type=INVENTAIRE&${qs}`, '_blank');
  };

  // ── Options ────────────────────────────────────────────────────────────────
  const groupByOptions: { value: GroupByOption; label: string; desc: string; icon: React.ReactNode }[] = [
    { value: 'rayon',       label: 'Par Rayon',             desc: 'Emplacement physique',         icon: <Grid3X3 className="size-4" /> },
    { value: 'forme',       label: 'Par Forme galénique',   desc: 'Comprimé, sirop, pommade…',    icon: <FlaskConical className="size-4" /> },
    { value: 'groupe',      label: 'Par Groupe thérap.',    desc: 'Classification DCI / ATC',     icon: <Tag className="size-4" /> },
    { value: 'fournisseur', label: 'Par Fournisseur',       desc: 'Fournisseur des lots',         icon: <Building2 className="size-4" /> },
  ];

  const stockFilterOptions: { value: StockFilterOption; label: string; desc: string; icon: React.ReactNode; accent: 'emerald' | 'blue' | 'amber' }[] = [
    { value: 'tous',     label: 'Tous les produits',     desc: 'Stock nul et positif',          icon: <Package className="size-4" />,      accent: 'blue' },
    { value: 'non_zero', label: 'Stocks positifs (> 0)', desc: 'Produits en stock uniquement',   icon: <CheckCircle2 className="size-4" />, accent: 'emerald' },
    { value: 'zero',     label: 'Stocks nuls (= 0)',     desc: 'Ruptures / produits à saisir',  icon: <AlertCircle className="size-4" />,  accent: 'amber' },
  ];

  const entityLabel = groupByOptions.find(o => o.value === groupBy)?.label.replace('Par ', '') || '';
  const selectedEntityName = entities.find(e => e.id === selectedEntity)?.name;
  const selectedInvInfo = inventaires.find(i => i.id === selectedInventaire);
  const canExport = source === 'stock' || (source === 'inventaire' && !!selectedInventaire);

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 animate-in fade-in duration-300">

      {/* ── En-tête ── */}
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
          <BarChart3 className="size-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">Listing d'inventaire</h1>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Génération configurable — Excel & Impression</p>
        </div>
      </div>

      {/* ── Grille principale ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-[1fr_1fr_1fr_300px] gap-3 lg:gap-4">

        {/* ── Colonne 1 : Regroupement ── */}
        <Card>
          <CardHeader className="pb-2 lg:pb-3 pt-3 lg:pt-4 px-3 lg:px-4">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="size-4 text-slate-400" />
              <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400">Regroupement</CardTitle>
            </div>
            <CardDescription className="text-[11px]">Organiser le listing par…</CardDescription>
          </CardHeader>
          <CardContent className="px-3 lg:px-4 pb-3 lg:pb-4 space-y-1.5">
            {groupByOptions.map(o => (
              <RadioCard
                key={o.value}
                value={o.value}
                current={groupBy}
                label={o.label}
                description={o.desc}
                icon={o.icon}
                accent="violet"
                onChange={(v) => setGroupBy(v as GroupByOption)}
              />
            ))}
          </CardContent>
        </Card>

        {/* ── Colonne 2 : Source + Entité ── */}
        <Card>
          <CardHeader className="pb-2 lg:pb-3 pt-3 lg:pt-4 px-3 lg:px-4">
            <div className="flex items-center gap-2">
              <Layers className="size-4 text-slate-400" />
              <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400">Source des données</CardTitle>
            </div>
            <CardDescription className="text-[11px]">Stock courant ou inventaire précis</CardDescription>
          </CardHeader>
          <CardContent className="px-3 lg:px-4 pb-3 lg:pb-4 space-y-3">
            <div className="space-y-1.5">
              <RadioCard
                value="stock"
                current={source}
                label="Stock courant"
                description="Quantités réelles présentes"
                icon={<TrendingUp className="size-4" />}
                accent="emerald"
                onChange={(v) => setSource(v as SourceOption)}
              />
              <RadioCard
                value="inventaire"
                current={source}
                label="D'un inventaire"
                description="Lignes d'un inventaire enregistré"
                icon={<BarChart3 className="size-4" />}
                accent="blue"
                onChange={(v) => setSource(v as SourceOption)}
              />
            </div>

            {source === 'inventaire' && (
              <div className="space-y-1.5 pt-1 border-t border-slate-100">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 pt-1">Choisir l'inventaire</p>
                <div className="relative">
                  <select
                    className="w-full h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 pr-8 text-sm text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none disabled:opacity-50"
                    value={selectedInventaire ?? ''}
                    onChange={(e) => setSelectedInventaire(e.target.value ? Number(e.target.value) : null)}
                    disabled={loadingInventaires}
                  >
                    <option value="">— Sélectionner —</option>
                    {inventaires.map(inv => (
                      <option key={inv.id} value={inv.id}>
                        {inv.reference} • {inv.date} {inv.status === 'VALIDEE' ? '✓' : '⏳'}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    {loadingInventaires
                      ? <span className="size-3.5 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin inline-block" />
                      : <ChevronDown className="size-4" />
                    }
                  </div>
                </div>
                {selectedInvInfo && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <Badge variant={selectedInvInfo.status === 'VALIDEE' ? 'default' : 'outline'} className="text-[10px]">
                      {selectedInvInfo.status === 'VALIDEE' ? 'Validé' : 'En cours'}
                    </Badge>
                    {selectedInvInfo.description && (
                      <span className="text-[11px] text-slate-400 truncate">{selectedInvInfo.description}</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Colonne 3 : Filtre entité + stock ── */}
        <Card>
          <CardHeader className="pb-2 lg:pb-3 pt-3 lg:pt-4 px-3 lg:px-4">
            <div className="flex items-center gap-2">
              <Package className="size-4 text-slate-400" />
              <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400">Filtres</CardTitle>
            </div>
            <CardDescription className="text-[11px]">Affiner par entité et par stock</CardDescription>
          </CardHeader>
          <CardContent className="px-3 lg:px-4 pb-3 lg:pb-4 space-y-4">
            {/* Filtre entité */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Filtrer par {entityLabel}
              </p>
              <div className="relative">
                <select
                  className="w-full h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 pr-8 text-sm text-slate-700 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all appearance-none disabled:opacity-50"
                  value={selectedEntity ?? ''}
                  onChange={(e) => setSelectedEntity(e.target.value ? Number(e.target.value) : null)}
                  disabled={loadingEntities}
                >
                  <option value="">— Tous —</option>
                  {entities.map(ent => (
                    <option key={ent.id} value={ent.id}>{ent.name}</option>
                  ))}
                </select>
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  {loadingEntities
                    ? <span className="size-3.5 border-2 border-slate-300 border-t-violet-500 rounded-full animate-spin inline-block" />
                    : <ChevronDown className="size-4" />
                  }
                </div>
              </div>
            </div>

            <div className="h-px bg-slate-100" />

            {/* Filtre stock */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Filtre stock</p>
              {stockFilterOptions.map(o => (
                <RadioCard
                  key={o.value}
                  value={o.value}
                  current={stockFilter}
                  label={o.label}
                  description={o.desc}
                  icon={o.icon}
                  accent={o.accent}
                  onChange={(v) => setStockFilter(v as StockFilterOption)}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Colonne 4 : Résumé + Actions ── */}
        <div className="flex flex-col gap-3 lg:gap-4">
          {/* Résumé */}
          <Card className="flex-1">
            <CardHeader className="pb-2 lg:pb-3 pt-3 lg:pt-4 px-3 lg:px-4">
              <div className="flex items-center gap-2">
                <Eye className="size-4 text-slate-400" />
                <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400">Récapitulatif</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-3 lg:px-4 pb-3 lg:pb-4 space-y-2">
              <SummaryLine
                label="Source"
                value={source === 'stock' ? 'Stock courant' : selectedInvInfo ? selectedInvInfo.reference : '—'}
                color="blue"
              />
              <SummaryLine
                label="Regroupement"
                value={groupByOptions.find(o => o.value === groupBy)?.label || groupBy}
                color="violet"
              />
              <SummaryLine
                label={entityLabel}
                value={selectedEntityName || 'Tous'}
                color="slate"
              />
              <SummaryLine
                label="Filtre stock"
                value={stockFilterOptions.find(o => o.value === stockFilter)?.label || stockFilter}
                color="emerald"
              />

              {/* Avertissement si inventaire non sélectionné */}
              {source === 'inventaire' && !selectedInventaire && (
                <div className="flex items-start gap-2 mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertCircle className="size-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-amber-700 font-medium">Sélectionnez un inventaire pour continuer</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Boutons d'action */}
          <div className="grid grid-cols-2 xl:grid-cols-1 gap-2">
            <Button
              onClick={handleExportExcel}
              disabled={exporting || !canExport}
              className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20"
            >
              {exporting
                ? <span className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <FileSpreadsheet className="size-5" />
              }
              {exporting ? 'Génération…' : 'Exporter en Excel'}
            </Button>

            <Button
              variant="outline"
              onClick={handlePrint}
              disabled={!canExport}
              className="w-full h-11"
            >
              <Printer className="size-4" />
              Imprimer
            </Button>
          </div>

          {/* Note info */}
          <div className="flex gap-2 p-3 bg-blue-50 border border-blue-100 rounded-xl">
            <Info className="size-4 text-blue-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-blue-600 leading-relaxed">
              L'export Excel est groupé, avec sous-totaux par catégorie et total général. Pour le fournisseur, le regroupement s'effectue via les lots en stock.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
