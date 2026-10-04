import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { ArrowLeft, Receipt } from 'lucide-react-native';
import { getHistorique } from '../services/historique';
import { theme } from '../config/theme';
import type { HistoriqueItem } from '../types';

const formatDate = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function HistoriqueScreen({ onBack }: { onBack: () => void }) {
  const [items, setItems] = useState<HistoriqueItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setItems(await getHistorique());
  }, []);

  useEffect(() => { void load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <ArrowLeft size={20} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Historique</Text>
      </View>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Receipt size={40} color={theme.borderStrong} />
            <Text style={styles.empty}>Aucune vente envoyée pour le moment</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.numero}>{item.numero_facture ?? '—'}</Text>
              <Text style={styles.meta}>
                {formatDate(item.timestamp)} · {item.articles_count} article(s)
              </Text>
              {item.client ? <Text style={styles.client}>{item.client}</Text> : null}
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.total}>{item.total_estime.toLocaleString('fr-FR')} F</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Envoyée</Text>
              </View>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.bgElevated,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  backBtn: { padding: 6, marginRight: 8 },
  title: { fontSize: 18, fontWeight: '700', color: theme.text },
  list: { padding: 12, flexGrow: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.bgElevated,
    borderRadius: theme.radiusSm,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
  },
  rowLeft: { flex: 1, gap: 2 },
  numero: { fontSize: 14, fontWeight: '700', color: theme.text },
  meta: { fontSize: 12, color: theme.textMuted },
  client: { fontSize: 12, color: theme.textSecondary },
  rowRight: { alignItems: 'flex-end', gap: 4 },
  total: { fontSize: 14, fontWeight: '700', color: theme.primary },
  badge: {
    backgroundColor: theme.primaryWash,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 10, fontWeight: '700', color: theme.primary },
  emptyBox: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24 },
  empty: { textAlign: 'center', color: theme.textMuted, fontSize: 14 },
});
