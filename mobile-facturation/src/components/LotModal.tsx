import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, FlatList,
  ActivityIndicator, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { Product, StockLot } from '../types';
import { getLots } from '../services/api';
import { expiryInfo } from '../utils/format';
import { theme } from '../config/theme';
import { moderateScale as ms } from '../utils/scale';

interface Props {
  visible: boolean;
  product: Product | null;
  currentLotId: number | null;
  onSelect: (lot: StockLot | null) => void;
  onClose: () => void;
}

export function LotModal({ visible, product, currentLotId, onSelect, onClose }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
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
      <View style={[styles.overlay, {
        paddingTop: Math.max(insets.top, 24),
        paddingBottom: Math.max(insets.bottom, 24),
      }]}>
        <View style={styles.sheet}>

          <View style={styles.header}>
            <View>
              <Text style={styles.title}>{t('lot.title')}</Text>
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
            <Text style={styles.optionTitle}>🚀 {t('lot.auto_title')}</Text>
            <Text style={styles.optionSub}>{t('lot.auto_sub')}</Text>
            {!currentLotId && <Text style={styles.checkmark}>✓</Text>}
          </TouchableOpacity>

          {loading ? (
            <ActivityIndicator color={theme.primary} style={{ marginVertical: ms(30) }} />
          ) : lots.length === 0 ? (
            <Text style={styles.empty}>{t('lot.empty')}</Text>
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
                        {item.lot || t('lot.no_lot')}
                      </Text>
                      <Text style={[styles.lotExp, { color: exp.color }]}>
                        {t('lot.exp', { label: exp.label })}
                      </Text>
                    </View>
                    <View style={styles.lotRight}>
                      <Text style={styles.lotStock}>{t('lot.stock', { count: item.quantity_remaining })}</Text>
                      {isSelected && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelBtnText}>{t('common.close')}</Text>
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
    padding: ms(24),
  },
  sheet: {
    backgroundColor: theme.bgElevated,
    borderRadius: ms(16),
    width: '100%',
    maxHeight: '80%',
    padding: ms(20),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: ms(16),
    paddingBottom: ms(12),
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  title: { fontSize: ms(17), fontWeight: '700', color: theme.text },
  subtitle: { fontSize: ms(12), color: theme.textMuted, marginTop: ms(2), maxWidth: ms(240) },
  closeBtn: { padding: ms(4) },
  closeBtnText: { color: theme.textMuted, fontSize: ms(18) },
  option: {
    backgroundColor: theme.primaryWash,
    borderRadius: ms(10),
    padding: ms(14),
    marginBottom: ms(12),
    borderWidth: 1,
    borderColor: theme.primaryLight,
  },
  optionSelected: {
    backgroundColor: theme.primaryLight,
    borderColor: theme.primary,
  },
  optionTitle: { fontSize: ms(13), fontWeight: '700', color: theme.primary },
  optionSub: { fontSize: ms(11), color: theme.textSecondary, marginTop: ms(2) },
  checkmark: { position: 'absolute', right: ms(14), top: ms(14), color: theme.primary, fontSize: ms(16), fontWeight: '700' },
  empty: { textAlign: 'center', color: theme.textMuted, fontSize: ms(13), marginVertical: ms(24) },
  list: { maxHeight: ms(240) },
  lotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.bgMuted,
    borderRadius: ms(8),
    padding: ms(12),
    marginBottom: ms(4),
    borderWidth: 1,
    borderColor: theme.border,
  },
  lotRowSelected: {
    backgroundColor: theme.primaryWash,
    borderColor: theme.primary,
  },
  lotLeft: { gap: ms(2) },
  lotNum: { fontSize: ms(13), fontWeight: '600', color: theme.text },
  lotNumSelected: { color: theme.primary },
  lotExp: { fontSize: ms(11), fontWeight: '500' },
  lotRight: { alignItems: 'flex-end', gap: ms(2) },
  lotStock: { fontSize: ms(11), color: theme.textMuted },
  cancelBtn: {
    marginTop: ms(12),
    backgroundColor: theme.bgMuted,
    borderRadius: ms(10),
    paddingVertical: ms(12),
    alignItems: 'center',
  },
  cancelBtnText: { color: theme.text, fontWeight: '600', fontSize: ms(14) },
});
