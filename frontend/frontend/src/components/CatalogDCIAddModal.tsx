import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import PremiumModal from './common/PremiumModal';
import type { Substance } from '../hooks/useSubstances';

interface ProduitSearchItem {
  id: number;
  name: string;
  forme_nom: string | null;
  stock: number;
  selling_price: string;
  dci_reference: number | null;
  substances: number[];
}

interface CatalogDCIAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  substance: Substance | null;
  onProductsAdded: () => void;
}

export default function CatalogDCIAddModal({
  isOpen,
  onClose,
  substance,
  onProductsAdded,
}: CatalogDCIAddModalProps) {
  const { t } = useTranslation(['products', 'common']);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Recherche dans la base produit de la pharmacie
  const { data, isLoading } = useQuery({
    queryKey: ['produits-search', search || substance?.nom],
    queryFn: async () => {
      const q = search.trim() || substance?.nom || '';
      if (!q) return { results: [] as ProduitSearchItem[], count: 0 };
      const response = await api.get<{ results: ProduitSearchItem[]; count: number }>(
        `produits/?search=${encodeURIComponent(q)}&page_size=100`
      );
      return response.data;
    },
    enabled: isOpen,
  });

  const results = data?.results || [];

  // Détermine si un produit est déjà lié à cette DCI
  const isAlreadyLinked = (p: ProduitSearchItem) =>
    p.dci_reference === substance?.id || (p.substances || []).includes(substance?.id ?? -1);

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAddAll = async () => {
    if (!substance || selected.size === 0) return;
    setAdding(true);
    setAddError(null);

    const toAdd = results.filter(r => selected.has(r.id) && !isAlreadyLinked(r));
    const errors: string[] = [];

    for (const prod of toAdd) {
      try {
        const currentSubs = new Set(prod.substances || []);
        currentSubs.add(substance.id);
        await api.patch(`produits/${prod.id}/`, {
          dci_reference: substance.id,
          substances: Array.from(currentSubs),
          substance_active: substance.nom,
        });
      } catch (err: any) {
        const msg = err.response?.data?.detail || err.message;
        errors.push(`${prod.name}: ${msg}`);
      }
    }

    setAdding(false);
    if (errors.length > 0) {
      setAddError(errors.join(' | '));
    } else {
      onProductsAdded();
      setSelected(new Set());
      setSearch('');
      onClose();
    }
  };

  return (
    <PremiumModal
      isOpen={isOpen}
      onClose={onClose}
      title={`${t('products:actions.add')} — ${substance?.nom || ''}`}
      maxWidth="max-w-2xl"
      icon={<span>🔍</span>}
      gradientFrom="secondary/20"
      gradientTo="primary/20"
    >
      <div className="p-6 space-y-4">
        {addError && (
          <div role="alert" className="alert alert-error shadow-sm">
            <span className="text-xs">{addError}</span>
          </div>
        )}

        {/* Barre de recherche */}
        <div className="relative">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-base-content/50">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          </div>
          <input
            type="text"
            className="input input-bordered w-full pl-10 rounded-xl bg-base-200/50 border-none focus:ring-2 ring-primary/20"
            placeholder={t('products:form.search_med_ref') || 'Rechercher un produit...'}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelected(new Set());
            }}
          />
        </div>

        {/* Compteur de sélection */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-base-content/70">
            {selected.size > 0 ? `${selected.size} sélectionné(s)` : 'Aucune sélection'}
          </span>
          {results.length > 0 && (
            <span className="text-xs text-base-content/50">{results.length} résultat(s)</span>
          )}
        </div>

        {/* Liste des résultats */}
        <div className="max-h-80 overflow-y-auto space-y-2 custom-scrollbar border border-base-200 rounded-2xl p-2 bg-base-100">
          {isLoading ? (
            <div className="space-y-2 p-2">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-14 w-full bg-base-200 animate-pulse rounded-xl" />
              ))}
            </div>
          ) : results.length === 0 ? (
            <div className="p-8 text-center opacity-40">
              <p className="text-sm font-medium">
                {search ? 'Aucun résultat pour cette recherche' : 'Commencez à taper pour rechercher'}
              </p>
            </div>
          ) : (
            results.map((prod) => {
              const alreadyLinked = isAlreadyLinked(prod);
              const isSelected = selected.has(prod.id);
              return (
                <label
                  key={prod.id}
                  className={`flex items-start gap-3 p-3 rounded-xl transition-all border ${
                    alreadyLinked
                      ? 'opacity-40 bg-base-200/50 border-transparent cursor-not-allowed'
                      : isSelected
                      ? 'bg-secondary/10 border-secondary/30 cursor-pointer'
                      : 'hover:bg-base-200 border-transparent cursor-pointer'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="checkbox checkbox-secondary mt-1"
                    checked={isSelected}
                    disabled={alreadyLinked}
                    onChange={() => !alreadyLinked && toggleSelect(prod.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h4 className="font-bold text-sm uppercase leading-tight truncate">{prod.name}</h4>
                      {alreadyLinked && (
                        <span className="badge badge-sm badge-success font-bold">Déjà associé</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs opacity-60">
                      <span>{prod.forme_nom || 'Forme inconnue'}</span>
                      <span className={`badge badge-xs ${prod.stock > 0 ? 'badge-success' : 'badge-error'}`}>
                        {prod.stock} en stock
                      </span>
                      <span className="font-bold text-primary">{prod.selling_price} F</span>
                    </div>
                  </div>
                </label>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 pt-2 border-t border-base-200">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={adding}>
            {t('common:cancel')}
          </button>
          <button
            type="button"
            className="btn btn-primary shadow-lg shadow-primary/20"
            disabled={selected.size === 0 || adding}
            onClick={handleAddAll}
          >
            {adding ? (
              <span className="loading loading-spinner loading-sm" />
            ) : (
              <>
                <span>+</span>
                <span>Associer {selected.size > 0 ? `(${selected.size})` : ''}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </PremiumModal>
  );
}
