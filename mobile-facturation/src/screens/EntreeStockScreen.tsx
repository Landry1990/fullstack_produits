import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  Alert, ActivityIndicator, Platform, Keyboard,
} from 'react-native';
import {
  ArrowLeft, ChevronDown, Clock, Pause, Search, ScanBarcode, Trash2, Truck, Upload, PackageCheck,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
  searchProducts, getProductById, getProductByBarcode, getFournisseurs, getTauxTVA,
  createEntreeCommande, syncCommandeProduits,
  type CommandeProduitPayload,
} from '../services/api';
import {
  useEntreeStockStore, buildEntreeLine, applyLinkedField,
  type EntreeEditableField,
} from '../stores/useEntreeStockStore';
import { usePendingEntreeStore } from '../stores/usePendingEntreeStore';
import { ProductRow } from '../components/ProductRow';
import { ScanBarcodeModal } from '../components/ScanBarcodeModal';
import { FournisseurPickerModal } from '../components/FournisseurPickerModal';
import { PendingEntreeModal } from '../components/PendingEntreeModal';
import { EntreeStockLineModal, isValidExpiryMMYY } from '../components/EntreeStockLineModal';
import { parseGS1Datamatrix } from '../utils/gs1Parser';
import { theme } from '../config/theme';
import { moderateScale as ms } from '../utils/scale';
import type { EntreeStockLine, Fournisseur, PendingEntree, Product, ScanResult } from '../types';

