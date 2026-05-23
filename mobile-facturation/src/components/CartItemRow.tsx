import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { CartLine } from '../types';

interface Props {
  line: CartLine;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
  onOpenLot: () => void;
}

export function CartItemRow({ line, onIncrement, onDecrement, onRemove, onOpenLot }: Props) {
  const prix = line.prix_unitaire.toLocaleString('fr-FR', { minimumFractionDigits: 0 });
  const total = line.total_ttc.toLocaleString('fr-FR', { minimumFractionDigits: 0 });

  return (
    <View style={styles.row}>
      {/* Infos produit */}
      <View style={styles.info}>
        <Text style={styles.designation} numberOfLines={1}>
          {line.product.designation}
        </Text>
        <View style={styles.subRow}>
          <Text style={styles.prix}>{prix} F</Text>
          {line.remise > 0 && (
            <Text style={styles.remise}>-{line.remise}%</Text>
          )}
          <TouchableOpacity style={[styles.lotBadge, line.lotId ? styles.lotBadgeActive : null]} onPress={onOpenLot}>
            <Text style={[styles.lotText, line.lotId ? styles.lotTextActive : null]}>
              {line.lotId ? (line.lotText || 'LOT') : 'AUTO'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Quantité */}
      <View style={styles.qty}>
        <TouchableOpacity style={styles.qtyBtn} onPress={onDecrement}>
          <Text style={styles.qtyBtnText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.qtyVal}>{line.quantite}</Text>
        <TouchableOpacity style={styles.qtyBtn} onPress={onIncrement}>
          <Text style={styles.qtyBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Total + supprimer */}
      <View style={styles.totalCol}>
        <Text style={styles.total}>{total} F</Text>
        <TouchableOpacity onPress={onRemove} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.remove}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  info: { flex: 1, gap: 4 },
  designation: { fontSize: 13, fontWeight: '600', color: '#f1f5f9' },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  prix: { fontSize: 11, color: '#94a3b8' },
  remise: { fontSize: 11, color: '#f59e0b', fontWeight: '700' },
  lotBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  lotBadgeActive: {
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderColor: '#10b981',
  },
  lotText: { fontSize: 10, fontWeight: '700', color: '#64748b' },
  lotTextActive: { color: '#10b981' },
  qty: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 8 },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: 'rgba(99,102,241,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyBtnText: { fontSize: 16, color: '#818cf8', fontWeight: '700' },
  qtyVal: { fontSize: 15, fontWeight: '700', color: '#f1f5f9', minWidth: 22, textAlign: 'center' },
  totalCol: { alignItems: 'flex-end', gap: 4 },
  total: { fontSize: 13, fontWeight: '700', color: '#10b981' },
  remove: { fontSize: 13, color: '#ef4444', fontWeight: '600' },
});
