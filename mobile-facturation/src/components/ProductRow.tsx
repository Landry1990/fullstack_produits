import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { theme } from '../config/theme';
import type { Product } from '../types';

interface Props {
  product: Product;
  onPress: (product: Product) => void;
}

export function ProductRow({ product, onPress }: Props) {
  const prix = parseFloat(product.selling_price).toLocaleString('fr-FR', {
    minimumFractionDigits: 0,
  });
  const cip = product.cip1 || product.cip2 || product.cip3 || product.cip4 || '';

  return (
    <TouchableOpacity style={styles.row} onPress={() => onPress(product)} activeOpacity={0.7}>
      <View style={styles.left}>
        <Text style={styles.designation} numberOfLines={1}>
          {product.name}
        </Text>
        {cip ? <Text style={styles.code}>{cip}</Text> : null}
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
    backgroundColor: theme.bgElevated,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: theme.border,
  },
  left: { flex: 1, gap: 2 },
  designation: { fontSize: 14, fontWeight: '600', color: theme.text },
  code: { fontSize: 11, color: theme.textMuted },
  right: { alignItems: 'flex-end', gap: 2 },
  prix: { fontSize: 14, fontWeight: '700', color: theme.primary },
  stock: { fontSize: 11, color: theme.textMuted },
  stockZero: { color: theme.danger },
});
