import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { theme } from '../config/theme';
import { moderateScale as ms } from '../utils/scale';
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
  // Lisibilité stock dans les résultats : en stock = gras, sans stock =
  // normal, stock négatif = rouge (anomalie à corriger, vente forcée).
  const stockNeg = product.stock < 0;
  const stockZero = product.stock === 0;

  return (
    <TouchableOpacity style={styles.row} onPress={() => onPress(product)} activeOpacity={0.7}>
      <View style={styles.left}>
        <Text
          style={[
            styles.designation,
            (stockZero || stockNeg) && styles.designationNoStock,
            stockNeg && styles.designationNeg,
          ]}
          numberOfLines={1}
        >
          {product.name}
        </Text>
        {cip ? <Text style={styles.code}>{cip}</Text> : null}
      </View>
      <View style={styles.right}>
        <Text style={styles.prix}>{prix} F</Text>
        <Text style={[styles.stock, stockNeg && styles.stockNeg]}>
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
    borderRadius: ms(8),
    paddingHorizontal: ms(12),
    paddingVertical: ms(10),
    marginBottom: ms(4),
    borderWidth: 1,
    borderColor: theme.border,
  },
  left: { flex: 1, gap: ms(2) },
  designation: { fontSize: ms(14), fontWeight: '700', color: theme.text },
  designationNoStock: { fontWeight: '400' },
  designationNeg: { color: theme.danger },
  code: { fontSize: ms(11), color: theme.textMuted },
  right: { alignItems: 'flex-end', gap: ms(2) },
  prix: { fontSize: ms(14), fontWeight: '700', color: theme.primary },
  stock: { fontSize: ms(11), color: theme.textMuted },
  stockNeg: { color: theme.danger, fontWeight: '700' },
});
