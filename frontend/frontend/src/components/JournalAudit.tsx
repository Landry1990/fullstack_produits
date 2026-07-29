import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuditLogs, useAuditStats, useUsers } from '../hooks/useAudit';
import { formatNumber } from '../utils/formatters';
import {
  ClipboardList, Search, Download, RotateCcw, ChevronDown, ChevronUp,
  TrendingUp, Clock, Calendar, Shield, PackagePlus, PackageMinus, Loader2,
  XCircle, Trash2, CheckCircle2, Boxes, ArrowDownToLine,
  BadgeAlert, Edit, LogIn, FileOutput, Settings, AlertTriangle,
  Activity, Filter
} from 'lucide-react';

// ── Config par type d'action ────────────────────────────────────────────────
const ACTION_CONFIG: Record<string, {
  Icon: React.FC<{ className?: string }>;
  bg: string; ring: string; iconColor: string; label: string;
  severity: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
}> = {
  CREATE:     { Icon: PackagePlus,    bg: 'bg-emerald-50',  ring: 'ring-emerald-200', iconColor: 'text-emerald-600', label: 'Création',              severity: 'success'  },
  INV_CRE:    { Icon: Boxes,          bg: 'bg-emerald-50',  ring: 'ring-emerald-200', iconColor: 'text-emerald-600', label: 'Inventaire créé',        severity: 'success'  },
  ORD_RECV:   { Icon: ArrowDownToLine,bg: 'bg-sky-50',      ring: 'ring-sky-200',     iconColor: 'text-sky-600',     label: 'Réception commande',     severity: 'info'     },
  CLOTURE:    { Icon: CheckCircle2,   bg: 'bg-sky-50',      ring: 'ring-sky-200',     iconColor: 'text-sky-600',     label: 'Clôture caisse',         severity: 'info'     },
  UPDATE:     { Icon: Edit,           bg: 'bg-amber-50',    ring: 'ring-amber-200',   iconColor: 'text-amber-600',   label: 'Modification',           severity: 'warning'  },
  STOCK_ADJ:  { Icon: PackageMinus,   bg: 'bg-amber-50',    ring: 'ring-amber-200',   iconColor: 'text-amber-600',   label: 'Ajust. stock',           severity: 'warning'  },
  PRICE_CHG:  { Icon: TrendingUp,     bg: 'bg-amber-50',    ring: 'ring-amber-200',   iconColor: 'text-amber-600',   label: 'Changement prix',        severity: 'warning'  },
  INV_VALID:  { Icon: CheckCircle2,   bg: 'bg-purple-50',   ring: 'ring-purple-200',  iconColor: 'text-purple-600',  label: 'Inventaire validé',      severity: 'purple'   },
  INV_VAL:    { Icon: Shield,         bg: 'bg-purple-50',   ring: 'ring-purple-200',  iconColor: 'text-purple-600',  label: 'Validation (Sudo)',       severity: 'purple'   },
  SUDO_VAL:   { Icon: Shield,         bg: 'bg-purple-50',   ring: 'ring-purple-200',  iconColor: 'text-purple-600',  label: 'Validation Sudo',        severity: 'purple'   },
  DELETE:     { Icon: Trash2,         bg: 'bg-red-50',      ring: 'ring-red-200',     iconColor: 'text-red-600',     label: 'Suppression',            severity: 'danger'   },
  INV_CANCEL: { Icon: XCircle,        bg: 'bg-red-50',      ring: 'ring-red-200',     iconColor: 'text-red-600',     label: 'Annulation facture',     severity: 'danger'   },
  INV_DEL:    { Icon: Trash2,         bg: 'bg-red-50',      ring: 'ring-red-200',     iconColor: 'text-red-600',     label: 'Suppression facture',    severity: 'danger'   },
  ORD_CNCL:   { Icon: XCircle,        bg: 'bg-red-50',      ring: 'ring-red-200',     iconColor: 'text-red-600',     label: 'Annulation commande',    severity: 'danger'   },
  LOGIN:      { Icon: LogIn,          bg: 'bg-slate-50',    ring: 'ring-slate-200',   iconColor: 'text-slate-500',   label: 'Connexion',              severity: 'neutral'  },
  EXPORT:     { Icon: FileOutput,     bg: 'bg-slate-50',    ring: 'ring-slate-200',   iconColor: 'text-slate-500',   label: 'Export',                 severity: 'neutral'  },
};

