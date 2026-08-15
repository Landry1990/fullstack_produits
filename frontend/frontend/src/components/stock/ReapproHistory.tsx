import { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'react-hot-toast';
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
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../ui/Table';
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
      toast.error(t('stock:reappro.messages.history_load_error'));
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
      toast.success(t('stock:reappro.messages.pdf_generated'));
    } catch (error) {
      logger.error('Error generating PDF:', error);
      toast.error(t('stock:reappro.messages.pdf_generation_error'));
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
            <Button variant="outline" size="sm" className="rounded-full w-10 h-10 p-0">
              <ChevronLeft className="size-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-slate-900 text-white rounded-xl shadow-sm">
              <History className="size-6" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
                Historique Réappro
              </h1>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-0.5">
                Suivi des transferts Réserve → Rayon
              </p>
            </div>
          </div>
        </div>

        <div className="w-full max-w-md">
          <Input
            type="text"
            placeholder="Rechercher par N° ou utilisateur..."
            icon={<Search className="size-4" />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Main Content */}
      <Card variant="default" padding="none" className="rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Session</TableHead>
                <TableHead>Date & Heure</TableHead>
                <TableHead>Utilisateur</TableHead>
                <TableHead className="text-center">Produits</TableHead>
                <TableHead className="text-center">Unités</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-8 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-8 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : filteredHistory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-24 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-300">
                      <History className="size-16 mb-4" />
                      <h3 className="text-lg font-medium text-slate-600">
                        Aucun historique trouvé
                      </h3>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredHistory.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell>
                      <Badge variant="outline" size="sm">
                        #{session.id}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-slate-700">
                        <Calendar className="size-3.5 text-slate-400" />
                        <span className="text-sm font-medium">
                          {new Date(session.created_at).toLocaleString()}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="size-6 bg-slate-100 rounded-full flex items-center justify-center">
                          <User className="size-3 text-slate-500" />
                        </div>
                        <span className="text-sm font-medium text-slate-700">
                          {session.user_name || 'Inconnu'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-sm font-medium text-slate-700">
                        {session.total_products}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="success" size="sm">
                        {session.total_units}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          leftIcon={<Eye className="size-3.5" />}
                          onClick={() => setSelectedSession(session)}
                        >
                          Voir
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
                    Détails du réappro #{selectedSession?.id}
                  </DialogTitle>
                  <DialogDescription className="text-sm text-slate-500">
                    Transfert Réserve → Rayon
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <Card variant="bordered" padding="md" className="rounded-xl">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                  Résumé
                </p>
                <p className="text-sm font-semibold text-slate-800">
                  {selectedSession?.total_products} produits transférés
                  <br />
                  {selectedSession?.total_units} unités au total
                </p>
              </Card>
              <Card variant="bordered" padding="md" className="rounded-xl">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                  Effectué le
                </p>
                <p className="text-sm font-semibold text-slate-800">
                  {selectedSession && new Date(selectedSession.created_at).toLocaleString()}
                </p>
              </Card>
            </div>

            <Card variant="bordered" padding="none" className="rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produit</TableHead>
                    <TableHead>Lot / Exp</TableHead>
                    <TableHead className="text-center">Qté</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedSession?.adjustments?.map((adj) => (
                    <TableRow key={adj.id}>
                      <TableCell className="text-sm font-medium text-slate-700">
                        {adj.produit_name}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col text-xs">
                          <span className="font-medium text-slate-600">{adj.lot_num}</span>
                          <span className="text-slate-400">
                            {formatDate(adj.expiry) !== '-' ? formatDate(adj.expiry) : 'N/A'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
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
                Fermer
              </Button>
              {selectedSession && (
                <Button
                  leftIcon={<Download className="size-4" />}
                  onClick={() => handleDownloadPdf(selectedSession)}
                  disabled={downloadingId === selectedSession.id}
                >
                  Télécharger la confirmation
                </Button>
              )}
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
