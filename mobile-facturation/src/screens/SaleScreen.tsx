import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Keyboard,
  ActivityIndicator,
  Vibration,
} from 'react-native';
import { useProductSearch } from '../hooks';
import { useCartStore, useConnectionStore } from '../stores';
import { ProductCard, NetworkIndicator } from '../components';
import type { Product } from '../types';

interface SaleScreenProps {
  onNavigateToCart: () => void;
  onBack: () => void;
}

export function SaleScreen({ onNavigateToCart, onBack }: SaleScreenProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const inputRef = useRef<TextInput>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const skipAutoFocusRef = useRef(false); // Flag pour éviter le refocus après clic manuel

  const { isOnline, pendingCount } = useConnectionStore();
  const cartItemsCount = useCartStore((state) => state.articlesCount());
  const cartTotal = useCartStore((state) => state.totalTTC());
  // Utiliser getState pour les actions afin d'éviter le stale closure
  const addProductToCart = useCallback((product: Product, qty: number) => {
    useCartStore.getState().addProduct(product, qty);
  }, []);

  const { results, isSearching, error, search, findByBarcode, clear } = useProductSearch();

  const triggerToast = (message: string) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToastMessage(message);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2200);
  };

  // ─── Auto-focus infini pour PDA ───────────────────────
  useEffect(() => {
    const focusTimer = setTimeout(() => {
      if (!skipAutoFocusRef.current) {
        inputRef.current?.focus();
      }
    }, 400);

    // Si le clavier se ferme, on tente de garder le focus pour le lecteur laser
    const keyboardSub = Keyboard.addListener('keyboardDidHide', () => {
      if (!skipAutoFocusRef.current) {
        inputRef.current?.focus();
      }
    });

    return () => {
      clearTimeout(focusTimer);
      keyboardSub.remove();
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // ─── Traitement du Scan / Soumission ───────────────────
  const handleSubmitSearch = async () => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;

    // Recherche par code-barres exact
    const product = await findByBarcode(trimmed);
    if (product) {
      if (product.stock_local > 0 || !product.stock_local) {
        addProductToCart(product, 1);
        Vibration.vibrate(80); // Retour haptique court (Bip physique de confirmation)
        triggerToast(`Ajouté : ${product.designation}`);
        setSearchQuery('');
        clear();
        // Garder le focus pour scan à la chaîne
        setTimeout(() => {
          inputRef.current?.focus();
        }, 100);
      } else {
        alert(`Produit en rupture de stock : ${product.designation}`);
        setSearchQuery('');
        clear();
      }
    } else {
      // Si ce n'est pas un code-barres trouvé directement
      if (/^\d+$/.test(trimmed) && trimmed.length >= 6) {
        // Semble être un code-barres mais inconnu en base
        alert(`Code-barres inconnu : ${trimmed}`);
        setSearchQuery('');
        clear();
      } else {
        // C'est probablement une recherche textuelle, on laisse la liste afficher les résultats partiels
        search(trimmed);
      }
    }
  };

  // ─── Recherche textuelle dynamique ─────────────────────
  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (text.trim().length > 0) {
      search(text);
    } else {
      clear();
    }
  };

  const handleProductPress = (product: Product) => {
    skipAutoFocusRef.current = true; // Désactiver l'autofocus temporairement
    Keyboard.dismiss(); // Masquer le clavier pour révéler le bouton Panier !
    addProductToCart(product, 1);
    Vibration.vibrate(80);
    triggerToast(`Ajouté : ${product.designation}`);
    setSearchQuery('');
    clear();
    // Réactiver l'autofocus après un délai
    setTimeout(() => {
      skipAutoFocusRef.current = false;
      inputRef.current?.focus();
    }, 1500);
  };

  const showSearchResults = searchQuery.trim().length > 0 || results.length > 0;

  return (
    <View style={styles.container}>
      {/* Toast de confirmation flottant en haut de l'écran */}
      {toastMessage && (
        <View style={styles.toast}>
          <Text style={styles.toastText} numberOfLines={1}>
            {toastMessage}
          </Text>
        </View>
      )}

      {/* Header compact avec indicateur réseau */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Retour</Text>
        </TouchableOpacity>
        <NetworkIndicator isOnline={isOnline} pendingCount={pendingCount} />
      </View>

      {/* Barre de recherche et de scan laser */}
      <View style={styles.searchContainer}>
        <TextInput
          ref={inputRef}
          style={styles.searchInput}
          placeholder="Scannez ou saisissez un produit..."
          placeholderTextColor="#64748b"
          value={searchQuery}
          onChangeText={handleSearchChange}
          onSubmitEditing={handleSubmitSearch}
          autoCorrect={false}
          blurOnSubmit={false} // RESTE FOCUS pour pouvoir scanner à la chaîne !
          autoFocus={true}
        />
        {isSearching && (
          <ActivityIndicator style={styles.searchLoading} size="small" color="#10b981" />
        )}
      </View>

      {!!error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>⚠ {error}</Text>
        </View>
      )}

      {/* Zone centrale : Résultats ou Statut Laser PDA */}
      <View style={styles.mainContent}>
        {showSearchResults ? (
          <FlatList
            data={results}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <ProductCard product={item} onPress={handleProductPress} />
            )}
            ListEmptyComponent={
              !isSearching && searchQuery.length > 2 ? (
                <Text style={styles.emptyText}>Aucun produit trouvé</Text>
              ) : null
            }
          />
        ) : (
          <View style={styles.scannerPromptContainer}>
            <View style={styles.laserPulse} />
            <Text style={styles.scannerPromptEmoji}>⚡</Text>
            <Text style={styles.scannerPromptTitle}>Lecteur Laser PDA Actif</Text>
            <Text style={styles.scannerPromptSubtitle}>
              Le lecteur physique de votre appareil est opérationnel. Pressez le bouton jaune/gâchette de votre PDA pour scanner un produit.
            </Text>
            <View style={styles.tipBox}>
              <Text style={styles.scannerPromptTip}>
                💡 Astuce : Le focus est maintenu automatiquement. Vous pouvez scanner les articles l'un après l'autre sans toucher l'écran.
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Footer : Accès au panier */}
      {cartItemsCount > 0 && (
        <View style={styles.footer}>
          <TouchableOpacity style={styles.cartButton} onPress={onNavigateToCart}>
            <View style={styles.cartSummary}>
              <Text style={styles.cartCount}>{cartItemsCount}</Text>
              <Text style={styles.cartLabel}>articles dans le panier</Text>
            </View>
            <Text style={styles.cartTotal}>{cartTotal} FCFA →</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  backButton: {
    paddingVertical: 8,
    paddingRight: 16,
  },
  backButtonText: {
    color: '#34d399',
    fontSize: 16,
    fontWeight: '600',
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
    position: 'relative',
    justifyContent: 'center',
  },
  searchInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 14,
    paddingRight: 40,
    color: '#f1f5f9',
    fontSize: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  searchLoading: {
    position: 'absolute',
    right: 30,
  },
  mainContent: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scannerPromptContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  laserPulse: {
    width: '80%',
    height: 2,
    backgroundColor: '#ef4444',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    position: 'absolute',
    top: '40%',
  },
  scannerPromptEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  scannerPromptTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#f1f5f9',
    marginBottom: 12,
  },
  scannerPromptSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  tipBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.15)',
  },
  scannerPromptTip: {
    fontSize: 12,
    color: '#34d399',
    textAlign: 'center',
    lineHeight: 18,
  },
  listContent: {
    paddingBottom: 24,
  },
  emptyText: {
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 32,
    fontSize: 15,
  },
  footer: {
    padding: 16,
    paddingBottom: 32,
    backgroundColor: 'rgba(15, 15, 26, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  cartButton: {
    backgroundColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
  },
  cartSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cartCount: {
    backgroundColor: '#fff',
    color: '#10b981',
    fontWeight: '800',
    fontSize: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  cartLabel: {
    color: '#e0e7ff',
    fontSize: 15,
    fontWeight: '500',
  },
  cartTotal: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '600',
  },
  toast: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    backgroundColor: '#10b981',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  toastText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
});