const num = (v: string | undefined | null): number => {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

// Expiration GS1 'YYYY-MM-DD' → saisie ligne 'MM/AA' (contrat bulk_sync).
const gs1ExpToMMYY = (iso: string | null): string =>
  iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso.slice(5, 7)}/${iso.slice(2, 4)}` : '';

export function EntreeStockScreen({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const fournisseur = useEntreeStockStore((s) => s.fournisseur);
  const lines = useEntreeStockStore((s) => s.lines);
  const uploadedCommandeId = useEntreeStockStore((s) => s.uploadedCommandeId);
  const totalArticles = useEntreeStockStore((s) => s.totalArticles());
  const totalAchat = useEntreeStockStore((s) => s.totalAchat());

  // Fournisseur (menu déroulant — liste complète chargée au montage)
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [fPickerVisible, setFPickerVisible] = useState(false);

  // Taux de TVA configurés en pharmacie (déroulant de la fiche ligne)
  const [tvaOptions, setTvaOptions] = useState<string[]>(['0', '19.25']);

  // Recherche produit
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [scanVisible, setScanVisible] = useState(false);

  // Éditeur de ligne (copie de travail — commitée au Valider)
  const [editing, setEditing] = useState<EntreeStockLine | null>(null);
  const [editingIsNew, setEditingIsNew] = useState(true);

  const [uploading, setUploading] = useState(false);

  // Téléversement grisé tant qu'il manque le fournisseur ou la liste
  // est vide (même convention que la vente : disabled + opacité).
  const uploadDisabled = uploading || !fournisseur || lines.length === 0;

  // Réceptions en attente (stockage local par vendeur, comme les ventes)
  const pendingCount = usePendingEntreeStore((s) => s.entries.length);
  const [pendingModalVisible, setPendingModalVisible] = useState(false);

  // Restaure le brouillon de réception + charge fournisseurs et taux
  // de TVA (une seule fois par session).
  useEffect(() => {
    void useEntreeStockStore.getState().loadDraft();
    void usePendingEntreeStore.getState().load();
    getFournisseurs().then(setFournisseurs).catch(() => {});
    getTauxTVA()
      .then((list) => {
        const rates = list.map((tva) => String(tva.taux));
        if (rates.length > 0) setTvaOptions(rates);
      })
      .catch(() => {});
  }, []);

  // Recherche produit débouncée
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

  const pickFournisseur = (f: Fournisseur) => {
    useEntreeStockStore.getState().setFournisseur(f);
    setFPickerVisible(false);
    Keyboard.dismiss();
  };

  // Ouvre l'éditeur sur une nouvelle ligne préremplie depuis la fiche
  // produit (dernier prix d'achat, TVA, marge, prix de vente).
  const openNewLine = useCallback(async (
    p: Product,
    prefill?: { lot?: string; expiration?: string; quantity?: number }
  ) => {
    const full = await getProductById(p.id).catch(() => p);
    const line = buildEntreeLine(full, prefill);
    if (prefill?.quantity && prefill.quantity > 0) {
      line.quantity = String(prefill.quantity);
    }
    setEditingIsNew(true);
    setEditing(line);
  }, []);

  const selectProduct = useCallback(async (p: Product) => {
    Keyboard.dismiss();
    setQuery('');
    setResults([]);
    await openNewLine(p);
  }, [openNewLine]);

  // Résolution d'un code scanné pour la RÉCEPTION : contrairement à la
  // vente, on ne cherche pas le lot en stock (le lot reçu n'existe pas
  // encore) — le datamatrix GS1 fournit directement n° de lot et
  // expiration qui préremplissent la ligne.
  const resolveEntreeBarcode = useCallback(async (code: string): Promise<ScanResult | null> => {
    try {
      const parsed = parseGS1Datamatrix(code);
      const product = await getProductByBarcode(parsed.cip ?? code);
      if (!product) return null;
      const full = await getProductById(product.id).catch(() => product);
      return {
        product: full,
        lot: parsed.lot
          ? {
              id: 0,
              produit: full.id,
              lot: parsed.lot,
              quantity_remaining: 0,
              date_expiration: parsed.expiration,
            }
          : null,
        prix: parseFloat(full.selling_price) || 0,
        label: full.name,
      };
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status !== 404) {
        Alert.alert(t('common.error'), t('common.server_unreachable'));
      }
      return null;
    }
  }, [t]);

  // Ajout depuis le scanner — même logique que le web
  // (useDataMatrixScanner) : un datamatrix remplit lot + expiration
  // sur la ligne existante SANS lot du produit ; même produit + même
  // lot → incrémente (comptage) ; sinon nouvelle ligne via l'éditeur.
  const handleScanAdd = useCallback((result: ScanResult, qty: number) => {
    const lotText = result.lot?.lot ?? '';
    const exp = gs1ExpToMMYY(result.lot?.date_expiration ?? null);
    const state = useEntreeStockStore.getState();
    const productLines = state.lines.filter(
      (l) => l.product.id === result.product.id
    );

    if (lotText) {
      // Ligne sans lot existante → on y renseigne le lot scanné
      // (= statut « filled » du scan datamatrix web).
      const noLot = productLines.find((l) => !(l.lot || '').trim());
      if (noLot) {
        state.updateLine(noLot.key, 'lot', lotText);
        if (exp) state.updateLine(noLot.key, 'date_expiration', exp);
        return;
      }
      // Même produit + même lot déjà renseigné → incrémente.
      const sameLot = productLines.find(
        (l) => l.lot.trim().toUpperCase() === lotText.trim().toUpperCase()
      );
      if (sameLot) {
        const current = parseInt(sameLot.quantity, 10) || 0;
        state.updateLine(sameLot.key, 'quantity', String(current + qty));
        return;
      }
      // Produit présent avec d'autres lots → nouvelle ligne préremplie.
      void openNewLine(result.product, { lot: lotText, expiration: exp, quantity: qty });
      return;
    }

    // Code linéaire (pas de lot) : incrémente la ligne sans lot du
    // produit si elle existe, sinon ouvre l'éditeur.
    const noLot = productLines.find((l) => !(l.lot || '').trim());
    if (noLot) {
      const current = parseInt(noLot.quantity, 10) || 0;
      state.updateLine(noLot.key, 'quantity', String(current + qty));
      return;
    }
    void openNewLine(result.product, { quantity: qty });
  }, [openNewLine]);

  // Douchette / scanner clavier : Enter résout le code comme la caméra.
  const handleSearchSubmit = useCallback(async () => {
    const code = query.trim();
    if (!code) return;
    const result = await resolveEntreeBarcode(code);
    if (result) {
      setQuery('');
      setResults([]);
      handleScanAdd(result, 1);
    }
  }, [query, resolveEntreeBarcode, handleScanAdd]);

  const commitEditing = () => {
    if (!editing) return;
    if (!isValidExpiryMMYY(editing.date_expiration)) {
      Alert.alert(t('common.error'), t('entree.error_exp'));
      return;
    }
    const state = useEntreeStockStore.getState();
    if (editingIsNew) {
      state.addLine(editing);
    } else {
      state.replaceLine(editing);
    }
    setEditing(null);
  };

  const editLine = (line: EntreeStockLine) => {
    setEditingIsNew(false);
    setEditing({ ...line });
  };

  // ─── Mise en attente (stockage local, comme les ventes) ─
  // La réception garde fournisseur + lignes + l'id de commande déjà
  // créée → la reprise re-synchronise sur elle, jamais de doublon.

  const handlePark = () => {
    const state = useEntreeStockStore.getState();
    if (state.lines.length === 0) {
      Alert.alert(t('facturation.empty_title'), t('entree.empty_park'));
      return;
    }
    usePendingEntreeStore.getState().park({
      fournisseur: state.fournisseur,
      lines: state.lines,
      uploadedCommandeId: state.uploadedCommandeId,
    });
    state.clear();
  };

  const restorePending = (entry: PendingEntree) => {
    useEntreeStockStore.getState().hydrate({
      fournisseur: entry.fournisseur,
      lines: entry.lines,
      uploadedCommandeId: entry.uploadedCommandeId,
    });
    usePendingEntreeStore.getState().remove(entry.id);
    setPendingModalVisible(false);
  };

  const mergePending = (entry: PendingEntree) => {
    const state = useEntreeStockStore.getState();
    // Fusion par produit + lot : même couple → quantités additionnées
    // (prix de la ligne courante conservés), sinon ligne ajoutée avec
    // une nouvelle clé. Fournisseur/commande courants conservés ;
    // ceux de la réception en attente servent de fallback.
    if (!state.fournisseur && entry.fournisseur) {
      state.setFournisseur(entry.fournisseur);
    }
    if (!state.uploadedCommandeId && entry.uploadedCommandeId) {
      state.setUploadedCommandeId(entry.uploadedCommandeId);
    }
    for (const l of entry.lines) {
      const lotKey = (l.lot || '').trim().toUpperCase();
      const existing = useEntreeStockStore.getState().lines.find(
        (x) => x.product.id === l.product.id
          && (x.lot || '').trim().toUpperCase() === lotKey
      );
      if (existing) {
        const mergedQty = (parseInt(existing.quantity, 10) || 0) + (parseInt(l.quantity, 10) || 0);
        const mergedUG = (parseInt(existing.unites_gratuites, 10) || 0) + (parseInt(l.unites_gratuites, 10) || 0);
        state.updateLine(existing.key, 'quantity', String(mergedQty));
        state.updateLine(existing.key, 'unites_gratuites', String(mergedUG));
      } else {
        state.addLine({ ...l, key: `${l.product.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` });
      }
    }
    usePendingEntreeStore.getState().remove(entry.id);
    setPendingModalVisible(false);
  };

  const handleRestorePress = (entry: PendingEntree) => {
    if (lines.length === 0) {
      restorePending(entry);
      return;
    }
    Alert.alert(
      t('pendingEntree.replace_title'),
      t('pendingEntree.replace_msg'),
      [
        { text: t('facturation.pending_replace'), onPress: () => restorePending(entry) },
        { text: t('facturation.pending_merge'), onPress: () => mergePending(entry) },
        { text: t('common.cancel'), style: 'cancel' },
      ]
    );
  };

  const clearAll = () => {
    if (lines.length === 0) return;
    Alert.alert(t('entree.clear_title'), t('entree.clear_msg', { count: lines.length }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('entree.clear_confirm'),
        style: 'destructive',
        onPress: () => useEntreeStockStore.getState().clear(),
      },
    ]);
  };

  // Lignes fusionnées même produit + même lot (convention web : les
  // lignes identiques fusionnent, la dernière saisie fait foi pour les
  // prix).
  const mergedLines = (): EntreeStockLine[] => {
    const map = new Map<string, EntreeStockLine>();
    for (const l of lines) {
      const k = `${l.product.id}|${(l.lot || '').trim().toUpperCase()}`;
      const prev = map.get(k);
      if (prev) {
        map.set(k, {
          ...l,
          quantity: String((parseInt(prev.quantity, 10) || 0) + (parseInt(l.quantity, 10) || 0)),
          unites_gratuites: String((parseInt(prev.unites_gratuites, 10) || 0) + (parseInt(l.unites_gratuites, 10) || 0)),
        });
      } else {
        map.set(k, l);
      }
    }
    return [...map.values()];
  };

  const validateLines = (): string | null => {
    for (const l of mergedLines()) {
      const qty = parseInt(l.quantity, 10) || 0;
      if (qty < 1) return t('entree.error_qty', { name: l.product.name });
      if (num(l.price) < 0 || num(l.selling_price) < 0) {
        return t('entree.error_price', { name: l.product.name });
      }
      if (!isValidExpiryMMYY(l.date_expiration)) {
        return t('entree.error_exp_name', { name: l.product.name });
      }
    }
    return null;
  };

  const buildPayload = (): CommandeProduitPayload[] =>
    mergedLines().map((l) => ({
      produit: l.product.id,
      quantity: parseInt(l.quantity, 10) || 0,
      unites_gratuites: parseInt(l.unites_gratuites, 10) || 0,
      price: String(Math.round(num(l.price))),
      price_cost: String(Math.round(num(l.price))),
      selling_price: String(Math.round(num(l.selling_price))),
      prix_euro: null,
      tva: String(num(l.tva)),
      taux_marge: num(l.marge || '1.3').toFixed(4),
      lot: l.lot.trim() || null,
      date_expiration: l.date_expiration.trim() || null,
    }));

  const doUpload = async () => {
    if (!fournisseur) return;
    setUploading(true);
    try {
      const state = useEntreeStockStore.getState();
      // Réutilise la commande déjà créée par un envoi interrompu :
      // bulk_sync remplace toutes les lignes → aucun doublon possible.
      let commandeId = state.uploadedCommandeId;
      if (!commandeId) {
        const cmd = await createEntreeCommande(fournisseur.id);
        commandeId = cmd.id;
        state.setUploadedCommandeId(commandeId);
      }
      const res = await syncCommandeProduits(commandeId, buildPayload());
      const warnings = res?.warnings?.length
        ? `\n\n${t('entree.upload_warnings', { count: res.warnings.length })}`
        : '';
      Alert.alert(
        t('entree.success_title'),
        t('entree.success_msg', { id: commandeId }) + warnings
      );
      state.clear();
      onBack();
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { error?: string; detail?: string; errors?: string[] } } })?.response?.data;
      const detail = data?.error ?? data?.detail ?? (data?.errors ?? []).join('\n');
      Alert.alert(t('common.error'), detail || t('entree.error_generic'));
    } finally {
      setUploading(false);
    }
  };

  const handleUpload = () => {
    if (!fournisseur) {
      Alert.alert(t('common.error'), t('entree.error_fournisseur'));
      return;
    }
    if (lines.length === 0) {
      Alert.alert(t('common.error'), t('entree.error_empty'));
      return;
    }
    const err = validateLines();
    if (err) {
      Alert.alert(t('common.error'), err);
      return;
    }
    Alert.alert(
      t('entree.confirm_title'),
      t('entree.confirm_msg', { count: mergedLines().length, fournisseur: fournisseur.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('entree.upload'), onPress: () => void doUpload() },
      ]
    );
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
        <Text style={styles.title}>{t('entree.title')}</Text>
        <TouchableOpacity onPress={() => setPendingModalVisible(true)} style={styles.iconBtn}>
          <Clock size={ms(19)} color={theme.textMuted} />
          {pendingCount > 0 && (
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>{pendingCount}</Text>
            </View>
          )}
        </TouchableOpacity>
        {lines.length > 0 && (
          <>
            <TouchableOpacity onPress={handlePark} style={styles.iconBtn}>
              <Pause size={ms(19)} color={theme.warning} />
            </TouchableOpacity>
            <TouchableOpacity onPress={clearAll} style={styles.iconBtn}>
              <Trash2 size={ms(19)} color={theme.danger} />
            </TouchableOpacity>
          </>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Fournisseur (menu déroulant, obligatoire au téléversement) */}
        <View style={styles.fournisseurBlock}>
          <Text style={styles.blockLabel}>{t('entree.fournisseur_label')}</Text>
          <TouchableOpacity
            style={styles.select}
            onPress={() => setFPickerVisible(true)}
            disabled={uploading}
          >
            <Truck size={ms(16)} color={fournisseur ? theme.info : theme.textMuted} />
            <Text
              style={[styles.selectText, !fournisseur && { color: theme.textMuted, fontWeight: '400' }]}
              numberOfLines={1}
            >
              {fournisseur?.name ?? t('entree.fournisseur_placeholder')}
            </Text>
            <ChevronDown size={ms(16)} color={theme.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Recherche / scan produit */}
        <View style={styles.searchBar}>
          <Search size={ms(18)} color={theme.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('entree.search_placeholder')}
            placeholderTextColor={theme.textMuted}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => void handleSearchSubmit()}
            autoFocus
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {Platform.OS !== 'web' && (
            <TouchableOpacity onPress={() => setScanVisible(true)}>
              <ScanBarcode size={ms(20)} color={theme.primary} />
            </TouchableOpacity>
          )}
        </View>
        {searching && <ActivityIndicator color={theme.primary} style={{ marginTop: ms(12) }} />}
        {/* Résultats de recherche : même rendu que la vente (ProductRow)
            — nom pondéré selon stock, CIP, stock coloré, prix. */}
        {results.map((p) => (
          <ProductRow key={p.id} product={p} onPress={(prod) => void selectProduct(prod)} />
        ))}

        {/* Lignes de la réception */}
        <Text style={styles.sectionTitle}>
          {t('entree.lines_title', { count: lines.length })}
        </Text>
        {lines.length === 0 ? (
          <View style={styles.emptyRow}>
            <PackageCheck size={ms(18)} color={theme.borderStrong} />
            <Text style={styles.emptyText}>{t('entree.empty')}</Text>
          </View>
        ) : (
          lines.map((l) => {
            const montant = (parseInt(l.quantity, 10) || 0) * num(l.price);
            return (
              <TouchableOpacity key={l.key} style={styles.lineRow} onPress={() => editLine(l)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lineName} numberOfLines={1}>{l.product.name}</Text>
                  <Text style={styles.lineMeta}>
                    {t('entree.line_summary', {
                      qty: l.quantity || '0',
                      ug: l.unites_gratuites && l.unites_gratuites !== '0' ? ` +${l.unites_gratuites}UG` : '',
                      price: num(l.price).toLocaleString('fr-FR'),
                      sell: num(l.selling_price).toLocaleString('fr-FR'),
                    })}
                  </Text>
                  {(l.lot || l.date_expiration) ? (
                    <Text style={styles.lineLot}>
                      {[l.lot, l.date_expiration].filter(Boolean).join(' · ')}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.lineMontant}>{montant.toLocaleString('fr-FR')} F</Text>
                <TouchableOpacity
                  onPress={() => useEntreeStockStore.getState().removeLine(l.key)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Trash2 size={ms(16)} color={theme.danger} />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Pied : totaux + téléversement */}
      <View style={styles.footer}>
        <View>
          <Text style={styles.footerMeta}>
            {t('common.articles_count', { count: totalArticles })}
          </Text>
          <Text style={styles.footerTotal}>{totalAchat.toLocaleString('fr-FR')} F</Text>
        </View>
        <TouchableOpacity
          style={[styles.uploadBtn, uploadDisabled && { opacity: 0.4 }]}
          disabled={uploadDisabled}
          onPress={handleUpload}
        >
          {uploading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Upload size={ms(17)} color="#fff" />
              <Text style={styles.uploadText}>{t('entree.upload')}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <PendingEntreeModal
        visible={pendingModalVisible}
        entreeEmpty={lines.length === 0}
        onRestore={handleRestorePress}
        onMerge={mergePending}
        onDelete={(id) => usePendingEntreeStore.getState().remove(id)}
        onClose={() => setPendingModalVisible(false)}
      />

      <FournisseurPickerModal
        visible={fPickerVisible}
        fournisseurs={fournisseurs}
        selectedId={fournisseur?.id ?? null}
        onPick={pickFournisseur}
        onClose={() => setFPickerVisible(false)}
      />

      <ScanBarcodeModal
        visible={scanVisible}
        onResolve={resolveEntreeBarcode}
        onAdd={handleScanAdd}
        onClose={() => setScanVisible(false)}
      />

      <EntreeStockLineModal
        visible={editing !== null}
        line={editing}
        isNew={editingIsNew}
        tvaOptions={tvaOptions}
        onChange={(field: EntreeEditableField, value: string) =>
          setEditing((cur) => (cur ? applyLinkedField(cur, field, value) : cur))
        }
        onSave={commitEditing}
        onClose={() => setEditing(null)}
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
  iconBtn: { padding: ms(6), marginLeft: ms(4) },
  pendingBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: theme.warning,
    borderRadius: ms(8),
    minWidth: ms(15),
    height: ms(15),
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: ms(3),
  },
  pendingBadgeText: { color: '#fff', fontSize: ms(9), fontWeight: '800' },
  title: { fontSize: ms(18), fontWeight: '700', color: theme.text, flex: 1 },
  content: { padding: ms(12), flexGrow: 1 },
  fournisseurBlock: {
    backgroundColor: theme.bgElevated,
    borderRadius: ms(theme.radiusMd),
    borderWidth: 1,
    borderColor: theme.border,
    padding: ms(12),
    marginBottom: ms(10),
  },
  blockLabel: { fontSize: ms(12), fontWeight: '600', color: theme.textMuted, marginBottom: ms(6) },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(8),
    backgroundColor: theme.bg,
    borderRadius: ms(theme.radiusSm),
    borderWidth: 1,
    borderColor: theme.borderStrong,
    paddingHorizontal: ms(10),
    paddingVertical: ms(10),
  },
  selectText: { flex: 1, fontSize: ms(14), fontWeight: '700', color: theme.text },
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
  sectionTitle: {
    fontSize: ms(13),
    fontWeight: '700',
    color: theme.textMuted,
    marginTop: ms(16),
    marginBottom: ms(6),
  },
  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: ms(8), paddingVertical: ms(8) },
  emptyText: { fontSize: ms(12), color: theme.textMuted, fontStyle: 'italic' },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(10),
    backgroundColor: theme.bgElevated,
    borderRadius: ms(theme.radiusSm),
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: ms(12),
    paddingVertical: ms(10),
    marginBottom: ms(6),
  },
  lineName: { fontSize: ms(14), fontWeight: '600', color: theme.text },
  lineMeta: { fontSize: ms(12), color: theme.textSecondary, marginTop: ms(2) },
  lineLot: { fontSize: ms(11), color: theme.warning, marginTop: ms(2), fontWeight: '600' },
  lineMontant: { fontSize: ms(13), fontWeight: '700', color: theme.primary },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: ms(16),
    paddingVertical: ms(12),
    backgroundColor: theme.bgElevated,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  footerMeta: { fontSize: ms(12), color: theme.textMuted },
  footerTotal: { fontSize: ms(17), fontWeight: '700', color: theme.text },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(8),
    backgroundColor: theme.primary,
    borderRadius: ms(theme.radiusMd),
    paddingVertical: ms(12),
    paddingHorizontal: ms(20),
  },
  uploadText: { color: '#fff', fontSize: ms(15), fontWeight: '700' },
});
