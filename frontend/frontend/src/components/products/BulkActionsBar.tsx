import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Rayon, Fournisseur } from '../../types';

interface BulkActionsBarProps {
  selectedCount: number;
  onDeselectAll: () => void;
  rayons: Rayon[];
  fournisseurs: Fournisseur[];
  onBulkChangeRayon: (rayonId: number) => void;
  onBulkChangeFournisseur: (fournisseurId: number) => void;
  onBulkDelete: () => void;
  loading: boolean;
}

export const BulkActionsBar: React.FC<BulkActionsBarProps> = ({
  selectedCount,
  onDeselectAll,
  rayons,
  fournisseurs,
  onBulkChangeRayon,
  onBulkChangeFournisseur,
  onBulkDelete,
  loading
}) => {
  const { t } = useTranslation();

  if (selectedCount === 0) return null;

  return (
    <div className="p-2 border-t bg-primary/5 shrink-0 space-y-2">
      <div className="flex items-center justify-between text-xs font-semibold text-primary">
        <span>✓ {selectedCount} {t('products.actions.selected')}</span>
        <button 
          className="btn btn-xs btn-ghost"
          onClick={onDeselectAll}
          title={t('products.actions.deselect')}
        >
          ✕
        </button>
      </div>
      <div className="flex gap-1 flex-wrap">
        <div className="dropdown dropdown-top dropdown-end">
          <label tabIndex={0} className="btn btn-xs btn-outline btn-primary gap-1">
            📁 {t('products.actions.bulk_rayon')} ▼
          </label>
          <ul tabIndex={0} className="dropdown-content z-50 menu p-1 shadow bg-base-100 rounded-box w-40 max-h-48 overflow-auto">
            {rayons.map(r => (
              <li key={r.id}>
                <a onClick={() => onBulkChangeRayon(r.id)} className="text-xs py-1">{r.name}</a>
              </li>
            ))}
          </ul>
        </div>
        <div className="dropdown dropdown-top dropdown-end">
          <label tabIndex={0} className="btn btn-xs btn-outline btn-secondary gap-1">
            🏭 {t('products.actions.bulk_provider')} ▼
          </label>
          <ul tabIndex={0} className="dropdown-content z-50 menu p-1 shadow bg-base-100 rounded-box w-48 max-h-48 overflow-auto">
            {fournisseurs.map(f => (
              <li key={f.id}>
                <a onClick={() => onBulkChangeFournisseur(f.id)} className="text-xs py-1">{f.name}</a>
              </li>
            ))}
          </ul>
        </div>
        <button 
          className="btn btn-xs btn-error gap-1" 
          onClick={onBulkDelete}
          disabled={loading}
        >
          🗑️ {t('products.actions.bulk_delete')}
        </button>
      </div>
    </div>
  );
};
