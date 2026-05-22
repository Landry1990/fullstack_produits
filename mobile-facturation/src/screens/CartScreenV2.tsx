/**
 * Écran du Panier V2 — Mode Autonome OU Envoi à la Caisse (WebSocket)
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  Modal,
  SafeAreaView,
} from 'react-native';
import { 
  ShoppingCart, 
  Send, 
  Store,
  Smartphone,
  Wifi,
  WifiOff,
  ArrowLeft,
  Trash2,
  User,
  Users,
  Clock,
  ChevronRight,
  CreditCard
} from 'lucide-react-native';
import { useCartStore, useCashierQueueStore } from '../stores';
import { useWebSocketPDA } from '../hooks';
import { CartItemRow, LotSelectionModal } from '../components';
import { formatPrice } from '../utils';
import { ClientSelectScreen } from './ClientSelectScreen';
import { PendingSalesScreen } from './PendingSalesScreen';
import type { Client, AyantDroit, Product, StockLot } from '../types';

const PDA_ID = `PDA-${Date.now().toString(36).toUpperCase().slice(-6)}`;

interface CartScreenV2Props {
  onBack: () => void;
  onValidationSuccess: () => void;
}

export function CartScreenV2({ onBack, onValidationSuccess }: CartScreenV2Props) {
  const [mode, setMode] = useState<'autonomous' | 'cashier'>('cashier');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [showLotModal, setShowLotModal] = useState(false);
  const [lotModalProduct, setLotModalProduct] = useState<Product | null>(null);

  const cart = useCartStore();
  const queueStore = useCashierQueueStore();

  // WebSocket
  const ws = useWebSocketPDA({
    pdaId: PDA_ID,
    autoConnect: mode === 'cashier',
    onStatusUpdate: (data) => {
      if (data.status === 'completed' && data.ticket) {
        Alert.alert(
          '✅ Vente Validée !',
          `Ticket: ${data.ticket.numero_ticket}\nTotal: ${data.ticket.total_ttc} FCFA`,
          [{ 
            text: 'OK', 
            onPress: () => {
              cart.clearCart();
              onValidationSuccess();
            }
          }]
        );
        setIsSubmitting(false);
      } else if (data.status === 'cancelled') {
        Alert.alert('❌ Annulée', 'La caisse a annulé cette vente');
        setIsSubmitting(false);
      }
    },
  });

  const hasItems = cart.lignes.length > 0;
  const itemCount = cart.articlesCount();
  const totalTTC = cart.totalTTC();
  const hasClient = cart.client !== null;

  const handleClearCart = () => {
    Alert.alert(
      'Vider le panier?',
      'Tous les articles seront supprimés',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Vider', style: 'destructive', onPress: cart.clearCart },
      ]
    );
  };

  const handleSelectClient = (client: Client | null, ayantDroit: AyantDroit | null) => {
    cart.setClient(client);
    cart.setAyantDroit(ayantDroit);
    setShowClientModal(false);
  };

  const handleSendToCashier = async () => {
    if (!hasItems) return;
    setIsSubmitting(true);

    try {
      const queueItem = cart.toCashierQueueItem(PDA_ID);
      
      queueStore.addToQueue(cart.lignes, cart.client, cart.ayantDroit);
      
      const result = await ws.sendToCashier(queueItem);

      if (result.success) {
        Alert.alert(
          '📤 Envoyé !',
          result.method === 'websocket' 
            ? 'La caisse a été notifiée en temps réel'
            : 'Envoi différé (mode dégradé)',
          [
            { text: 'Nouvelle vente', onPress: () => {
              cart.clearCart();
              onValidationSuccess();
            }},
            { text: 'Voir ventes', onPress: () => {
              cart.clearCart();
              setShowPendingModal(true);
            }}
          ]
        );
      } else {
        Alert.alert('Erreur', result.error || 'Échec envoi');
        setIsSubmitting(false);
      }
    } catch (error) {
      Alert.alert('Erreur', 'Impossible d\'envoyer');
      setIsSubmitting(false);
    }
  };

  const handleValidateAutonomous = () => {
    Alert.alert('Mode Autonome', 'Paiement direct sur PDA - À implémenter');
  };

  // ─── Gestion du modal Lot ─────────────────
  const handleOpenLotModal = (product: Product, currentLotId: number | null) => {
    setLotModalProduct(product);
    setShowLotModal(true);
  };

  const handleCloseLotModal = () => {
    setShowLotModal(false);
    setLotModalProduct(null);
  };

  const handleSelectLot = (lot: StockLot | null) => {
    if (lotModalProduct) {
      cart.setLotForLigne(
        lotModalProduct.id,
        lot?.id || null,
        lot?.lot || null
      );
    }
    handleCloseLotModal();
  };

  if (!hasItems) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack}>
            <ArrowLeft size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Panier</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.emptyContainer}>
          <ShoppingCart size={64} color="#334155" />
          <Text style={styles.emptyTitle}>Panier vide</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={onBack}>
            <Text style={styles.primaryButtonText}>Continuer</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <ArrowLeft size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Panier ({itemCount})</Text>
        <TouchableOpacity onPress={handleClearCart}>
          <Trash2 size={20} color="#ef4444" />
        </TouchableOpacity>
      </View>

      {/* Mode Toggle */}
      <View style={styles.modeSection}>
        <View style={styles.modeToggle}>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'cashier' && styles.modeBtnActive]}
            onPress={() => setMode('cashier')}
          >
            <Store size={16} color={mode === 'cashier' ? '#fff' : '#94a3b8'} />
            <Text style={[styles.modeText, mode === 'cashier' && styles.modeTextActive]}>
              Envoi Caisse
            </Text>
            {ws.isConnected && <View style={styles.wsDot} />}
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'autonomous' && styles.modeBtnActive]}
            onPress={() => setMode('autonomous')}
          >
            <Smartphone size={16} color={mode === 'autonomous' ? '#fff' : '#94a3b8'} />
            <Text style={[styles.modeText, mode === 'autonomous' && styles.modeTextActive]}>
              Paiement PDA
            </Text>
          </TouchableOpacity>
        </View>

        {/* WS Status */}
        {mode === 'cashier' && (
          <View style={styles.wsRow}>
            {ws.isConnected ? (
              <><Wifi size={14} color="#22c55e" /><Text style={styles.wsConnected}>Connecté</Text></>
            ) : ws.isFailed ? (
              <><WifiOff size={14} color="#f59e0b" /><Text style={styles.wsFailed}>Dégradé</Text></>
            ) : (
              <><Clock size={14} color="#94a3b8" /><Text style={styles.wsConnecting}>...</Text></>
            )}
          </View>
        )}
      </View>

      {/* Client */}
      <TouchableOpacity style={styles.clientRow} onPress={() => setShowClientModal(true)}>
        {hasClient ? (
          <>
            <View style={styles.clientIcon}>
              {cart.ayantDroit ? <Users size={18} color="#6366f1" /> : <User size={18} color="#6366f1" />}
            </View>
            <View style={styles.clientInfo}>
              <Text style={styles.clientName}>{cart.client?.name}</Text>
              {cart.ayantDroit && (
                <Text style={styles.ayantInfo}>{cart.ayantDroit.nom} ({cart.ayantDroit.taux_couverture}%)</Text>
              )}
            </View>
          </>
        ) : (
          <>
            <User size={20} color="#64748b" />
            <Text style={styles.noClient}>Ajouter un client (optionnel)</Text>
          </>
        )}
        <ChevronRight size={18} color="#64748b" />
      </TouchableOpacity>

      {/* Articles */}
      <FlatList
        data={cart.lignes}
        keyExtractor={(item) => item.produit.id.toString()}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <CartItemRow
            item={item}
            onOpenLotModal={handleOpenLotModal}
            onIncrement={() => cart.incrementQuantite(item.produit.id)}
            onDecrement={() => cart.decrementQuantite(item.produit.id)}
            onRemove={() => cart.removeLigne(item.produit.id)}
          />
        )}
      />

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatPrice(parseFloat(totalTTC))}</Text>
        </View>

        {mode === 'cashier' ? (
          <TouchableOpacity
            style={[styles.validateBtn, isSubmitting && styles.validateBtnDisabled]}
            onPress={handleSendToCashier}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <><Send size={18} color="#fff" /><Text style={styles.validateText}>Envoyer à la caisse</Text></>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.validateBtn}
            onPress={handleValidateAutonomous}
          >
            <CreditCard size={18} color="#fff" />
            <Text style={styles.validateText}>Payer maintenant</Text>
          </TouchableOpacity>
        )}

        {/* Voir ventes en attente */}
        {queueStore.waitingCount() > 0 && (
          <TouchableOpacity style={styles.pendingBtn} onPress={() => setShowPendingModal(true)}>
            <Text style={styles.pendingText}>
              {queueStore.waitingCount()} vente(s) en attente
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Modals */}
      <Modal visible={showClientModal} animationType="slide">
        <ClientSelectScreen 
          onClose={() => setShowClientModal(false)}
          onSelect={handleSelectClient}
        />
      </Modal>

      <Modal visible={showPendingModal} animationType="slide">
        <PendingSalesScreen onClose={() => setShowPendingModal(false)} />
      </Modal>

      {/* Modal Sélection Lot */}
      <LotSelectionModal
        visible={showLotModal}
        onClose={handleCloseLotModal}
        product={lotModalProduct}
        currentLotId={lotModalProduct ? cart.lignes.find(l => l.produit.id === lotModalProduct.id)?.lotId : undefined}
        onSelectLot={handleSelectLot}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 16,
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  modeSection: {
    padding: 12,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 4,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  modeBtnActive: {
    backgroundColor: '#6366f1',
  },
  modeText: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '500',
  },
  modeTextActive: {
    color: '#ffffff',
  },
  wsDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
    marginLeft: 4,
  },
  wsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
  },
  wsConnected: {
    fontSize: 12,
    color: '#22c55e',
  },
  wsFailed: {
    fontSize: 12,
    color: '#f59e0b',
  },
  wsConnecting: {
    fontSize: 12,
    color: '#94a3b8',
  },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  clientIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clientInfo: {
    flex: 1,
  },
  clientName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  ayantInfo: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  noClient: {
    flex: 1,
    fontSize: 14,
    color: '#64748b',
  },
  list: {
    padding: 12,
  },
  footer: {
    padding: 16,
    backgroundColor: '#1e293b',
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  totalLabel: {
    fontSize: 16,
    color: '#94a3b8',
  },
  totalValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
  },
  validateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    borderRadius: 10,
  },
  validateBtnDisabled: {
    opacity: 0.7,
  },
  validateText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  pendingBtn: {
    marginTop: 10,
    alignItems: 'center',
    paddingVertical: 8,
  },
  pendingText: {
    color: '#6366f1',
    fontSize: 13,
  },
});
