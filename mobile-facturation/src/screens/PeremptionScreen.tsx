import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl,
  Platform, ActivityIndicator,
} from 'react-native';
import { ArrowLeft, CalendarClock, Pin, PinOff } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { getExpiringLots, getShelfLots, markShelfLots, type ExpiringLot } from '../services/api';
import { StockLiveIndicator } from '../components/StockLiveIndicator';
import { theme } from '../config/theme';
import { moderateScale as ms } from '../utils/scale';
import { expiryInfo } from '../utils/format';

// Horizons proposés : affichés en mois (habitude pharmacien), envoyés en
// jours — GET /stock-lots/?expiring_within_days=N inclut les lots DÉJÀ
// périmés (pas de borne basse côté backend).
const HORIZONS = [
  { months: 1, days: 30 },
  { months: 2, days: 60 },
  { months: 3, days: 90 },
  { months: 6, days: 180 },
];

const DAY_MS = 86_400_000;

// Classement pour la collecte physique : par date (chronologique, tri
// serveur), ou groupé par rayon / forme puis alpha — l'ordre des rayons
// suit celui du magasin quand on circule dans les allées.
type GroupMode = 'date' | 'rayon' | 'forme';
type RowItem = { type: 'header'; label: string; count: number } | { type: 'lot'; lot: ExpiringLot };

