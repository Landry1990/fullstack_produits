import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, Pencil, Check, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { gooeyToast } from 'goey-toast';
import api from '../services/api';
import { Button } from './shadcn/button';
import { Badge } from './ui/Badge';
import { EmptyState } from './ui/EmptyState';
import { Skeleton } from './ui/Skeleton';
import { logger } from '../utils/logger';

interface Substance {
  id: number;
  nom: string;
  code_cas?: string | null;
  produits_count?: number;
}

interface SubstancesResponse {
  results: Substance[];
  count: number;
  next: string | null;
  previous: string | null;
}

/**
 * Référentiel des substances : recherche + renommage manuel des stubs
 * MQ-… (identifiants internes de la base médicamenteuse importée).
 * Le nom est utilisé dans les alertes d'interaction — écriture staff only,
 * chaque renommage est audité côté serveur.
 */
export default function SubstancesManager() {
  const { t } = useTranslation(['products', 'common']);
  const [search, setSearch] = useState('');
  const [unresolvedOnly, setUnresolvedOnly] = useState(true);
  const [data, setData] = useState<SubstancesResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSubstances = useCallback((q: string, pg: number, unresolved: boolean) => {
    setLoading(true);
    const params: Record<string, string | number> = { page: pg, page_size: 20 };
    if (q.trim()) params.search = q.trim();
    if (unresolved) params.unresolved = '1';
    api.get<SubstancesResponse>('substances/', { params })
      .then(r => setData(r.data))
      .catch(err => {
        logger.error('substances fetch failed', err);
        gooeyToast.error(t('products:dci.substances.error_load'));
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    fetchSubstances('', 1, true);
  }, [fetchSubstances]);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      fetchSubstances(val, 1, unresolvedOnly);
    }, 300);
  };

  const toggleUnresolved = () => {
    const next = !unresolvedOnly;
    setUnresolvedOnly(next);
    setPage(1);
    fetchSubstances(search, 1, next);
  };

  const goToPage = (pg: number) => {
    setPage(pg);
    fetchSubstances(search, pg, unresolvedOnly);
  };

  const startEdit = (s: Substance) => {
    setEditingId(s.id);
    setEditValue(s.nom);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const saveEdit = (s: Substance) => {
    const nom = editValue.trim();
    if (!nom || nom === s.nom) { cancelEdit(); return; }
    setSaving(true);
    api.patch(`substances/${s.id}/`, { nom })
      .then(() => {
        gooeyToast.success(t('products:dci.substances.renamed', { from: s.nom, to: nom }));
        setData(prev => prev ? {
          ...prev,
          results: prev.results.map(r => r.id === s.id ? { ...r, nom } : r),
        } : prev);
        cancelEdit();
      })
      .catch(err => {
        const msg = err.response?.data?.nom?.[0]
          || err.response?.data?.error
          || t('products:dci.substances.error_rename');
        gooeyToast.error(msg);
      })
      .finally(() => setSaving(false));
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.count / 20)) : 1;

  return (
    <div className="space-y-6">
      <div className="bg-base-100 rounded-3xl border border-base-200 p-6">
        <h2 className="font-bold text-lg mb-1">{t('products:dci.substances.title')}</h2>
        <p className="text-sm text-base-content/50 mb-4">{t('products:dci.substances.desc')}</p>
        <div className="flex items-center gap-4 flex-wrap">
          <input
            type="text"
            className="w-full max-w-[360px] rounded-xl bg-base-200/50 border-none h-9 text-sm px-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            placeholder={t('products:dci.substances.search_placeholder')}
            value={search}
            onChange={handleSearchChange}
            aria-label={t('products:dci.substances.search_placeholder')}
          />
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              className="checkbox checkbox-sm checkbox-primary"
              checked={unresolvedOnly}
              onChange={toggleUnresolved}
            />
            {t('products:dci.substances.unresolved_only')}
          </label>
          {data && (
            <Badge variant="secondary" size="sm" className="font-bold">
              {t('products:dci.substances.count', { count: data.count })}
            </Badge>
          )}
        </div>
      </div>

      <div className="bg-base-100 rounded-3xl border border-base-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-base-200 bg-base-200/30">
                <th className="text-xs uppercase tracking-wider text-base-content/50 font-bold px-4 py-2 text-left">{t('products:dci.substances.col_name')}</th>
                <th className="text-xs uppercase tracking-wider text-base-content/50 font-bold px-4 py-2 text-left">{t('products:dci.substances.col_products')}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-base-200">
                    <td className="px-4 py-3"><Skeleton className="h-4 w-64" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-10" /></td>
                    <td className="px-4 py-3" />
                  </tr>
                ))
              ) : !data || data.results.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-8">
                    <EmptyState compact variant="base" title={t('products:dci.substances.empty')} />
                  </td>
                </tr>
              ) : (
                data.results.map(s => (
                  <tr key={s.id} className="border-b border-base-200 hover:bg-base-200/30 transition-colors">
                    <td className="px-4 py-3 text-sm">
                      {editingId === s.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            className="flex-1 rounded-lg bg-base-200/50 border-none h-8 text-sm px-2 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') saveEdit(s);
                              if (e.key === 'Escape') cancelEdit();
                            }}
                            autoFocus
                            aria-label={t('products:dci.substances.edit_label')}
                          />
                          {saving ? (
                            <Loader2 className="size-4 animate-spin text-primary" />
                          ) : (
                            <>
                              <button
                                className="text-success hover:opacity-70"
                                onClick={() => saveEdit(s)}
                                aria-label={t('common:save')}
                              >
                                <Check className="size-4" />
                              </button>
                              <button
                                className="text-error hover:opacity-70"
                                onClick={cancelEdit}
                                aria-label={t('common:cancel')}
                              >
                                <X className="size-4" />
                              </button>
                            </>
                          )}
                        </div>
                      ) : (
                        <span className={`font-bold ${s.nom.startsWith('MQ-') ? 'text-warning font-mono' : ''}`}>
                          {s.nom}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-base-content/70">{s.produits_count ?? '-'}</td>
                    <td className="px-4 py-3 text-right">
                      {editingId !== s.id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEdit(s)}
                        >
                          <Pencil className="size-3.5" />
                          {t('products:dci.substances.rename')}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {data && data.count > 20 && (
          <div className="p-4 border-t border-base-200 flex items-center justify-between">
            <span className="text-sm text-base-content/50">
              {t('products:dci.page_x_of_y', { page, total: totalPages })}
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
                {t('products:dci.previous')}
              </Button>
              <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => goToPage(page + 1)}>
                {t('products:dci.next')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
