import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { gooeyToast } from 'goey-toast';
import api from '../services/api';
import { isToday, isYesterday, parseISO } from 'date-fns';
import { getLocalDateString, formatTime, formatDateLong } from '../utils/dateUtils';
import { useAuditLogs, useAuditStats, useUsers } from '../hooks/useAudit';
import { formatNumber } from '../utils/formatters';
import type { AuditLog } from '../types/audit';
import { PageContainer } from './ui/PageContainer';
import { Button } from './shadcn/button';
import { Badge } from './shadcn/badge';
import { Select } from './shadcn/select';
import { Input } from './shadcn/input';
import { Card } from './shadcn/card';
import {
  ClipboardList, Search, Download, RotateCcw, ChevronDown, ChevronUp,
  TrendingUp, Shield, PackagePlus, PackageMinus, Loader2, XCircle, Trash2,
  CheckCircle2, Boxes, ArrowDownToLine, BadgeAlert, Edit, LogIn, FileOutput,
  Settings, AlertTriangle, Activity, Filter,
} from 'lucide-react';

interface LogDetails {
  old_price?: number; new_price?: number; produit_nom?: string;
  old_quantity?: number; new_quantity?: number; ecart?: number; reason?: string;
  sudo_validation?: boolean; sudo_user?: string; sudo_permission?: string;
  changes?: Record<string, { old?: string | number; new?: string | number }>;
  amount?: number; montant?: number; quantity?: number; total_ttc?: number;
  client_name?: string; [key: string]: unknown;
}

type Severity = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
type ActionConfig = { Icon: React.FC<{ className?: string }>; labelKey: string; severity: Severity };
const ACTION_CONFIG: Record<string, ActionConfig> = {
  CREATE: { Icon: PackagePlus, labelKey: 'actions.CREATE', severity: 'success' },
  INV_CRE: { Icon: Boxes, labelKey: 'actions.INV_CRE', severity: 'success' },
  ORD_RECV: { Icon: ArrowDownToLine, labelKey: 'actions.ORD_RECV', severity: 'info' },
  CLOTURE: { Icon: CheckCircle2, labelKey: 'actions.CLOTURE', severity: 'info' },
  UPDATE: { Icon: Edit, labelKey: 'actions.UPDATE', severity: 'warning' },
  STOCK_ADJ: { Icon: PackageMinus, labelKey: 'actions.STOCK_ADJ', severity: 'warning' },
  PRICE_CHG: { Icon: TrendingUp, labelKey: 'actions.PRICE_CHG', severity: 'warning' },
  INV_VALID: { Icon: CheckCircle2, labelKey: 'actions.INV_VALID', severity: 'purple' },
  INV_VAL: { Icon: Shield, labelKey: 'actions.INV_VAL', severity: 'purple' },
  SUDO_VAL: { Icon: Shield, labelKey: 'actions.SUDO_VAL', severity: 'purple' },
  DELETE: { Icon: Trash2, labelKey: 'actions.DELETE', severity: 'danger' },
  INV_CANCEL: { Icon: XCircle, labelKey: 'actions.INV_CANCEL', severity: 'danger' },
  INV_DEL: { Icon: Trash2, labelKey: 'actions.INV_DEL', severity: 'danger' },
  ORD_CNCL: { Icon: XCircle, labelKey: 'actions.ORD_CNCL', severity: 'danger' },
  LOGIN: { Icon: LogIn, labelKey: 'actions.LOGIN', severity: 'neutral' },
  EXPORT: { Icon: FileOutput, labelKey: 'actions.EXPORT', severity: 'neutral' },
};
const SEVERITY_BADGE: Record<Severity, string> = {
  success: 'bg-emerald-100 text-emerald-700', info: 'bg-sky-100 text-sky-700',
  warning: 'bg-amber-100 text-amber-700', danger: 'bg-red-100 text-red-700',
  purple: 'bg-purple-100 text-purple-700', neutral: 'bg-slate-100 text-slate-600',
};
const QUICK_FILTERS = [
  { value: '', key: 'quick.all' },
  { value: 'INV_CANCEL,INV_DEL,ORD_CNCL,DELETE', key: 'quick.cancellations' },
  { value: 'PRICE_CHG', key: 'quick.price' }, { value: 'STOCK_ADJ', key: 'quick.stock' },
  { value: 'SUDO_VAL,INV_VAL', key: 'quick.sudo' }, { value: 'CLOTURE', key: 'quick.closings' },
  { value: 'EXPORT', key: 'quick.exports' }, { value: 'LOGIN', key: 'quick.logins' },
];
const MODELS = ['Produit', 'Facture', 'Commande', 'Client', 'Fournisseur', 'User', 'AuditLog', 'Rapport'];

