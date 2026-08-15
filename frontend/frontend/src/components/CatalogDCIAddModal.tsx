import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import api from '../services/api';
import PremiumModal from './common/PremiumModal';
import { Loader2 } from 'lucide-react';
import { Button } from './shadcn/button';
import { Badge } from './ui/Badge';
import { useProductSearch } from '../hooks/useProductSearch';
import type { ProduitModel } from '../types';
import type { Substance } from '../hooks/useSubstances';

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
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const { produits: results, loading: isLoading, searchQuery, setSearchQuery } = useProductSearch({
    minSearchLength: 2,
    debounceMs: 200,
    pageSize: 100,
    autoLoad: false,
  });

  // Auto-search avec le nom de la substance à l'ouverture du modal
  useEffect(() => {
    if (isOpen && substance?.nom) {
      setSearchQuery(substance.nom);
    } else if (!isOpen) {
      setSearchQuery('');
      setSelected(new Set());
    }
  }, [isOpen, substance?.nom, setSearchQuery]);

  // Détermine si un produit est déjà lié à cette DCI
  const isAlreadyLinked = (p: ProduitModel) =>
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

    const results_all = await Promise.all(toAdd.map(async (prod) => {
      try {
        const currentSubs = new Set(prod.substances || []);
        currentSubs.add(substance.id);
        await api.patch(`produits/${prod.id}/`, {
          dci_reference: substance.id,
          substances: Array.from(currentSubs),
          substance_active: substance.nom,
        });
        return null;
      } catch (err: unknown) {
        const errObj = err as { response?: { data?: { detail?: string } }; message?: string };
        const msg = errObj?.response?.data?.detail || errObj?.message;
        return `${prod.name}: ${msg}`;
      }
    }));
    results_all.forEach((msg) => { if (msg) errors.push(msg); });

    setAdding(false);
    if (errors.length > 0) {
      setAddError(errors.join(' | '));
      toast.error(t('common:messages.error_saving'));
    } else {
      onProductsAdded();
      setSelected(new Set());
      setSearchQuery('');
      onClose();
      toast.success(t('common:messages.success_save'));
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
          <div role="alert" className="flex items-start gap-3 p-4 rounded-lg bg-[#fee2e2] text-[#7f1d1d] dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-800 shadow-sm">
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
            className="w-full pl-10 rounded-xl bg-base-200/50 border-none h-10 text-sm px-4 outline-none focus:ring-2 ring-primary/20 transition-all"
            placeholder={t('products:form.search_med_ref') || 'Rechercher un produit...'}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
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
                {searchQuery ? 'Aucun résultat pour cette recherche' : 'Commencez à taper pour rechercher'}
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
                        <Badge variant="success" size="sm" className="font-bold">Déjà associé</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs opacity-60">
                      <span>{prod.forme_name || 'Forme inconnue'}</span>
                      <Badge variant={prod.stock > 0 ? 'success' : 'error'} size="sm" className="h-4 px-1 text-[9px]">
                        {prod.stock} en stock
                      </Badge>
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
          <Button type="button" variant="ghost" onClick={onClose} disabled={adding}>
            {t('common:cancel')}
          </Button>
          <Button
            type="button"
            variant="default" className="shadow-lg shadow-emerald-600/20"
            disabled={selected.size === 0 || adding}
            onClick={handleAddAll}
          >
            {adding ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <span>+</span>
                <span>Associer {selected.size > 0 ? `(${selected.size})` : ''}</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </PremiumModal>
  );
}
