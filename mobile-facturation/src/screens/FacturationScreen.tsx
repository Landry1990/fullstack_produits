import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Alert, ActivityIndicator,
} from 'react-native';
import { Search, Send, Trash2, User, Wifi, WifiOff, ArrowLeft } from 'lucide-react-native';
import { useCartStore, useAuthStore } from '../stores';
import { pdaWS, searchProducts, getProductByBarcode, searchClients } from '../services';
import { ProductRow, CartItemRow, LotModal } from '../components';
import type { Product, StockLot, Client, AyantDroit } from '../types';

export function FacturationScreen({ onLogout }: { onLogout: () => void }) {
  const cart = useCartStore();
  const { username, logout } = useAuthStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);

  const [lotModalVisible, setLotModalVisible] = useState(false);
  const [lotModalProduct, setLotModalProduct] = useState<Product | null>(null);
  const [lotModalCurrentId, setLotModalCurrentId] = useState<number | null>(null);

  const [clientModalVisible, setClientModalVisible] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState<Client[]>([]);
  const [clientSearching, setClientSearching] = useState(false);

  const [wsStatus, setWsStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [sending, setSending] = useState(false);

  // WebSocket
  useEffect(() => {
    const unsub = pdaWS.onStatus(setWsStatus);
    pdaWS.connect();
    return () => {
      unsub();
      pdaWS.disconnect();
    };
  }, []);

  // Recherche produits
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

  // Recherche clients
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (clientSearch.length >= 2) {
        setClientSearching(true);
        try {
          const data = await searchClients(clientSearch);
          setClientResults(data);
        } catch {}
        setClientSearching(false);
      } else {
        setClientResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [clientSearch]);

  const handleAddProduct = (product: Product) => {
    cart.addProduct(product);
    setSearchQuery('');
    setResults([]);
  };

  const handleOpenLot = (productId: number) => {
    const line = cart.lines.find((l) => l.product.id === productId);
    if (line) {
      setLotModalProduct(line.product);
      setLotModalCurrentId(line.lotId);
      setLotModalVisible(true);
    }
  };

  const handleSelectLot = (lot: StockLot | null) => {
    if (lotModalProduct) {
      cart.setLot(lotModalProduct.id, lot);
    }
  };

  const handleSelectClient = (client: Client) => {
    cart.setClient(client);
    setClientModalVisible(false);
    setClientSearch('');
    setClientResults([]);
  };

  const handleSendToCashier = async () => {
    if (cart.lines.length === 0) {
      Alert.alert('Panier vide', 'Ajoutez des produits avant d\'envoyer');
      return;
    }

    if (wsStatus !== 'connected') {
      Alert.alert('Non connecté', 'Vérifiez la connexion WebSocket');
      return;
    }

    setSending(true);
    try {
      const payload = {
        type: 'cashier_item_new' as const,
        pda_id: pdaWS.id,
        item_id: `item-${Date.now()}`,
        articles: cart.lines.map((l) => ({
          produit_id: l.product.id,
          code_barre: l.product.code_barre,
          designation: l.product.designation,
          quantite: l.quantite,
          prix_unitaire: l.prix_unitaire,
          remise: l.remise,
          lot_id: l.lotId,
          lot_text: l.lotText,
          total_ttc: l.total_ttc,
        })),
        client: cart.client,
        ayant_droit: cart.ayantDroit,
        total_estime: cart.totalTTC(),
        articles_count: cart.totalArticles(),
        timestamp: new Date().toISOString(),
      };

      const sent = pdaWS.send(payload);
      if (sent) {
        Alert.alert('Envoyé', 'Panier envoyé à la caisse');
        cart.clear();
      } else {
        Alert.alert('Erreur', 'Impossible d\'envoyer');
      }
    } catch (err) {
      Alert.alert('Erreur', 'Échec de l\'envoi');
    } finally {
      setSending(false);
    }
  };

  const handleLogout = () => {
    logout();
    onLogout();
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.userBadge}>
            <User size={16} color="#94a3b8" />
            <Text style={styles.userText}>{username}</Text>
          </View>
          <View style={[styles.wsBadge, wsStatus === 'connected' ? styles.wsOk : styles.wsErr]}>
            {wsStatus === 'connected' ? <Wifi size={14} color="#10b981" /> : <WifiOff size={14} color="#ef4444" />}
          </View>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <ArrowLeft size={20} color="#ef4444" />
        </TouchableOpacity>
      </View>

      {/* Split vertical */}
      <View style={styles.split}>
        {/* Gauche : Recherche + Produits */}
        <View style={styles.leftPanel}>
          <View style={styles.searchBar}>
            <Search size={18} color="#64748b" />
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher produit..."
              placeholderTextColor="#64748b"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
          </View>

          {searching ? (
            <ActivityIndicator color="#6366f1" style={{ marginVertical: 20 }} />
          ) : results.length === 0 && searchQuery.length >= 2 ? (
            <Text style={styles.empty}>Aucun résultat</Text>
          ) : (
            <FlatList
              data={results}
              keyExtractor={(i) => String(i.id)}
              renderItem={({ item }) => <ProductRow product={item} onPress={handleAddProduct} />}
              contentContainerStyle={styles.list}
            />
          )}
        </View>

        {/* Droite : Panier */}
        <View style={styles.rightPanel}>
          {/* Client */}
          <TouchableOpacity
            style={styles.clientBtn}
            onPress={() => setClientModalVisible(true)}
          >
            <User size={16} color="#64748b" />
            <Text style={styles.clientText}>
              {cart.client ? `${cart.client.nom} ${cart.client.prenom || ''}` : 'Sélectionner client'}
            </Text>
          </TouchableOpacity>

          {/* Lignes panier */}
          <FlatList
            data={cart.lines}
            keyExtractor={(l) => String(l.product.id)}
            renderItem={({ item }) => (
              <CartItemRow
                line={item}
                onIncrement={() => cart.updateQty(item.product.id, item.quantite + 1)}
                onDecrement={() => cart.updateQty(item.product.id, item.quantite - 1)}
                onRemove={() => cart.removeLine(item.product.id)}
                onOpenLot={() => handleOpenLot(item.product.id)}
              />
            )}
            contentContainerStyle={styles.cartList}
            ListEmptyComponent={<Text style={styles.emptyCart}>Panier vide</Text>}
          />

          {/* Footer panier */}
          <View style={styles.cartFooter}>
            <View style={styles.totals}>
              <Text style={styles.articles}>{cart.totalArticles()} article(s)</Text>
              <Text style={styles.total}>{cart.totalTTC().toLocaleString('fr-FR')} F</Text>
            </View>
            <View style={styles.footerActions}>
              <TouchableOpacity onPress={cart.clear} style={styles.clearBtn}>
                <Trash2 size={18} color="#ef4444" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sendBtn, sending && styles.sendBtnDisabled]}
                onPress={handleSendToCashier}
                disabled={sending}
              >
                {sending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Send size={18} color="#fff" />
                    <Text style={styles.sendBtnText}>Envoyer</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      {/* Modal Lot */}
      <LotModal
        visible={lotModalVisible}
        product={lotModalProduct}
        currentLotId={lotModalCurrentId}
        onSelect={handleSelectLot}
        onClose={() => setLotModalVisible(false)}
      />

      {/* Modal Client */}
      {clientModalVisible && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sélectionner client</Text>
              <TouchableOpacity onPress={() => setClientModalVisible(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.modalInput}
              placeholder="Rechercher client..."
              placeholderTextColor="#64748b"
              value={clientSearch}
              onChangeText={setClientSearch}
            />
            {clientSearching ? (
              <ActivityIndicator color="#6366f1" style={{ marginVertical: 20 }} />
            ) : (
              <FlatList
                data={clientResults}
                keyExtractor={(c) => String(c.id)}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.clientItem}
                    onPress={() => handleSelectClient(item)}
                  >
                    <Text style={styles.clientItemName}>{item.nom} {item.prenom || ''}</Text>
                    {item.telephone && <Text style={styles.clientItemPhone}>{item.telephone}</Text>}
                  </TouchableOpacity>
                )}
                contentContainerStyle={styles.modalList}
              />
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  userBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  userText: { fontSize: 13, color: '#f1f5f9', fontWeight: '600' },
  wsBadge: { padding: 6, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)' },
  wsOk: { backgroundColor: 'rgba(16,185,129,0.12)' },
  wsErr: { backgroundColor: 'rgba(239,68,68,0.12)' },
  logoutBtn: { padding: 6 },
  split: { flex: 1, flexDirection: 'row' },
  leftPanel: { flex: 1, borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.06)', padding: 12 },
  rightPanel: { flex: 1, padding: 12 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  searchInput: { flex: 1, marginLeft: 8, color: '#f1f5f9', fontSize: 14 },
  list: { paddingBottom: 12 },
  empty: { textAlign: 'center', color: '#64748b', marginTop: 24, fontSize: 13 },
  clientBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1e293b', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  clientText: { fontSize: 13, color: '#f1f5f9' },
  cartList: { flex: 1, paddingBottom: 12 },
  emptyCart: { textAlign: 'center', color: '#64748b', marginTop: 24, fontSize: 13 },
  cartFooter: { backgroundColor: '#1e293b', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  totals: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  articles: { fontSize: 12, color: '#64748b' },
  total: { fontSize: 18, fontWeight: '700', color: '#10b981' },
  footerActions: { flexDirection: 'row', gap: 8 },
  clearBtn: { padding: 10, backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: 8 },
  sendBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#6366f1', borderRadius: 8, paddingVertical: 12 },
  sendBtnDisabled: { opacity: 0.6 },
  sendBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalSheet: { backgroundColor: '#1e293b', borderRadius: 16, width: '100%', maxWidth: 400, maxHeight: '80%', padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#f1f5f9' },
  modalClose: { fontSize: 18, color: '#64748b' },
  modalInput: { backgroundColor: '#0f172a', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: '#f1f5f9', fontSize: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 12 },
  modalList: { maxHeight: 300 },
  clientItem: { padding: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 8, marginBottom: 4 },
  clientItemName: { fontSize: 14, fontWeight: '600', color: '#f1f5f9' },
  clientItemPhone: { fontSize: 12, color: '#64748b', marginTop: 2 },
});
