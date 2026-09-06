import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Folder, Factory, Trash2, X, Check, ChevronDown } from 'lucide-react';
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
  const [openMenu, setOpenMenu] = useState<'rayon' | 'fournisseur' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenu]);

  if (selectedCount === 0) return null;

  return (
    <div className="p-3 border-t border-base-200 bg-primary/10 shrink-0 space-y-2">
      <div className="flex items-center justify-between text-xs font-semibold text-primary">
        <span className="inline-flex items-center gap-1"><Check className="size-3.5" /> {selectedCount} {t('products:actions.selected')}</span>
        <button
          className="p-1 text-indigo-500 hover:bg-primary/20 rounded-md transition-colors"
          onClick={onDeselectAll}
          title={t('products:actions.deselect')}
          aria-label={t('products:actions.deselect')}
        >
          <X className="size-3.5" />
        </button>
      </div>
      <div ref={containerRef} className="flex gap-2 flex-wrap">
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpenMenu(openMenu === 'rayon' ? null : 'rayon')}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md border border-indigo-200 bg-base-100 text-primary hover:bg-primary/10 cursor-pointer transition-colors"
            aria-expanded={openMenu === 'rayon'}
            aria-haspopup="listbox"
          >
            <Folder className="size-3.5" />
            {t('products:actions.bulk_rayon')}
            <ChevronDown className="size-3.5" />
          </button>
          {openMenu === 'rayon' && (
            <ul className="absolute bottom-full right-0 z-50 p-1 shadow-xl bg-base-100 rounded-lg w-40 max-h-48 overflow-auto border border-base-200 mb-1">
              {rayons.map(r => (
                <li key={r.id}>
                  <button
                    onClick={() => { onBulkChangeRayon(r.id); setOpenMenu(null); }}
                    className="w-full text-left text-xs py-2 px-2 hover:bg-base-200 text-base-content block"
                  >
                    {r.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpenMenu(openMenu === 'fournisseur' ? null : 'fournisseur')}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md border border-base-300 bg-base-100 text-base-content hover:bg-base-200 cursor-pointer transition-colors"
            aria-expanded={openMenu === 'fournisseur'}
            aria-haspopup="listbox"
          >
            <Factory className="size-3.5" />
            {t('products:actions.bulk_provider')}
            <ChevronDown className="size-3.5" />
          </button>
          {openMenu === 'fournisseur' && (
            <ul className="absolute bottom-full right-0 z-50 p-1 shadow-xl bg-base-100 rounded-lg w-48 max-h-48 overflow-auto border border-base-200 mb-1">
              {fournisseurs.map(f => (
                <li key={f.id}>
                  <button
                    onClick={() => { onBulkChangeFournisseur(f.id); setOpenMenu(null); }}
                    className="w-full text-left text-xs py-2 px-2 hover:bg-base-200 text-base-content block"
                  >
                    {f.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md text-white bg-error hover:bg-error-focus transition-colors"
          onClick={onBulkDelete}
          disabled={loading}
          aria-label={t('products:actions.bulk_delete')}
        >
          <Trash2 className="size-3.5" />
          {t('products:actions.bulk_delete')}
        </button>
      </div>
    </div>
  );
};
