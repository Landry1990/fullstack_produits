import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { useDebounce } from 'use-debounce';
import { Award, ChevronLeft, ChevronRight, Loader2, Settings, FileText, Search, X, User as UserIcon } from 'lucide-react';
import { Button } from '../shadcn/button';
import { Badge } from '../shadcn/badge';
import { Select } from '../shadcn/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../shadcn/table';
import { cn } from '../../lib/utils';
import LoyaltyConfigModal from '../LoyaltyConfigModal';
import {
    useLoyaltyHistory,
    useLoyaltySettings,
    useLoyaltyClients,
} from '../../hooks/useLoyalty';
import type { LoyaltyHistoryEntry, LoyaltySettings } from '../../types';

const PAGE_SIZE = 25;

const TYPE_BADGE_CONFIG: Record<LoyaltyHistoryEntry['type_transaction'], { className: string; dot: string }> = {
    GAIN: { className: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
    UTILISATION: { className: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
    REMISE_AUTO: { className: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-500' },
    AJUSTEMENT: { className: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
};

const TRANSACTION_TYPES: LoyaltyHistoryEntry['type_transaction'][] = [
    'GAIN',
    'UTILISATION',
    'REMISE_AUTO',
    'AJUSTEMENT',
];

interface StatCardProps {
    label: string;
    value: string;
    hint: string;
    icon: React.ReactNode;
    accent: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, hint, icon, accent }) => (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex items-start gap-3">
        <div className={cn('p-2.5 rounded-lg', accent)}>{icon}</div>
        <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
            <p className="text-lg font-bold text-slate-800 truncate">{value}</p>
            <p className="text-xs text-slate-400 mt-0.5 truncate">{hint}</p>
        </div>
    </div>
);

const LoyaltyPage: React.FC = () => {
    const { t } = useTranslation(['loyalty', 'common']);
    const locale = t('common:locale', { defaultValue: 'fr-FR' });
    const location = useLocation();

    const [configOpen, setConfigOpen] = useState(false);
    const [clientFilter, setClientFilter] = useState<string>('');
    const [clientSearchQuery, setClientSearchQuery] = useState('');
    const [clientSelectedName, setClientSelectedName] = useState('');
    const [showClientDropdown, setShowClientDropdown] = useState(false);
    const clientDropdownRef = useRef<HTMLDivElement>(null);
    const [typeFilter, setTypeFilter] = useState<string>('');

    const [page, setPage] = useState(1);

    // Pre-select client from navigation state (e.g., from Clients.tsx "View history")
    useEffect(() => {
        const state = location.state as { selectedClientId?: number; selectedClientName?: string } | null;
        if (state?.selectedClientId) {
            setClientFilter(String(state.selectedClientId));
            if (state.selectedClientName) {
                setClientSelectedName(state.selectedClientName);
            }
        }
    }, [location.state]);

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (clientDropdownRef.current && !clientDropdownRef.current.contains(e.target as Node)) {
                setShowClientDropdown(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const queryParams = useMemo(() => {
        const params: { client?: number; type_transaction?: string; page?: number; page_size?: number } = {
            page,
            page_size: PAGE_SIZE,
        };
        if (clientFilter) params.client = Number(clientFilter);
        if (typeFilter) params.type_transaction = typeFilter;
        return params;
    }, [clientFilter, typeFilter, page]);

    const { data: historyData, isLoading } = useLoyaltyHistory(queryParams);
    const { data: settings } = useLoyaltySettings();
    const [debouncedClientSearch] = useDebounce(clientSearchQuery, 300);
    const { data: clients } = useLoyaltyClients(debouncedClientSearch);

    const allClients = (clients as { id: number; name: string; phone?: string }[] | undefined) ?? [];

    const entries: LoyaltyHistoryEntry[] = historyData?.results ?? historyData ?? [];
    const total: number = historyData?.count ?? entries.length ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const start = (page - 1) * PAGE_SIZE + 1;
    const end = Math.min(page * PAGE_SIZE, total);

    const formatCurrency = (value: string | number) => {
        const num = typeof value === 'string' ? parseFloat(value) : value;
        const safeNum = isNaN(num) ? 0 : num;
        try {
            return new Intl.NumberFormat(locale, {
                style: 'decimal',
                minimumFractionDigits: 0,
            }).format(safeNum) + ' FCFA';
        } catch {
            return `${safeNum.toLocaleString(locale)} FCFA`;
        }
    };

    const formatDate = (date: string) => {
        if (!date) return '—';
        try {
            return new Date(date).toLocaleDateString(locale);
        } catch {
            return date;
        }
    };

    const handleClientSelect = (clientId: number, clientName: string) => {
        setClientFilter(String(clientId));
        setClientSelectedName(clientName);
        setClientSearchQuery('');
        setShowClientDropdown(false);
        setPage(1);
    };

    const handleClientClear = () => {
        setClientFilter('');
        setClientSelectedName('');
        setClientSearchQuery('');
        setPage(1);
    };

    const handleTypeChange = (value: string) => {
        setTypeFilter(value);
        setPage(1);
    };

    const getTypeBadge = (type: LoyaltyHistoryEntry['type_transaction']) => {
        const config = TYPE_BADGE_CONFIG[type] || TYPE_BADGE_CONFIG.AJUSTEMENT;
        return (
            <Badge className={cn('border shadow-none font-medium gap-1.5', config.className)}>
                <span className={cn('size-1.5 rounded-full', config.dot)} />
                {t(`loyalty:types.${type}`)}
            </Badge>
        );
    };

    const settingsTyped = settings as LoyaltySettings | undefined;

    return (
        <div className="p-6 w-full h-full flex flex-col gap-4">
            {/* ── Header ── */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 w-full">
                <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
                    <div className="flex items-start gap-3">
                        <div className="p-2.5 bg-purple-100 rounded-lg text-purple-600">
                            <Award className="size-5" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-800">{t('loyalty:title')}</h1>
                            <p className="text-sm text-slate-500">{t('loyalty:subtitle')}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => setConfigOpen(true)}
                        >
                            <Settings className="size-4" />
                            {t('loyalty:config')}
                        </Button>
                    </div>
                </div>
            </div>

            {/* ── Stats ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    label={t('loyalty:stats.amount_per_point')}
                    value={settingsTyped ? formatCurrency(settingsTyped.amount_per_point) : '—'}
                    hint={t('loyalty:stats.amount_per_point_hint')}
                    icon={<Award className="size-5 text-emerald-600" />}
                    accent="bg-emerald-100"
                />
                <StatCard
                    label={t('loyalty:stats.point_value')}
                    value={settingsTyped ? formatCurrency(settingsTyped.point_value) : '—'}
                    hint={t('loyalty:stats.point_value_hint')}
                    icon={<Award className="size-5 text-blue-600" />}
                    accent="bg-blue-100"
                />
                <StatCard
                    label={t('loyalty:stats.auto_reward_threshold')}
                    value={settingsTyped ? String(settingsTyped.auto_reward_threshold) : '—'}
                    hint={t('loyalty:stats.auto_reward_threshold_hint')}
                    icon={<Award className="size-5 text-purple-600" />}
                    accent="bg-purple-100"
                />
                <StatCard
                    label={t('loyalty:stats.auto_reward_percent')}
                    value={settingsTyped ? `${settingsTyped.auto_reward_percent} %` : '—'}
                    hint={t('loyalty:stats.auto_reward_percent_hint')}
                    icon={<Award className="size-5 text-amber-600" />}
                    accent="bg-amber-100"
                />
            </div>

            {/* ── Filters ── */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 w-full">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <div className="flex flex-col gap-1 flex-1 min-w-0" ref={clientDropdownRef}>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            {t('loyalty:filters.client')}
                        </label>
                        <div className="relative group">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-600 transition-colors">
                                <Search className="size-4" />
                            </div>
                            <input
                                type="text"
                                value={clientSearchQuery || clientSelectedName}
                                onChange={e => {
                                    setClientSearchQuery(e.target.value);
                                    setClientSelectedName('');
                                    setClientFilter('');
                                    setShowClientDropdown(true);
                                    setPage(1);
                                }}
                                onFocus={() => setShowClientDropdown(true)}
                                placeholder={t('loyalty:filters.client_placeholder')}
                                className="w-full sm:w-64 pl-10 pr-8 rounded-lg border border-slate-200 bg-slate-50/50 font-bold h-10 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                            />
                            {(clientFilter || clientSelectedName || clientSearchQuery) && (
                                <button
                                    type="button"
                                    onClick={handleClientClear}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    <X className="size-4" />
                                </button>
                            )}
                            {showClientDropdown && allClients.length > 0 && (
                                <ul className="absolute z-50 w-full bg-white shadow-xl rounded-2xl mt-2 max-h-60 overflow-auto border border-slate-200 py-2 animate-in fade-in zoom-in duration-200">
                                    {allClients.map(c => (
                                        <li key={c.id}>
                                            <button
                                                type="button"
                                                className="w-full text-left px-4 py-3 hover:bg-slate-100 transition-colors flex items-center gap-3"
                                                onClick={() => handleClientSelect(c.id, c.name)}
                                            >
                                                <div className="size-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                                                    <UserIcon className="size-4" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-bold text-sm truncate">{c.name}</div>
                                                    {c.phone && <div className="text-[10px] text-slate-400 font-bold">{c.phone}</div>}
                                                </div>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-col gap-1 flex-1 min-w-0">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            {t('loyalty:filters.type')}
                        </label>
                        <Select
                            value={typeFilter}
                            onChange={(e) => handleTypeChange(e.target.value)}
                            className="w-full sm:w-48 text-sm"
                        >
                            <option value="">{t('loyalty:filters.type_placeholder')}</option>
                            {TRANSACTION_TYPES.map((tp) => (
                                <option key={tp} value={tp}>{t(`loyalty:types.${tp}`)}</option>
                            ))}
                        </Select>
                    </div>
                </div>
            </div>

            {/* ── Table ── */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col w-full flex-1 min-h-0">
                <div className="overflow-x-auto w-full">
                    <Table className="w-full min-w-[1100px]">
                        <TableHeader>
                            <TableRow className="bg-slate-50 hover:bg-slate-50">
                                <TableHead className="w-[10%] px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('loyalty:table.date')}</TableHead>
                                <TableHead className="w-[15%] px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('loyalty:table.client')}</TableHead>
                                <TableHead className="w-[10%] px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('loyalty:table.type')}</TableHead>
                                <TableHead className="w-[8%] px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('loyalty:table.points')}</TableHead>
                                <TableHead className="w-[8%] px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('loyalty:table.balance_after')}</TableHead>
                                <TableHead className="w-[12%] px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('loyalty:table.amount')}</TableHead>
                                <TableHead className="w-[10%] px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('loyalty:table.invoice')}</TableHead>
                                <TableHead className="w-[15%] px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('loyalty:table.notes')}</TableHead>
                                <TableHead className="w-[12%] px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('loyalty:table.operator')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="h-64 text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center gap-3">
                                            <Loader2 className="size-8 animate-spin text-emerald-600" />
                                            <span className="text-sm">{t('loyalty:loading')}</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : entries.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="h-64 text-center">
                                        <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
                                            <div className="p-3 bg-slate-50 rounded-full">
                                                <FileText className="size-8 text-slate-300" />
                                            </div>
                                            <p className="text-sm font-medium">{t('loyalty:empty')}</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                entries.map((entry) => (
                                    <TableRow key={entry.id} className="hover:bg-slate-50/70 transition-colors border-b border-slate-100 last:border-0">
                                        <TableCell className="px-4 py-3 text-sm text-slate-600">
                                            {formatDate(entry.created_at)}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-sm text-slate-700">
                                            {entry.client_name || t('loyalty:no_client')}
                                        </TableCell>
                                        <TableCell className="px-4 py-3">
                                            {getTypeBadge(entry.type_transaction)}
                                        </TableCell>
                                        <TableCell className={cn('px-4 py-3 text-right text-sm font-semibold', entry.points >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                                            {entry.points > 0 ? '+' : ''}{entry.points}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-right text-sm font-medium text-slate-700">
                                            {entry.solde_apres}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-right text-sm text-slate-600">
                                            {entry.montant && Number(entry.montant) !== 0 ? formatCurrency(entry.montant) : '—'}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-sm text-slate-600">
                                            {entry.facture_numero ? (
                                                <span className="font-mono text-xs">{entry.facture_numero}</span>
                                            ) : (
                                                '—'
                                            )}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-sm text-slate-600 max-w-[200px] truncate" title={entry.notes || ''}>
                                            {entry.notes || '—'}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-sm text-slate-600">
                                            {entry.created_by_name || '—'}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* ── Pagination ── */}
                <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <span className="text-sm text-slate-500">
                        {t('common:pagination.showing', { defaultValue: '{{start}}–{{end}} sur {{total}}', start, end, total })}
                    </span>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(page - 1)}
                            disabled={page <= 1 || isLoading}
                            className="gap-1"
                        >
                            <ChevronLeft className="size-4" />
                            {t('common:pagination.prev', { defaultValue: 'Précédent' })}
                        </Button>
                        <span className="text-sm font-medium text-slate-700 px-2">
                            {t('common:pagination.page', { defaultValue: 'Page {{page}}/{{total}}', page, total: totalPages })}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(page + 1)}
                            disabled={page >= totalPages || isLoading}
                            className="gap-1"
                        >
                            {t('common:pagination.next', { defaultValue: 'Suivant' })}
                            <ChevronRight className="size-4" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* ── Config Modal ── */}
            <LoyaltyConfigModal isOpen={configOpen} onClose={() => setConfigOpen(false)} />
        </div>
    );
};

export default LoyaltyPage;
