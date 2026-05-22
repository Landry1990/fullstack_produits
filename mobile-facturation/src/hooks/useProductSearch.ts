/**
 * Hook de recherche de produits dans le catalogue SQLite local
 * Recherche par code-barres ou désignation avec debounce
 */
import { useState, useCallback, useRef } from 'react';
import { productRepo } from '../database';
import type { Product } from '../types';

interface UseProductSearchReturn {
  /** Résultats de la recherche */
  results: Product[];
  /** Recherche en cours */
  isSearching: boolean;
  /** Erreur de recherche */
  error: string | null;
  /** Rechercher par texte (désignation ou code-barres partiel) */
  search: (query: string) => Promise<void>;
  /** Rechercher par code-barres exact (scan) */
  findByBarcode: (barcode: string) => Promise<Product | null>;
  /** Effacer les résultats */
  clear: () => void;
}

export function useProductSearch(): UseProductSearchReturn {
  const [results, setResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Recherche par texte avec debounce (300ms)
   */
  const search = useCallback(async (query: string) => {
    // Annuler la recherche précédente
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      setError(null);

      try {
        const products = await productRepo.search(trimmed, 20);
        setResults(products);
      } catch (err) {
        console.error('[ProductSearch] Erreur recherche:', err);
        setError('Erreur de recherche dans le catalogue local');
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, []);

  /**
   * Recherche par code-barres exact (utilisé après un scan)
   * Pas de debounce — résultat immédiat
   */
  const findByBarcode = useCallback(async (barcode: string): Promise<Product | null> => {
    setIsSearching(true);
    setError(null);

    try {
      const product = await productRepo.findByBarcode(barcode.trim());
      if (product) {
        setResults([product]);
      } else {
        setResults([]);
        setError(`Produit non trouvé : ${barcode}`);
      }
      return product;
    } catch (err) {
      console.error('[ProductSearch] Erreur recherche code-barres:', err);
      setError('Erreur de recherche');
      return null;
    } finally {
      setIsSearching(false);
    }
  }, []);

  /**
   * Effacer les résultats
   */
  const clear = useCallback(() => {
    setResults([]);
    setError(null);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
  }, []);

  return {
    results,
    isSearching,
    error,
    search,
    findByBarcode,
    clear,
  };
}
