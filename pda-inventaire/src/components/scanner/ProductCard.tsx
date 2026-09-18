import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Produit, StockLot } from '../../services/inventaire';

const normalizeExpiryMMYY = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
};

interface ProductCardProps {
  product: Produit;
  inventoryType?: 'GLOBAL' | 'RAYON' | 'RESERVE';
  quantity: string;
  setQuantity: (value: string) => void;
  lotQuantities: { [key: string]: string };
  setLotQuantities: (value: { [key: string]: string } | ((prev: { [key: string]: string }) => { [key: string]: string })) => void;
  newLotNumber: string;
  setNewLotNumber: (value: string) => void;
  newLotExpiration: string;
  setNewLotExpiration: (value: string) => void;
  onValidate: () => void;
  onCancel: () => void;
  loading: boolean;
}

export default function ProductCard({
  product,
  inventoryType = 'RAYON',
  quantity,
  setQuantity,
  lotQuantities,
  setLotQuantities,
  newLotNumber,
  setNewLotNumber,
  newLotExpiration,
  setNewLotExpiration,
  onValidate,
  onCancel,
  loading,
}: ProductCardProps) {
  const insets = useSafeAreaInsets();
  const lots = product.stock_lots || [];

  const handleLotQtyChange = (lotId: string | number, value: string) => {
    setLotQuantities((prev) => ({ ...prev, [String(lotId)]: value }));
  };

  const renderLotItem = ({ item }: { item: StockLot }) => {
    const theoretical = inventoryType === 'RESERVE'
      ? item.quantity_reserved || 0
      : inventoryType === 'GLOBAL'
        ? item.quantity_remaining + (item.quantity_reserved || 0)
        : item.quantity_remaining;
    const physical = Number(lotQuantities[String(item.id)] || 0);
    const difference = physical - theoretical;

    return (
      <View style={styles.lotItem}>
        <View style={styles.lotInfo}>
          <Text style={styles.lotValue}>{item.lot || `Lot #${item.id}`}</Text>
          <Text style={styles.lotMeta}>Exp. {item.date_expiration || 'Non renseignée'}</Text>
          <Text style={styles.lotTheoretical}>Stock théorique : {theoretical}</Text>
        </View>
        <View style={styles.quantityBlock}>
          <Text style={styles.quantityLabel}>Stock compté</Text>
          <TextInput
            style={styles.lotQtyInput}
            value={lotQuantities[String(item.id)] ?? ''}
            onChangeText={(value) => handleLotQtyChange(item.id, value)}
            placeholder="0"
            placeholderTextColor="#64748b"
            keyboardType="number-pad"
            selectTextOnFocus
          />
          <Text style={[styles.difference, difference === 0 ? styles.neutral : difference > 0 ? styles.positive : styles.negative]}>
            Écart {difference > 0 ? '+' : ''}{difference}
          </Text>
        </View>
      </View>
    );
  };

  const listFooter = product.use_lot_management ? (
    <View style={styles.newLotSection}>
      <Text style={styles.sectionTitle}>Nouveau lot</Text>
      <TextInput
        style={styles.fullInput}
        placeholder="Numéro du lot"
        placeholderTextColor="#64748b"
        value={newLotNumber}
        onChangeText={setNewLotNumber}
      />
      <View style={styles.newLotRow}>
        <TextInput
          style={styles.dateInput}
          placeholder="Péremption MM/YY"
          placeholderTextColor="#64748b"
          value={newLotExpiration}
          onChangeText={(value) => setNewLotExpiration(normalizeExpiryMMYY(value))}
          keyboardType="number-pad"
          maxLength={5}
        />
        <TextInput
          style={styles.newQtyInput}
          placeholder="Qté"
          placeholderTextColor="#64748b"
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="number-pad"
          selectTextOnFocus
        />
      </View>
    </View>
  ) : (
    <View style={styles.singleCountSection}>
      <View>
        <Text style={styles.quantityLabel}>Stock théorique</Text>
        <Text style={styles.singleTheoretical}>{product.stock}</Text>
      </View>
      <View style={styles.singleQuantityBlock}>
        <Text style={styles.quantityLabel}>Stock compté</Text>
        <TextInput
          style={styles.singleQtyInput}
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="number-pad"
          selectTextOnFocus
          autoFocus
        />
        <Text style={[styles.difference, Number(quantity || 0) - product.stock === 0 ? styles.neutral : Number(quantity || 0) - product.stock > 0 ? styles.positive : styles.negative]}>
          Écart {Number(quantity || 0) - product.stock > 0 ? '+' : ''}{Number(quantity || 0) - product.stock}
        </Text>
      </View>
    </View>
  );

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onCancel} statusBarTranslucent>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.modal, { marginTop: Math.max(insets.top, 16), marginBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title} numberOfLines={2}>{product.name}</Text>
              <Text style={styles.subtitle}>CIP : {product.cip1 || product.cip2 || product.cip3 || product.cip4 || 'Non renseigné'}</Text>
            </View>
            <View style={styles.stockBadge}>
              <Text style={styles.stockBadgeLabel}>Stock global</Text>
              <Text style={styles.stockBadgeValue}>{product.stock}</Text>
            </View>
          </View>

          <Text style={styles.instructions}>
            {product.use_lot_management
              ? 'Vérifiez et modifiez le stock compté pour chaque lot.'
              : 'Vérifiez et modifiez le stock compté.'}
          </Text>

          <FlatList
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            data={lots}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderLotItem}
            ListEmptyComponent={product.use_lot_management ? (
              <Text style={styles.emptyLots}>Aucun lot actif. Ajoutez un nouveau lot ci-dessous.</Text>
            ) : null}
            ListFooterComponent={listFooter}
            keyboardShouldPersistTaps="always"
            removeClippedSubviews={false}
          />

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} disabled={loading}>
              <Text style={styles.cancelBtnText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.validateBtn, loading && styles.disabled]} onPress={onValidate} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.validateBtnText}>Ajouter au comptage</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.82)',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  modal: {
    flex: 1,
    maxHeight: 720,
    backgroundColor: '#111827',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerText: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 5,
  },
  stockBadge: {
    minWidth: 72,
    padding: 9,
    borderRadius: 10,
    backgroundColor: '#0f172a',
    alignItems: 'center',
  },
  stockBadgeLabel: {
    color: '#94a3b8',
    fontSize: 9,
  },
  stockBadgeValue: {
    color: '#93c5fd',
    fontSize: 18,
    fontWeight: '800',
  },
  instructions: {
    color: '#cbd5e1',
    fontSize: 13,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: '#172033',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 14,
  },
  lotItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginBottom: 10,
    borderRadius: 12,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  lotInfo: {
    flex: 1,
    marginRight: 12,
  },
  lotValue: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '800',
  },
  lotMeta: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 4,
  },
  lotTheoretical: {
    color: '#93c5fd',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
  quantityBlock: {
    width: 108,
    alignItems: 'center',
  },
  quantityLabel: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 5,
  },
  lotQtyInput: {
    width: '100%',
    minHeight: 48,
    backgroundColor: '#0f172a',
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#3b82f6',
    color: '#fff',
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '800',
  },
  difference: {
    fontSize: 11,
    fontWeight: '800',
    marginTop: 5,
  },
  neutral: {
    color: '#94a3b8',
  },
  positive: {
    color: '#4ade80',
  },
  negative: {
    color: '#f87171',
  },
  emptyLots: {
    color: '#cbd5e1',
    textAlign: 'center',
    paddingVertical: 22,
  },
  newLotSection: {
    borderTopWidth: 1,
    borderTopColor: '#334155',
    marginTop: 4,
    paddingTop: 14,
  },
  sectionTitle: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  fullInput: {
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: 9,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#475569',
    color: '#fff',
    marginBottom: 8,
  },
  newLotRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dateInput: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: 9,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#475569',
    color: '#fff',
  },
  newQtyInput: {
    width: 78,
    minHeight: 48,
    borderRadius: 9,
    backgroundColor: '#0f172a',
    borderWidth: 2,
    borderColor: '#3b82f6',
    color: '#fff',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
  },
  singleCountSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 30,
    paddingHorizontal: 10,
  },
  singleTheoretical: {
    color: '#93c5fd',
    fontSize: 30,
    fontWeight: '800',
  },
  singleQuantityBlock: {
    width: 140,
    alignItems: 'center',
  },
  singleQtyInput: {
    width: '100%',
    minHeight: 64,
    borderRadius: 12,
    backgroundColor: '#0f172a',
    borderWidth: 2,
    borderColor: '#3b82f6',
    color: '#fff',
    textAlign: 'center',
    fontSize: 28,
    fontWeight: '800',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    backgroundColor: '#1e293b',
  },
  cancelBtn: {
    flex: 1,
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 11,
    backgroundColor: '#334155',
  },
  cancelBtnText: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '700',
  },
  validateBtn: {
    flex: 2,
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 11,
    backgroundColor: '#16a34a',
  },
  validateBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.6,
  },
});
