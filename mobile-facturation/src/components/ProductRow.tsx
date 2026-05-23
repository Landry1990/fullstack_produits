import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { Product } from '../types';

interface Props {
  product: Product;
  onPress: (product: Product) => void;
}

export function ProductRow({ product, onPress }: Props) {
  const prix = parseFloat(product.prix_vente).toLocaleString('fr-FR', {
    minimumFractionDigits: 0,
  });

  return (
    <TouchableOpacity style={styles.row} onPress={() => onPress(product)} activeOpacity={0.7}>
      <View style={styles.left}>
        <Text style={styles.designation} numberOfLines={1}>
          {product.designation}
        </Text>
        <Text style={styles.code}>{product.code_barre}</Text>
      </View>
      <View style={styles.right}>
        <Text style={styles.prix}>{prix} F</Text>
        <Text style={[styles.stock, product.stock <= 0 && styles.stockZero]}>
          Stock: {product.stock}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  left: { flex: 1, gap: 2 },
  designation: { fontSize: 14, fontWeight: '600', color: '#f1f5f9' },
  code: { fontSize: 11, color: '#64748b' },
  right: { alignItems: 'flex-end', gap: 2 },
  prix: { fontSize: 14, fontWeight: '700', color: '#10b981' },
  stock: { fontSize: 11, color: '#64748b' },
  stockZero: { color: '#ef4444' },
});