export function PeremptionScreen({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [days, setDays] = useState(90);
  const [groupMode, setGroupMode] = useState<GroupMode>('rayon');
  // Vue « étagère » : liste dédiée des lots déplacés physiquement devant.
  const [shelfView, setShelfView] = useState(false);
  const [items, setItems] = useState<ExpiringLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [marking, setMarking] = useState<number | null>(null);

  const load = useCallback(async (spinner = false) => {
    if (spinner) setLoading(true);
    setError(false);
    try {
      setItems(shelfView ? await getShelfLots() : await getExpiringLots(days));
    } catch {
      setError(true);
    }
    setLoading(false);
    setRefreshing(false);
  }, [days, shelfView]);

  useEffect(() => { void load(true); }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    void load();
  };

  // Jours restants avant péremption (négatif = déjà périmé).
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const daysLeft = (iso: string | null) =>
    iso ? Math.ceil((new Date(`${iso}T00:00:00`).getTime() - todayStart.getTime()) / DAY_MS) : null;

  // Valeur en jeu = Σ quantité × dernier prix d'achat (price_cost du lot).
  const totalValue = items.reduce(
    (sum, i) => sum + i.quantity_remaining * (parseFloat(i.price_cost ?? '0') || 0),
    0
  );

  const badgeFor = (d: number | null) => {
    if (d === null) return { label: t('peremption.no_exp'), fg: theme.textMuted, bg: theme.bgMuted };
    if (d < 0) return { label: t('peremption.expired'), fg: theme.danger, bg: theme.dangerWash };
    // ≤ 30 j : urgence affichée en jours (J-N) ; au-delà : en mois.
    if (d <= 30) return { label: t('peremption.days_left', { count: d }), fg: theme.danger, bg: theme.dangerWash };
    const months = Math.round(d / 30);
    if (months <= 2) return { label: t('peremption.months_left', { count: months }), fg: theme.warning, bg: theme.warningWash };
    return { label: t('peremption.months_left', { count: months }), fg: theme.info, bg: theme.infoWash };
  };

  // Marquage/démarquage manuel de l'étagère — la quantité ne bouge pas.
  // En vue étagère, le lot démarqué disparaît de la liste ; en vue
  // collecte il reste et son badge disparaît.
  const toggleShelf = async (lot: ExpiringLot) => {
    if (marking !== null) return;
    const deplace = !lot.deplace_peremption_le;
    setMarking(lot.id);
    try {
      await markShelfLots([lot.id], deplace);
      setItems((prev) =>
        shelfView && !deplace
          ? prev.filter((l) => l.id !== lot.id)
          : prev.map((l) =>
              l.id === lot.id
                ? { ...l, deplace_peremption_le: deplace ? new Date().toISOString() : null }
                : l
            )
      );
    } catch {
      Alert.alert(t('peremption.title'), t('peremption.shelf_error'));
    } finally {
      setMarking(null);
    }
  };

  // Liste plate prête pour FlatList : en mode date = ordre serveur
  // chronologique ; en mode rayon/forme = en-têtes de groupe (alpha,
  // « non classé » en dernier) puis lots alpha par produit + FEFO.
  const rows = useMemo<RowItem[]>(() => {
    // Vue étagère : lieu unique → liste plate alpha produit + FEFO.
    if (shelfView) {
      return [...items]
        .sort((a, b) =>
          a.produit_nom.localeCompare(b.produit_nom, 'fr') ||
          (a.date_expiration ?? '9999').localeCompare(b.date_expiration ?? '9999')
        )
        .map((lot) => ({ type: 'lot', lot }));
    }
    if (groupMode === 'date') return items.map((lot) => ({ type: 'lot', lot }));
    const key = groupMode === 'rayon' ? 'produit_rayon' : 'produit_forme';
    const groups = new Map<string, ExpiringLot[]>();
    for (const lot of items) {
      const label = lot[key] || t('peremption.no_group');
      const group = groups.get(label);
      if (group) group.push(lot); else groups.set(label, [lot]);
    }
    const sortedLabels = [...groups.keys()].sort((a, b) => {
      const noGroup = t('peremption.no_group');
      if (a === noGroup) return 1;
      if (b === noGroup) return -1;
      return a.localeCompare(b, 'fr');
    });
    const out: RowItem[] = [];
    for (const label of sortedLabels) {
      const lots = (groups.get(label) ?? []).sort((a, b) =>
        a.produit_nom.localeCompare(b.produit_nom, 'fr') ||
        (a.date_expiration ?? '9999').localeCompare(b.date_expiration ?? '9999')
      );
      out.push({ type: 'header', label, count: lots.length });
      for (const lot of lots) out.push({ type: 'lot', lot });
    }
    return out;
  }, [items, groupMode, shelfView, t]);

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
        <Text style={styles.title}>{t('peremption.title')}</Text>
        <StockLiveIndicator />
      </View>

      {/* Horizon (masqué en vue étagère : elle ne dépend pas de la période) */}
      {!shelfView && (
        <View style={styles.chips}>
          {HORIZONS.map((h) => (
            <TouchableOpacity
              key={h.days}
              style={[styles.chip, days === h.days && styles.chipActive]}
              onPress={() => setDays(h.days)}
            >
              <Text style={[styles.chipText, days === h.days && styles.chipTextActive]}>
                {t('peremption.horizon', { count: h.months })}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Classement de la liste : chronologique ou groupé pour la
          collecte physique (rayon = allées, forme = galénique) + bascule
          vers la liste dédiée « étagère proches péremption » */}
      <View style={styles.chips}>
        {!shelfView &&
          (['date', 'rayon', 'forme'] as GroupMode[]).map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.chip, groupMode === m && styles.chipActive]}
              onPress={() => setGroupMode(m)}
            >
              <Text style={[styles.chipText, groupMode === m && styles.chipTextActive]}>
                {t(`peremption.group_${m}`)}
              </Text>
            </TouchableOpacity>
          ))}
        <TouchableOpacity
          style={[styles.chip, styles.chipShelf, shelfView && styles.chipShelfActive]}
          onPress={() => setShelfView((v) => !v)}
        >
          <Pin size={ms(12)} color={shelfView ? theme.warning : theme.textMuted} />
          <Text style={[styles.chipText, shelfView && styles.chipTextShelfActive]}>
            {t('peremption.shelf')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Synthèse : nombre de lots + valeur en jeu (prix d'achat) */}
      {!loading && !error && items.length > 0 && (
        <View style={styles.summary}>
          <Text style={styles.summaryText}>
            {t('peremption.summary', {
              count: items.length,
              value: Math.round(totalValue).toLocaleString('fr-FR'),
            })}
          </Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: ms(40) }} />
      ) : error ? (
        <View style={styles.emptyBox}>
          <CalendarClock size={ms(40)} color={theme.borderStrong} />
          <Text style={styles.empty}>{t('peremption.error')}</Text>
          <TouchableOpacity onPress={() => void load(true)} style={styles.retryBtn}>
            <Text style={styles.retryText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => (r.type === 'header' ? `h-${r.label}` : String(r.lot.id))}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <CalendarClock size={ms(40)} color={theme.borderStrong} />
              <Text style={styles.empty}>
                {shelfView
                  ? t('peremption.shelf_empty')
                  : t('peremption.empty', { months: days / 30, count: days / 30 })}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            if (item.type === 'header') {
              return (
                <Text style={styles.groupHeader}>
                  {item.label} · {item.count}
                </Text>
              );
            }
            const lot = item.lot;
            const d = daysLeft(lot.date_expiration);
            const badge = badgeFor(d);
            const exp = expiryInfo(lot.date_expiration);
            return (
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>{lot.produit_nom}</Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.meta} numberOfLines={1}>
                      {t('peremption.line_meta', {
                        lot: lot.lot || '—',
                        qty: lot.quantity_remaining,
                      })}
                    </Text>
                    {!shelfView && lot.deplace_peremption_le && (
                      <View style={styles.shelfBadge}>
                        <Pin size={ms(9)} color={theme.warning} />
                        <Text style={styles.shelfBadgeText}>{t('peremption.shelf_badge')}</Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={styles.right}>
                  <Text style={[styles.exp, { color: exp.color }]}>{exp.label}</Text>
                  <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.badgeText, { color: badge.fg }]}>{badge.label}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.pinBtn}
                  onPress={() => void toggleShelf(lot)}
                  disabled={marking === lot.id}
                  accessibilityLabel={shelfView || lot.deplace_peremption_le
                    ? t('peremption.shelf_unmark')
                    : t('peremption.shelf_mark')}
                >
                  {marking === lot.id ? (
                    <ActivityIndicator size="small" color={theme.warning} />
                  ) : shelfView || lot.deplace_peremption_le ? (
                    <PinOff size={ms(17)} color={theme.warning} />
                  ) : (
                    <Pin size={ms(17)} color={theme.textMuted} />
                  )}
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ms(16),
    paddingBottom: ms(10),
    backgroundColor: theme.bgElevated,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  backBtn: { padding: ms(6), marginRight: ms(6) },
  title: { fontSize: ms(18), fontWeight: '700', color: theme.text },
  chips: {
    flexDirection: 'row',
    gap: ms(8),
    paddingHorizontal: ms(16),
    paddingVertical: ms(10),
  },
  chip: {
    paddingHorizontal: ms(14),
    paddingVertical: ms(6),
    borderRadius: ms(16),
    backgroundColor: theme.bgMuted,
    borderWidth: 1,
    borderColor: theme.border,
  },
  chipActive: { backgroundColor: theme.primaryWash, borderColor: theme.primary },
  chipShelf: { flexDirection: 'row', alignItems: 'center', gap: ms(5), marginLeft: 'auto' },
  chipShelfActive: { backgroundColor: theme.warningWash, borderColor: theme.warning },
  chipText: { fontSize: ms(12), fontWeight: '700', color: theme.textMuted },
  chipTextActive: { color: theme.primary },
  chipTextShelfActive: { color: theme.warning },
  summary: {
    marginHorizontal: ms(16),
    marginBottom: ms(8),
    padding: ms(10),
    borderRadius: ms(8),
    backgroundColor: theme.warningWash,
  },
  summaryText: { fontSize: ms(12), fontWeight: '700', color: theme.warning, textAlign: 'center' },
  list: { paddingHorizontal: ms(16), paddingBottom: ms(16) },
  groupHeader: {
    fontSize: ms(12),
    fontWeight: '800',
    color: theme.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: ms(10),
    marginBottom: ms(4),
  },
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
  name: { fontSize: ms(14), fontWeight: '700', color: theme.text },
  meta: { fontSize: ms(11), color: theme.textMuted, marginTop: ms(2) },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: ms(6) },
  shelfBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(3),
    marginTop: ms(2),
    paddingHorizontal: ms(5),
    paddingVertical: ms(1),
    borderRadius: ms(4),
    backgroundColor: theme.warningWash,
  },
  shelfBadgeText: { fontSize: ms(9), fontWeight: '800', color: theme.warning, textTransform: 'uppercase' },
  pinBtn: { padding: ms(8), marginLeft: ms(2) },
  right: { alignItems: 'flex-end', gap: ms(4) },
  exp: { fontSize: ms(13), fontWeight: '700' },
  badge: { paddingHorizontal: ms(8), paddingVertical: ms(2), borderRadius: ms(4) },
  badgeText: { fontSize: ms(11), fontWeight: '700' },
  emptyBox: { alignItems: 'center', marginTop: ms(60), gap: ms(12) },
  empty: { fontSize: ms(13), color: theme.textMuted, textAlign: 'center' },
  retryBtn: {
    paddingHorizontal: ms(16),
    paddingVertical: ms(8),
    borderRadius: ms(8),
    backgroundColor: theme.primaryWash,
  },
  retryText: { fontSize: ms(13), fontWeight: '700', color: theme.primary },
});
