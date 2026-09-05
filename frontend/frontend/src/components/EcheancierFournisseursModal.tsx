import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../utils/formatters';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/Dialog';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Card } from './ui/Card';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from './shadcn/table';
import SkeletonTable from './ui/SkeletonTable';
import {
  Search,
  CalendarDays,
  Wallet,
  CheckSquare,
  AlertCircle,
  TrendingDown,
  Clock,
  CheckCircle2,
} from 'lucide-react';

interface Echeance {
  fournisseur_id: number;
  fournisseur_nom: string;
  type_reglement: 'FACTURE' | 'RELEVE';
  commande_id: number | null;
  numero_facture: string;
  montant_du: number;
  date_echeance: string;
  jours_restants: number;
  status: 'EN RETARD' | "AUJOURD'HUI" | 'À VENIR';
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onPointer?: (fournisseurId: number, fournisseurNom: string) => void;
}

const statusBadgeVariant = (status: Echeance['status']) => {
  switch (status) {
    case 'EN RETARD': return 'error';
    case "AUJOURD'HUI": return 'warning';
    case 'À VENIR': return 'success';
    default: return 'ghost';
  }
};

export default function EcheancierFournisseursModal({ isOpen, onClose, onPointer }: Props) {
  const { t } = useTranslation(['providers', 'common']);
  const [echeances, setEcheances] = useState<Echeance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('TOUS');

  useEffect(() => {
    if (isOpen) {
      fetchEcheances();
      setSearchTerm('');
      setStatusFilter('TOUS');
    }
  }, [isOpen]);

  async function fetchEcheances() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('fournisseurs/echeancier/');
      setEcheances(data);
    } catch (err: unknown) {
      setError(err.response?.data?.message || err.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }

  const filteredEcheances = useMemo(() => {
    return echeances.filter(e => {
      const term = searchTerm.toLowerCase();
      const matchSearch = e.fournisseur_nom.toLowerCase().includes(term) ||
                          e.numero_facture.toLowerCase().includes(term);
      const matchStatus = statusFilter === 'TOUS' || e.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [echeances, searchTerm, statusFilter]);

  const summary = useMemo(() => {
    return filteredEcheances.reduce((acc, e) => {
      acc.total += e.montant_du;
      if (e.status === 'EN RETARD') acc.late += e.montant_du;
      else if (e.status === "AUJOURD'HUI") acc.today += e.montant_du;
      else acc.upcoming += e.montant_du;
      return acc;
    }, { total: 0, late: 0, today: 0, upcoming: 0 });
  }, [filteredEcheances]);

  const summaryCards = [
    { label: t('providers:schedule.summary.total'), amount: summary.total, icon: Wallet, variant: 'primary' as const },
    { label: t('providers:schedule.summary.late'), amount: summary.late, icon: TrendingDown, variant: 'error' as const },
    { label: t('providers:schedule.summary.today'), amount: summary.today, icon: Clock, variant: 'warning' as const },
    { label: t('providers:schedule.summary.upcoming'), amount: summary.upcoming, icon: CalendarDays, variant: 'success' as const },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="p-6 pb-2 border-b border-base-200">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 rounded-xl">
              <CalendarDays className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <DialogTitle>{t('providers:schedule.title')}</DialogTitle>
              <DialogDescription>{t('providers:schedule.subtitle')}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 flex flex-col gap-5 overflow-hidden">
          {error && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm shrink-0">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
            {summaryCards.map((card) => (
              <Card key={card.label} variant="bordered" padding="sm" className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  card.variant === 'error' ? 'bg-red-50 text-red-600' :
                  card.variant === 'warning' ? 'bg-amber-50 text-amber-600' :
                  card.variant === 'success' ? 'bg-emerald-50 text-emerald-600' :
                  'bg-indigo-50 text-indigo-600'
                }`}>
                  <card.icon className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-base-content/50">{card.label}</div>
                  <div className="text-base font-black text-base-content tabular-nums">{formatCurrency(card.amount)}</div>
                </div>
              </Card>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            <Input
              type="text"
              placeholder={t('providers:schedule.search_placeholder')}
              size="sm"
              containerClassName="flex-1"
              icon={<Search className="h-4 w-4" />}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            <Select
              size="sm"
              containerClassName="w-full sm:w-48"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="TOUS">{t('providers:schedule.status_all')}</option>
              <option value="EN RETARD">{t('providers:schedule.status_late')}</option>
              <option value="AUJOURD'HUI">{t('providers:schedule.status_today')}</option>
              <option value="À VENIR">{t('providers:schedule.status_upcoming')}</option>
            </Select>
          </div>

          {loading ? (
            <div className="flex-1 overflow-hidden">
              <SkeletonTable rows={6} columns={6} />
            </div>
          ) : filteredEcheances.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-10 bg-base-200/30 rounded-xl border border-base-200 text-center">
              <div className="p-4 bg-emerald-50 rounded-full mb-4">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              </div>
              <h3 className="text-lg font-bold text-base-content/90">{t('providers:schedule.empty')}</h3>
              <p className="text-sm text-base-content/60 mt-1">{t('providers:schedule.empty_subtitle')}</p>
            </div>
          ) : (
            <div className="flex-1 overflow-auto rounded-xl border border-base-200 shadow-sm">
              <Table className="border-0">
                <TableHeader className="bg-base-200/50 sticky top-0 z-10">
                  <TableRow>
                    <TableHead>{t('providers:schedule.table.provider')}</TableHead>
                    <TableHead>{t('providers:schedule.table.ref_type')}</TableHead>
                    <TableHead className="text-right">{t('providers:schedule.table.amount')}</TableHead>
                    <TableHead className="text-center">{t('providers:schedule.table.due_date')}</TableHead>
                    <TableHead className="text-center">{t('providers:schedule.table.status')}</TableHead>
                    <TableHead className="text-center">{t('providers:schedule.table.action')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEcheances.map((e) => (
                    <TableRow key={`${e.fournisseur_id}-${e.commande_id || 'releve'}`}>
                      <TableCell>
                        <div className="font-bold text-base-content">{e.fournisseur_nom}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-mono text-xs font-medium bg-base-200 px-2 py-0.5 rounded inline-block text-base-content/80">
                          {e.numero_facture}
                        </div>
                        <div className="text-[10px] text-base-content/40 mt-0.5 uppercase tracking-wide">
                          {e.type_reglement === 'RELEVE' ? t('providers:schedule.type_statement') : t('providers:schedule.type_invoice')}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className={`font-black tracking-tight tabular-nums ${e.status === 'EN RETARD' ? 'text-red-600' : 'text-base-content'}`}>
                          {formatCurrency(e.montant_du)}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="font-semibold text-sm text-base-content">
                          {new Date(e.date_echeance).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={statusBadgeVariant(e.status)} size="sm">
                          {e.status}
                          {e.jours_restants < 0 ? ` (${Math.abs(e.jours_restants)}j)` : e.jours_restants > 0 ? ` (dans ${e.jours_restants}j)` : ''}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            leftIcon={<CheckSquare className="h-3.5 w-3.5" />}
                            onClick={() => onPointer && onPointer(e.fournisseur_id, e.fournisseur_nom)}
                          >
                            {t('providers:schedule.table.pointage_btn')}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
