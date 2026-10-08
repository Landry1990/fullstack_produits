import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { ShieldAlert, Package } from 'lucide-react-native';
import type { Product } from '../types';
import { theme } from '../config/theme';
import { moderateScale as ms } from '../utils/scale';

export type ResolutionAction = 'promis' | 'reduce' | 'force';

export interface StockConflict {
  product: Product;
  quantity: number;
  stock: number;
}

interface Props {
  visible: boolean;
  conflicts: StockConflict[];
  // Téléphone pré-rempli depuis le client du panier (optionnel).
  defaultPhone?: string;
  onConfirm: (actions: Record<number, ResolutionAction>, phone: string) => void;
  onClose: () => void;
}

// Résolution des ruptures à l'envoi — parité avec le StockResolutionModal
// web : par ligne en déficit, « Promis » (défaut, la part manquante est
// due au client et livrée à la prochaine réception), « Réduire » (qté
// ramenée au stock) ou « Forcer » (validation superviseur ensuite).
export function StockResolutionModal({ visible, conflicts, defaultPhone, onConfirm, onClose }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [actions, setActions] = useState<Record<number, ResolutionAction>>({});
  const [phone, setPhone] = useState('');

  // Réinitialise à chaque ouverture : promis par défaut (comme le web),
  // téléphone repris du client sélectionné.
  useEffect(() => {
    if (!visible) return;
    const init: Record<number, ResolutionAction> = {};
    for (const c of conflicts) init[c.product.id] = 'promis';
    setActions(init);
    setPhone(defaultPhone ?? '');
  }, [visible, conflicts, defaultPhone]);

  const hasPromis = Object.values(actions).includes('promis');
  const hasForce = Object.values(actions).includes('force');

  const setAction = (productId: number, action: ResolutionAction) =>
    setActions((prev) => ({ ...prev, [productId]: action }));

  const ACTION_ORDER: ResolutionAction[] = ['promis', 'reduce', 'force'];
  const actionColor: Record<ResolutionAction, string> = {
    promis: theme.info,
    reduce: theme.primary,
    force: theme.danger,
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.overlay, {
        paddingTop: Math.max(insets.top, 24),
        paddingBottom: Math.max(insets.bottom, 24),
      }]}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <ShieldAlert size={ms(20)} color={theme.warning} />
              <Text style={styles.title}>{t('stockRes.title')}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.message}>{t('stockRes.message')}</Text>

          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
            {conflicts.map((c) => {
              const stock = Math.max(0, c.stock);
              const missing = c.quantity - stock;
              const current = actions[c.product.id] ?? 'promis';
              return (
                <View key={c.product.id} style={styles.conflictRow}>
                  <View style={styles.conflictTop}>
                    <Package size={ms(15)} color={theme.textMuted} />
                    <Text style={styles.conflictName} numberOfLines={1}>{c.product.name}</Text>
                    <Text style={styles.conflictMissing}>−{missing}</Text>
                  </View>
                  <Text style={styles.conflictMeta}>
                    {t('stockRes.meta', { qty: c.quantity, stock })}
                  </Text>
                  <View style={styles.actionRow}>
                    {ACTION_ORDER.map((a) => (
                      <TouchableOpacity
                        key={a}
                        style={[
                          styles.actionBtn,
                          current === a && { backgroundColor: actionColor[a], borderColor: actionColor[a] },
                        ]}
                        onPress={() => setAction(c.product.id, a)}
                      >
                        <Text style={[styles.actionBtnText, current === a && styles.actionBtnTextActive]}>
                          {t(`stockRes.action_${a}`)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {current === 'promis' && (
                    <Text style={styles.promisHint}>
                      {t('stockRes.promis_hint', { count: missing })}
                    </Text>
                  )}
                </View>
              );
            })}
          </ScrollView>

          {hasPromis && (
            <View style={styles.phoneBox}>
              <Text style={styles.phoneLabel}>{t('stockRes.phone_label')}</Text>
              <TextInput
                style={styles.phoneInput}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder={t('stockRes.phone_placeholder')}
                placeholderTextColor={theme.textMuted}
                maxLength={20}
              />
            </View>
          )}

          {hasForce && (
            <Text style={styles.forceWarning}>{t('stockRes.force_warning')}</Text>
          )}

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>{t('stockRes.back_to_cart')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.confirmBtn}
              onPress={() => onConfirm(actions, phone.trim())}
            >
              <Text style={styles.confirmBtnText}>{t('stockRes.confirm')}</Text>
            </TouchableOpacity>
          </View>
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
    maxWidth: ms(520),
    maxHeight: '90%',
    padding: ms(20),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: ms(8),
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: ms(8), flex: 1 },
  title: { fontSize: ms(17), fontWeight: '700', color: theme.text },
  closeBtn: { padding: ms(4) },
  closeBtnText: { color: theme.textMuted, fontSize: ms(18) },
  message: { fontSize: ms(12), color: theme.textSecondary, marginBottom: ms(12) },
  list: { maxHeight: ms(320) },
  conflictRow: {
    backgroundColor: theme.bgMuted,
    borderRadius: ms(10),
    padding: ms(12),
    marginBottom: ms(8),
    borderWidth: 1,
    borderColor: theme.border,
  },
  conflictTop: { flexDirection: 'row', alignItems: 'center', gap: ms(6) },
  conflictName: { flex: 1, fontSize: ms(13), fontWeight: '700', color: theme.text },
  conflictMissing: {
    fontSize: ms(12),
    fontWeight: '700',
    color: theme.danger,
    backgroundColor: theme.dangerWash,
    paddingHorizontal: ms(6),
    paddingVertical: ms(1),
    borderRadius: ms(4),
    overflow: 'hidden',
  },
  conflictMeta: { fontSize: ms(11), color: theme.textMuted, marginTop: ms(2), marginBottom: ms(8) },
  actionRow: {
    flexDirection: 'row',
    gap: ms(6),
    backgroundColor: theme.border,
    borderRadius: ms(8),
    padding: ms(3),
  },
  actionBtn: {
    flex: 1,
    paddingVertical: ms(7),
    borderRadius: ms(6),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  actionBtnText: { fontSize: ms(12), fontWeight: '600', color: theme.textSecondary },
  actionBtnTextActive: { color: theme.textOnPrimary },
  promisHint: { fontSize: ms(11), color: theme.info, marginTop: ms(6) },
  phoneBox: { marginTop: ms(10) },
  phoneLabel: { fontSize: ms(11), fontWeight: '700', color: theme.textSecondary, marginBottom: ms(4) },
  phoneInput: {
    borderWidth: 1,
    borderColor: theme.borderStrong,
    borderRadius: ms(8),
    paddingHorizontal: ms(10),
    paddingVertical: ms(8),
    fontSize: ms(14),
    color: theme.text,
    backgroundColor: theme.bgElevated,
  },
  forceWarning: { fontSize: ms(11), color: theme.warning, fontWeight: '600', marginTop: ms(8) },
  footer: { flexDirection: 'row', gap: ms(10), marginTop: ms(14) },
  cancelBtn: {
    flex: 1,
    backgroundColor: theme.bgMuted,
    borderRadius: ms(10),
    paddingVertical: ms(12),
    alignItems: 'center',
  },
  cancelBtnText: { color: theme.text, fontWeight: '600', fontSize: ms(13) },
  confirmBtn: {
    flex: 2,
    backgroundColor: theme.primary,
    borderRadius: ms(10),
    paddingVertical: ms(12),
    alignItems: 'center',
  },
  confirmBtnText: { color: theme.textOnPrimary, fontWeight: '700', fontSize: ms(13) },
});