function buildDetailChips(log: AuditLog, t: TFunction) {
  const d = log.details as LogDetails | null;
  if (!d || !Object.keys(d).length) return [];
  const chips: { label: string; value: string; highlight?: boolean }[] = [];
  const add = (key: string, value: unknown, highlight = false) => chips.push({ label: t(`chips.${key}`), value: String(value ?? '—'), highlight });
  if (log.action === 'PRICE_CHG') {
    add('before', `${d.old_price ?? '—'} FCFA`); add('after', `${d.new_price ?? '—'} FCFA`, true);
    if (d.produit_nom) add('product', d.produit_nom);
  } else if (log.action === 'STOCK_ADJ') {
    add('before', d.old_quantity); add('after', d.new_quantity, true);
    if (d.ecart !== undefined) add('difference', `${d.ecart > 0 ? '+' : ''}${d.ecart}`, true);
    if (d.reason) add('reason', d.reason);
  } else if (d.sudo_validation) {
    add('validated_by', d.sudo_user, true); if (d.sudo_permission) add('permission', d.sudo_permission);
  } else if (d.changes && typeof d.changes === 'object') {
    Object.entries(d.changes).slice(0, 3).forEach(([key, val]) => chips.push({ label: key, value: `${val.old ?? '—'} → ${val.new ?? '—'}`, highlight: true }));
  } else {
    if (d.amount !== undefined) add('amount', `${Number(d.amount).toLocaleString()} FCFA`, true);
    if (d.montant !== undefined) add('amount', `${Number(d.montant).toLocaleString()} FCFA`, true);
    if (d.quantity !== undefined) add('quantity', d.quantity, true);
    if (d.total_ttc !== undefined) add('total', `${Number(d.total_ttc).toLocaleString()} FCFA`, true);
    if (d.client_name) add('client', d.client_name); if (d.produit_nom) add('product', d.produit_nom);
    if (d.reason) add('reason', d.reason);
  }
  return chips;
}

