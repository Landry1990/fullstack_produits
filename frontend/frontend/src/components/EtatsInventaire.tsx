import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { cn } from '../lib/utils';
import { Button } from './shadcn/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './shadcn/card';
import {
  FileSpreadsheet, Printer, Layers,
  Package, TrendingUp, AlertCircle, CheckCircle2, BarChart3,
  SlidersHorizontal, Eye, Building2, Tag, FlaskConical,
  Grid3X3, Info, ChevronDown
} from 'lucide-react';
import { gooeyToast } from 'goey-toast';
import { downloadBlob } from '../utils/excelExport';

// ─── Types ────────────────────────────────────────────────────────────────────

type GroupByOption = 'rayon' | 'forme' | 'groupe' | 'fournisseur';
type StockFilterOption = 'tous' | 'zero' | 'non_zero';
type SourceOption = 'stock' | 'blind';
type StockLocationOption = 'tous' | 'rayon' | 'reserve';

interface EntityOption { id: number; name: string; }

// ─── Sous-composant : Sélecteur Radio Card ────────────────────────────────────

const radioCardAccents: Record<string, string> = {
  emerald: 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20',
  blue:    'border-blue-500 bg-blue-50 ring-2 ring-blue-500/20',
  violet:  'border-violet-500 bg-violet-50 ring-2 ring-violet-500/20',
  amber:   'border-amber-500 bg-amber-50 ring-2 ring-amber-500/20',
};
const radioCardDotColors: Record<string, string> = {
  emerald: 'bg-emerald-500', blue: 'bg-blue-500', violet: 'bg-violet-500', amber: 'bg-amber-500',
};

function RadioCard({
  value, current, label, description, icon, accent = 'emerald', onChange,
}: {
  value: string; current: string; label: string; description?: string;
  icon: React.ReactNode; accent?: 'emerald' | 'blue' | 'violet' | 'amber';
  onChange: (v: string) => void;
}) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={cn(
        'w-full text-left flex items-start gap-2 lg:gap-3 p-2 lg:p-3 rounded-xl border-2 transition-all duration-150 cursor-pointer',
        active ? radioCardAccents[accent] : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
      )}
    >
      <div className={cn(
        'mt-0.5 shrink-0 size-7 lg:size-8 rounded-lg flex items-center justify-center transition-colors',
        active ? `${radioCardDotColors[accent].replace('bg-', 'bg-').replace('500','100')} text-${accent}-600` : 'bg-slate-100 text-slate-400'
      )}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('text-xs lg:text-sm font-semibold truncate', active ? 'text-slate-800' : 'text-slate-600')}>{label}</p>
        {description && <p className="text-[10px] lg:text-[11px] text-slate-400 mt-0.5 truncate">{description}</p>}
      </div>
      {active && (
        <div className={cn('shrink-0 size-4 rounded-full flex items-center justify-center mt-1', radioCardDotColors[accent])}>
          <div className="size-1.5 rounded-full bg-white" />
        </div>
      )}
    </button>
  );
}

// ─── Sous-composant : Badge résumé ────────────────────────────────────────────

const summaryLineColors: Record<string, string> = {
  blue:    'bg-blue-100 text-blue-700',
  violet:  'bg-violet-100 text-violet-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  amber:   'bg-amber-100 text-amber-700',
  slate:   'bg-slate-100 text-slate-600',
};

