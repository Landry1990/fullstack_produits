import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  FlatList, Alert, ActivityIndicator, Platform, Keyboard, RefreshControl,
} from 'react-native';
import { ArrowLeft, Search, ScanBarcode, Megaphone, PackageX } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
  searchProducts, getProductById, createSignalementBesoin, getMesSignalements,
  type SignalementBesoin,
} from '../services/api';
import { useProductSearch } from '../hooks/useProductSearch';
import { ScanBarcodeModal } from '../components/ScanBarcodeModal';
import { theme } from '../config/theme';
import { moderateScale as ms } from '../utils/scale';
import type { Product } from '../types';

const statutBadge = (statut: string, t: (k: string) => string) => {
  switch (statut) {
    case 'INTEGRE':
      return { label: t('signalement.badge_integre'), bg: theme.primaryWash, fg: theme.primaryDark };
    case 'IGNORE':
      return { label: t('signalement.badge_ignore'), bg: theme.bgMuted, fg: theme.textMuted };
    default:
      return { label: t('signalement.badge_nouveau'), bg: theme.warningWash, fg: theme.warning };
  }
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function SignalementScreen({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { resolveBarcode } = useProductSearch();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [scanVisible, setScanVisible] = useState(false);

  const [product, setProduct] = useState<Product | null>(null);
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [items, setItems] = useState<SignalementBesoin[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Recherche produit débouncée (même pattern que FacturationScreen).
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.trim().length >= 2) {
        setSearching(true);
        try {
          setResults(await searchProducts(query.trim()));
        } catch {}
        setSearching(false);
      } else {
        setResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const loadItems = useCallback(async () => {
    try {
      setItems(await getMesSignalements());
    } catch {}
  }, []);

  useEffect(() => { void loadItems(); }, [loadItems]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadItems();
    setRefreshing(false);
  };

  const selectProduct = useCallback(async (p: Product) => {
    Keyboard.dismiss();
    setQuery('');
    setResults([]);
    const full = await getProductById(p.id).catch(() => p);
    setProduct(full);
  }, []);

  const handleSubmit = async () => {
    if (!product) return;
    const qtyNum = qty ? parseInt(qty, 10) : null;
    if (qty && (!qtyNum || qtyNum <= 0)) {
      Alert.alert(t('common.error'), t('signalement.error_qty'));
      return;
    }
    setSubmitting(true);
    try {
      await createSignalementBesoin(product.id, qtyNum, note);
      Alert.alert(
        t('signalement.success_title'),
        t('signalement.success_msg', { name: product.name })
      );
      setProduct(null);
      setQty('');
      setNote('');
      void loadItems();
    } catch (err: unknown) {
      const detailMsg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      Alert.alert(t('common.error'), detailMsg ?? t('signalement.error_generic'));
    } finally {
      setSubmitting(false);
    }
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
        <Text style={styles.title}>{t('signalement.title')}</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        {/* Saisie : recherche/scan produit + quantité + note */}
        {!product ? (
          <>
            <View style={styles.searchBar}>
              <Search size={ms(18)} color={theme.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder={t('signalement.search_placeholder')}
                placeholderTextColor={theme.textMuted}
                value={query}
                onChangeText={setQuery}
                autoCorrect={false}
                autoCapitalize="none"
              />
              {Platform.OS !== 'web' && (
                <TouchableOpacity onPress={() => setScanVisible(true)}>
                  <ScanBarcode size={ms(20)} color={theme.primary} />
                </TouchableOpacity>
              )}
            </View>
            {searching && <ActivityIndicator color={theme.primary} style={{ marginTop: ms(12) }} />}
            {results.map((p) => (
              <TouchableOpacity key={p.id} style={styles.resultRow} onPress={() => void selectProduct(p)}>
                <Text style={styles.resultName} numberOfLines={1}>{p.name}</Text>
                <Text style={styles.resultStock}>{t('scan.stock_label', { count: p.stock })}</Text>
              </TouchableOpacity>
            ))}
          </>
        ) : (
          <View style={styles.form}>
            <View style={styles.productCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
                <Text style={styles.productStock}>
                  {t('ajustement.current_stock', { count: product.stock })}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setProduct(null)} style={styles.changeBtn}>
                <Text style={styles.changeBtnText}>{t('facturation.edit')}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.block}>
              <Text style={styles.blockLabel}>{t('signalement.qty_optional')}</Text>
              <TextInput
                style={styles.qtyInput}
                value={qty}
                onChangeText={(v) => setQty(v.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
                placeholder="—"
                placeholderTextColor={theme.textMuted}
              />
            </View>

            <View style={styles.block}>
              <Text style={styles.blockLabel}>{t('signalement.note_optional')}</Text>
              <TextInput
                style={styles.noteInput}
                value={note}
                onChangeText={setNote}
                placeholder={t('signalement.note_placeholder')}
                placeholderTextColor={theme.textMuted}
                multiline
              />
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, submitting && { opacity: 0.4 }]}
              disabled={submitting}
              onPress={handleSubmit}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Megaphone size={ms(18)} color="#fff" />
                  <Text style={styles.submitText}>{t('signalement.submit')}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Mes derniers signalements */}
        <Text style={styles.sectionTitle}>{t('signalement.recent')}</Text>
        {items.length === 0 ? (
          <View style={styles.emptyRow}>
            <PackageX size={ms(18)} color={theme.borderStrong} />
            <Text style={styles.emptyText}>{t('signalement.empty')}</Text>
          </View>
        ) : (
          items.map((s) => {
            const b = statutBadge(s.statut, t);
            return (
              <View key={s.id} style={styles.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {s.produit_nom ?? `#${s.produit}`}
                    {s.quantite ? ` ×${s.quantite}` : ''}
                  </Text>
                  <Text style={styles.itemMeta}>
                    {formatDate(s.created_at)}
                    {s.note ? ` · ${s.note}` : ''}
                  </Text>
                </View>
                <View style={[styles.badge, { backgroundColor: b.bg }]}>
                  <Text style={[styles.badgeText, { color: b.fg }]}>{b.label}</Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <ScanBarcodeModal
        visible={scanVisible}
        onResolve={resolveBarcode}
        onAdd={(result) => {
          setScanVisible(false);
          void selectProduct(result.product);
        }}
        onClose={() => setScanVisible(false)}
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
  content: { padding: ms(12), flexGrow: 1 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(10),
    backgroundColor: theme.bgElevated,
    borderRadius: ms(theme.radiusMd),
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: ms(12),
    paddingVertical: ms(10),
  },
  searchInput: { flex: 1, fontSize: ms(15), color: theme.text, padding: 0 },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.bgElevated,
    borderRadius: ms(theme.radiusSm),
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: ms(12),
    paddingVertical: ms(10),
    marginTop: ms(6),
  },
  resultName: { flex: 1, fontSize: ms(14), fontWeight: '600', color: theme.text },
  resultStock: { fontSize: ms(12), color: theme.textMuted, marginLeft: ms(8) },
  form: { gap: ms(10) },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.warningWash,
    borderRadius: ms(theme.radiusMd),
    borderWidth: 1,
    borderColor: theme.warning,
    padding: ms(14),
    gap: ms(10),
  },
  productName: { fontSize: ms(15), fontWeight: '700', color: theme.text },
  productStock: { fontSize: ms(13), color: theme.warning, marginTop: ms(2) },
  changeBtn: {
    paddingHorizontal: ms(10),
    paddingVertical: ms(6),
    borderRadius: ms(theme.radiusSm),
    backgroundColor: theme.bgElevated,
    borderWidth: 1,
    borderColor: theme.border,
  },
  changeBtnText: { fontSize: ms(12), fontWeight: '600', color: theme.textSecondary },
  block: {
    backgroundColor: theme.bgElevated,
    borderRadius: ms(theme.radiusMd),
    borderWidth: 1,
    borderColor: theme.border,
    padding: ms(14),
    gap: ms(8),
  },
  blockLabel: { fontSize: ms(12), fontWeight: '600', color: theme.textMuted },
  qtyInput: {
    width: ms(90),
    borderWidth: 1,
    borderColor: theme.borderStrong,
    borderRadius: ms(8),
    paddingVertical: ms(6),
    paddingHorizontal: ms(10),
    fontSize: ms(16),
    fontWeight: '700',
    color: theme.text,
    textAlign: 'center',
    backgroundColor: theme.bg,
  },
  noteInput: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: ms(8),
    padding: ms(10),
    fontSize: ms(13),
    color: theme.text,
    minHeight: ms(56),
    textAlignVertical: 'top',
    backgroundColor: theme.bg,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: ms(8),
    backgroundColor: theme.primary,
    borderRadius: ms(theme.radiusMd),
    paddingVertical: ms(14),
  },
  submitText: { color: '#fff', fontSize: ms(15), fontWeight: '700' },
  sectionTitle: {
    fontSize: ms(13),
    fontWeight: '700',
    color: theme.textMuted,
    marginTop: ms(16),
    marginBottom: ms(6),
  },
  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: ms(8), paddingVertical: ms(8) },
  emptyText: { fontSize: ms(12), color: theme.textMuted, fontStyle: 'italic' },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(8),
    backgroundColor: theme.bgElevated,
    borderRadius: ms(theme.radiusSm),
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: ms(12),
    paddingVertical: ms(8),
    marginBottom: ms(6),
  },
  itemName: { fontSize: ms(13), fontWeight: '600', color: theme.text },
  itemMeta: { fontSize: ms(11), color: theme.textMuted, marginTop: ms(2) },
  badge: {
    borderRadius: ms(10),
    paddingHorizontal: ms(8),
    paddingVertical: ms(2),
  },
  badgeText: { fontSize: ms(10), fontWeight: '700' },
});
