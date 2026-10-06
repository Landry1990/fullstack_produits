import { useState, useEffect } from 'react';
import { Alert, Keyboard } from 'react-native';
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
export function useProductSearch() {
  const cart = useCartStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.length >= 2) {
        setSearching(true);
        try {
          const data = await searchProducts(searchQuery);
          setResults(data);
        } catch {}
        setSearching(false);
      } else {
        setResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleAddProduct = (product: Product) => {
    cart.addProduct(product);
    setSearchQuery('');
    setResults([]);
    // Referme le clavier : le panier complet réapparaît (les sections
    // basses étaient masquées pendant la recherche).
    Keyboard.dismiss();
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
    }
  };

  return {
    searchQuery, setSearchQuery, results, searching,
    isSearching: searchQuery.length >= 2,
    handleAddProduct, resolveBarcode, addScanResult, handleSearchSubmit,
  };
}
