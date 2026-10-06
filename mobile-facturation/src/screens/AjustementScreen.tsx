import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  FlatList, Alert, ActivityIndicator, Platform, Keyboard,
} from 'react-native';
import { ArrowLeft, Search, ScanBarcode, Minus, Plus, PackageCheck, PackagePlus } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
  searchProducts, getProductById, getLots, getStockAdjustmentReasons, adjustStock,
  type AdjustmentReason, type AdjustStockPayload,
} from '../services/api';
import { useProductSearch } from '../hooks/useProductSearch';
import { useSudo } from '../hooks/useSudo';
import { ScanBarcodeModal } from '../components/ScanBarcodeModal';
import { SudoModal } from '../components/SudoModal';
import { theme } from '../config/theme';
import { moderateScale as ms } from '../utils/scale';
import type { Product, StockLot } from '../types';

// Motifs standards (StockAdjustment.ReasonType backend). Les motifs
// personnalisés (configuration-options type=STOCK_ADJ) sont fusionnés.
const STANDARD_REASONS = [
  'CASSE', 'VOL', 'AVARIE', 'PERIME', 'USAGE_INT', 'CONFUSION', 'ERR_ENTREE', 'INVENTAIRE',
] as const;

// 'MM/AA' → 'YYYY-MM-DD' (dernier jour du mois, convention péremption).
const expInputToDate = (v: string): string | null => {
  const m = v.match(/^(\d{2})\/(\d{2})$/);
  if (!m) return null;
  const month = parseInt(m[1], 10);
  const year = 2000 + parseInt(m[2], 10);
  if (month < 1 || month > 12) return null;
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
};

