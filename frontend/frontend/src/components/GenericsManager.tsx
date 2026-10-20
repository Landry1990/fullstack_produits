import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { gooeyToast } from 'goey-toast';
import api from '../services/api';
import { Button } from './shadcn/button';
import { Badge } from './ui/Badge';
import { EmptyState } from './ui/EmptyState';
import { Skeleton } from './ui/Skeleton';
import { logger } from '../utils/logger';

interface ProductLite {
  id: number;
  name: string;
  cip1?: string | null;
  stock?: number;
  selling_price?: string | number;
}

interface GenericItem extends ProductLite {
  shared: string[];
  declared: boolean;
}

interface GenericsResponse {
  results: GenericItem[];
}

/**
 * Gestion manuelle des génériques : sélectionner un produit de référence,
 * voir ses génériques (produits partageant une substance / DCI),
 * ajouter ou retirer des liens manuellement.
 */
export default function GenericsManager() {
  const { t } = useTranslation(['products', 'common']);
  const [reference, setReference] = useState<ProductLite | null>(null);
  const [generics, setGenerics] = useState<GenericItem[] | null>(null);
  const [loadingGenerics, setLoadingGenerics] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const fetchGenerics = useCallback(() => {
    if (!reference) { setGenerics(null); return; }
    setLoadingGenerics(true);
    api.get<GenericsResponse>('dci-admin/generiques/', { params: { produit_id: reference.id } })
      .then(r => setGenerics(r.data.results || []))
      .catch(err => {
        logger.error('generiques fetch failed', err);
        gooeyToast.error(t('products:dci.generics.error_load'));
        setGenerics([]);
      })
      .finally(() => setLoadingGenerics(false));
  }, [reference, t]);

  useEffect(() => { fetchGenerics(); }, [fetchGenerics]);

  const postLink = useCallback((candidate: ProductLite, force = false) => {
    if (!reference) return;
    setBusyId(candidate.id);
    api.post('dci-admin/link_generic/', {
      produit_id: reference.id,
      generic_id: candidate.id,
      force,
    })
      .then(r => {
        gooeyToast.success(
          t('products:dci.generics.linked', { name: r.data.generic || candidate.name })
        );
        fetchGenerics();
      })
      .catch(err => {
        const data = err.response?.data;
        if (err.response?.status === 409 && data?.requires_confirmation) {
          const details = t('products:dci.generics.mismatch_detail', {
            generic: (data.generic_substances || []).join(', ') || '-',
            reference: (data.reference_substances || []).join(', ') || '-',
          });
          if (window.confirm(`${data.error}\n\n${details}\n\n${t('products:dci.generics.mismatch_confirm')}`)) {
            postLink(candidate, true);
            return;
          }
        } else {
          gooeyToast.error(data?.error || t('products:dci.generics.error_link'));
        }
      })
      .finally(() => setBusyId(null));
  }, [reference, fetchGenerics, t]);

  const handleLink = (candidate: ProductLite) => {
    if (!reference) return;
    if (!window.confirm(
      t('products:dci.generics.confirm_link', { generic: candidate.name, reference: reference.name })
    )) return;
    postLink(candidate);
  };

  const handleUnlink = (item: GenericItem) => {
    if (!reference) return;
    if (!window.confirm(t('products:dci.generics.confirm_unlink', { name: item.name }))) return;
    setBusyId(item.id);
    api.post('dci-admin/unlink_generic/', { produit_id: reference.id, generic_id: item.id })
      .then(() => {
        gooeyToast.success(t('products:dci.generics.unlinked', { name: item.name }));
        fetchGenerics();
      })
      .catch(err => gooeyToast.error(err.response?.data?.error || t('products:dci.generics.error_unlink')))
      .finally(() => setBusyId(null));
  };

  return (
    <div className="space-y-6">
      {/* Sélection du produit de référence */}
      <div className="bg-base-100 rounded-3xl border border-base-200 p-6">
        <h2 className="font-bold text-lg mb-1">{t('products:dci.generics.reference_title')}</h2>
        <p className="text-sm text-base-content/50 mb-4">{t('products:dci.generics.reference_desc')}</p>
        <div className="flex items-center gap-4 flex-wrap">
          <ProductSearchCombobox
            placeholder={t('products:dci.generics.search_reference')}
            onSelect={(p) => setReference(p)}
          />
          {reference && (
            <Badge variant="outline" size="sm" className="bg-primary/10 text-primary border-none">
              {reference.name}
              <button
                className="ml-1 hover:text-error"
                onClick={() => setReference(null)}
                aria-label={t('common:delete')}
              >
                <X className="size-3" />
              </button>
            </Badge>
          )}
        </div>
      </div>

      {reference && (
        <>
          {/* Ajout d'un générique */}
          <div className="bg-base-100 rounded-3xl border border-base-200 p-6">
            <h2 className="font-bold text-lg mb-1">{t('products:dci.generics.add_title')}</h2>
            <p className="text-sm text-base-content/50 mb-4">{t('products:dci.generics.add_desc')}</p>
            <ProductSearchCombobox
              placeholder={t('products:dci.generics.search_generic')}
              excludeId={reference.id}
              onSelect={handleLink}
              disabled={busyId !== null}
            />
          </div>

          {/* Liste des génériques actuels */}
          <div className="bg-base-100 rounded-3xl border border-base-200 overflow-hidden">
            <div className="p-6 border-b border-base-200 flex items-center gap-3">
              <h2 className="font-bold text-lg">{t('products:dci.generics.current_title')}</h2>
              <Badge variant="secondary" size="sm" className="font-bold">{generics?.length ?? 0}</Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-base-200 bg-base-200/30">
                    <th className="text-xs uppercase tracking-wider text-base-content/50 font-bold px-4 py-2 text-left">{t('common:product')}</th>
                    <th className="text-xs uppercase tracking-wider text-base-content/50 font-bold px-4 py-2 text-left">CIP</th>
                    <th className="text-xs uppercase tracking-wider text-base-content/50 font-bold px-4 py-2 text-left">{t('products:dci.generics.col_shared')}</th>
                    <th className="text-xs uppercase tracking-wider text-base-content/50 font-bold px-4 py-2 text-left">{t('products:dci.col_stock')}</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {loadingGenerics ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <tr key={i} className="border-b border-base-200">
                        <td className="px-4 py-3"><Skeleton className="h-4 w-48" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-10" /></td>
                        <td className="px-4 py-3" />
                      </tr>
                    ))
                  ) : generics && generics.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8">
                        <EmptyState compact variant="base" title={t('products:dci.generics.empty')} />
                      </td>
                    </tr>
                  ) : (
                    generics?.map(g => (
                      <tr key={g.id} className="border-b border-base-200 hover:bg-base-200/30 transition-colors">
                        <td className="px-4 py-3 font-bold text-sm">{g.name}</td>
                        <td className="px-4 py-3 font-mono text-xs text-base-content/50">{g.cip1 || '-'}</td>
                        <td className="px-4 py-3 text-xs">
                          <div className="flex flex-wrap gap-1">
                            {g.declared && (
                              <Badge variant="outline" size="sm" className="border-success/40 text-success">
                                {t('products:dci.generics.declared')}
                              </Badge>
                            )}
                            {g.shared.map(s => (
                              <Badge key={s} variant="outline" size="sm" className="border-primary/30 text-primary">{s}</Badge>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-base-content/70">{g.stock}</td>
                        <td className="px-4 py-3 text-right">
                          {busyId === g.id ? (
                            <Loader2 className="size-4 animate-spin inline-block text-primary" />
                          ) : g.declared ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-error hover:text-error"
                              onClick={() => handleUnlink(g)}
                            >
                              {t('products:dci.generics.unlink')}
                            </Button>
                          ) : (
                            <span className="text-xs text-base-content/30">
                              {t('products:dci.generics.not_declared')}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Combobox de recherche produit (endpoint produits/?search=)
// ---------------------------------------------------------------------------

interface ProductSearchComboboxProps {
  placeholder: string;
  onSelect: (product: ProductLite) => void;
  excludeId?: number;
  disabled?: boolean;
}

function ProductSearchCombobox({ placeholder, onSelect, excludeId, disabled }: ProductSearchComboboxProps) {
  const { t } = useTranslation(['products', 'common']);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProductLite[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const doSearch = useCallback((q: string) => {
    const term = q.trim();
    if (term.length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    api.get('produits/', { params: { search: term, page_size: 15 } })
      .then(r => {
        const data = r.data;
        const list: ProductLite[] = Array.isArray(data) ? data : (data.results || []);
        setResults(list.filter(p => p.id !== excludeId));
        setHighlightIndex(-1);
      })
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [excludeId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 300);
  };

  const handleSelect = (p: ProductLite) => {
    onSelect(p);
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex(i => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex(i => (i - 1 + results.length) % results.length);
    } else if (e.key === 'Enter' && highlightIndex >= 0) {
      e.preventDefault();
      handleSelect(results[highlightIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={containerRef} className="relative inline-block w-full max-w-[360px]">
      <input
        type="text"
        className="w-full rounded-xl bg-base-200/50 border-none h-9 text-sm px-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
        placeholder={placeholder}
        value={query}
        onChange={handleChange}
        onFocus={() => { if (query) setOpen(true); }}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-label={placeholder}
        aria-expanded={open}
        aria-autocomplete="list"
        role="combobox"
      />
      {open && (
        <ul className="absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-base-100 border border-base-300 rounded-xl shadow-lg" role="listbox">
          {loading ? (
            <li className="px-3 py-2 space-y-1.5">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3.5 w-1/2" />
            </li>
          ) : results.length === 0 ? (
            <li className="px-3 py-2 text-xs text-base-content/40">{t('common:no_results')}</li>
          ) : (
            results.map((p, idx) => (
              <li key={p.id} role="option" aria-selected={idx === highlightIndex}>
                <button
                  type="button"
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-base-200 rounded-lg ${idx === highlightIndex ? 'bg-base-200' : ''}`}
                  onMouseEnter={() => setHighlightIndex(idx)}
                  onClick={() => handleSelect(p)}
                >
                  {p.name}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
