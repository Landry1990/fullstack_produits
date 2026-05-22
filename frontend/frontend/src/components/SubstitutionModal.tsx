import { useTranslation } from 'react-i18next';
import { useProduitSubstituts } from '../hooks/useProduitSubstituts';
import type { ProduitModel } from '../types/catalog';

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
    <div className="modal modal-open z-50">
      <div className="modal-box max-w-2xl">
        <h3 className="font-bold text-lg mb-2">
          {t('substitution.title', { produit: produitName })}
        </h3>
        <p className="text-sm text-base-content/70 mb-4">
          {data?.dci ? t('substitution.dci_label', { dci: data.dci }) : t('substitution.no_dci')}
        </p>

        {isLoading && (
          <div className="flex justify-center py-8">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        )}

        {!isLoading && data && data.count === 0 && (
          <div className="alert alert-warning">
            <span>{data.message || t('substitution.none_available')}</span>
          </div>
        )}

        {!isLoading && data && data.count > 0 && (
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="table table-zebra table-sm w-full">
              <thead>
                <tr>
                  <th>{t('substitution.product')}</th>
                  <th>{t('substitution.stock')}</th>
                  <th>{t('substitution.price')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.substituts.map((sub) => (
                  <tr key={sub.id}>
                    <td>
                      <div className="font-medium">{sub.name}</div>
                      {sub.cip1 && <div className="text-xs opacity-60">CIP: {sub.cip1}</div>}
                    </td>
                    <td>
                      <span className={`badge ${sub.stock > 10 ? 'badge-success' : sub.stock > 0 ? 'badge-warning' : 'badge-error'}`}>
                        {sub.stock}
                      </span>
                    </td>
                    <td className="font-mono">{sub.selling_price} F</td>
                    <td>
                      <button className="btn btn-primary btn-sm" onClick={() => onSelect(sub)}>
                        {t('substitution.select')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onClose}>
            {t('cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
