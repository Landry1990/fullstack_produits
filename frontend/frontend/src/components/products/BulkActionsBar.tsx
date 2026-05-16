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
  const { t } = useTranslation(['products', 'common']);

  if (selectedCount === 0) return null;

  return (
    <div className="p-3 border-t border-gray-100 bg-indigo-50/30 shrink-0 space-y-2">
      <div className="flex items-center justify-between text-xs font-semibold text-indigo-700">
        <span>✓ {selectedCount} {t('products:actions.selected')}</span>
        <button
          className="p-1 text-indigo-500 hover:bg-indigo-100 rounded-md transition-colors"
          onClick={onDeselectAll}
          title={t('products:actions.deselect')}
        >
          ✕
        </button>
      </div>
      <div className="flex gap-2 flex-wrap">
        <div className="dropdown dropdown-top dropdown-end">
          <label tabIndex={0} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md border border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50 cursor-pointer transition-colors">
            📁 {t('products:actions.bulk_rayon')} ▼
          </label>
          <ul tabIndex={0} className="dropdown-content z-50 menu p-1 shadow-xl bg-white rounded-lg w-40 max-h-48 overflow-auto border border-gray-100">
            {rayons.map(r => (
              <li key={r.id}>
                <a onClick={() => onBulkChangeRayon(r.id)} className="text-xs py-2 hover:bg-gray-50 text-gray-700">{r.name}</a>
              </li>
            ))}
          </ul>
        </div>
        <div className="dropdown dropdown-top dropdown-end">
          <label tabIndex={0} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors">
            🏭 {t('products:actions.bulk_provider')} ▼
          </label>
          <ul tabIndex={0} className="dropdown-content z-50 menu p-1 shadow-xl bg-white rounded-lg w-48 max-h-48 overflow-auto border border-gray-100">
            {fournisseurs.map(f => (
              <li key={f.id}>
                <a onClick={() => onBulkChangeFournisseur(f.id)} className="text-xs py-2 hover:bg-gray-50 text-gray-700">{f.name}</a>
              </li>
            ))}
          </ul>
        </div>
        <button
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md text-white bg-red-600 hover:bg-red-700 transition-colors"
          onClick={onBulkDelete}
          disabled={loading}
        >
          🗑️ {t('products:actions.bulk_delete')}
        </button>
      </div>
    </div>
  );
};
