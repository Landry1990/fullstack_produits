import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import type { Produit, StockLot } from '../../services/inventaire';

interface ProductCardProps {
  product: Produit;
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
  const handleLotQtyChange = (lotId: string | number, value: string) => {
    setLotQuantities((prev) => ({ ...prev, [String(lotId)]: value }));
  };

  const renderLotItem = ({ item }: { item: StockLot }) => (
    <View style={styles.lotItem}>
      <View style={styles.lotInfo}>
        <Text style={styles.lotLabel}>
          Lot: <Text style={styles.lotValue}>{item.lot}</Text>
        </Text>
        <Text style={styles.lotExp}>Exp: {item.date_expiration || 'N/A'}</Text>
        <Text style={styles.lotStock}>Théorique: {item.quantity_remaining}</Text>
      </View>
      <View style={styles.lotQtyContainer}>
        <TextInput
          style={styles.lotQtyInput}
          value={lotQuantities[item.id] || ''}
          onChangeText={(val) => handleLotQtyChange(item.id, val)}
          placeholder="0"
          placeholderTextColor="#444"
          keyboardType="number-pad"
          selectTextOnFocus
        />
      </View>
    </View>
  );

  const ListFooter = () => (
    <View style={styles.newLotSection}>
      <Text style={styles.newLotTitle}>Nouveau Lot / Sans Lot</Text>
      <View style={styles.newLotRow}>
        <TextInput
          style={[styles.lotInput, { flex: 2 }]}
          placeholder="Numéro de Lot"
          placeholderTextColor="#666"
          value={newLotNumber}
          onChangeText={setNewLotNumber}
        />
        <TextInput
          style={[styles.lotInput, { flex: 2 }]}
          placeholder="Expiration (AAAA-MM-JJ)"
          placeholderTextColor="#666"
          value={newLotExpiration}
          onChangeText={setNewLotExpiration}
        />
        <TextInput
          style={[
            styles.lotInput,
            { flex: 1, backgroundColor: '#2d2d44', color: '#fff', fontWeight: 'bold' },
          ]}
          placeholder="Qté"
          placeholderTextColor="#888"
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="number-pad"
          selectTextOnFocus
        />
      </View>
    </View>
  );

  return (
    <View style={styles.productCard}>
      <Text style={styles.productName}>{product.name}</Text>
      <View style={styles.productMeta}>
        <Text style={styles.productCip}>CIP: {product.cip1 || '-'}</Text>
        <View style={styles.stockBadge}>
          <Text style={styles.stockBadgeText}>Stock: {product.stock}</Text>
        </View>
      </View>

      <FlatList
        style={styles.lotScroll}
        data={product.stock_lots || []}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderLotItem}
        ListFooterComponent={<ListFooter />}
      />

      <View style={styles.actions}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelBtnText}>Annuler</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.validateBtn, loading && styles.btnDisabled]}
          onPress={onValidate}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.validateBtnText}>Sauvegarder</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  productCard: {
    backgroundColor: '#1e1e35',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 0,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4f46e5',
    flex: 1,
    minHeight: 0,
  },
  productName: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  productMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  productCip: {
    color: '#888',
    fontSize: 14,
  },
  stockBadge: {
    backgroundColor: '#2d2d44',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  stockBadgeText: {
    color: '#4f46e5',
    fontWeight: 'bold',
    fontSize: 12,
  },
  lotScroll: {
    maxHeight: 300,
    marginBottom: 15,
  },
  lotItem: {
    flexDirection: 'row',
    backgroundColor: '#151525',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  lotInfo: {
    flex: 1,
  },
  lotLabel: { color: '#ccc', fontSize: 13 },
  lotValue: { color: '#fff', fontWeight: 'bold' },
  lotExp: { color: '#888', fontSize: 11 },
  lotStock: { color: '#4f46e5', fontSize: 11, marginTop: 2 },
  lotQtyContainer: {
    width: 70,
    marginLeft: 10,
  },
  lotQtyInput: {
    backgroundColor: '#2d2d44',
    color: '#fff',
    textAlign: 'center',
    padding: 10,
    borderRadius: 8,
    fontWeight: 'bold',
    fontSize: 18,
    borderWidth: 1,
    borderColor: '#4f46e5',
  },
  newLotSection: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#333',
    paddingTop: 15,
    paddingBottom: 10,
  },
  newLotTitle: {
    color: '#aaa',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  newLotRow: {
    flexDirection: 'row',
    gap: 8,
  },
  lotInput: {
    flex: 1,
    backgroundColor: '#0f0f1a',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#2d2d44',
    minHeight: 56,
  },
  actions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#2d2d44',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4b4b6a',
  },
  cancelBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  validateBtn: {
    flex: 2,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    elevation: 4,
  },
  validateBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
