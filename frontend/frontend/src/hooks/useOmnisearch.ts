import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDebounce } from 'use-debounce';

import omnisearchService, { type GlobalSearchResponse } from '../services/omnisearchService';
import type { ProduitModel, Client, Facture, Commande, Fournisseur } from '../types';

interface CacheEntry {
  data: GlobalSearchResponse;
  timestamp: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 30;          // plus petit = moins de mémoire
const MIN_SEARCH_LENGTH = 2;        // ne pas chercher avant 2 caractères
const DEBOUNCE_MS = 300;

export default function useOmnisearch() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeValue, setActiveValue] = useState<string | undefined>(undefined);
  const [debouncedSearch] = useDebounce(search, DEBOUNCE_MS);
  const { t } = useTranslation('common');
  const navigate = useNavigate();

  const [produits, setProduits] = useState<ProduitModel[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [factures, setFactures] = useState<Facture[]>([]);
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cache avec TTL
  const [searchCache, setSearchCache] = useState<Map<string, CacheEntry>>(new Map());

  // Ref pour suivre le dernier debouncedSearch traité et éviter les race conditions
  const lastProcessedRef = useRef<string>('');

  // Toggle au clavier (Ctrl+K ou Cmd+K) + fermeture par Escape
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInModal = activeElement?.closest('[role="dialog"]') !== null;
      const isTyping = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA';

      if (e.code === 'KeyK' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (!isInModal || open) {
          setOpen((prev) => !prev);
        }
      }

      if (e.key === 'Escape' && open && !isInModal) {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open]);

  // Nettoyer les résultats quand on ferme
  useEffect(() => {
    if (!open) {
      setProduits([]);
      setClients([]);
      setFactures([]);
      setCommandes([]);
      setFournisseurs([]);
      setSearch('');
      setActiveValue(undefined);
      setError(null);
      lastProcessedRef.current = '';
    }
  }, [open]);

  // Recherche avec cache + AbortController
  useEffect(() => {
    // Si le modal est fermé, ne rien faire
    if (!open) return;

    const controller = new AbortController();

    async function fetchData() {
      const term = debouncedSearch.trim();

      // Réinitialiser si terme vide
      if (!term) {
        setProduits([]);
        setClients([]);
        setFactures([]);
        setCommandes([]);
        setFournisseurs([]);
        setLoading(false);
        lastProcessedRef.current = '';
        return;
      }

      // Ne pas chercher avant MIN_SEARCH_LENGTH caractères
      if (term.length < MIN_SEARCH_LENGTH) {
        setLoading(false);
        return;
      }

      const cacheKey = term.toLowerCase();
      const now = Date.now();

      // Vérifier le cache (avec TTL)
      if (searchCache.has(cacheKey)) {
        const cached = searchCache.get(cacheKey)!;
        if (now - cached.timestamp < CACHE_TTL_MS) {
          setProduits(cached.data.produits);
          setClients(cached.data.clients);
          setFactures(cached.data.factures);
          setCommandes(cached.data.commandes);
          setFournisseurs(cached.data.fournisseurs);
          setLoading(false);
          lastProcessedRef.current = term;
          return;
        }
        // Cache expiré → on va le remplacer
      }

      setLoading(true);
      setError(null);

      try {
        const results = await omnisearchService.search(term, 5, controller.signal);

        if (!controller.signal.aborted) {
          setProduits(results.produits);
          setClients(results.clients);
          setFactures(results.factures);
          setCommandes(results.commandes);
          setFournisseurs(results.fournisseurs);
          lastProcessedRef.current = term;

          // Mettre en cache avec timestamp
          setSearchCache((prev) => {
            const newCache = new Map(prev);
            newCache.set(cacheKey, { data: results, timestamp: Date.now() });
            // Garder seulement les MAX_CACHE_SIZE entrées les plus récentes
            if (newCache.size > MAX_CACHE_SIZE) {
              const entries = Array.from(newCache.entries());
              entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
              const toDelete = entries.slice(0, entries.length - MAX_CACHE_SIZE);
              toDelete.forEach(([key]) => newCache.delete(key));
            }
            return newCache;
          });
        }
      } catch (err: any) {
        if (err.name !== 'AbortError' && !controller.signal.aborted) {
          console.error('Erreur Omnisearch:', err);
          setError(t('omnisearch.error', 'Erreur de recherche'));
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchData();
    return () => controller.abort();
  }, [debouncedSearch, open, t, searchCache]);

  // Synchronisation auto de la sélection
  useEffect(() => {
    if (!open || (!produits.length && !clients.length && !factures.length && !commandes.length && !fournisseurs.length)) {
      setActiveValue(undefined);
      return;
    }

    const currentParts = activeValue?.split('-') || [];
    const currentType = currentParts[0];
    const currentId = currentParts[1];

    let itemStillExists = false;
    if (currentId) {
      switch (currentType) {
        case 'prod':
          itemStillExists = produits.some((p) => p.id.toString() === currentId);
          break;
        case 'client':
          itemStillExists = clients.some((c) => c.id.toString() === currentId);
          break;
        case 'facture':
          itemStillExists = factures.some((f) => f.id.toString() === currentId);
          break;
        case 'commande':
          itemStillExists = commandes.some((o) => o.id.toString() === currentId);
          break;
        case 'fournisseur':
          itemStillExists = fournisseurs.some((s) => s.id.toString() === currentId);
          break;
        default:
          itemStillExists = !!activeValue?.startsWith('action-') || !!activeValue?.startsWith('nav-');
      }
    }

    if (!itemStillExists) {
      if (produits.length > 0) setActiveValue(`prod-${produits[0].id}`);
      else if (clients.length > 0) setActiveValue(`client-${clients[0].id}`);
      else if (factures.length > 0) setActiveValue(`facture-${factures[0].id}`);
      else if (commandes.length > 0) setActiveValue(`commande-${commandes[0].id}`);
      else if (fournisseurs.length > 0) setActiveValue(`fournisseur-${fournisseurs[0].id}`);
    }
  }, [produits, clients, factures, commandes, fournisseurs, open]);

  const onSelectLink = useCallback(
    (path: string) => {
      setOpen(false);
      navigate(path);
    },
    [navigate]
  );

  const onSelectAction = useCallback(
    (action: string) => {
      setOpen(false);
      if (action === 'NEW_SALE') {
        if (window.location.pathname === '/app/facturation') {
          window.location.reload();
        } else {
          navigate('/app/facturation', { state: { action } });
        }
      } else if (action === 'NEW_PRODUCT') {
        navigate('/app/produits', { state: { action } });
      } else if (action === 'NEW_CLIENT') {
        navigate('/app/clients', { state: { action } });
      } else if (action === 'NEW_ORDER') {
        navigate('/app/commandes', { state: { action } });
      }
    },
    [navigate]
  );

  const onSelectProduit = useCallback(
    (id: number) => {
      setOpen(false);
      navigate('/app/produits', { state: { searchProduitId: id } });
    },
    [navigate]
  );

  const onSelectClient = useCallback(
    (id: number) => {
      setOpen(false);
      navigate('/app/clients', { state: { selectedClientId: id } });
    },
    [navigate]
  );

  const onSelectFacture = useCallback(
    (id: number) => {
      setOpen(false);
      navigate('/app/ventes', { state: { selectedFactureId: id } });
    },
    [navigate]
  );

  const onSelectCommande = useCallback(
    (id: number) => {
      setOpen(false);
      navigate('/app/commandes', { state: { selectedCommandeId: id } });
    },
    [navigate]
  );

  const onSelectFournisseur = useCallback(
    (id: number) => {
      setOpen(false);
      navigate('/app/commandes', { state: { selectedFournisseurId: id } });
    },
    [navigate]
  );

  const getSelectedData = useCallback(() => {
    if (!activeValue) return null;
    if (activeValue.startsWith('prod-')) {
      const id = parseInt(activeValue.split('-')[1]);
      return { type: 'product' as const, data: produits.find((p) => p.id === id) };
    }
    if (activeValue.startsWith('client-')) {
      const id = parseInt(activeValue.split('-')[1]);
      return { type: 'client' as const, data: clients.find((c) => c.id === id) };
    }
    if (activeValue.startsWith('facture-')) {
      const id = parseInt(activeValue.split('-')[1]);
      return { type: 'facture' as const, data: factures.find((f) => f.id === id) };
    }
    if (activeValue.startsWith('commande-')) {
      const id = parseInt(activeValue.split('-')[1]);
      return { type: 'commande' as const, data: commandes.find((o) => o.id === id) };
    }
    if (activeValue.startsWith('fournisseur-')) {
      const id = parseInt(activeValue.split('-')[1]);
      return { type: 'fournisseur' as const, data: fournisseurs.find((s) => s.id === id) };
    }
    return { type: 'action' as const, id: activeValue };
  }, [activeValue, produits, clients, factures, commandes, fournisseurs]);

  const selectedItem = getSelectedData();

  const hasResults =
    produits.length > 0 ||
    clients.length > 0 ||
    factures.length > 0 ||
    commandes.length > 0 ||
    fournisseurs.length > 0;

  return {
    open,
    setOpen,
    search,
    setSearch,
    activeValue,
    setActiveValue,
    loading,
    error,
    produits,
    clients,
    factures,
    commandes,
    fournisseurs,
    selectedItem,
    hasResults,
    onSelectLink,
    onSelectAction,
    onSelectProduit,
    onSelectClient,
    onSelectFacture,
    onSelectCommande,
    onSelectFournisseur,
    t,
  };
}
