import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useTranslation } from 'react-i18next';
import { gooeyToast } from 'goey-toast';
import { formatDateTime } from '../utils/dateUtils';
import {
    Search, RefreshCcw, CheckCircle2, XCircle, Clock, FileText, User, Hash,
    Loader2, Download, Send, AlertTriangle, Paperclip,
} from 'lucide-react';
import { Button } from './shadcn/button';
import { Badge } from './shadcn/badge';
import { Select } from './shadcn/select';
import { Input } from './shadcn/input';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from './shadcn/table';
import { PageContainer } from './ui/PageContainer';
import { logger } from '../utils/logger'

interface TelegramLog {
    id: number;
    recipient_chat_id: string;
    recipient_name: string;
    message: string;
    type: string;
    type_display: string;
    status: string;
    status_display: string;
    has_attachment: boolean;
    attachment_path: string | null;
    created_at: string;
    sent_at: string | null;
    sent_by_name: string;
    facture_numero: string | null;
}

const PAGE_SIZE = 20;
const TYPES = ['RAPPORT', 'FACTURE', 'PROMIS', 'RAPPEL', 'MANUEL'];
const STATUSES = ['PENDING', 'SENT', 'DELIVERED', 'FAILED'];

const STATUS_STYLE: Record<string, { icon: React.ReactNode; classes: string }> = {
    SENT: { icon: <CheckCircle2 className="size-3" />, classes: 'bg-emerald-100 text-emerald-700 border-transparent' },
    DELIVERED: { icon: <CheckCircle2 className="size-3" />, classes: 'bg-sky-100 text-sky-700 border-transparent' },
    FAILED: { icon: <XCircle className="size-3" />, classes: 'bg-red-100 text-red-700 border-transparent' },
    PENDING: { icon: <Clock className="size-3" />, classes: 'bg-amber-100 text-amber-700 border-transparent' },
};