const SEVERITY_BADGE: Record<string, string> = {
  success: 'bg-emerald-100 text-emerald-700',
  info:    'bg-sky-100 text-sky-700',
  warning: 'bg-amber-100 text-amber-700',
  danger:  'bg-red-100 text-red-700',
  purple:  'bg-purple-100 text-purple-700',
  neutral: 'bg-slate-100 text-slate-600',
};

const QUICK_FILTERS = [
  { value: '',          label: 'Tout',        color: 'bg-slate-100 text-slate-700 hover:bg-slate-200' },
  { value: 'INV_CANCEL,INV_DEL,ORD_CNCL,DELETE', label: '🔴 Annulations', color: 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200' },
  { value: 'PRICE_CHG', label: '💲 Prix',      color: 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200' },
  { value: 'STOCK_ADJ', label: '📦 Stock',     color: 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200' },
  { value: 'SUDO_VAL,INV_VAL', label: '🔐 Sudo', color: 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200' },
  { value: 'CLOTURE',   label: '💰 Clôtures',  color: 'bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200' },
];

// ── Formatage lisible des détails ────────────────────────────────────────────
function buildDetailChips(log: unknown): { label: string; value: string; highlight?: boolean }[] {
  const d = log.details;
  if (!d || Object.keys(d).length === 0) return [];
  const chips: { label: string; value: string; highlight?: boolean }[] = [];

  if (log.action === 'PRICE_CHG') {
    chips.push({ label: 'Avant', value: `${d.old_price} FCFA` });
    chips.push({ label: 'Après', value: `${d.new_price} FCFA`, highlight: true });
    if (d.produit_nom) chips.push({ label: 'Produit', value: d.produit_nom });
  } else if (log.action === 'STOCK_ADJ') {
    chips.push({ label: 'Avant', value: String(d.old_quantity) });
    chips.push({ label: 'Après', value: String(d.new_quantity), highlight: true });
    if (d.ecart !== undefined) chips.push({ label: 'Écart', value: (d.ecart > 0 ? '+' : '') + d.ecart, highlight: true });
    if (d.reason) chips.push({ label: 'Motif', value: d.reason });
  } else if (d.sudo_validation) {
    chips.push({ label: 'Validé par', value: d.sudo_user || '—', highlight: true });
    if (d.sudo_permission) chips.push({ label: 'Permission', value: d.sudo_permission });
  } else if (d.changes && typeof d.changes === 'object') {
    Object.entries(d.changes).slice(0, 3).forEach(([key, val]: [string, unknown]) => {
      chips.push({ label: key, value: `${val?.old ?? '—'} → ${val?.new ?? '—'}`, highlight: true });
    });
  } else {
    if (d.amount !== undefined) chips.push({ label: 'Montant', value: `${Number(d.amount).toLocaleString('fr-FR')} FCFA`, highlight: true });
    if (d.montant !== undefined) chips.push({ label: 'Montant', value: `${Number(d.montant).toLocaleString('fr-FR')} FCFA`, highlight: true });
    if (d.quantity !== undefined) chips.push({ label: 'Qté', value: String(d.quantity), highlight: true });
    if (d.total_ttc !== undefined) chips.push({ label: 'Total', value: `${Number(d.total_ttc).toLocaleString('fr-FR')} FCFA`, highlight: true });
    if (d.client_name) chips.push({ label: 'Client', value: d.client_name });
    if (d.produit_nom) chips.push({ label: 'Produit', value: d.produit_nom });
    if (d.reason) chips.push({ label: 'Motif', value: d.reason });
  }
  return chips;
}

// ── Groupage par date ────────────────────────────────────────────────────────
function groupByDay(logs: unknown[]) {
  const groups: { label: string; dateKey: string; logs: unknown[] }[] = [];
  const map = new Map<string, unknown[]>();
  logs.forEach(log => {
    const d = parseISO(log.timestamp);
    const key = format(d, 'yyyy-MM-dd');
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(log);
  });
  map.forEach((dayLogs, key) => {
    const d = parseISO(key);
    let label = '';
    if (isToday(d)) label = "Aujourd'hui";
    else if (isYesterday(d)) label = 'Hier';
    else label = format(d, 'EEEE d MMMM yyyy', { locale: fr });
    groups.push({ label, dateKey: key, logs: dayLogs });
  });
  return groups;
}

// ── Composant principal ──────────────────────────────────────────────────────
const JournalAudit: React.FC = () => {
    const { t } = useTranslation(['audit', 'common']);

    const [page, setPage] = useState(1);
    const [actionFilter, setActionFilter] = useState('');
    const [quickFilter, setQuickFilter] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [userFilter, setUserFilter] = useState('');
    const [expandedLog, setExpandedLog] = useState<number | null>(null);
    const [showFilters, setShowFilters] = useState(false);

    // L'action envoyée à l'API = quickFilter ou actionFilter standard
    const effectiveAction = quickFilter || actionFilter;

    const { data: logsData, isLoading: loading, isError: error } = useAuditLogs({
        page,
        action: effectiveAction.includes(',') ? '' : effectiveAction,
        user: userFilter,
        date_from: dateFrom,
        date_to: dateTo,
    });

    const { data: statistics } = useAuditStats({
        action: effectiveAction.includes(',') ? '' : effectiveAction,
        user: userFilter,
        date_from: dateFrom,
        date_to: dateTo,
    });

    const { data: users = [] } = useUsers();

    const logs = logsData?.results || [];
    const totalPages = Math.ceil((logsData?.count || 0) / 50);

    const filteredLogs = useMemo(() => {
        let result = logs;
        // Filtre multi-valeurs pour les quick filters avec virgules
        if (quickFilter && quickFilter.includes(',')) {
            const values = new Set(quickFilter.split(','));
            result = result.filter(log => values.has(log.action));
        }
        if (!searchQuery.trim()) return result;
        const q = searchQuery.toLowerCase();
        return result.filter(log =>
            log.description?.toLowerCase().includes(q) ||
            log.user_name?.toLowerCase().includes(q) ||
            log.model_name?.toLowerCase().includes(q)
        );
    }, [logs, searchQuery, quickFilter]);

    const groupedLogs = useMemo(() => groupByDay(filteredLogs), [filteredLogs]);

    const handleExportCSV = async () => {
        try {
            const params = new URLSearchParams();
            if (effectiveAction && !effectiveAction.includes(',')) params.append('action', effectiveAction);
            if (userFilter) params.append('user', userFilter);
            if (dateFrom) params.append('date_from', dateFrom);
            if (dateTo) params.append('date_to', dateTo);
            const endpoint = `audit-logs/export_csv/${params.toString() ? '?' + params.toString() : ''}`;
            const response = await api.get(endpoint, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch { alert(t('messages.export_error')); }
    };

    const handleResetFilters = () => {
        setActionFilter(''); setQuickFilter(''); setUserFilter('');
        setDateFrom(''); setDateTo(''); setSearchQuery(''); setPage(1);
    };

    const hasActiveFilters = !!(effectiveAction || userFilter || dateFrom || dateTo || searchQuery);

    return (
        <div className="p-3 sm:p-6 max-w-5xl mx-auto">

            {/* ── Header ──────────────────────────────────────────── */}
            <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-slate-800 text-white rounded-2xl">
                        <ClipboardList className="size-6" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 tracking-tight">{t('title')}</h2>
                        <p className="text-sm text-slate-400 font-medium">{t('subtitle')}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleExportCSV}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold hover:bg-emerald-100 transition-colors"
                    >
                        <Download className="size-3.5" /> Export CSV
                    </button>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${showFilters ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                    >
                        <Filter className="size-3.5" /> Filtres
                        {hasActiveFilters && <span className="size-1.5 rounded-full bg-orange-400 inline-block" />}
                    </button>
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200 mb-4 text-sm text-red-700 font-semibold">
                    <AlertTriangle className="size-4 shrink-0" /> {t('messages.load_error')}
                </div>
            )}

            {/* ── KPI Stats ────────────────────────────────────────── */}
            {statistics && (
                <div className="grid grid-cols-4 gap-3 mb-5">
                    {[
                        { label: 'Total logs', value: formatNumber(statistics.total_logs), color: 'text-slate-800', sub: 'depuis le début' },
                        { label: 'Dernières 24h', value: statistics.recent_activity.last_24h, color: 'text-indigo-700', sub: 'aujourd\'hui' },
                        { label: '7 derniers jours', value: statistics.recent_activity.last_7d, color: 'text-sky-700', sub: 'cette semaine' },
                        { label: '30 derniers jours', value: statistics.recent_activity.last_30d, color: 'text-emerald-700', sub: 'ce mois' },
                    ].map((kpi) => (
                        <div key={kpi.label} className="bg-white border border-slate-200 rounded-2xl p-4">
                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{kpi.label}</div>
                            <div className={`text-2xl font-black ${kpi.color}`}>{kpi.value}</div>
                            <div className="text-[10px] text-slate-300 font-medium mt-0.5">{kpi.sub}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Quick filters (pills) ────────────────────────────── */}
            <div className="flex flex-wrap gap-2 mb-4">
                {QUICK_FILTERS.map(qf => (
                    <button
                        key={qf.value}
                        onClick={() => { setQuickFilter(qf.value === quickFilter ? '' : qf.value); setActionFilter(''); setPage(1); }}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${qf.color} ${quickFilter === qf.value ? 'ring-2 ring-offset-1 ring-current opacity-100' : 'opacity-80 hover:opacity-100'}`}
                    >
                        {qf.label}
                    </button>
                ))}
                <div className="relative ml-auto">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Rechercher..."
                        className="pl-8 pr-3 py-1.5 rounded-full text-xs font-medium border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 w-48"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* ── Filtres avancés (dépliables) ─────────────────────── */}
            {showFilters && (
                <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-5 grid grid-cols-2 md:grid-cols-4 gap-4 animate-in slide-in-from-top-2 duration-200">
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">{t('filters.user_label')}</label>
                        <select className="w-full rounded-lg border border-base-300 bg-base-100 h-9 text-xs px-3 font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" value={userFilter} onChange={e => { setUserFilter(e.target.value); setPage(1); }}>
                            <option value="">{t('filters.all_users')}</option>
                            {users.flatMap(u => u.id ? [(
                                <option key={u.id} value={u.id?.toString()}>
                                    {u.first_name || u.last_name ? `${u.first_name} ${u.last_name}`.trim() : u.username}
                                </option>
                            )] : [])}
                        </select>
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">{t('filters.date_from')}</label>
                        <input type="datetime-local" className="w-full rounded-lg border border-base-300 bg-base-100 h-9 text-xs px-3 font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">{t('filters.date_to')}</label>
                        <input type="datetime-local" className="w-full rounded-lg border border-base-300 bg-base-100 h-9 text-xs px-3 font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} />
                    </div>
                    <div className="flex items-end">
                        <button onClick={handleResetFilters} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200 transition-colors w-full justify-center">
                            <RotateCcw className="size-3.5" /> Réinitialiser
                        </button>
                    </div>
                </div>
            )}

            {/* ── Compteur résultats ───────────────────────────────── */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Activity className="size-3.5 text-slate-400" />
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{t('view.flux')}</span>
                    <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{filteredLogs.length} {t('view.items')}</span>
                </div>
            </div>

            {/* ── Timeline ────────────────────────────────────────────── */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-24 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                    <Loader2 className="size-8 animate-spin text-indigo-500" />
                    <span className="mt-4 font-black uppercase text-xs text-slate-300 tracking-widest">{t('view.loading')}</span>
                </div>
            ) : filteredLogs.length === 0 ? (
                <div className="bg-white rounded-3xl border-2 border-dashed border-slate-200 py-24 text-center">
                    <ClipboardList className="size-12 text-slate-200 mx-auto mb-4" />
                    <p className="font-black text-lg text-slate-300 uppercase">{t('view.empty_title')}</p>
                    <p className="text-sm text-slate-300 mt-1">{t('view.empty_subtitle')}</p>
                </div>
            ) : (
                <div className="space-y-8">
                    {groupedLogs.map(({ label, dateKey, logs: dayLogs }) => (
                        <div key={dateKey}>
                            {/* Day header */}
                            <div className="flex items-center gap-3 mb-3">
                                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 text-white">
                                    <Calendar className="size-3" />
                                    <span className="text-[11px] font-black capitalize">{label}</span>
                                </div>
                                <div className="flex-1 h-px bg-slate-200" />
                                <span className="text-[10px] font-bold text-slate-300">{dayLogs.length} action{dayLogs.length > 1 ? 's' : ''}</span>
                            </div>

                            {/* Timeline entries */}
                            <div className="relative">
                                {/* Vertical line */}
                                <div className="absolute left-[27px] top-0 bottom-0 w-px bg-slate-200" />

                                <div className="space-y-2">
                                    {dayLogs.map(log => {
                                        const cfg = ACTION_CONFIG[log.action] ?? {
                                            Icon: Settings, bg: 'bg-slate-50', ring: 'ring-slate-200',
                                            iconColor: 'text-slate-500', label: log.action, severity: 'neutral'
                                        };
                                        const { Icon } = cfg;
                                        const chips = buildDetailChips(log);
                                        const isSudo = !!log.details?.sudo_validation;
                                        const isExpanded = expandedLog === log.id;

                                        return (
                                            <div key={log.id} className="relative flex gap-4 group">
                                                {/* Icon dot */}
                                                <div className={`relative z-10 shrink-0 size-[54px] rounded-2xl flex items-center justify-center ${cfg.bg} ring-1 ${cfg.ring} transition-transform group-hover:scale-105`}>
                                                    <Icon className={`size-5 ${cfg.iconColor}`} />
                                                </div>

                                                {/* Card */}
                                                <div className={`flex-1 bg-white border rounded-2xl overflow-hidden transition-all ${isSudo ? 'border-purple-200' : 'border-slate-200'} hover:border-indigo-200 hover:shadow-sm`}>
                                                    <div className="px-4 py-3 flex items-start justify-between gap-3">
                                                        <div className="flex-1 min-w-0">
                                                            {/* Action badge + heure */}
                                                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${SEVERITY_BADGE[cfg.severity]}`}>
                                                                    {cfg.label || log.action_display}
                                                                </span>
                                                                {isSudo && (
                                                                    <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 flex items-center gap-1">
                                                                        <Shield className="size-2.5" /> SUDO
                                                                    </span>
                                                                )}
                                                                <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                                                    <Clock className="size-2.5" />
                                                                    {format(parseISO(log.timestamp), 'HH:mm:ss')}
                                                                </span>
                                                            </div>

                                                            {/* Description principale */}
                                                            <p className="text-sm font-semibold text-slate-700 leading-snug mb-1.5">
                                                                {log.description || `${log.model_name} #${log.object_id}`}
                                                            </p>

                                                            {/* Chips de détails */}
                                                            {chips.length > 0 && (
                                                                <div className="flex flex-wrap gap-1.5 mb-1">
                                                                    {chips.map((chip, ci) => (
                                                                        <span key={ci} className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md ${chip.highlight ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-slate-100 text-slate-500'}`}>
                                                                            <span className="opacity-60">{chip.label}:</span> {chip.value}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}

                                                            {/* Auteur */}
                                                            <div className="flex items-center gap-1.5 mt-1">
                                                                <div className="size-4 rounded-full bg-slate-200 flex items-center justify-center text-[8px] font-black uppercase text-slate-600">
                                                                    {(log.user_name || 'S')[0]}
                                                                </div>
                                                                <span className="text-[10px] font-semibold text-slate-400">{log.user_name || t('view.system_user')}</span>
                                                                {log.ip_address && <span className="text-[9px] text-slate-300">· {log.ip_address}</span>}
                                                            </div>
                                                        </div>

                                                        {/* Toggle JSON */}
                                                        {log.details && Object.keys(log.details).length > 0 && (
                                                            <button
                                                                onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                                                                className={`shrink-0 p-1.5 rounded-lg transition-colors ${isExpanded ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-100 hover:text-slate-600'}`}
                                                                title="Voir les détails techniques"
                                                            >
                                                                {isExpanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                                                            </button>
                                                        )}
                                                    </div>

                                                    {/* JSON expandé — propre et lisible */}
                                                    {isExpanded && log.details && (
                                                        <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 animate-in slide-in-from-top-1 duration-150">
                                                            <div className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-2 flex items-center gap-1.5">
                                                                <BadgeAlert className="size-3" /> Données techniques · ID #{log.id}
                                                            </div>
                                                            <div className="flex flex-wrap gap-2">
                                                                {Object.entries(log.details).map(([key, val]) => (
                                                                    <div key={key} className="bg-white rounded-lg px-3 py-2 border border-slate-200 text-[10px]">
                                                                        <div className="text-slate-400 font-bold uppercase tracking-wider mb-0.5">{key}</div>
                                                                        <div className="font-black text-slate-700 max-w-[200px] truncate" title={String(val)}>
                                                                            {typeof val === 'object' ? JSON.stringify(val) : String(val ?? '—')}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Pagination ───────────────────────────────────────── */}
            {!loading && filteredLogs.length > 0 && totalPages > 1 && (
                <div className="flex justify-center items-center gap-3 mt-8">
                    <button
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                        disabled={page === 1}
                        onClick={() => setPage(page - 1)}
                    >
                        ← {t('common:pagination.prev')}
                    </button>
                    <span className="text-sm font-bold text-slate-500 px-3">
                        Page {page} / {totalPages}
                    </span>
                    <button
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                        disabled={page >= totalPages}
                        onClick={() => setPage(page + 1)}
                    >
                        {t('common:pagination.next')} →
                    </button>
                </div>
            )}
        </div>
    );
};

export default JournalAudit;
