import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Pencil } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../config/theme';
import { moderateScale as ms } from '../utils/scale';
import { getFEFOPreview } from '../utils/fefo';
import { expiryInfo } from '../utils/format';
import type { CartLine } from '../types';

interface Props {
  line: CartLine;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
  onOpenLot: () => void;
  onEditLine: () => void;
}

export function CartItemRow({ line, onIncrement, onDecrement, onRemove, onOpenLot, onEditLine }: Props) {
  const { t } = useTranslation();
  const prix = line.prix_unitaire.toLocaleString('fr-FR', { minimumFractionDigits: 0 });
  const total = line.total_ttc.toLocaleString('fr-FR', { minimumFractionDigits: 0 });

  // Badge lot : lot choisi manuellement, sinon « SANS LOT » quand aucun
  // lot n'est prélevable, ou aperçu FEFO (« FEFO · LOT-X · exp ») quand
  // le backend prélèvera le lot qui expire le plus tôt.
  const lotLabel = (() => {
    if (line.lotId) {
      const exp = line.lotExp ? expiryInfo(line.lotExp).label : null;
      return [line.lotText || t('cart.lot_fallback'), exp].filter(Boolean).join(' · ');
    }
    const preview = getFEFOPreview(line.product.stock_lots, line.quantite);
    if (preview.length === 0) return t('cart.no_lot');
    if (preview.length === 1) {
      const p = preview[0];
      const exp = p.expiration ? expiryInfo(p.expiration).label : null;
      return [t('cart.fefo'), p.lot, exp].filter(Boolean).join(' · ');
    }
    return `${t('cart.fefo')} · ${preview[0].lot} +${preview.length - 1}`;
  })();

  return (
    <View style={styles.row}>
      {/* Infos produit */}
      <View style={styles.info}>
        <Text style={styles.designation} numberOfLines={1}>
          {line.product.name}
        </Text>
        <View style={styles.subRow}>
          <TouchableOpacity style={styles.prixBtn} onPress={onEditLine} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Text style={styles.prix}>{prix} F</Text>
            <Pencil size={ms(12)} color={theme.textMuted} />
          </TouchableOpacity>
          {line.remise > 0 && (
            <Text style={styles.remise}>-{line.remise}%</Text>
          )}
          <TouchableOpacity style={[styles.lotBadge, line.lotId ? styles.lotBadgeActive : null]} onPress={onOpenLot}>
            <Text style={[styles.lotText, line.lotId ? styles.lotTextActive : null]} numberOfLines={1}>
              {lotLabel}
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
    backgroundColor: theme.bgElevated,
    borderRadius: ms(8),
    paddingHorizontal: ms(10),
    paddingVertical: ms(8),
    marginBottom: ms(4),
    borderWidth: 1,
    borderColor: theme.border,
  },
  info: { flex: 1, gap: ms(4) },
  designation: { fontSize: ms(13), fontWeight: '600', color: theme.text },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: ms(8) },
  prixBtn: { flexDirection: 'row', alignItems: 'center', gap: ms(4) },
  prix: { fontSize: ms(11), color: theme.textSecondary },
  remise: { fontSize: ms(11), color: theme.warning, fontWeight: '700' },
  lotBadge: {
    paddingHorizontal: ms(6),
    paddingVertical: ms(2),
    borderRadius: ms(4),
    backgroundColor: theme.bgMuted,
    borderWidth: 1,
    borderColor: theme.borderStrong,
    maxWidth: ms(170),
  },
  lotBadgeActive: {
    backgroundColor: theme.primaryWash,
    borderColor: theme.primary,
  },
  lotText: { fontSize: ms(10), fontWeight: '700', color: theme.textMuted },
  lotTextActive: { color: theme.primary },
  qty: { flexDirection: 'row', alignItems: 'center', gap: ms(6), marginHorizontal: ms(8) },
  qtyBtn: {
    width: ms(28),
    height: ms(28),
    borderRadius: ms(6),
    backgroundColor: theme.primaryWash,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyBtnText: { fontSize: ms(16), color: theme.primary, fontWeight: '700' },
  qtyVal: { fontSize: ms(15), fontWeight: '700', color: theme.text, minWidth: ms(22), textAlign: 'center' },
  totalCol: { alignItems: 'flex-end', gap: ms(4) },
  total: { fontSize: ms(13), fontWeight: '700', color: theme.primary },
  remove: { fontSize: ms(13), color: theme.danger, fontWeight: '600' },
});