export function AjustementScreen({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { resolveBarcode } = useProductSearch();
  const { sudoState, requireSudo, closeSudo } = useSudo();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [scanVisible, setScanVisible] = useState(false);

  const [product, setProduct] = useState<Product | null>(null);
  const [lots, setLots] = useState<StockLot[]>([]);
  const [lotId, setLotId] = useState<number | null>(null);
  const [newLotMode, setNewLotMode] = useState(false);
  const [newLotNumber, setNewLotNumber] = useState('');
  const [newLotExp, setNewLotExp] = useState('');
  const [mode, setMode] = useState<'remove' | 'add'>('remove');
  const [qty, setQty] = useState('1');
  const [reasons, setReasons] = useState<AdjustmentReason[]>([]);
  const [reason, setReason] = useState<string | null>(null);
  const [detail, setDetail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const pendingPayload = useRef<AdjustStockPayload | null>(null);

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

  useEffect(() => {
    void getStockAdjustmentReasons().then(setReasons).catch(() => {});
  }, []);

  const selectProduct = useCallback(async (p: Product, preselectLot?: StockLot | null) => {
    Keyboard.dismiss();
    setQuery('');
    setResults([]);
    setNewLotMode(false);
    setNewLotNumber('');
    setNewLotExp('');
    // Détail complet : stock frais + lots (le serializer liste est partiel).
    const full = await getProductById(p.id).catch(() => p);
    setProduct(full);
    if (full.use_lot_management) {
      const productLots: StockLot[] = full.stock_lots ?? (await getLots(full.id).catch(() => []));
      setLots(productLots.filter((l) => l.quantity_remaining > 0));
      setLotId(preselectLot?.id ?? null);
    } else {
      setLots([]);
      setLotId(null);
    }
  }, []);

  const qtyNum = parseInt(qty, 10) || 0;
  const lotManaged = !!product?.use_lot_management;
  const selectedLot = lots.find((l) => l.id === lotId) ?? null;

  // Aperçu : l'ajustement porte sur le LOT — le stock global est
  // reconstitué en appliquant le même delta (parité backend : le
  // produit et le lot bougent de la même quantité).
  const signedDelta = newLotMode ? qtyNum : qtyNum * (mode === 'remove' ? -1 : 1);
  const lotTarget = selectedLot ? selectedLot.quantity_remaining + signedDelta : null;
  const target = product ? product.stock + signedDelta : 0;

  const lotMissing = lotManaged && !selectedLot && !newLotMode;
  const newLotIncomplete = newLotMode && !newLotNumber.trim();
  const submitDisabled =
    !product || !reason || submitting || qtyNum <= 0 ||
    lotMissing || newLotIncomplete ||
    (lotTarget !== null && lotTarget < 0) ||
    (!lotManaged && target < 0);

  const applySuccess = useCallback((updated: Product) => {
    pendingPayload.current = null;
    setProduct(updated);
    setLotId(null);
    setNewLotMode(false);
    setNewLotNumber('');
    setNewLotExp('');
    setQty('1');
    setDetail('');
    Alert.alert(
      t('ajustement.success_title'),
      t('ajustement.success_msg', { name: updated.name, stock: updated.stock })
    );
  }, [t]);

  const buildPayload = async (): Promise<AdjustStockPayload | null> => {
    // Re-lecture du stock ET des lots juste avant l'envoi : le backend
    // attend des quantités CIBLES — calculer depuis des valeurs périmées
    // écraserait une vente concurrente.
    const fresh = await getProductById(product!.id);
    let delta: number;
    const payload: AdjustStockPayload = { new_quantity: 0, reason_type: reason!, reason_detail: detail.trim() };

    if (newLotMode) {
      const expDate = newLotExp ? expInputToDate(newLotExp) : null;
      if (newLotExp && !expDate) {
        Alert.alert(t('common.error'), t('ajustement.error_exp'));
        return null;
      }
      delta = qtyNum;
      payload.new_lot_number = newLotNumber.trim();
      if (expDate) payload.new_lot_expiration = expDate;
    } else if (selectedLot) {
      // Quantité fraîche du lot (le détail produit ne liste que 5 lots FEFO).
      const freshLots: StockLot[] = await getLots(product!.id).catch(() => []);
      const freshLot = freshLots.find((l) => l.id === selectedLot.id);
      const lotQty = freshLot?.quantity_remaining ?? selectedLot.quantity_remaining;
      const newLotQty = lotQty + qtyNum * (mode === 'remove' ? -1 : 1);
      if (newLotQty < 0) {
        Alert.alert(t('common.error'), t('ajustement.error_lot_negative', { stock: lotQty }));
        return null;
      }
      delta = newLotQty - lotQty;
      payload.stock_lot_id = selectedLot.id;
    } else {
      // Produit sans gestion de lots : ajustement global direct.
      delta = qtyNum * (mode === 'remove' ? -1 : 1);
    }

    const newTarget = fresh.stock + delta;
    if (newTarget < 0) {
      Alert.alert(t('common.error'), t('ajustement.error_negative', { stock: fresh.stock }));
      return null;
    }
    payload.new_quantity = newTarget;
    return payload;
  };

  const handleSubmit = async () => {
    if (!product || !reason) return;
    if (qtyNum <= 0) {
      Alert.alert(t('common.error'), t('ajustement.error_qty'));
      return;
    }
    if (lotMissing) {
      Alert.alert(t('common.error'), t('ajustement.error_lot_required'));
      return;
    }
    setSubmitting(true);
    try {
      const payload = await buildPayload();
      if (!payload) return;
      try {
        applySuccess(await adjustStock(product.id, payload));
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number; data?: { detail?: string } } })?.response?.status;
        const detailMsg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
        if (status === 403) {
          // Permission can_adjust_stock manquante → validation superviseur,
          // puis rejeu du même payload avec les credentials du validateur.
          pendingPayload.current = payload;
          requireSudo(
            async (validatorId, password) => {
              const p = pendingPayload.current;
              if (!p) return;
              applySuccess(await adjustStock(product.id, {
                ...p,
                validated_by_id: validatorId,
                sudo_password: password,
              }));
            },
            {
              title: t('sudo.title_default'),
              message: detailMsg ?? t('sudo.subtitle'),
              permission: 'can_adjust_stock',
              onCancel: () => { pendingPayload.current = null; },
            }
          );
        } else {
          Alert.alert(t('common.error'), detailMsg ?? t('ajustement.error_generic'));
        }
      }
    } catch {
      Alert.alert(t('common.error'), t('common.server_unreachable'));
    } finally {
      setSubmitting(false);
    }
  };

  const allReasons: AdjustmentReason[] = [
    ...STANDARD_REASONS.map((code) => ({ code, label: t(`ajustement.reason_${code.toLowerCase()}`) })),
    ...reasons,
  ];

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
        <Text style={styles.title}>{t('ajustement.title')}</Text>
      </View>

      {/* Recherche / scan produit */}
      {!product && (
        <View style={styles.searchSection}>
          <View style={styles.searchBar}>
            <Search size={ms(18)} color={theme.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder={t('ajustement.search_placeholder')}
              placeholderTextColor={theme.textMuted}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              autoCapitalize="none"
              autoFocus
            />
            {Platform.OS !== 'web' && (
              <TouchableOpacity onPress={() => setScanVisible(true)}>
                <ScanBarcode size={ms(20)} color={theme.primary} />
              </TouchableOpacity>
            )}
          </View>
          {searching && <ActivityIndicator color={theme.primary} style={{ marginTop: ms(12) }} />}
          <FlatList
            data={results}
            keyExtractor={(p) => String(p.id)}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.resultRow} onPress={() => void selectProduct(item)}>
                <Text style={styles.resultName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.resultStock}>{t('scan.stock_label', { count: item.stock })}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* Formulaire d'ajustement */}
      {product && (
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <View style={styles.productCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
              <Text style={styles.productStock}>
                {t('ajustement.current_stock', { count: product.stock })}
              </Text>
            </View>
            <TouchableOpacity onPress={() => { setProduct(null); setReason(null); }} style={styles.changeBtn}>
              <Text style={styles.changeBtnText}>{t('facturation.edit')}</Text>
            </TouchableOpacity>
          </View>

          {/* Lot : OBLIGATOIRE pour les produits gérés par lot — le stock
              global est reconstitué depuis le delta du lot. */}
          {lotManaged && (
            <View style={styles.block}>
              <Text style={styles.blockLabel}>{t('ajustement.lot_required')} *</Text>
              <View style={styles.chips}>
                {lots.map((l) => (
                  <TouchableOpacity
                    key={l.id}
                    style={[styles.chip, selectedLot?.id === l.id && styles.chipActive]}
                    onPress={() => { setLotId(l.id); setNewLotMode(false); }}
                  >
                    <Text style={[styles.chipText, selectedLot?.id === l.id && styles.chipTextActive]}>
                      {l.lot} · {l.quantity_remaining}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[styles.chip, styles.chipNew, newLotMode && styles.chipActive]}
                  onPress={() => { setNewLotMode(true); setLotId(null); }}
                >
                  <PackagePlus size={ms(13)} color={newLotMode ? '#fff' : theme.primary} />
                  <Text style={[styles.chipText, styles.chipNewText, newLotMode && styles.chipTextActive]}>
                    {t('ajustement.new_lot')}
                  </Text>
                </TouchableOpacity>
              </View>
              {lots.length === 0 && !newLotMode && (
                <Text style={styles.hint}>{t('ajustement.no_lots')}</Text>
              )}
              {lotMissing && (
                <Text style={styles.warn}>{t('ajustement.error_lot_required')}</Text>
              )}
              {newLotMode && (
                <View style={styles.newLotRow}>
                  <TextInput
                    style={[styles.newLotInput, { flex: 2 }]}
                    value={newLotNumber}
                    onChangeText={setNewLotNumber}
                    placeholder={t('ajustement.new_lot_number')}
                    placeholderTextColor={theme.textMuted}
                    autoCapitalize="characters"
                  />
                  <TextInput
                    style={[styles.newLotInput, { flex: 1 }]}
                    value={newLotExp}
                    onChangeText={(v) => setNewLotExp(v.replace(/[^0-9/]/g, '').slice(0, 5))}
                    placeholder="MM/AA"
                    placeholderTextColor={theme.textMuted}
                    keyboardType="numbers-and-punctuation"
                  />
                </View>
              )}
            </View>
          )}

          {/* Sens + quantité (nouveau lot = toujours un ajout) */}
          <View style={styles.block}>
            <Text style={styles.blockLabel}>{t('ajustement.quantity')}</Text>
            <View style={styles.qtyRow}>
              <View style={[styles.modeSwitch, newLotMode && { opacity: 0.4 }]}>
                <TouchableOpacity
                  style={[styles.modeBtn, mode === 'remove' && styles.modeBtnRemove]}
                  onPress={() => setMode('remove')}
                  disabled={newLotMode}
                >
                  <Minus size={ms(16)} color={mode === 'remove' ? '#fff' : theme.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modeBtn, mode === 'add' && styles.modeBtnAdd]}
                  onPress={() => setMode('add')}
                  disabled={newLotMode}
                >
                  <Plus size={ms(16)} color={mode === 'add' ? '#fff' : theme.textSecondary} />
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.qtyInput}
                value={qty}
                onChangeText={(v) => setQty(v.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
                selectTextOnFocus
              />
              <View style={{ flex: 1 }}>
                {selectedLot && (
                  <Text style={[styles.targetText, lotTarget !== null && lotTarget < 0 && { color: theme.danger }]}>
                    {t('ajustement.lot_target', { count: Math.max(0, lotTarget ?? 0) })}
                  </Text>
                )}
                <Text style={styles.targetText}>
                  → {t('ajustement.new_stock', { count: Math.max(0, target) })}
                </Text>
              </View>
            </View>
          </View>

          {/* Motif */}
          <View style={styles.block}>
            <Text style={styles.blockLabel}>{t('ajustement.reason')} *</Text>
            <View style={styles.chips}>
              {allReasons.map((r) => (
                <TouchableOpacity
                  key={r.code}
                  style={[styles.chip, reason === r.code && styles.chipActive]}
                  onPress={() => setReason(r.code)}
                >
                  <Text style={[styles.chipText, reason === r.code && styles.chipTextActive]}>
                    {r.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Détail (optionnel) */}
          <View style={styles.block}>
            <Text style={styles.blockLabel}>{t('ajustement.detail_optional')}</Text>
            <TextInput
              style={styles.detailInput}
              value={detail}
              onChangeText={setDetail}
              placeholder={t('ajustement.detail_placeholder')}
              placeholderTextColor={theme.textMuted}
              multiline
            />
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, submitDisabled && { opacity: 0.4 }]}
            disabled={submitDisabled}
            onPress={handleSubmit}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <PackageCheck size={ms(18)} color="#fff" />
                <Text style={styles.submitText}>{t('ajustement.submit')}</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}

      <ScanBarcodeModal
        visible={scanVisible}
        onResolve={resolveBarcode}
        onAdd={(result) => {
          setScanVisible(false);
          void selectProduct(result.product, result.lot);
        }}
        onClose={() => setScanVisible(false)}
      />
      <SudoModal
        key={sudoState.requestId}
        visible={sudoState.visible}
        title={sudoState.title}
        message={sudoState.message}
        permission={sudoState.permission}
        onValidate={sudoState.onValidate}
        onClose={closeSudo}
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
  searchSection: { flex: 1, padding: ms(12) },
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
  form: { padding: ms(12), gap: ms(10) },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.primaryWash,
    borderRadius: ms(theme.radiusMd),
    borderWidth: 1,
    borderColor: theme.primary,
    padding: ms(14),
    gap: ms(10),
  },
  productName: { fontSize: ms(15), fontWeight: '700', color: theme.text },
  productStock: { fontSize: ms(13), color: theme.primaryDark, marginTop: ms(2) },
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
  hint: { fontSize: ms(12), color: theme.textMuted, fontStyle: 'italic' },
  warn: { fontSize: ms(12), color: theme.warning, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: ms(8) },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(4),
    borderRadius: ms(16),
    borderWidth: 1,
    borderColor: theme.borderStrong,
    paddingHorizontal: ms(12),
    paddingVertical: ms(6),
    backgroundColor: theme.bgMuted,
  },
  chipActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  chipNew: { borderColor: theme.primary, borderStyle: 'dashed' },
  chipNewText: { color: theme.primary },
  chipText: { fontSize: ms(12), fontWeight: '600', color: theme.textSecondary },
  chipTextActive: { color: '#fff' },
  newLotRow: { flexDirection: 'row', gap: ms(8) },
  newLotInput: {
    borderWidth: 1,
    borderColor: theme.borderStrong,
    borderRadius: ms(8),
    paddingVertical: ms(8),
    paddingHorizontal: ms(10),
    fontSize: ms(14),
    color: theme.text,
    backgroundColor: theme.bg,
  },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: ms(12) },
  modeSwitch: { flexDirection: 'row', borderRadius: ms(8), overflow: 'hidden', borderWidth: 1, borderColor: theme.border },
  modeBtn: {
    width: ms(40),
    height: ms(36),
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.bgMuted,
  },
  modeBtnRemove: { backgroundColor: theme.danger },
  modeBtnAdd: { backgroundColor: theme.primary },
  qtyInput: {
    width: ms(70),
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
  targetText: { fontSize: ms(13), fontWeight: '600', color: theme.textSecondary },
  detailInput: {
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
    marginTop: ms(4),
  },
  submitText: { color: '#fff', fontSize: ms(15), fontWeight: '700' },
});
