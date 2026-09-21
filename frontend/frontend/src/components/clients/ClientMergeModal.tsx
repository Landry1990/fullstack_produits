import { useTranslation } from 'react-i18next';
import { Users, Merge, UserPlus, Phone, X } from 'lucide-react';
import { Button } from '../shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../shadcn/dialog';
import { Badge } from '../shadcn/badge';
import { cn } from '../../lib/utils';

interface Candidate {
  id: number;
  name: string;
  client_type: 'PARTICULIER' | 'PROFESSIONNEL';
  phone: string | null;
  score: number;
}

interface ClientMergeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeepNew: () => void;
  onMerge: (candidate: Candidate) => void;
  candidates: Candidate[];
}

export default function ClientMergeModal({
  isOpen,
  onClose,
  onKeepNew,
  onMerge,
  candidates,
}: ClientMergeModalProps) {
  const { t } = useTranslation(['clients', 'common']);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md" hideCloseButton>
        <DialogHeader>
          <div className="flex items-center gap-2 mx-auto sm:mx-0">
            <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
              <Users className="size-5" />
            </div>
            <DialogTitle>{t('clients:merge.title')}</DialogTitle>
          </div>
          <DialogDescription>
            {t('clients:merge.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-64 overflow-y-auto py-2">
          {candidates.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              onClick={() => onMerge(candidate)}
              className={cn(
                "w-full text-left p-3 rounded-lg border transition-all hover:border-emerald-300 hover:bg-emerald-50",
                candidate.score >= 0.9 ? 'border-amber-200 bg-amber-50/50' : 'border-slate-200 bg-white'
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800 text-sm truncate pr-2">{candidate.name}</span>
                <Badge variant="outline" className={cn(
                  "text-caption uppercase tracking-wide",
                  candidate.client_type === 'PROFESSIONNEL' ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-slate-100 text-slate-500 border-slate-200'
                )}>
                  {candidate.client_type === 'PROFESSIONNEL' ? t('clients:types.pro_short') : t('clients:types.part_short')}
                </Badge>
              </div>
              <div className="flex items-center justify-between mt-1 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Phone className="size-3" />
                  {candidate.phone || '—'}
                </span>
                <span className="font-medium text-emerald-600">{Math.round(candidate.score * 100)}% {t('clients:merge.match')}</span>
              </div>
            </button>
          ))}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onKeepNew} className="w-full sm:w-auto gap-2">
            <UserPlus className="size-4" />
            {t('clients:merge.keep_new')}
          </Button>
          <Button variant="ghost" onClick={onClose} className="w-full sm:w-auto gap-2">
            <X className="size-4" />
            {t('common:cancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
