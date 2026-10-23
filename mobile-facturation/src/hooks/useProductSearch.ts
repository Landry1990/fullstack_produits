import { useState, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import i18n from '../i18n';
import { useCartStore } from '../stores/useCartStore';
import {
  searchProducts, getProductByBarcode, getProductById, getLotByDatamatrix, getLots,
} from '../services/api';
import { parseGS1Datamatrix } from '../utils/gs1Parser';
import type { Product, ScanResult } from '../types';

// Recherche produit + résolution de codes scannés (caméra ou douchette) :
// état query/results, debounce 300 ms, ajout au panier avec chargement des
// lots à la demande (serializer liste sans stock_lots → aperçu FEFO).
export function useProductSearch(opts?: { onAdded?: () => void }) {
  const cart = useCartStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);

  // N° de requête : une réponse lente d'une frappe plus ancienne ne doit
  // jamais écraser les résultats de la requête courante.
  const reqSeq = useRef(0);
  // Mini-cache des dernières recherches : « dol » → « doli » → effacer ne
  // refait pas un aller-retour serveur pour un résultat déjà connu.
  const cacheRef = useRef<Map<string, Product[]>>(new Map());

  useEffect(() => {
    const timer = setTimeout(async () => {
      const q = searchQuery.trim();
      if (q.length < 2) {
        setResults([]);
        return;
      }
      const cached = cacheRef.current.get(q);
      if (cached) {
        setResults(cached);
        return;
      }
      const seq = ++reqSeq.current;
      setSearching(true);
      try {
        const data = await searchProducts(q);
        if (seq !== reqSeq.current) return; // réponse obsolète
        setResults(data);
        const cache = cacheRef.current;
        cache.set(q, data);
        if (cache.size > 50) cache.delete(cache.keys().next().value!);
      } catch {} finally {
        if (seq === reqSeq.current) setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleAddProduct = (product: Product) => {
    cart.addProduct(product);
    setSearchQuery('');
    setResults([]);
    // Le produit vient d'entrer dans le panier : le focus revient dans
    // le champ recherche pour enchaîner le produit suivant (flux caisse).
    opts?.onAdded?.();
    // Le serializer liste (recherche) ne renvoie pas stock_lots → chargés
    // à la demande pour l'aperçu FEFO du badge lot (parité avec le scan).
    if (!product.stock_lots) {
      getLots(product.id)
        .then((lots) => useCartStore.getState().setProductLots(product.id, lots))
        .catch(() => {});
    }
  };

  // Résout un code scanné (caméra ou douchette) SANS toucher au panier :
  // - Datamatrix GS1 (médicament sérialisé) : résout produit + lot exact
  //   via /stock-lots/by-datamatrix/ comme la facturation web.
  // - Code linéaire (CIP/EAN) : GET /produits/by-cip/<code>/.
  // Retourne le ScanResult à ajouter, null si inconnu.
  const resolveBarcode = async (code: string): Promise<ScanResult | null> => {
    try {
      const parsed = parseGS1Datamatrix(code);

      if (parsed.cip && parsed.lot) {
        const dm = await getLotByDatamatrix(parsed.cip, parsed.lot);
        // Le payload by-datamatrix n'inclut pas la TVA → détail complet.
        const full = await getProductById(dm.produit.id).catch(() => null);
        const product: Product = full ?? {
          id: dm.produit.id,
          name: dm.produit.name,
          cip1: dm.produit.cip1,
          selling_price: dm.selling_price,
          stock: dm.produit.stock,
          tva: '0',
        };
        return {
          product,
          lot: {
            id: dm.lot_id,
            produit: product.id,
            lot: dm.lot_numero,
            quantity_remaining: dm.quantity_remaining,
            date_expiration: dm.date_expiration,
          },
          prix: parseFloat(dm.selling_price),
          label: `${product.name} — Lot ${dm.lot_numero}`,
        };
      }

      const product = await getProductByBarcode(parsed.cip ?? code);
      if (!product) return null;
      return {
        product,
        lot: null,
        prix: parseFloat(product.selling_price),
        label: product.name,
      };
    } catch (err) {
      // 404 = produit/lot inconnu → feedback « Code inconnu » dans le modal.
      // Tout le reste (réseau, 401, 5xx) mérite une alerte explicite.
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status !== 404) {
        Alert.alert(i18n.t('common.error'), i18n.t('common.server_unreachable'));
      }
      return null;
    }
  };

  // Ajoute un produit résolu au panier (lot + prix de lot si datamatrix).
  // updatePrix reste « brut » ici : le prix de lot n'est pas une
  // modification manuelle, pas de validation Sudo.
  const addScanResult = (result: ScanResult, qty: number) => {
    cart.addProduct(result.product, qty);
    if (result.lot) {
      cart.setLot(result.product.id, result.lot);
      cart.updatePrix(result.product.id, result.prix);
    }
  };

  // Douchette / scanner clavier : Enter déclenche le même traitement que la
  // caméra (datamatrix ou CIP), en ajout direct ×1 (pas de carte de
  // confirmation : la douchette n'a pas d'écran). Si trouvé → ajout +
  // reset ; sinon la recherche texte reste affichée.
  const handleSearchSubmit = async () => {
    const code = searchQuery.trim();
    if (!code) return;
    const result = await resolveBarcode(code);
    if (result) {
      addScanResult(result, 1);
      setSearchQuery('');
      setResults([]);
      opts?.onAdded?.();
    }
  };

  return {
    searchQuery, setSearchQuery, results, searching,
    isSearching: searchQuery.length >= 2,
    handleAddProduct, resolveBarcode, addScanResult, handleSearchSubmit,
  };
}
