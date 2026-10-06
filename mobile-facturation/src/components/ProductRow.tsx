import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../config/theme';
import { moderateScale as ms } from '../utils/scale';
import type { Product } from '../types';

interface Props {
  product: Product;
  onPress: (product: Product) => void;
}

export function ProductRow({ product, onPress }: Props) {
  const { t } = useTranslation();
  const prix = parseFloat(product.selling_price).toLocaleString('fr-FR', {
    minimumFractionDigits: 0,
  });
  const cip = product.cip1 || product.cip2 || product.cip3 || product.cip4 || '';
  // Lisibilité stock dans les résultats — double signal (poids + couleur,
  // le gras seul passait inaperçu sur tablette) : en stock = nom extra-gras
  // + compteur vert, sans stock = nom atténué gris, négatif = rouge.
  const stockNeg = product.stock < 0;
  const stockZero = product.stock === 0;

  return (
    <TouchableOpacity style={styles.row} onPress={() => onPress(product)} activeOpacity={0.7}>
      <View style={styles.left}>
        <Text
          style={[
            styles.designation,
            stockZero && styles.designationNoStock,
            stockNeg && styles.designationNeg,
          ]}
          numberOfLines={1}
        >
          {product.name}
        </Text>
        {/* Toutes les infos utiles regroupées à gauche sur une ligne :
            lecture en un seul regard (CIP · stock · prix). */}
        <View style={styles.metaRow}>
          {cip ? <Text style={styles.code}>{cip}</Text> : null}
          <Text style={[
            styles.stock,
            !stockZero && !stockNeg && styles.stockOk,
            stockNeg && styles.stockNeg,
          ]}>
            {t('lot.stock', { count: product.stock })}
          </Text>
          <Text style={styles.prix}>{prix} F</Text>
        </View>
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
  left: { flex: 1, gap: ms(3) },
  designation: { fontSize: ms(14), fontWeight: '800', color: theme.text },
  designationNoStock: { fontWeight: '400', color: theme.textMuted },
  designationNeg: { fontWeight: '400', color: theme.danger },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: ms(10) },
  code: { fontSize: ms(11), color: theme.textMuted },
  prix: { fontSize: ms(13), fontWeight: '700', color: theme.primary },
  stock: { fontSize: ms(11), color: theme.textMuted },
  stockOk: { color: theme.primary, fontWeight: '700' },
  stockNeg: { color: theme.danger, fontWeight: '700' },
});
