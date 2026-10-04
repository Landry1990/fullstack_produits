import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, FlatList,
  ActivityIndicator, StyleSheet,
} from 'react-native';
import type { Product, StockLot } from '../types';
import { getLots } from '../services/api';
import { expiryInfo } from '../utils/format';
import { theme } from '../config/theme';

interface Props {
  visible: boolean;
  product: Product | null;
  currentLotId: number | null;
  onSelect: (lot: StockLot | null) => void;
  onClose: () => void;
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
              <Text style={styles.subtitle} numberOfLines={1}>{product.name}</Text>
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
            <ActivityIndicator color={theme.primary} style={{ marginVertical: 30 }} />
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
    backgroundColor: theme.bgOverlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  sheet: {
    backgroundColor: theme.bgElevated,
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
    borderBottomColor: theme.border,
  },
  title: { fontSize: 17, fontWeight: '700', color: theme.text },
  subtitle: { fontSize: 12, color: theme.textMuted, marginTop: 2, maxWidth: 240 },
  closeBtn: { padding: 4 },
  closeBtnText: { color: theme.textMuted, fontSize: 18 },
  option: {
    backgroundColor: theme.primaryWash,
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.primaryLight,
  },
  optionSelected: {
    backgroundColor: theme.primaryLight,
    borderColor: theme.primary,
  },
  optionTitle: { fontSize: 13, fontWeight: '700', color: theme.primary },
  optionSub: { fontSize: 11, color: theme.textSecondary, marginTop: 2 },
  checkmark: { position: 'absolute', right: 14, top: 14, color: theme.primary, fontSize: 16, fontWeight: '700' },
  empty: { textAlign: 'center', color: theme.textMuted, fontSize: 13, marginVertical: 24 },
  list: { maxHeight: 240 },
  lotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.bgMuted,
    borderRadius: 8,
    padding: 12,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: theme.border,
  },
  lotRowSelected: {
    backgroundColor: theme.primaryWash,
    borderColor: theme.primary,
  },
  lotLeft: { gap: 2 },
  lotNum: { fontSize: 13, fontWeight: '600', color: theme.text },
  lotNumSelected: { color: theme.primary },
  lotExp: { fontSize: 11, fontWeight: '500' },
  lotRight: { alignItems: 'flex-end', gap: 2 },
  lotStock: { fontSize: 11, color: theme.textMuted },
  cancelBtn: {
    marginTop: 12,
    backgroundColor: theme.bgMuted,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelBtnText: { color: theme.text, fontWeight: '600', fontSize: 14 },
});
