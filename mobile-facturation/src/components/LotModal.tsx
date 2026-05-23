import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, FlatList,
  ActivityIndicator, StyleSheet,
} from 'react-native';
import type { Product, StockLot } from '../types';
import { getLots } from '../services';

interface Props {
  visible: boolean;
  product: Product | null;
  currentLotId: number | null;
  onSelect: (lot: StockLot | null) => void;
  onClose: () => void;
}

function expiryInfo(dateStr: string | null): { label: string; color: string } {
  if (!dateStr) return { label: 'N/A', color: '#94a3b8' };
  const days = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
  const d = new Date(dateStr);
  const label = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`;
  if (days < 0) return { label, color: '#ef4444' };
  if (days < 30) return { label, color: '#f59e0b' };
  return { label, color: '#22c55e' };
}

export function LotModal({ visible, product, currentLotId, onSelect, onClose }: Props) {
  const [lots, setLots] = useState<StockLot[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && product) {
      setLoading(true);
      getLots(product.id).then(setLots).finally(() => setLoading(false));
    }
  }, [visible, product]);

  const handleSelect = (lot: StockLot | null) => {
    onSelect(lot);
    onClose();
  };

  if (!product) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>

          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Sélection du lot</Text>
              <Text style={styles.subtitle} numberOfLines={1}>{product.designation}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Option FEFO auto */}
          <TouchableOpacity
            style={[styles.option, !currentLotId && styles.optionSelected]}
            onPress={() => handleSelect(null)}
          >
            <Text style={styles.optionTitle}>🚀 AUTOMATIQUE (FEFO)</Text>
            <Text style={styles.optionSub}>Le système choisit le lot expirant le plus tôt</Text>
            {!currentLotId && <Text style={styles.checkmark}>✓</Text>}
          </TouchableOpacity>

          {loading ? (
            <ActivityIndicator color="#10b981" style={{ marginVertical: 30 }} />
          ) : lots.length === 0 ? (
            <Text style={styles.empty}>Aucun lot spécifique disponible</Text>
          ) : (
            <FlatList
              data={lots}
              keyExtractor={(i) => String(i.id)}
              style={styles.list}
              renderItem={({ item }) => {
                const isSelected = item.id === currentLotId;
                const exp = expiryInfo(item.date_expiration);
                return (
                  <TouchableOpacity
                    style={[styles.lotRow, isSelected && styles.lotRowSelected]}
                    onPress={() => handleSelect(item)}
                  >
                    <View style={styles.lotLeft}>
                      <Text style={[styles.lotNum, isSelected && styles.lotNumSelected]}>
                        {item.lot || 'Sans lot'}
                      </Text>
                      <Text style={[styles.lotExp, { color: exp.color }]}>
                        Exp: {exp.label}
                      </Text>
                    </View>
                    <View style={styles.lotRight}>
                      <Text style={styles.lotStock}>Stock: {item.quantity_remaining}</Text>
                      {isSelected && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelBtnText}>Fermer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  sheet: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    width: '100%',
    maxHeight: '80%',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  title: { fontSize: 17, fontWeight: '700', color: '#f1f5f9' },
  subtitle: { fontSize: 12, color: '#94a3b8', marginTop: 2, maxWidth: 240 },
  closeBtn: { padding: 4 },
  closeBtnText: { color: '#64748b', fontSize: 18 },
  option: {
    backgroundColor: 'rgba(16,185,129,0.08)',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.2)',
  },
  optionSelected: {
    backgroundColor: 'rgba(16,185,129,0.18)',
    borderColor: '#10b981',
  },
  optionTitle: { fontSize: 13, fontWeight: '700', color: '#10b981' },
  optionSub: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  checkmark: { position: 'absolute', right: 14, top: 14, color: '#10b981', fontSize: 16, fontWeight: '700' },
  empty: { textAlign: 'center', color: '#64748b', fontSize: 13, marginVertical: 24 },
  list: { maxHeight: 240 },
  lotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  lotRowSelected: {
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderColor: '#10b981',
  },
  lotLeft: { gap: 2 },
  lotNum: { fontSize: 13, fontWeight: '600', color: '#f1f5f9' },
  lotNumSelected: { color: '#10b981' },
  lotExp: { fontSize: 11, fontWeight: '500' },
  lotRight: { alignItems: 'flex-end', gap: 2 },
  lotStock: { fontSize: 11, color: '#64748b' },
  cancelBtn: {
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelBtnText: { color: '#f1f5f9', fontWeight: '600', fontSize: 14 },
});
