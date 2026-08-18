import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { cn } from '../lib/utils';
import { Button } from './shadcn/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './shadcn/card';
import { Select } from './ui/Select';
import {
  FileSpreadsheet, Printer, Layers,
  Package, TrendingUp, AlertCircle, CheckCircle2, BarChart3,
  SlidersHorizontal, Eye, Building2, Tag, FlaskConical,
  Grid3X3, Info
} from 'lucide-react';
import { gooeyToast } from 'goey-toast';
import { downloadBlob } from '../utils/excelExport';

// ─── Types ────────────────────────────────────────────────────────────────────

type GroupByOption = 'rayon' | 'forme' | 'groupe' | 'fournisseur';
type StockFilterOption = 'tous' | 'zero' | 'non_zero';
type SourceOption = 'stock' | 'blind';
type StockLocationOption = 'tous' | 'rayon' | 'reserve';

interface EntityOption { id: number; name: string; }

// ─── Styles utilitaires pour tuiles et chips ──────────────────────────────────

const tileActive = {
  violet:  'border-violet-500 bg-violet-50 ring-1 ring-violet-500/20',
  emerald: 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500/20',
  blue:    'border-blue-500 bg-blue-50 ring-1 ring-blue-500/20',
};

const tileIconActive = {
  violet:  'bg-violet-100 text-violet-600',
  emerald: 'bg-emerald-100 text-emerald-600',
  blue:    'bg-blue-100 text-blue-600',
};

const pillActive = {
  blue:    'bg-blue-100 text-blue-700 border-blue-300',
  emerald: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  amber:   'bg-amber-100 text-amber-700 border-amber-300',
  violet:  'bg-violet-100 text-violet-700 border-violet-300',
};

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

  const sourceOptions: { value: SourceOption; label: string; desc: string; icon: React.ReactNode; accent: 'emerald' | 'blue' }[] = useMemo(() => [
    { value: 'stock', label: t('stock:etats.source_stock'), desc: t('stock:etats.source_stock_desc'), icon: <TrendingUp className="size-4" />, accent: 'emerald' },
    { value: 'blind', label: t('stock:etats.source_blind'), desc: t('stock:etats.source_blind_desc'), icon: <BarChart3 className="size-4" />, accent: 'blue' },
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
    <div className="space-y-4 lg:space-y-5 animate-in fade-in duration-300">

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

      {/* ── Grille principale : 2 colonnes ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_340px] gap-4 lg:gap-6 items-start">

        {/* ── Colonne gauche : paramètres ── */}
        <div className="space-y-4">

          {/* 1. Regroupement */}
          <Card>
            <CardHeader className="pb-2 pt-3 px-3 lg:px-4">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="size-4 text-slate-400" />
                <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400">{t('stock:etats.card_grouping')}</CardTitle>
              </div>
              <CardDescription className="text-[11px]">{t('stock:etats.card_grouping_desc')}</CardDescription>
            </CardHeader>
            <CardContent className="px-3 lg:px-4 pb-3 lg:pb-4">
              <div className="grid grid-cols-2 gap-2">
                {groupByOptions.map(o => {
                  const active = groupBy === o.value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setGroupBy(o.value)}
                      className={cn(
                        'flex flex-col gap-1.5 p-3 rounded-xl border-2 text-left transition-all duration-150',
                        active ? tileActive.violet : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                      )}
                    >
                      <div className={cn(
                        'shrink-0 size-8 rounded-lg flex items-center justify-center transition-colors',
                        active ? tileIconActive.violet : 'bg-slate-100 text-slate-400'
                      )}>
                        {o.icon}
                      </div>
                      <div>
                        <p className={cn('text-xs font-semibold', active ? 'text-slate-800' : 'text-slate-700')}>{o.label}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5 leading-tight line-clamp-2">{o.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* 2. Source de données */}
          <Card>
            <CardHeader className="pb-2 pt-3 px-3 lg:px-4">
              <div className="flex items-center gap-2">
                <Layers className="size-4 text-slate-400" />
                <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400">{t('stock:etats.card_source')}</CardTitle>
              </div>
              <CardDescription className="text-[11px]">{t('stock:etats.card_source_desc')}</CardDescription>
            </CardHeader>
            <CardContent className="px-3 lg:px-4 pb-3 lg:pb-4">
              <div className="grid grid-cols-2 gap-2">
                {sourceOptions.map(o => {
                  const active = source === o.value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setSource(o.value)}
                      className={cn(
                        'flex items-start gap-2.5 p-3 rounded-xl border-2 text-left transition-all duration-150',
                        active ? tileActive[o.accent] : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                      )}
                    >
                      <div className={cn(
                        'shrink-0 size-8 rounded-lg flex items-center justify-center transition-colors',
                        active ? tileIconActive[o.accent] : 'bg-slate-100 text-slate-400'
                      )}>
                        {o.icon}
                      </div>
                      <div className="min-w-0 pt-0.5">
                        <p className={cn('text-xs font-semibold', active ? 'text-slate-800' : 'text-slate-700')}>{o.label}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5 leading-tight line-clamp-2">{o.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* 3. Filtres */}
          <Card>
            <CardHeader className="pb-2 pt-3 px-3 lg:px-4">
              <div className="flex items-center gap-2">
                <Package className="size-4 text-slate-400" />
                <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400">{t('stock:etats.card_filters')}</CardTitle>
              </div>
              <CardDescription className="text-[11px]">{t('stock:etats.card_filters_desc')}</CardDescription>
            </CardHeader>
            <CardContent className="px-3 lg:px-4 pb-3 lg:pb-4 space-y-4">

              {/* Filtre entité */}
              <Select
                size="sm"
                label={t('stock:etats.filter_by_entity', { entity: entityLabel })}
                value={selectedEntity ?? ''}
                onChange={(e) => setSelectedEntity(e.target.value ? Number(e.target.value) : null)}
                disabled={loadingEntities}
              >
                <option value="">{t('stock:etats.all_option')}</option>
                {entities.map(ent => (
                  <option key={ent.id} value={ent.id}>{ent.name}</option>
                ))}
              </Select>

              <div className="h-px bg-slate-100" />

              {/* Filtre stock — chips */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{t('stock:etats.filter_stock_label')}</p>
                <div className="flex flex-wrap gap-2">
                  {stockFilterOptions.map(o => {
                    const active = stockFilter === o.value;
                    return (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => setStockFilter(o.value)}
                        className={cn(
                          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150',
                          active ? pillActive[o.accent] : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        )}
                      >
                        {active ? <CheckCircle2 className="size-3.5" /> : o.icon}
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Filtre emplacement — chips (uniquement en mode stock) */}
              {source === 'stock' && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{t('stock:etats.location_label')}</p>
                  <div className="flex flex-wrap gap-2">
                    {stockLocationOptions.map(o => {
                      const active = stockLocation === o.value;
                      return (
                        <button
                          key={o.value}
                          type="button"
                          onClick={() => setStockLocation(o.value)}
                          className={cn(
                            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150',
                            active ? pillActive[o.accent] : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                          )}
                        >
                          {active ? <CheckCircle2 className="size-3.5" /> : o.icon}
                          {o.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Colonne droite : résumé + actions (sticky) ── */}
        <div className="lg:sticky lg:top-4 space-y-4">

          {/* Récapitulatif */}
          <Card>
            <CardHeader className="pb-2 pt-3 px-3 lg:px-4">
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
          <div className="grid grid-cols-1 gap-2">
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
