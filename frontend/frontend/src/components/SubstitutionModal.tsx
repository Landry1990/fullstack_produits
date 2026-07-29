import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { useProduitSubstituts } from '../hooks/useProduitSubstituts';
import type { ProduitModel } from '../types/catalog';
import { Button } from './shadcn/button';
import { Badge } from './ui/Badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/Dialog';

interface SubstitutionModalProps {
  produitId: number | null;
  produitName: string;
  onSelect: (substitut: ProduitModel) => void;
  onClose: () => void;
}

export function SubstitutionModal({ produitId, produitName, onSelect, onClose }: SubstitutionModalProps) {
  const { t } = useTranslation('common');
  const { data, isLoading } = useProduitSubstituts(produitId);

  if (!produitId) return null;

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl" aria-labelledby="substitution-title">
        <DialogHeader>
          <DialogTitle id="substitution-title">
            {t('substitution.title', { produit: produitName })}
          </DialogTitle>
          <DialogDescription>
            {data?.dci ? t('substitution.dci_label', { dci: data.dci }) : t('substitution.no_dci')}
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="size-8 animate-spin" />
          </div>
        )}

        {!isLoading && data && data.count === 0 && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            {data.message || t('substitution.none_available')}
          </div>
        )}

        {!isLoading && data && data.count > 0 && (
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-base-300">
                  <th className="text-left py-2 px-3 font-bold">{t('substitution.product')}</th>
                  <th className="text-left py-2 px-3 font-bold">{t('substitution.stock')}</th>
                  <th className="text-left py-2 px-3 font-bold">{t('substitution.price')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.substituts.map((sub) => (
                  <tr key={sub.id} className="border-b border-base-200 hover:bg-base-200/50">
                    <td className="py-2 px-3">
                      <div className="font-medium">{sub.name}</div>
                      {sub.cip1 && <div className="text-xs opacity-60">CIP: {sub.cip1}</div>}
                    </td>
                    <td className="py-2 px-3">
                      <Badge variant={sub.stock > 10 ? 'success' : sub.stock > 0 ? 'warning' : 'error'} size="sm">
                        {sub.stock}
                      </Badge>
                    </td>
                    <td className="py-2 px-3 font-mono">{sub.selling_price} F</td>
                    <td className="py-2 px-3">
                      <Button variant="default" size="sm" onClick={() => onSelect(sub)}>
                        {t('substitution.select')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="ghost" onClick={onClose}>
            {t('cancel')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
