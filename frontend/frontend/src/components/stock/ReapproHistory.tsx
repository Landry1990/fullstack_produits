import { useState, useEffect, useMemo, useCallback } from 'react';
import { gooeyToast } from 'goey-toast';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  History,
  ChevronLeft,
  Download,
  Calendar,
  User,
  Search,
  Eye,
  Package,
  Loader2,
} from 'lucide-react';
import produitService from '../../services/produitService';
import { formatDate } from '../../utils/dateUtils';
import { generateReapproSessionPdfDraft } from '../../utils/print/reapproSessionPdfDraft';
import { usePharmacySettings } from '../../hooks/usePharmacySettings';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { Skeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../shadcn/table';
import { logger } from '../../utils/logger'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/Dialog';

interface ReapproAdjustment {
  id: number;
  produit_name: string;
  lot_num: string | null;
  expiry: string | null;
  quantity_change: number;
}

interface ReapproSession {
  id: number;
  created_at: string;
  user_name: string | null;
  total_products: number;
  total_units: number;
  adjustments: ReapproAdjustment[];
}

export default function ReapproHistory() {
  const { t } = useTranslation(['stock', 'common']);
  const { settings } = usePharmacySettings();
  const [history, setHistory] = useState<ReapproSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSession, setSelectedSession] = useState<ReapproSession | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const data: unknown = await produitService.getReapproHistory();
      const results = Array.isArray(data) ? data : ((data as { results?: unknown[] })?.results ?? []);
      setHistory(results as ReapproSession[]);
    } catch (error) {
      logger.error('Error fetching history:', error);
      gooeyToast.error(t('stock:reappro.messages.history_load_error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleDownloadPdf = async (session: ReapproSession) => {
    setDownloadingId(session.id);
    try {
      generateReapproSessionPdfDraft(session, settings).save(
        `reappro_session_${session.id}_${new Date(session.created_at).toISOString().slice(0, 10).replace(/-/g, '')}.pdf`
      );
      gooeyToast.success(t('stock:reappro.messages.pdf_generated'));
    } catch (error) {
      logger.error('Error generating PDF:', error);
      gooeyToast.error(t('stock:reappro.messages.pdf_generation_error'));
    } finally {
      setDownloadingId(null);
    }
  };

  const filteredHistory = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return history;
    return history.filter(
      (h) =>
        h.id.toString().includes(query) ||
        (h.user_name && h.user_name.toLowerCase().includes(query))
    );
  }, [history, searchQuery]);

  return (
    <div className="h-full flex flex-col bg-slate-50 p-4 sm:p-6 gap-4 sm:gap-6 font-sans">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Link to="/app/reappro-rayon">
            <Button variant="outline" size="sm" className="rounded-full w-10 h-10 p-0" aria-label={t('common:back', { defaultValue: 'Retour' })}>
              <ChevronLeft className="size-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-slate-900 text-white rounded-xl shadow-sm">
              <History className="size-6" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
                {t('stock:reappro_history.title')}
              </h1>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-0.5">
                {t('stock:reappro_history.subtitle')}
              </p>
            </div>
          </div>
        </div>

        <div className="w-full max-w-md">
          <Input
            type="text"
            placeholder={t('stock:reappro.search_placeholder')}
            aria-label={t('stock:reappro.search_placeholder')}
            icon={<Search className="size-4" />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Main Content */}
      <Card variant="default" padding="none" className="rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-28 px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500">{t('stock:reappro_history.col_session')}</TableHead>
                <TableHead className="w-36 px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500">{t('stock:reappro_history.col_date')}</TableHead>
                <TableHead className="w-32 px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500">{t('stock:reappro_history.col_user')}</TableHead>
                <TableHead className="px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500 text-center">{t('common:products')}</TableHead>
                <TableHead className="w-20 px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500 text-center">{t('stock:reappro_history.col_units')}</TableHead>
                <TableHead className="w-24 px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500 text-right">{t('common:actions_title')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell className="px-3 py-2"><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell className="px-3 py-2"><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell className="px-3 py-2"><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell className="px-3 py-2 text-center"><Skeleton className="h-4 w-8 mx-auto" /></TableCell>
                    <TableCell className="px-3 py-2 text-center"><Skeleton className="h-4 w-8 mx-auto" /></TableCell>
                    <TableCell className="px-3 py-2 text-right"><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : filteredHistory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="px-3 py-16 text-center">
                    <EmptyState
                      compact
                      icon={<History className="size-6" />}
                      title={t('stock:reappro_history.no_history')}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filteredHistory.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell className="px-3 py-2">
                      <Badge variant="outline" size="sm">
                        #{session.id}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-3 py-2">
                      <div className="flex items-center gap-2 text-slate-700">
                        <Calendar className="size-3.5 text-slate-400" />
                        <span className="text-sm font-medium">
                          {new Date(session.created_at).toLocaleString()}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="size-6 bg-slate-100 rounded-full flex items-center justify-center">
                          <User className="size-3 text-slate-500" />
                        </div>
                        <span className="text-sm font-medium text-slate-700">
                          {session.user_name || t('stock:reappro_history.unknown_user')}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-2 text-center">
                      <span className="text-sm font-medium text-slate-700">
                        {session.total_products}
                      </span>
                    </TableCell>
                    <TableCell className="px-3 py-2 text-center">
                      <Badge variant="success" size="sm">
                        {session.total_units}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          leftIcon={<Eye className="size-3.5" />}
                          onClick={() => setSelectedSession(session)}
                        >
                          {t('common:view')}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          leftIcon={
                            downloadingId === session.id ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Download className="size-3.5" />
                            )
                          }
                          onClick={() => handleDownloadPdf(session)}
                          disabled={downloadingId === session.id}
                        >
                          PDF
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedSession} onOpenChange={(open) => !open && setSelectedSession(null)}>
        <DialogContent className="max-w-2xl rounded-2xl p-0 overflow-hidden">
          <div className="px-6 pt-6 pb-4 border-b border-slate-100">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-slate-100 text-slate-700 rounded-lg">
                  <Package className="size-5" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-semibold text-slate-900">
                    {t('stock:reappro_history.details_title', { id: selectedSession?.id })}
                  </DialogTitle>
                  <DialogDescription className="text-sm text-slate-500">
                    {t('stock:reappro_history.details_desc')}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card variant="bordered" padding="md" className="rounded-xl">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                  {t('stock:reappro_history.summary')}
                </p>
                <p className="text-sm font-semibold text-slate-800">
                  {t('stock:reappro_history.products_transferred', { count: selectedSession?.total_products ?? 0 })}
                  <br />
                  {t('stock:reappro_history.units_total', { count: selectedSession?.total_units ?? 0 })}
                </p>
              </Card>
              <Card variant="bordered" padding="md" className="rounded-xl">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                  {t('stock:reappro_history.performed_on')}
                </p>
                <p className="text-sm font-semibold text-slate-800">
                  {selectedSession && new Date(selectedSession.created_at).toLocaleString()}
                </p>
              </Card>
            </div>

            <Card variant="bordered" padding="none" className="rounded-xl overflow-hidden">
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500">{t('common:product')}</TableHead>
                    <TableHead className="px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500">{t('stock:reappro_history.col_lot_exp')}</TableHead>
                    <TableHead className="px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500 text-center">{t('stock:reappro_history.col_qty')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedSession?.adjustments?.map((adj) => (
                    <TableRow key={adj.id}>
                      <TableCell className="px-3 py-2 text-sm font-medium text-slate-700">
                        {adj.produit_name}
                      </TableCell>
                      <TableCell className="px-3 py-2">
                        <div className="flex flex-col text-xs">
                          <span className="font-medium text-slate-600">{adj.lot_num}</span>
                          <span className="text-slate-400">
                            {formatDate(adj.expiry) !== '-' ? formatDate(adj.expiry) : 'N/A'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="px-3 py-2 text-center">
                        <Badge variant="success" size="sm">
                          +{adj.quantity_change}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>

            <DialogFooter className="pt-2">
              <Button variant="outline" onClick={() => setSelectedSession(null)}>
                {t('common:close')}
              </Button>
              {selectedSession && (
                <Button
                  leftIcon={<Download className="size-4" />}
                  onClick={() => handleDownloadPdf(selectedSession)}
                  disabled={downloadingId === selectedSession.id}
                >
                  {t('stock:reappro_history.download_confirmation')}
                </Button>
              )}
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