const JournalAudit: React.FC = () => {
  const { t } = useTranslation(['audit', 'common']);
  const [page, setPage] = useState(1); const [quickFilter, setQuickFilter] = useState('');
  const [search, setSearch] = useState(''); const [debouncedSearch, setDebouncedSearch] = useState('');
  const [dateFrom, setDateFrom] = useState(''); const [dateTo, setDateTo] = useState('');
  const [userFilter, setUserFilter] = useState(''); const [modelFilter, setModelFilter] = useState('');
  const [expandedLog, setExpandedLog] = useState<number | null>(null); const [showFilters, setShowFilters] = useState(false);
  useEffect(() => { const timer = window.setTimeout(() => { setDebouncedSearch(search.trim()); setPage(1); }, 400); return () => window.clearTimeout(timer); }, [search]);

  const filters = { action_in: quickFilter, user: userFilter, model_name: modelFilter, date_from: dateFrom, date_to: dateTo, q: debouncedSearch };
  const { data: logsData, isLoading: loading, isError: error } = useAuditLogs({ page, ...filters });
  const { data: statistics } = useAuditStats(filters); const { data: users = [] } = useUsers();
  const logs = useMemo(() => logsData?.results || [], [logsData]);
  const groups = useMemo(() => {
    const map = new Map<string, AuditLog[]>();
    logs.forEach(log => { const key = getLocalDateString(parseISO(log.timestamp)); map.set(key, [...(map.get(key) || []), log]); });
    return Array.from(map, ([dateKey, dayLogs]) => { const date = parseISO(dateKey); return { dateKey, dayLogs, label: isToday(date) ? t('dates.today') : isYesterday(date) ? t('dates.yesterday') : formatDateLong(date) }; });
  }, [logs, t]);
  const totalPages = Math.ceil((logsData?.count || 0) / 50);
  const hasActiveFilters = Boolean(quickFilter || userFilter || modelFilter || dateFrom || dateTo || search);

  const reset = () => { setQuickFilter(''); setUserFilter(''); setModelFilter(''); setDateFrom(''); setDateTo(''); setSearch(''); setDebouncedSearch(''); setPage(1); };
  const exportCSV = async () => {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
      const response = await api.get(`audit-logs/export_csv/${params.size ? `?${params}` : ''}`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([response.data])); const link = document.createElement('a');
      link.href = url; link.download = `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
    } catch { gooeyToast.error(t('messages.export_error')); }
  };

  return <PageContainer variant="dense" className="lg:px-10">
    <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
      <div className="flex items-center gap-3"><div className="p-2.5 bg-slate-800 text-white rounded-xl"><ClipboardList className="size-5" /></div><div><h2 className="text-2xl font-black text-slate-800">{t('title')}</h2><p className="text-sm text-slate-500">{t('subtitle')}</p></div></div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={exportCSV} className="border-emerald-200 text-emerald-700 hover:border-emerald-500 hover:text-emerald-700"><Download className="size-3.5" />{t('filters.export')}</Button>
        <Button variant="outline" size="sm" onClick={() => setShowFilters(v => !v)}><Filter className="size-3.5" />{t('filters.button')}{hasActiveFilters && <span className="size-1.5 rounded-full bg-orange-400" />}</Button>
      </div>
    </div>
    {error && <div className="flex gap-2 p-3 rounded-xl bg-red-50 border border-red-200 mb-4 text-sm text-red-700"><AlertTriangle className="size-4" />{t('messages.load_error')}</div>}
    {statistics && <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">{[
      ['stats.total', formatNumber(statistics.total_logs), 'stats.all_time'], ['stats.last_24h', statistics.recent_activity.last_24h, 'stats.today'],
      ['stats.last_7d', statistics.recent_activity.last_7d, 'stats.this_week'], ['stats.last_30d', statistics.recent_activity.last_30d, 'stats.this_month'],
    ].map(([label, value, sub]) => <Card key={label} className="p-3"><div className="text-caption lg:text-xs font-black uppercase text-slate-500">{t(String(label))}</div><div className="text-xl lg:text-2xl font-black text-slate-800">{value}</div><div className="text-caption lg:text-xs text-slate-500">{t(String(sub))}</div></Card>)}</div>}
    <div className="flex flex-wrap gap-1.5 mb-4">
      {QUICK_FILTERS.map(item => <Button key={item.key} size="sm" variant={quickFilter === item.value ? 'secondary' : 'outline'} onClick={() => { setQuickFilter(item.value); setPage(1); }} className={`rounded-full ${quickFilter === item.value ? 'bg-indigo-600 hover:bg-indigo-700 shadow-none' : ''}`}>{t(item.key)}</Button>)}
      <div className="relative sm:ml-auto flex-1 sm:flex-none min-w-48"><Search className="absolute left-2.5 top-2.5 size-3.5 text-slate-400 pointer-events-none" /><Input disableUppercase value={search} onChange={e => setSearch(e.target.value)} placeholder={t('filters.search_placeholder')} aria-label={t('filters.search_label')} className="w-full sm:w-56 h-8 pl-8 rounded-full text-xs" /></div>
    </div>
    {showFilters && <Card className="p-4 mb-4 grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
      <FilterSelect label={t('filters.user_label')} value={userFilter} onChange={setUserFilter}><option value="">{t('filters.all_users')}</option>{users.filter(u => u.id).map(u => <option key={u.id} value={String(u.id)}>{u.first_name || u.last_name ? `${u.first_name} ${u.last_name}`.trim() : u.username}</option>)}</FilterSelect>
      <FilterSelect label={t('filters.model_label')} value={modelFilter} onChange={setModelFilter}><option value="">{t('filters.all_models')}</option>{MODELS.map(model => <option key={model} value={model}>{t(`models.${model}`)}</option>)}</FilterSelect>
      <FilterInput label={t('filters.date_from')} value={dateFrom} onChange={setDateFrom} /><FilterInput label={t('filters.date_to')} value={dateTo} onChange={setDateTo} />
      <Button variant="outline" size="sm" onClick={reset} className="self-end"><RotateCcw className="size-3.5" />{t('filters.reset')}</Button>
    </Card>}
    <div className="flex gap-2 items-center mb-2 text-xs font-black text-slate-500 uppercase"><Activity className="size-3.5" />{t('view.flux')}<span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{logsData?.count || 0} {t('view.items')}</span></div>
    {loading ? <div className="py-20 flex justify-center"><Loader2 className="size-7 animate-spin text-indigo-500" /><span className="sr-only">{t('view.loading')}</span></div> : !logs.length ? <div className="py-16 text-center border-2 border-dashed rounded-2xl text-slate-500"><p className="font-bold">{t('view.empty_title')}</p><p className="text-sm">{t('view.empty_subtitle')}</p></div> : <div className="space-y-4">{groups.map(group => <section key={group.dateKey}><div className="flex items-center gap-2 mb-1 text-caption lg:text-xs font-bold uppercase text-slate-500"><span>{group.label}</span><span>· {t('view.action_count', { count: group.dayLogs.length })}</span><div className="h-px bg-slate-200 flex-1" /></div><div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">{group.dayLogs.map(log => <AuditRow key={log.id} log={log} expanded={expandedLog === log.id} onToggle={() => setExpandedLog(expandedLog === log.id ? null : log.id)} t={t} />)}</div></section>)}</div>}
    {!loading && totalPages > 1 && <div className="flex justify-center items-center gap-3 mt-6">
      <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>{t('common:pagination.prev')}</Button>
      <span className="text-xs text-slate-500">{t('view.page', { page, total: totalPages })}</span>
      <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>{t('common:pagination.next')}</Button>
    </div>}
  </PageContainer>;
};

function FilterSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) { return <label className="text-caption font-black uppercase text-slate-500">{label}<Select value={value} onChange={e => onChange(e.target.value)} className="mt-1 h-9 text-xs">{children}</Select></label>; }
function FilterInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) { return <label className="text-caption font-black uppercase text-slate-500">{label}<Input type="datetime-local" value={value} onChange={e => onChange(e.target.value)} className="mt-1 h-9 text-xs" /></label>; }
function AuditRow({ log, expanded, onToggle, t }: { log: AuditLog; expanded: boolean; onToggle: () => void; t: TFunction }) {
  const cfg = ACTION_CONFIG[log.action] || { Icon: Settings, labelKey: '', severity: 'neutral' as Severity }; const chips = buildDetailChips(log, t); const isSudo = Boolean(log.details?.sudo_validation); const hasDetails = Boolean(log.details && Object.keys(log.details).length);
  return <div className="bg-white"><div className="min-h-11 px-2 sm:px-3 py-2 flex flex-wrap sm:flex-nowrap items-center gap-2"><span className="w-11 lg:w-14 shrink-0 text-caption lg:text-xs font-bold text-slate-500">{formatTime(log.timestamp)}</span><cfg.Icon className="size-3.5 lg:size-4 shrink-0 text-slate-500" /><Badge variant="outline" className={`shrink-0 text-micro lg:text-label font-black border-transparent ${SEVERITY_BADGE[cfg.severity]}`}>{cfg.labelKey ? t(cfg.labelKey) : (log.action_display || log.action)}</Badge>{isSudo && <Badge variant="outline" className="text-micro lg:text-label font-black text-purple-700 border-transparent bg-purple-50"><Shield className="inline size-3" /> {t('view.sudo_badge')}</Badge>}<p className="basis-[calc(100%-5rem)] sm:basis-auto sm:flex-1 min-w-0 text-xs lg:text-sm font-semibold text-slate-700 sm:truncate">{log.description || `${log.model_name} #${log.object_id}`}</p><div className="flex flex-wrap gap-1 basis-full sm:basis-auto">{chips.slice(0, 3).map((chip, i) => <Badge key={i} variant="outline" className={`text-micro lg:text-label border-transparent font-medium ${chip.highlight ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}><span className="opacity-60">{chip.label}:</span>&nbsp;{chip.value}</Badge>)}</div><div className="ml-auto flex items-center gap-1 lg:gap-1.5 shrink-0"><span className="size-5 lg:size-6 rounded-full bg-slate-200 text-micro lg:text-caption font-black grid place-items-center">{(log.user_name || t('view.system_user'))[0]}</span><span className="max-w-20 lg:max-w-32 truncate text-caption lg:text-xs text-slate-500">{log.user_name || t('view.system_user')}</span>{hasDetails && <Button variant="ghost" size="icon" onClick={onToggle} title={t('view_technical_details')} aria-label={t('view_technical_details')} className="size-7 text-slate-400">{expanded ? <ChevronUp className="size-3.5 lg:size-4" /> : <ChevronDown className="size-3.5 lg:size-4" />}</Button>}</div></div>{expanded && log.details && <div className="border-t bg-slate-50 p-3"><div className="text-micro lg:text-label font-black uppercase text-slate-500 mb-2"><BadgeAlert className="inline size-3" /> {t('view.technical_data', { id: log.id })}</div><pre className="text-caption lg:text-xs text-slate-700 whitespace-pre-wrap break-all">{JSON.stringify(log.details, null, 2)}</pre></div>}</div>;
}
export default JournalAudit;
