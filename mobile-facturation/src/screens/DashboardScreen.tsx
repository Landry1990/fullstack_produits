import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Platform, ActivityIndicator } from 'react-native';
import { ArrowLeft, TrendingUp, TrendingDown, ShoppingBag, Receipt, BarChart3 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { getDashboardStats, type DashboardStats } from '../services/api';
import { theme } from '../config/theme';
import { moderateScale as ms } from '../utils/scale';

const fmtF = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} F`;

// Badge variation vs veille : vert si positif, rouge si négatif.
function ChangeBadge({ change }: { change: number }) {
  const up = change >= 0;
  return (
    <View style={[styles.changeBadge, { backgroundColor: up ? theme.primaryWash : theme.dangerWash }]}>
      {up
        ? <TrendingUp size={ms(12)} color={theme.primaryDark} />
        : <TrendingDown size={ms(12)} color={theme.danger} />}
      <Text style={[styles.changeText, { color: up ? theme.primaryDark : theme.danger }]}>
        {up ? '+' : ''}{change}%
      </Text>
    </View>
  );
}

export function DashboardScreen({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      setStats(await getDashboardStats());
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const global = stats?.revenue != null;

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
        <Text style={styles.title}>{t('dashboard.title')}</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        {loading ? (
          <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: ms(40) }} />
        ) : error || !stats ? (
          <View style={styles.emptyBox}>
            <BarChart3 size={ms(40)} color={theme.borderStrong} />
            <Text style={styles.empty}>{t('dashboard.error')}</Text>
          </View>
        ) : (
          <>
            {/* Chiffres globaux (pharmacien/staff) — absents pour VENDEUR/CAISSIER */}
            {global && stats.revenue && stats.sales && (
              <View style={styles.row}>
                <View style={styles.card}>
                  <Text style={styles.cardLabel}>{t('dashboard.today_revenue')}</Text>
                  <Text style={styles.cardValue}>{fmtF(stats.revenue.value)}</Text>
                  <ChangeBadge change={stats.revenue.change} />
                </View>
                <View style={styles.card}>
                  <Text style={styles.cardLabel}>{t('dashboard.today_sales')}</Text>
                  <Text style={styles.cardValue}>{stats.sales.value}</Text>
                  <ChangeBadge change={stats.sales.change} />
                </View>
              </View>
            )}

            {/* Stats personnelles — toujours présentes */}
            <View style={styles.row}>
              <View style={styles.card}>
                <View style={styles.cardIconRow}>
                  <Receipt size={ms(14)} color={theme.primary} />
                  <Text style={styles.cardLabel}>{t('dashboard.my_sales')}</Text>
                </View>
                <Text style={styles.cardValue}>{fmtF(stats.user_stats.sales)}</Text>
                <Text style={styles.cardMeta}>
                  {t('common.articles_count', { count: stats.user_stats.count })}
                </Text>
              </View>
              <View style={styles.card}>
                <View style={styles.cardIconRow}>
                  <ShoppingBag size={ms(14)} color={theme.primary} />
                  <Text style={styles.cardLabel}>{t('dashboard.avg_basket')}</Text>
                </View>
                <Text style={styles.cardValue}>{fmtF(stats.user_stats.avg_basket)}</Text>
              </View>
            </View>

            {/* Top produits du jour (rôles globaux uniquement) */}
            {global && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('dashboard.top_products')}</Text>
                {stats.top_products && stats.top_products.length > 0 ? (
                  stats.top_products.map((p, i) => (
                    <View key={p.id} style={styles.topRow}>
                      <Text style={styles.topRank}>{i + 1}</Text>
                      <Text style={styles.topName} numberOfLines={1}>{p.name}</Text>
                      <Text style={styles.topQty}>×{p.qty}</Text>
                      <Text style={styles.topRevenue}>{fmtF(p.revenue)}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.topEmpty}>{t('dashboard.empty_top')}</Text>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>
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
  content: { padding: ms(12), flexGrow: 1 },
  row: { flexDirection: 'row', gap: ms(10), marginBottom: ms(10) },
  card: {
    flex: 1,
    backgroundColor: theme.bgElevated,
    borderRadius: ms(theme.radiusMd),
    borderWidth: 1,
    borderColor: theme.border,
    padding: ms(14),
    gap: ms(4),
  },
  cardIconRow: { flexDirection: 'row', alignItems: 'center', gap: ms(6) },
  cardLabel: { fontSize: ms(12), color: theme.textMuted, fontWeight: '600' },
  cardValue: { fontSize: ms(20), fontWeight: '700', color: theme.text },
  cardMeta: { fontSize: ms(12), color: theme.textMuted },
  changeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: ms(4),
    borderRadius: ms(10),
    paddingHorizontal: ms(8),
    paddingVertical: ms(2),
  },
  changeText: { fontSize: ms(11), fontWeight: '700' },
  section: {
    backgroundColor: theme.bgElevated,
    borderRadius: ms(theme.radiusMd),
    borderWidth: 1,
    borderColor: theme.border,
    padding: ms(14),
  },
  sectionTitle: { fontSize: ms(14), fontWeight: '700', color: theme.text, marginBottom: ms(8) },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(8),
    paddingVertical: ms(6),
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  topRank: { fontSize: ms(12), fontWeight: '700', color: theme.textMuted, width: ms(18) },
  topName: { flex: 1, fontSize: ms(13), color: theme.text },
  topQty: { fontSize: ms(12), color: theme.textMuted },
  topRevenue: { fontSize: ms(13), fontWeight: '700', color: theme.primary },
  topEmpty: { fontSize: ms(12), color: theme.textMuted, fontStyle: 'italic' },
  emptyBox: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: ms(12), padding: ms(24) },
  empty: { textAlign: 'center', color: theme.textMuted, fontSize: ms(14) },
});
