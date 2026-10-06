import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, ActivityIndicator,
  StyleSheet, Vibration, Switch, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ScanBarcode, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useCartStore } from '../stores/useCartStore';
import { expiryInfo } from '../utils/format';
import { theme } from '../config/theme';
import { moderateScale as ms } from '../utils/scale';
import type { ScanResult } from '../types';

interface Props {
  visible: boolean;
  // Résout le code scanné (datamatrix ou CIP) sans toucher au panier ;
  // null si inconnu.
  onResolve: (code: string) => Promise<ScanResult | null>;
  // Ajoute le produit résolu au panier (lot + prix déjà embarqués).
  onAdd: (result: ScanResult, qty: number) => void;
  onClose: () => void;
}

export function ScanBarcodeModal({ visible, onResolve, onAdd, onClose }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const { autoAddScan, setAutoAddScan } = useSettingsStore();
  const totalArticles = useCartStore((s) => s.totalArticles());
  const totalTTC = useCartStore((s) => s.totalTTC());

  const [feedback, setFeedback] = useState<{ text: string; ok: boolean } | null>(null);
  const [pending, setPending] = useState<ScanResult | null>(null);
  const [qty, setQty] = useState(1);
  const [lastAdded, setLastAdded] = useState<{ label: string; fresh: boolean } | null>(null);

  const processingRef = useRef(false);
  const pendingRef = useRef<ScanResult | null>(null);
  const lastSeenRef = useRef<Map<string, number>>(new Map());
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAddedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) {
      setPending(null);
      pendingRef.current = null;
      setFeedback(null);
      lastSeenRef.current.clear();
    }
  }, [visible]);

  // Timers feedback/dernier-ajout annulés au démontage — évite un
  // setState tardif et un réveil inutile du thread JS.
  useEffect(() => () => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    if (lastAddedTimer.current) clearTimeout(lastAddedTimer.current);
  }, []);

  const showFeedback = (text: string, ok: boolean) => {
    setFeedback({ text, ok });
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(null), 1800);
  };

  const handleScanned = useCallback(async ({ data }: { data: string }) => {
    const code = data.trim();
    if (!code) return;
    // Anti-doublon « sortie de champ » PAR code : chaque détection
    // rafraîchit l'horodatage du code — tant qu'il reste visé il n'est
    // jamais ré-ajouté ; il faut le retirer >1,5 s puis le re-scanner
    // pour +1. La Map couvre aussi le cas où plusieurs codes sont
    // visibles en même temps (sinon A, B, A, B… ajoutait en ping-pong).
    const now = Date.now();
    const seen = lastSeenRef.current;
    const lastAt = seen.get(code);
    seen.set(code, now);
    // Borne mémoire : purge des codes absents depuis plus de 5 s.
    if (seen.size > 50) {
      for (const [k, at] of seen) if (now - at > 5000) seen.delete(k);
    }
    if (processingRef.current || pendingRef.current) return;
    if (lastAt !== undefined && now - lastAt < 1500) return;

    processingRef.current = true;
    try {
      const result = await onResolve(code);
      if (!result) {
        Vibration.vibrate([0, 80, 60, 80]);
        showFeedback(t('scan.code_unknown', { code }), false);
        return;
      }
      if (autoAddScan) {
        onAdd(result, 1);
        Vibration.vibrate(50);
        setLastAdded({ label: result.label, fresh: true });
        if (lastAddedTimer.current) clearTimeout(lastAddedTimer.current);
        lastAddedTimer.current = setTimeout(
          () => setLastAdded((l) => (l ? { ...l, fresh: false } : l)),
          2000
        );
        setFeedback(null);
      } else {
        // Mode confirmation : la caméra se fige tant que la carte est affichée.
        pendingRef.current = result;
        setPending(result);
        setQty(1);
      }
    } finally {
      processingRef.current = false;
    }
  }, [onResolve, onAdd, autoAddScan]);

  const handleConfirmAdd = () => {
    if (!pending) return;
    // Pas besoin de prolonger l'anti-doublon : tant que le code reste visé,
    // les détections rafraîchissent l'horodatage et la carte ne se rouvre pas.
    onAdd(pending, qty);
    Vibration.vibrate(50);
    showFeedback(t('scan.added', { label: pending.label, qty }), true);
    pendingRef.current = null;
    setPending(null);
  };

  const handleCancelPending = () => {
    pendingRef.current = null;
    setPending(null);
  };

  const renderBody = () => {
    if (!permission) {
      return <ActivityIndicator color={theme.primary} size="large" />;
    }
    if (!permission.granted) {
      return (
        <View style={styles.permissionBox}>
          <ScanBarcode size={48} color={theme.textMuted} />
          <Text style={styles.permissionText}>
            {t('scan.permission_text')}
          </Text>
          {permission.canAskAgain ? (
            <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
              <Text style={styles.permissionBtnText}>{t('scan.permission_btn')}</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.permissionHint}>
              {t('scan.permission_hint')}
            </Text>
          )}
        </View>
      );
    }
    return (
      <View style={styles.cameraWrap}>
        <CameraView
          style={styles.camera}
          facing="back"
          // Aperçu en FIT (lettrebox) plutôt que FILL : sans ça, sur grand
          // écran paysage la vue très large rogne le flux 4:3 du capteur
          // → effet « zoom excessif ». iOS ignore cette prop.
          ratio="16:9"
          // Capteur arrêté hors affichage et pendant la carte de
          // confirmation — principale source de chauffe/batterie sinon.
          active={visible && !pending}
          barcodeScannerSettings={{
            barcodeTypes: [
              'ean13', 'ean8', 'upc_a', 'upc_e',
              'code128', 'code39', 'code93', 'itf14',
              'datamatrix', 'qr',
            ],
          }}
          onBarcodeScanned={handleScanned}
        />
        <View style={styles.frame} pointerEvents="none" />
        {pending && <View style={styles.frozenOverlay} pointerEvents="none" />}
      </View>
    );
  };

  const renderFooter = () => {
    // Carte produit en attente de confirmation
    if (pending) {
      const exp = pending.lot ? expiryInfo(pending.lot.date_expiration) : null;
      return (
        <View style={styles.card}>
          <Text style={styles.cardName} numberOfLines={2}>{pending.product.name}</Text>
          <View style={styles.cardMeta}>
            <Text style={styles.cardPrice}>{pending.prix.toLocaleString('fr-FR')} F</Text>
            <Text style={styles.cardStock}>{t('scan.stock_label', { count: pending.product.stock })}</Text>
            {pending.lot && (
              <Text style={[styles.cardLot, exp && { color: exp.color }]}>
                {t('scan.lot_exp', { lot: pending.lot.lot, exp: exp?.label })}
              </Text>
            )}
          </View>
          <View style={styles.cardActions}>
            <View style={styles.qtyRow}>
              <TouchableOpacity style={styles.qtyBtn} onPress={() => setQty((q) => Math.max(1, q - 1))}>
                <Text style={styles.qtyBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.qtyVal}>{qty}</Text>
              <TouchableOpacity style={styles.qtyBtn} onPress={() => setQty((q) => Math.min(99, q + 1))}>
                <Text style={styles.qtyBtnText}>+</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.cardBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelPending}>
                <Text style={styles.cancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addBtn} onPress={handleConfirmAdd}>
                <Text style={styles.addText}>{t('scan.add_to_cart')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    }

    // Mode automatique : mini-panier live + Terminer
    if (autoAddScan) {
      return (
        <View style={styles.autoFooter}>
          {feedback ? (
            <View style={[styles.feedback, feedback.ok ? styles.feedbackOk : styles.feedbackKo]}>
              <Text style={styles.feedbackText} numberOfLines={1}>{feedback.text}</Text>
            </View>
          ) : lastAdded ? (
            <Text
              style={[styles.lastAdded, !lastAdded.fresh && styles.lastAddedStale]}
              numberOfLines={1}
            >
              {t('scan.last_added', { label: lastAdded.label })}
            </Text>
          ) : (
            <Text style={styles.hint}>{t('scan.hint_auto')}</Text>
          )}
          <View style={styles.autoRow}>
            <Text style={styles.autoTotals}>
              {t('common.articles_count', { count: totalArticles })} · {totalTTC.toLocaleString('fr-FR')} F
            </Text>
            <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
              <Text style={styles.doneText}>{t('scan.done')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // Mode confirmation : toast après ajout ou hint
    return feedback ? (
      <View style={[styles.feedback, feedback.ok ? styles.feedbackOk : styles.feedbackKo]}>
        <Text style={styles.feedbackText} numberOfLines={1}>{feedback.text}</Text>
      </View>
    ) : (
      <Text style={styles.hint}>{t('scan.hint_confirm')}</Text>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, {
        paddingBottom: Math.min(insets.bottom, 24),
        paddingLeft: insets.left,
        paddingRight: insets.right,
      }]}>
        <View style={[styles.header, { paddingTop: 14 + (Platform.OS === 'web' ? 0 : insets.top) }]}>
          <Text style={styles.title}>{t('scan.title')}</Text>
          <View style={styles.headerRight}>
            <Text style={styles.switchLabel}>{t('scan.auto_add')}</Text>
            <Switch
              value={autoAddScan}
              onValueChange={setAutoAddScan}
              trackColor={{ false: theme.borderStrong, true: theme.primary }}
              thumbColor="#fff"
            />
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={ms(22)} color={theme.text} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.body}>{renderBody()}</View>

        <View style={styles.footer}>{renderFooter()}</View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: ms(16),
    paddingVertical: ms(14),
    backgroundColor: theme.bgElevated,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  title: { fontSize: ms(17), fontWeight: '700', color: theme.text },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: ms(10) },
  switchLabel: { fontSize: ms(12), color: theme.textMuted },
  closeBtn: { padding: ms(6) },
  body: { flex: 1, justifyContent: 'center' },
  cameraWrap: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  frame: {
    position: 'absolute',
    top: '30%',
    left: '12%',
    right: '12%',
    height: '28%',
    borderWidth: 2,
    borderColor: theme.primary,
    borderRadius: ms(12),
  },
  frozenOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(15,23,42,0.55)',
  },
  permissionBox: { alignItems: 'center', gap: ms(16), paddingHorizontal: ms(32) },
  permissionText: { color: theme.text, fontSize: ms(15), textAlign: 'center' },
  permissionHint: { color: theme.textMuted, fontSize: ms(13), textAlign: 'center' },
  permissionBtn: {
    backgroundColor: theme.primary,
    borderRadius: ms(8),
    paddingVertical: ms(12),
    paddingHorizontal: ms(24),
  },
  permissionBtnText: { color: '#fff', fontSize: ms(15), fontWeight: '600' },
  footer: {
    paddingVertical: ms(14),
    paddingHorizontal: ms(20),
    backgroundColor: theme.bgElevated,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    alignItems: 'center',
  },
  hint: { color: theme.textMuted, fontSize: ms(13) },
  feedback: {
    borderRadius: ms(8),
    paddingVertical: ms(8),
    paddingHorizontal: ms(14),
    maxWidth: '100%',
  },
  feedbackOk: { backgroundColor: theme.primaryWash },
  feedbackKo: { backgroundColor: theme.dangerWash },
  feedbackText: { color: theme.text, fontSize: ms(14), fontWeight: '600' },
  autoFooter: { width: '100%', alignItems: 'center', gap: ms(10) },
  lastAdded: { color: theme.primary, fontSize: ms(13), fontWeight: '600', maxWidth: '100%' },
  lastAddedStale: { color: theme.textMuted, fontWeight: '400' },
  autoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  autoTotals: { color: theme.text, fontSize: ms(14), fontWeight: '700' },
  doneBtn: {
    flex: 1,
    marginLeft: ms(16),
    backgroundColor: theme.primary,
    borderRadius: ms(8),
    paddingVertical: ms(10),
    alignItems: 'center',
  },
  doneText: { color: '#fff', fontSize: ms(15), fontWeight: '700' },
  card: {
    width: '100%',
    backgroundColor: theme.bg,
    borderRadius: ms(12),
    padding: ms(14),
    borderWidth: 1,
    borderColor: theme.primary,
  },
  cardName: { fontSize: ms(15), fontWeight: '700', color: theme.text },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: ms(12), marginTop: ms(4), flexWrap: 'wrap' },
  cardPrice: { fontSize: ms(14), fontWeight: '700', color: theme.primary },
  cardStock: { fontSize: ms(12), color: theme.textSecondary },
  cardLot: { fontSize: ms(12), fontWeight: '600' },
  cardActions: { marginTop: ms(12), gap: ms(10) },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: ms(12), alignSelf: 'center' },
  qtyBtn: {
    width: ms(34),
    height: ms(34),
    borderRadius: ms(8),
    backgroundColor: theme.primaryWash,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyBtnText: { fontSize: ms(18), color: theme.primary, fontWeight: '700' },
  qtyVal: { fontSize: ms(17), fontWeight: '700', color: theme.text, minWidth: ms(28), textAlign: 'center' },
  cardBtns: { flexDirection: 'row', gap: ms(10) },
  cancelBtn: {
    flex: 1,
    paddingVertical: ms(11),
    borderRadius: ms(8),
    backgroundColor: theme.bgMuted,
    alignItems: 'center',
  },
  cancelText: { color: theme.text, fontWeight: '600', fontSize: ms(14) },
  addBtn: {
    flex: 2,
    paddingVertical: ms(11),
    borderRadius: ms(8),
    backgroundColor: theme.primary,
    alignItems: 'center',
  },
  addText: { color: '#fff', fontWeight: '700', fontSize: ms(14) },
});