function SummaryLine({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-slate-500 font-medium">{label}</span>
      <span className={cn('px-2 py-0.5 rounded-full font-semibold max-w-[160px] truncate text-right', summaryLineColors[color] || summaryLineColors.slate)}>
        {value}
      </span>
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────


export default function EtatsInventaire() {
  const { t } = useTranslation(['stock', 'common']);

  const [source, setSource] = useState<SourceOption>('stock');
  const [groupBy, setGroupBy] = useState<GroupByOption>('rayon');
  const [stockFilter, setStockFilter] = useState<StockFilterOption>('tous');
  const [stockLocation, setStockLocation] = useState<StockLocationOption>('tous');
  const [selectedEntity, setSelectedEntity] = useState<number | null>(null);

  const groupByOptions: { value: GroupByOption; label: string; desc: string; icon: React.ReactNode }[] = useMemo(() => [
    { value: 'rayon',       label: t('stock:etats.group_by_rayon'),       desc: t('stock:etats.group_by_rayon_desc'),       icon: <Grid3X3 className="size-4" /> },
    { value: 'forme',       label: t('stock:etats.group_by_forme'),       desc: t('stock:etats.group_by_forme_desc'),       icon: <FlaskConical className="size-4" /> },
    { value: 'groupe',      label: t('stock:etats.group_by_groupe'),      desc: t('stock:etats.group_by_groupe_desc'),      icon: <Tag className="size-4" /> },
    { value: 'fournisseur', label: t('stock:etats.group_by_fournisseur'),  desc: t('stock:etats.group_by_fournisseur_desc'), icon: <Building2 className="size-4" /> },
  ], [t]);

  const stockFilterOptions: { value: StockFilterOption; label: string; desc: string; icon: React.ReactNode; accent: 'emerald' | 'blue' | 'amber' }[] = useMemo(() => [
    { value: 'tous',     label: t('stock:etats.filter_all'),      desc: t('stock:etats.filter_all_desc'),      icon: <Package className="size-4" />,      accent: 'blue' },
    { value: 'non_zero', label: t('stock:etats.filter_positive'), desc: t('stock:etats.filter_positive_desc'), icon: <CheckCircle2 className="size-4" />, accent: 'emerald' },
    { value: 'zero',     label: t('stock:etats.filter_zero'),     desc: t('stock:etats.filter_zero_desc'),     icon: <AlertCircle className="size-4" />,  accent: 'amber' },
  ], [t]);

  const stockLocationOptions: { value: StockLocationOption; label: string; desc: string; icon: React.ReactNode; accent: 'emerald' | 'blue' | 'amber' }[] = useMemo(() => [
    { value: 'tous',    label: t('stock:etats.location_all'),      desc: t('stock:etats.location_all_desc'),      icon: <Package className="size-4" />,   accent: 'blue' },
    { value: 'rayon',   label: t('stock:etats.location_rayon'),    desc: t('stock:etats.location_rayon_desc'),    icon: <TrendingUp className="size-4" />, accent: 'emerald' },
    { value: 'reserve', label: t('stock:etats.location_reserve'),  desc: t('stock:etats.location_reserve_desc'),  icon: <Layers className="size-4" />,     accent: 'amber' },
  ], [t]);

  const [entities, setEntities] = useState<EntityOption[]>([]);
  const [loadingEntities, setLoadingEntities] = useState(false);
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
        setEntities(data.map((i: unknown) => ({ id: i.id, name: i.name || i.nom })));
      } catch { setEntities([]); }
      finally { setLoadingEntities(false); }
    };
    fetch();
  }, [groupBy]);

  // ── Paramètres communs ─────────────────────────────────────────────────────
  const buildParams = useCallback(() => {
    const p: Record<string, string> = { group_by: groupBy, stock_filter: stockFilter };
    if (selectedEntity) p.filter_id = String(selectedEntity);
    if (source === 'blind') p.blind = 'true';
    if (stockLocation !== 'tous') p.stock_location = stockLocation;
    return p;
  }, [groupBy, stockFilter, selectedEntity, source, stockLocation]);

  // ── Export Excel ───────────────────────────────────────────────────────────
  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const res = await api.get('inventaires/listing-excel/', {
        params: buildParams(),
        responseType: 'blob',
      });
      const filename = `listing_${source}_${groupBy}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      downloadBlob(res.data, filename);
      gooeyToast.success(t('stock:etats.excel_success'));
    } catch {
      gooeyToast.error(t('stock:etats.excel_error'));
    } finally {
      setExporting(false);
    }
  };

  // ── Impression ─────────────────────────────────────────────────────────────
  const handlePrint = () => {
    const params = buildParams();
    const qs = new URLSearchParams(params).toString();
    window.open(`/app/printing/0?type=INVENTAIRE&${qs}`, '_blank');
  };

  // ── Options ────────────────────────────────────────────────────────────────

  const entityLabel = {
    rayon: t('common:rayon'),
    forme: t('common:forme'),
    groupe: t('common:groupe'),
    fournisseur: t('common:supplier'),
  }[groupBy];
  const selectedEntityName = entities.find(e => e.id === selectedEntity)?.name;
  const canExport = true;

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3 lg:space-y-5 animate-in fade-in duration-300">

      {/* ── En-tête ── */}
      <div className="flex items-center gap-2 lg:gap-3">
        <div className="size-8 lg:size-10 rounded-lg lg:rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
          <BarChart3 className="size-4 lg:size-5 text-white" />
        </div>
        <div>
          <h1 className="text-base lg:text-xl font-bold text-slate-800 tracking-tight">{t('stock:etats.title')}</h1>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest hidden lg:block">{t('stock:etats.subtitle')}</p>
        </div>
      </div>

      {/* ── Grille principale ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-[1fr_1fr_1fr_300px] gap-3 lg:gap-4">

        {/* ── Colonne 1 : Regroupement ── */}
        <Card>
          <CardHeader className="pb-2 lg:pb-3 pt-3 lg:pt-4 px-3 lg:px-4">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="size-4 text-slate-400" />
              <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400">{t('stock:etats.card_grouping')}</CardTitle>
            </div>
            <CardDescription className="text-[11px]">{t('stock:etats.card_grouping_desc')}</CardDescription>
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
              <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400">{t('stock:etats.card_source')}</CardTitle>
            </div>
            <CardDescription className="text-[11px]">{t('stock:etats.card_source_desc')}</CardDescription>
          </CardHeader>
          <CardContent className="px-3 lg:px-4 pb-3 lg:pb-4 space-y-3">
            <div className="space-y-1.5">
              <RadioCard
                value="stock"
                current={source}
                label={t('stock:etats.source_stock')}
                description={t('stock:etats.source_stock_desc')}
                icon={<TrendingUp className="size-4" />}
                accent="emerald"
                onChange={(v) => setSource(v as SourceOption)}
              />
              <RadioCard
                value="blind"
                current={source}
                label={t('stock:etats.source_blind')}
                description={t('stock:etats.source_blind_desc')}
                icon={<BarChart3 className="size-4" />}
                accent="blue"
                onChange={(v) => setSource(v as SourceOption)}
              />
            </div>
          </CardContent>
        </Card>

        {/* ── Colonne 3 : Filtre entité + stock ── */}
        <Card>
          <CardHeader className="pb-2 lg:pb-3 pt-3 lg:pt-4 px-3 lg:px-4">
            <div className="flex items-center gap-2">
              <Package className="size-4 text-slate-400" />
              <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400">{t('stock:etats.card_filters')}</CardTitle>
            </div>
            <CardDescription className="text-[11px]">{t('stock:etats.card_filters_desc')}</CardDescription>
          </CardHeader>
          <CardContent className="px-3 lg:px-4 pb-3 lg:pb-4 space-y-4">
            {/* Filtre entité */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                {t('stock:etats.filter_by_entity', { entity: entityLabel })}
              </p>
              <div className="relative">
                <select
                  className="w-full h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 pr-8 text-sm text-slate-700 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all appearance-none disabled:opacity-50"
                  value={selectedEntity ?? ''}
                  onChange={(e) => setSelectedEntity(e.target.value ? Number(e.target.value) : null)}
                  disabled={loadingEntities}
                >
                  <option value="">{t('stock:etats.all_option')}</option>
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
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{t('stock:etats.filter_stock_label')}</p>
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

            {/* Filtre emplacement (rayon / réserve) — visible uniquement en mode stock */}
            {source === 'stock' && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{t('stock:etats.location_label')}</p>
                {stockLocationOptions.map(o => (
                  <RadioCard
                    key={o.value}
                    value={o.value}
                    current={stockLocation}
                    label={o.label}
                    description={o.desc}
                    icon={o.icon}
                    accent={o.accent}
                    onChange={(v) => setStockLocation(v as StockLocationOption)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Colonne 4 : Résumé + Actions ── */}
        <div className="flex flex-col gap-3 lg:gap-4">
          {/* Résumé */}
          <Card className="flex-1">
            <CardHeader className="pb-2 lg:pb-3 pt-3 lg:pt-4 px-3 lg:px-4">
              <div className="flex items-center gap-2">
                <Eye className="size-4 text-slate-400" />
                <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400">{t('stock:etats.card_summary')}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-3 lg:px-4 pb-3 lg:pb-4 space-y-2">
              <SummaryLine
                label={t('stock:etats.summary_source')}
                value={source === 'stock' ? t('stock:etats.source_stock') : t('stock:etats.source_blind')}
                color="blue"
              />
              <SummaryLine
                label={t('stock:etats.summary_grouping')}
                value={groupByOptions.find(o => o.value === groupBy)?.label || groupBy}
                color="violet"
              />
              <SummaryLine
                label={entityLabel}
                value={selectedEntityName || t('common:all')}
                color="slate"
              />
              <SummaryLine
                label={t('stock:etats.summary_filter_stock')}
                value={stockFilterOptions.find(o => o.value === stockFilter)?.label || stockFilter}
                color="emerald"
              />
              {source === 'stock' && (
                <SummaryLine
                  label={t('stock:etats.summary_location')}
                  value={stockLocationOptions.find(o => o.value === stockLocation)?.label || stockLocation}
                  color="amber"
                />
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
              {exporting ? t('stock:etats.generating') : t('stock:etats.export_excel')}
            </Button>

            <Button
              variant="outline"
              onClick={handlePrint}
              disabled={!canExport}
              className="w-full h-11"
            >
              <Printer className="size-4" />
              {t('stock:etats.print')}
            </Button>
          </div>

          {/* Note info */}
          <div className="flex gap-2 p-3 bg-blue-50 border border-blue-100 rounded-xl">
            <Info className="size-4 text-blue-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-blue-600 leading-relaxed">
              {t('stock:etats.export_info')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