const TelegramHistory: React.FC = () => {
    const { t } = useTranslation(['telegram', 'common']);
    const [logs, setLogs] = useState<TelegramLog[]>([]);
    const [count, setCount] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [filterType, setFilterType] = useState('');
    const [filterStatus, setFilterStatus] = useState('');

    useEffect(() => {
        const timer = window.setTimeout(() => { setDebouncedSearch(searchTerm.trim()); setPage(1); }, 400);
        return () => window.clearTimeout(timer);
    }, [searchTerm]);

    const fetchLogs = async () => {
        setLoading(true);
        setError(false);
        try {
            const params: Record<string, string | number> = { page, page_size: PAGE_SIZE };
            if (filterType) params.type = filterType;
            if (filterStatus) params.status = filterStatus;
            if (debouncedSearch) params.search = debouncedSearch;

            const response = await api.get('telegram-logs/', { params });
            setLogs(Array.isArray(response.data) ? response.data : response.data.results || []);
            setCount(response.data?.count ?? 0);
        } catch (err) {
            logger.error('Erreur lors du chargement de l\'historique Telegram:', err);
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filterType, filterStatus, debouncedSearch, page]);

    const exportCSV = async () => {
        try {
            const params = new URLSearchParams();
            if (filterType) params.set('type', filterType);
            if (filterStatus) params.set('status', filterStatus);
            if (debouncedSearch) params.set('search', debouncedSearch);
            const response = await api.get(`telegram-logs/export_csv/${params.size ? `?${params}` : ''}`, { responseType: 'blob' });
            const url = URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.download = `telegram_logs_${new Date().toISOString().slice(0, 10)}.csv`;
            link.click();
            URL.revokeObjectURL(url);
        } catch {
            gooeyToast.error(t('messages.export_error'));
        }
    };

    const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

    return (
        <PageContainer variant="dense" className="lg:px-10">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-sky-600 text-white rounded-xl"><Send className="size-5" /></div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-800">{t('title')}</h2>
                        <p className="text-sm text-slate-500">{t('subtitle')}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={exportCSV} className="border-emerald-200 text-emerald-700 hover:border-emerald-500 hover:text-emerald-700">
                        <Download className="size-3.5" />{t('export_csv')}
                    </Button>
                    <Button onClick={fetchLogs} variant="outline" size="sm" className="gap-2" disabled={loading}>
                        <RefreshCcw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
                        {t('refresh')}
                    </Button>
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 mb-4 text-sm text-red-700">
                    <AlertTriangle className="size-4" />
                    {t('view.load_error')}
                    <Button variant="outline" size="sm" onClick={fetchLogs} className="ml-auto">{t('view.retry')}</Button>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                <div className="relative sm:col-span-2">
                    <Search className="absolute left-2.5 top-2.5 size-3.5 text-slate-400 pointer-events-none" />
                    <Input
                        disableUppercase
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder={t('filters.search_placeholder')}
                        aria-label={t('filters.search_label')}
                        className="w-full h-9 pl-8 text-xs"
                    />
                </div>
                <label className="text-caption font-black uppercase text-slate-500">
                    {t('filters.type_label')}
                    <Select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }} className="mt-1 h-9 text-xs">
                        <option value="">{t('filters.all_types')}</option>
                        {TYPES.map(type => <option key={type} value={type}>{t(`types.${type}`)}</option>)}
                    </Select>
                </label>
                <label className="text-caption font-black uppercase text-slate-500">
                    {t('filters.status_label')}
                    <Select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }} className="mt-1 h-9 text-xs">
                        <option value="">{t('filters.all_status')}</option>
                        {STATUSES.map(status => <option key={status} value={status}>{t(`statuses.${status}`)}</option>)}
                    </Select>
                </label>
            </div>

            <div className="flex gap-2 items-center mb-2 text-xs font-black text-slate-500 uppercase">
                <Send className="size-3.5" />
                <span className="text-sky-600 bg-sky-50 px-2 py-0.5 rounded-full">{count} {t('view.items')}</span>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{t('table.date_sender')}</TableHead>
                            <TableHead>{t('table.recipient')}</TableHead>
                            <TableHead>{t('table.message')}</TableHead>
                            <TableHead>{t('table.type')}</TableHead>
                            <TableHead>{t('table.status')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-10">
                                    <Loader2 className="size-8 animate-spin text-sky-500 mx-auto" />
                                </TableCell>
                            </TableRow>
                        ) : logs.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-12">
                                    <p className="font-bold text-slate-500">{t('view.empty_title')}</p>
                                    <p className="text-sm text-slate-400">{t('view.empty_subtitle')}</p>
                                </TableCell>
                            </TableRow>
                        ) : logs.map(log => {
                            const statusCfg = STATUS_STYLE[log.status] || STATUS_STYLE.PENDING;
                            return (
                                <TableRow key={log.id}>
                                    <TableCell>
                                        <div className="flex flex-col gap-1">
                                            <span className="font-bold text-sm">{formatDateTime(log.created_at)}</span>
                                            <span className="text-xs flex items-center gap-1 text-slate-500">
                                                <User className="size-3" /> {log.sent_by_name || t('view.system_user')}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-1">
                                            <span className="font-bold text-sm">{log.recipient_name || t('view.unknown_recipient')}</span>
                                            <span className="text-xs flex items-center gap-1 font-mono text-slate-500">
                                                <Hash className="size-3 text-sky-500" /> {log.recipient_chat_id}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="max-w-md">
                                            <p className="text-sm line-clamp-2" title={log.message}>{log.message}</p>
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {log.facture_numero && (
                                                    <Badge variant="outline" className="gap-1 font-mono whitespace-nowrap border-transparent bg-slate-100 text-slate-600">
                                                        <FileText className="size-3" /> {log.facture_numero}
                                                    </Badge>
                                                )}
                                                {log.has_attachment && (
                                                    <Badge variant="outline" className="gap-1 whitespace-nowrap border-transparent bg-sky-50 text-sky-600" title={log.attachment_path || ''}>
                                                        <Paperclip className="size-3" /> {t('view.attachment')}
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="font-semibold border-transparent bg-slate-100 text-slate-600">{log.type_display}</Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={`gap-1 font-bold ${statusCfg.classes}`}>
                                            {statusCfg.icon}
                                            {log.status_display}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>

            {!loading && totalPages > 1 && (
                <div className="flex justify-center items-center gap-3 mt-6">
                    <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>{t('common:pagination.prev')}</Button>
                    <span className="text-xs text-slate-500">{t('view.page', { page, total: totalPages })}</span>
                    <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>{t('common:pagination.next')}</Button>
                </div>
            )}
        </PageContainer>
    );
};

export default TelegramHistory;
