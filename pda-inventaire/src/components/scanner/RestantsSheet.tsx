/**
 * RestantsSheet - Liste des lignes pré-remplies jamais comptées
 * (inventaire à périmètre rayon/forme). Bouton « tout mettre à 0 »
 * = produits absents physiquement → stock remis à 0 à la validation.
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { theme } from '../../config/theme';
import type { LigneInventaire } from '../../services/inventaire';

interface RestantsSheetProps {
  visible: boolean;
  lignes: LigneInventaire[];
  isOnline: boolean;
  zeroing: boolean;
  onClose: () => void;
  onZeroAll?: () => void;
}

export default function RestantsSheet({
  visible,
  lignes,
  isOnline,
  zeroing,
  onClose,
  onZeroAll,
}: RestantsSheetProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.overlay, { paddingTop: Math.max(insets.top, 16), paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.card}>
          <Text style={styles.title}>{t('scanner.restants_title', { count: lignes.length })}</Text>
          {lignes.length === 0 ? (
            <Text style={styles.empty}>{t('scanner.restants_empty')}</Text>
          ) : (
            <FlatList
              data={lignes}
              keyExtractor={(item) => String(item.id)}
              style={styles.list}
              renderItem={({ item }) => (
                <View style={styles.row}>
                  <View style={styles.rowMain}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {item.produit_nom || `#${item.produit}`}
                    </Text>
                    {item.lot_numero ? (
                      <Text style={styles.rowLot}>{item.lot_numero}</Text>
                    ) : null}
                  </View>
                  <Text style={styles.rowTheo}>
                    {t('scanner.restants_theo', { qty: item.stock_theorique ?? 0 })}
                  </Text>
                </View>
              )}
            />
          )}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>{t('common.close')}</Text>
            </TouchableOpacity>
            {onZeroAll && isOnline && lignes.length > 0 && (
              <TouchableOpacity style={styles.zeroBtn} onPress={onZeroAll} disabled={zeroing}>
                {zeroing ? (
                  <ActivityIndicator color={theme.textOnPrimary} size="small" />
                ) : (
                  <Text style={styles.zeroBtnText}>
                    {t('scanner.zero_all', { count: lignes.length })}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: theme.bgElevated,
    borderRadius: 12,
    padding: 16,
    maxHeight: '85%',
  },
  title: {
    color: theme.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  empty: {
    color: theme.textMuted,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 24,
  },
  list: {
    flexGrow: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  rowMain: {
    flex: 1,
    marginRight: 8,
  },
  rowName: {
    color: theme.text,
    fontSize: 14,
    fontWeight: '600',
  },
  rowLot: {
    color: theme.textMuted,
    fontSize: 12,
  },
  rowTheo: {
    color: theme.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    gap: 10,
  },
  closeBtn: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.bgMuted,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  closeBtnText: {
    color: theme.text,
    fontWeight: '700',
    fontSize: 14,
  },
  zeroBtn: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.danger,
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  zeroBtnText: {
    color: theme.textOnPrimary,
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'center',
  },
});
