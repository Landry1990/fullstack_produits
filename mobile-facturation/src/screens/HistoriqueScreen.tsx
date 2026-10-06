import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Platform } from 'react-native';
import { ArrowLeft, Receipt, ChevronDown, ChevronRight } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { getHistorique } from '../services/historique';
import { getFactureStatuses, getMe } from '../services/api';
import { useAuthStore } from '../stores/useAuthStore';
import { theme } from '../config/theme';
import { moderateScale as ms } from '../utils/scale';
import type { HistoriqueItem } from '../types';

const formatDate = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// Badge de suivi d'encaissement : statut backend de la facture envoyée en
// caisse (match par numero_facture). Fallback « Envoyée » quand le statut
// n'est pas encore remonté (hors ligne, première ouverture…).
const badgeFor = (statusMap: Record<string, string>, numero: string | null) => {
  const st = numero ? statusMap[numero] : undefined;
  switch (st) {
    case 'PAY':
      return { label: i18n.t('historique.badge_paid'), bg: theme.primaryWash, fg: theme.primaryDark };
    case 'VAL':
      return { label: i18n.t('historique.badge_pending'), bg: theme.warningWash, fg: theme.warning };
    case 'ANN':
      return { label: i18n.t('historique.badge_cancelled'), bg: theme.dangerWash, fg: theme.danger };
    case 'BROU':
      return { label: i18n.t('historique.badge_draft'), bg: theme.bgMuted, fg: theme.textMuted };
    default:
      return { label: i18n.t('historique.badge_sent'), bg: theme.primaryWash, fg: theme.primary };
  }
};

export function HistoriqueScreen({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<HistoriqueItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [statusMap, setStatusMap] = useState<Record<string, string>>({});
  // Une seule entrée dépliée à la fois — tap sur la ligne = détail produits.
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadStatuses = useCallback(async () => {
    try {
      let userId = useAuthStore.getState().userId;
      if (!userId) {
        const me = await getMe();
        useAuthStore.getState().setUserId(me.id);
        userId = me.id;
      }
      setStatusMap(await getFactureStatuses(userId));
    } catch {
      // Hors ligne / endpoint indisponible : badges précédents conservés.
    }
  }, []);

  const load = useCallback(async () => {
    setItems(await getHistorique());
    void loadStatuses();
  }, [loadStatuses]);

  useEffect(() => { void load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={[styles.container, {
      paddingBottom: Math.min(insets.bottom, 24),
      paddingLeft: insets.left,
      paddingRight: insets.right,
    }]}>
      <View style={[styles.header, { paddingTop: 12 + (Platform.OS === 'web' ? 0 : insets.top) }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <ArrowLeft size={ms(20)} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('historique.title')}</Text>
      </View>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Receipt size={ms(40)} color={theme.borderStrong} />
            <Text style={styles.empty}>{t('historique.empty')}</Text>
          </View>
        }
        renderItem={({ item }) => {
          const expanded = expandedId === item.id;
          return (
            <TouchableOpacity
              style={styles.row}
              activeOpacity={0.7}
              onPress={() => setExpandedId(expanded ? null : item.id)}
            >
              <View style={styles.rowTop}>
                <View style={styles.rowLeft}>
                  <Text style={styles.numero}>{item.numero_facture ?? '—'}</Text>
                  <Text style={styles.meta}>
                    {formatDate(item.timestamp)} · {t('common.articles_count', { count: item.articles_count })}
                  </Text>
                  {item.client ? <Text style={styles.client}>{item.client}</Text> : null}
                </View>
                <View style={styles.rowRight}>
                  <Text style={styles.total}>{item.total_estime.toLocaleString('fr-FR')} F</Text>
                  {(() => {
                    const b = badgeFor(statusMap, item.numero_facture);
                    return (
                      <View style={[styles.badge, { backgroundColor: b.bg }]}>
                        <Text style={[styles.badgeText, { color: b.fg }]}>{b.label}</Text>
                      </View>
                    );
                  })()}
                  {expanded
                    ? <ChevronDown size={ms(16)} color={theme.textMuted} />
                    : <ChevronRight size={ms(16)} color={theme.textMuted} />}
                </View>
              </View>
              {expanded && (
                <View style={styles.detail}>
                  {item.lignes && item.lignes.length > 0 ? (
                    <>
                      {item.lignes.map((l, i) => (
                        <View key={i} style={styles.detailLine}>
                          <Text style={styles.detailName} numberOfLines={1}>
                            {l.quantite}× {l.name}
                            {l.remise > 0 ? ` (−${l.remise}%)` : ''}
                          </Text>
                          <Text style={styles.detailTotal}>
                            {l.total_ttc.toLocaleString('fr-FR')} F
                          </Text>
                        </View>
                      ))}
                      {(item.remise_globale ?? 0) > 0 && (
                        <View style={styles.detailLine}>
                          <Text style={styles.detailRemise}>{t('historique.global_discount')}</Text>
                          <Text style={styles.detailRemise}>
                            −{(item.remise_globale ?? 0).toLocaleString('fr-FR')} F
                          </Text>
                        </View>
                      )}
                    </>
                  ) : (
                    <Text style={styles.detailEmpty}>{t('historique.detail_empty')}</Text>
                  )}
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ms(16),
    paddingVertical: ms(12),
    backgroundColor: theme.bgElevated,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  backBtn: { padding: ms(6), marginRight: ms(8) },
  title: { fontSize: ms(18), fontWeight: '700', color: theme.text },
  list: { padding: ms(12), flexGrow: 1 },
  row: {
    backgroundColor: theme.bgElevated,
    borderRadius: ms(theme.radiusSm),
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: ms(12),
    paddingVertical: ms(10),
    marginBottom: ms(6),
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLeft: { flex: 1, gap: ms(2) },
  numero: { fontSize: ms(14), fontWeight: '700', color: theme.text },
  meta: { fontSize: ms(12), color: theme.textMuted },
  client: { fontSize: ms(12), color: theme.textSecondary },
  rowRight: { alignItems: 'flex-end', gap: ms(4) },
  total: { fontSize: ms(14), fontWeight: '700', color: theme.primary },
  badge: {
    backgroundColor: theme.primaryWash,
    borderRadius: ms(10),
    paddingHorizontal: ms(8),
    paddingVertical: ms(2),
  },
  badgeText: { fontSize: ms(10), fontWeight: '700', color: theme.primary },
  detail: {
    marginTop: ms(8),
    paddingTop: ms(8),
    borderTopWidth: 1,
    borderTopColor: theme.border,
    gap: ms(4),
  },
  detailLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: ms(8) },
  detailName: { flex: 1, fontSize: ms(12), color: theme.textSecondary },
  detailTotal: { fontSize: ms(12), fontWeight: '700', color: theme.text },
  detailRemise: { fontSize: ms(12), fontWeight: '600', color: theme.warning },
  detailEmpty: { fontSize: ms(12), color: theme.textMuted, fontStyle: 'italic' },
  emptyBox: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: ms(12), padding: ms(24) },
  empty: { textAlign: 'center', color: theme.textMuted, fontSize: ms(14) },
});
