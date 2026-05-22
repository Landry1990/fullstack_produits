/**
 * Composant — Ligne d'article dans le panier
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { LigneFacture, Product } from '../types';
import { formatPrice } from '../utils';

interface CartItemRowProps {
  item: LigneFacture;
  onIncrement: (productId: number) => void;
  onDecrement: (productId: number) => void;
  onRemove: (productId: number) => void;
  onOpenLotModal?: (product: Product, currentLotId: number | null) => void;
}

export function CartItemRow({ item, onIncrement, onDecrement, onRemove, onOpenLotModal }: CartItemRowProps) {
  const produit = item.produit;
  const quantite = item.quantite;
  const prixUnitaire = parseFloat(item.prix_unitaire || '0');
  const totalTTC = parseFloat(item.total_ttc || '0');
  
  const handleLotPress = () => {
    if (onOpenLotModal) {
      onOpenLotModal(produit, item.lotId || null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.info}>
        <Text style={styles.designation} numberOfLines={1}>
          {produit.designation}
        </Text>
        <View style={styles.lotRow}>
          <Text style={styles.unitPrice}>
            {formatPrice(prixUnitaire)} / unité
          </Text>
          {onOpenLotModal && (
            <TouchableOpacity 
              style={[styles.lotBadge, item.lotId ? styles.lotBadgeSelected : undefined]}
              onPress={handleLotPress}
            >
              <Text style={[styles.lotText, item.lotId ? styles.lotTextSelected : undefined]}>
                {item.lotId ? item.lotText || 'LOT' : 'AUTO'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.quantityContainer}>
        <TouchableOpacity
          style={styles.qtyButton}
          onPress={() => onDecrement(produit.id)}
          activeOpacity={0.6}
        >
          <Text style={styles.qtyButtonText}>−</Text>
        </TouchableOpacity>

        <Text style={styles.quantity}>{quantite}</Text>

        <TouchableOpacity
          style={styles.qtyButton}
          onPress={() => onIncrement(produit.id)}
          activeOpacity={0.6}
        >
          <Text style={styles.qtyButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.subtotalContainer}>
        <Text style={styles.subtotal}>{formatPrice(totalTTC)}</Text>
        <TouchableOpacity
          onPress={() => onRemove(produit.id)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.removeText}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  designation: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f1f5f9',
  },
  lotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  lotBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  lotBadgeSelected: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10b981',
  },
  lotText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  lotTextSelected: {
    color: '#10b981',
  },
  unitPrice: {
    fontSize: 11,
    color: '#64748b',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 10,
  },
  qtyButton: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyButtonText: {
    fontSize: 18,
    color: '#34d399',
    fontWeight: '700',
  },
  quantity: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f1f5f9',
    minWidth: 24,
    textAlign: 'center',
  },
  subtotalContainer: {
    alignItems: 'flex-end',
    gap: 4,
  },
  subtotal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#10b981',
  },
  removeText: {
    fontSize: 14,
    color: '#ef4444',
    fontWeight: '600',
  },
});
