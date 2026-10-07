import React from 'react';
import {
  Modal, View, Text, TouchableOpacity, FlatList, StyleSheet,
} from 'react-native';
import { Clock, RefreshCcw, GitMerge, Trash2 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { usePendingEntreeStore } from '../stores/usePendingEntreeStore';
import { theme } from '../config/theme';
import { moderateScale as ms } from '../utils/scale';
import type { PendingEntree } from '../types';

interface Props {
  visible: boolean;
  // Réception courante vide → pas de bouton « Fusionner ».
  entreeEmpty: boolean;
  onRestore: (entree: PendingEntree) => void;
  onMerge: (entree: PendingEntree) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const formatHeure = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const num = (v: string | undefined): number => {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

const entreeTotal = (e: PendingEntree) =>
  e.lines.reduce((a, l) => a + (parseInt(l.quantity, 10) || 0) * num(l.price), 0);

const entreeArticles = (e: PendingEntree) =>
  e.lines.reduce((a, l) => a + (parseInt(l.quantity, 10) || 0) + (parseInt(l.unites_gratuites, 10) || 0), 0);

export function PendingEntreeModal({ visible, entreeEmpty, onRestore, onMerge, onDelete, onClose }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const entries = usePendingEntreeStore((s) => s.entries);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.overlay, {
        paddingTop: Math.max(insets.top, 24),
        paddingBottom: Math.max(insets.bottom, 24),
      }]}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Clock size={ms(18)} color={theme.warning} />
              <Text style={styles.title}>{t('pendingEntree.title')}</Text>
              {entries.length > 0 && (
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{entries.length}</Text>
                </View>
              )}
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={entries}
            keyExtractor={(e) => e.id}
            style={styles.list}
            ListEmptyComponent={
              <Text style={styles.empty}>{t('pendingEntree.empty')}</Text>
            }
            renderItem={({ item }) => (
              <View style={styles.row}>
                <View style={styles.rowTop}>
                  <View style={styles.rowLeft}>
                    <Text style={styles.fournisseur} numberOfLines={1}>
                      {item.fournisseur?.name ?? t('pendingEntree.no_supplier')}
                    </Text>
                    <Text style={styles.meta}>
                      {t('pendingEntree.meta', {
                        time: formatHeure(item.timestamp),
                        articles: entreeArticles(item),
                        lines: item.lines.length,
                      })}
                    </Text>
                  </View>
                  <Text style={styles.total}>{entreeTotal(item).toLocaleString('fr-FR')} F</Text>
                </View>
                <View style={styles.preview}>
                  {item.lines.slice(0, 3).map((l) => (
                    <Text key={l.key} style={styles.previewLine} numberOfLines={1}>
                      {l.quantity}× {l.product.name}
                    </Text>
                  ))}
                  {item.lines.length > 3 && (
                    <Text style={styles.previewMore}>
                      {t('pending.more_lines', { count: item.lines.length - 3 })}
                    </Text>
                  )}
                </View>
                <View style={styles.actions}>
                  {!entreeEmpty && (
                    <TouchableOpacity style={styles.mergeBtn} onPress={() => onMerge(item)}>
                      <GitMerge size={ms(14)} color={theme.textSecondary} />
                      <Text style={styles.mergeText}>{t('pending.merge')}</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.restoreBtn} onPress={() => onRestore(item)}>
                    <RefreshCcw size={ms(14)} color="#fff" />
                    <Text style={styles.restoreText}>{t('pending.restore')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete(item.id)}>
                    <Trash2 size={ms(14)} color={theme.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
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
    maxWidth: ms(480),
    maxHeight: '85%',
    padding: ms(20),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: ms(14),
    paddingBottom: ms(12),
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: ms(8) },
  title: { fontSize: ms(17), fontWeight: '700', color: theme.text },
  countBadge: {
    backgroundColor: theme.warningWash,
    borderRadius: ms(10),
    paddingHorizontal: ms(8),
    paddingVertical: ms(2),
    borderWidth: 1,
    borderColor: theme.warning,
  },
  countText: { fontSize: ms(11), fontWeight: '800', color: theme.warning },
  closeBtn: { padding: ms(4) },
  closeBtnText: { color: theme.textMuted, fontSize: ms(18) },
  list: { flexGrow: 0 },
  empty: { textAlign: 'center', color: theme.textMuted, fontSize: ms(13), marginVertical: ms(28) },
  row: {
    backgroundColor: theme.bgMuted,
    borderRadius: ms(10),
    borderWidth: 1,
    borderColor: theme.border,
    padding: ms(12),
    marginBottom: ms(8),
  },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: ms(8) },
  rowLeft: { flex: 1, gap: ms(2) },
  fournisseur: { fontSize: ms(14), fontWeight: '700', color: theme.text },
  meta: { fontSize: ms(11), color: theme.textMuted },
  total: { fontSize: ms(15), fontWeight: '800', color: theme.primary },
  preview: { marginTop: ms(8), gap: ms(2) },
  previewLine: { fontSize: ms(12), color: theme.textSecondary },
  previewMore: { fontSize: ms(11), color: theme.textMuted, fontStyle: 'italic' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: ms(8), marginTop: ms(10) },
  mergeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(5),
    paddingHorizontal: ms(10),
    paddingVertical: ms(8),
    borderRadius: ms(8),
    backgroundColor: theme.bgElevated,
    borderWidth: 1,
    borderColor: theme.borderStrong,
  },
  mergeText: { fontSize: ms(12), fontWeight: '700', color: theme.textSecondary },
  restoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(6),
    paddingHorizontal: ms(14),
    paddingVertical: ms(8),
    borderRadius: ms(8),
    backgroundColor: theme.primary,
  },
  restoreText: { fontSize: ms(12), fontWeight: '700', color: '#fff' },
  deleteBtn: {
    padding: ms(8),
    borderRadius: ms(8),
    backgroundColor: theme.dangerWash,
  },
});
