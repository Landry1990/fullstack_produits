/**
 * Composant — Carte produit (résultat de scan ou recherche)
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { Product } from '../types';
import { formatPrice } from '../utils';

interface ProductCardProps {
  product: Product;
  onPress?: (product: Product) => void;
  showStock?: boolean;
}

export function ProductCard({ product, onPress, showStock = true }: ProductCardProps) {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress?.(product)}
      activeOpacity={0.7}
    >
      <View style={styles.info}>
        <Text style={styles.designation} numberOfLines={2}>
          {product.designation}
        </Text>
        <Text style={styles.codeBarre}>{product.code_barre}</Text>
        {product.lot && (
          <Text style={styles.lot}>Lot : {product.lot}</Text>
        )}
      </View>

      <View style={styles.right}>
        <Text style={styles.prix}>{formatPrice(product.prix_vente)}</Text>
        {showStock && (
          <Text style={[styles.stock, product.stock_local <= 0 && styles.stockOut]}>
            Stock : {product.stock_local}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  info: {
    flex: 1,
    gap: 4,
  },
  designation: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f1f5f9',
  },
  codeBarre: {
    fontSize: 12,
    color: '#94a3b8',
    fontFamily: 'monospace',
  },
  lot: {
    fontSize: 11,
    color: '#64748b',
  },
  right: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 4,
    marginLeft: 12,
  },
  prix: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10b981',
  },
  stock: {
    fontSize: 11,
    color: '#94a3b8',
  },
  stockOut: {
    color: '#ef4444',
    fontWeight: '600',
  },
});
