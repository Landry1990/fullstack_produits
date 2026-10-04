import React from 'react';
import {
  Modal, View, Text, TouchableOpacity, FlatList, StyleSheet,
} from 'react-native';
import { Clock, RefreshCcw, GitMerge, Trash2 } from 'lucide-react-native';
import { usePendingStore } from '../stores/usePendingStore';
import { theme } from '../config/theme';
import type { PendingSale } from '../types';

interface Props {
  visible: boolean;
  cartEmpty: boolean;
  onRestore: (sale: PendingSale) => void;
  onMerge: (sale: PendingSale) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const formatHeure = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// Total net affiché : sous-total des lignes − remise globale (mêmes règles
// d'arrondi que le store panier, F CFA entier).
const saleTotal = (s: PendingSale) => {
  const st = s.lines.reduce((a, l) => a + l.total_ttc, 0);
  const remise = s.remiseMode === 'taux'
    ? Math.round((st * s.remiseGlobale) / 100)
    : Math.round(Math.min(s.remiseGlobale, st));
  return Math.max(0, st - remise);
};

const saleArticles = (s: PendingSale) =>
  s.lines.reduce((a, l) => a + l.quantite, 0);

export function PendingSalesModal({ visible, cartEmpty, onRestore, onMerge, onDelete, onClose }: Props) {
  const sales = usePendingStore((s) => s.sales);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Clock size={18} color={theme.warning} />
              <Text style={styles.title}>Ventes en attente</Text>
              {sales.length > 0 && (
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{sales.length}</Text>
                </View>
              )}
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={sales}
            keyExtractor={(s) => s.id}
            style={styles.list}
            ListEmptyComponent={
              <Text style={styles.empty}>Aucune vente en attente</Text>
            }
            renderItem={({ item }) => (
              <View style={styles.row}>
                <View style={styles.rowTop}>
                  <View style={styles.rowLeft}>
                    <Text style={styles.client} numberOfLines={1}>
                      {item.client?.name ?? 'Client de passage'}
                    </Text>
                    <Text style={styles.meta}>
                      {formatHeure(item.timestamp)} · {saleArticles(item)} article(s) · {item.lines.length} ligne(s)
                    </Text>
                  </View>
                  <Text style={styles.total}>{saleTotal(item).toLocaleString('fr-FR')} F</Text>
                </View>
                <View style={styles.preview}>
                  {item.lines.slice(0, 3).map((l, i) => (
                    <Text key={i} style={styles.previewLine} numberOfLines={1}>
                      {l.quantite}× {l.product.name}
                    </Text>
                  ))}
                  {item.lines.length > 3 && (
                    <Text style={styles.previewMore}>+ {item.lines.length - 3} autre(s)</Text>
                  )}
                </View>
                <View style={styles.actions}>
                  {!cartEmpty && (
                    <TouchableOpacity style={styles.mergeBtn} onPress={() => onMerge(item)}>
                      <GitMerge size={14} color={theme.textSecondary} />
                      <Text style={styles.mergeText}>Fusionner</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.restoreBtn} onPress={() => onRestore(item)}>
                    <RefreshCcw size={14} color="#fff" />
                    <Text style={styles.restoreText}>Reprendre</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete(item.id)}>
                    <Trash2 size={14} color={theme.danger} />
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
    padding: 24,
  },
  sheet: {
    backgroundColor: theme.bgElevated,
    borderRadius: 16,
    width: '100%',
    maxWidth: 480,
    maxHeight: '85%',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 17, fontWeight: '700', color: theme.text },
  countBadge: {
    backgroundColor: theme.warningWash,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: theme.warning,
  },
  countText: { fontSize: 11, fontWeight: '800', color: theme.warning },
  closeBtn: { padding: 4 },
  closeBtnText: { color: theme.textMuted, fontSize: 18 },
  list: { flexGrow: 0 },
  empty: { textAlign: 'center', color: theme.textMuted, fontSize: 13, marginVertical: 28 },
  row: {
    backgroundColor: theme.bgMuted,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 12,
    marginBottom: 8,
  },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  rowLeft: { flex: 1, gap: 2 },
  client: { fontSize: 14, fontWeight: '700', color: theme.text },
  meta: { fontSize: 11, color: theme.textMuted },
  total: { fontSize: 15, fontWeight: '800', color: theme.primary },
  preview: { marginTop: 8, gap: 2 },
  previewLine: { fontSize: 12, color: theme.textSecondary },
  previewMore: { fontSize: 11, color: theme.textMuted, fontStyle: 'italic' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginTop: 10 },
  mergeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: theme.bgElevated,
    borderWidth: 1,
    borderColor: theme.borderStrong,
  },
  mergeText: { fontSize: 12, fontWeight: '700', color: theme.textSecondary },
  restoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: theme.primary,
  },
  restoreText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  deleteBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: theme.dangerWash,
  },
});
