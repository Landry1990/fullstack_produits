import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, GitMerge, Loader2, Phone, Search, User, X } from 'lucide-react';
import { Badge } from '../shadcn/badge';
import { Button } from '../shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../shadcn/dialog';
import { Input } from '../shadcn/input';
import { EmptyState } from '../ui/EmptyState';
import clientService from '../../services/clientService';
import type { Client } from '../../types';
import { cn } from '../../lib/utils';

interface ClientMergeTargetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMerge: (target: Client) => void;
  source: Client | null;
  isSubmitting?: boolean;
}

export default function ClientMergeTargetModal({
  isOpen,
  onClose,
  onMerge,
  source,
  isSubmitting = false,
}: ClientMergeTargetModalProps) {
  const { t } = useTranslation(['clients', 'common']);
  const [search, setSearch] = useState('');
  const [candidates, setCandidates] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !source) return;

    const controller = new AbortController();
    setLoading(true);
    const timer = window.setTimeout(() => {
      clientService.getAll({
        search: search.trim() || undefined,
        client_type: source.client_type,
        page_size: 20,
      }, true, controller.signal).then((data) => {
        const results = Array.isArray(data) ? data : (data as { results?: Client[] }).results || [];
        setCandidates(results.filter((client) => client.id !== source.id));
      }).catch(() => {
        if (!controller.signal.aborted) {
          setCandidates([]);
        }
      }).finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [isOpen, search, source]);

  useEffect(() => {
    if (!isOpen) {
      setSearch('');
      setCandidates([]);
    }
  }, [isOpen]);

  if (!source) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="max-w-lg" hideCloseButton>
        <DialogHeader>
          <div className="flex items-center gap-2 mx-auto sm:mx-0">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
              <GitMerge className="size-5" />
            </div>
            <DialogTitle>{t('clients:merge.manual.title')}</DialogTitle>
          </div>
          <DialogDescription>
            {t('clients:merge.manual.description', { name: source.name })}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-indigo-500">
            {t('clients:merge.manual.source_label')}
          </div>
          <div className="mt-1 flex items-center justify-between gap-3">
            <span className="font-semibold text-slate-800 truncate">{source.name}</span>
            <Badge variant="outline" className="bg-white text-indigo-600 border-indigo-200">
              {source.client_type === 'PROFESSIONNEL' ? t('clients:types.pro_short') : t('clients:types.part_short')}
            </Badge>
          </div>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex gap-2 text-amber-800">
          <AlertTriangle className="size-4 mt-0.5 shrink-0" />
          <p className="text-xs leading-5">{t('clients:merge.manual.warning')}</p>
        </div>

        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('clients:merge.manual.search_placeholder')}
              className="pl-9"
              disabled={isSubmitting}
            />
          </div>

          <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
            {loading ? (
              <div className="flex items-center justify-center py-10 text-slate-500">
                <Loader2 className="size-5 animate-spin" />
              </div>
            ) : candidates.length > 0 ? (
              candidates.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  onClick={() => onMerge(candidate)}
                  disabled={isSubmitting}
                  className={cn(
                    'w-full text-left p-3 rounded-lg border border-slate-200 bg-white transition-all',
                    'hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-sm text-slate-800 truncate">{candidate.name}</span>
                    <Badge variant="outline" className="bg-indigo-50 text-indigo-600 border-indigo-200">
                      {t('clients:merge.manual.choose')}
                    </Badge>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <User className="size-3" />
                      #{candidate.id}
                    </span>
                    <span className="flex items-center gap-1">
                      <Phone className="size-3" />
                      {candidate.phone || '—'}
                    </span>
                  </div>
                </button>
              ))
            ) : (
              <EmptyState compact title={t('clients:merge.manual.empty')} className="py-8" />
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting} className="gap-2">
            <X className="size-4" />
            {t('common:cancel')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
