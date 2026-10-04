import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, ActivityIndicator,
  StyleSheet, Vibration, Switch,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ScanBarcode, X } from 'lucide-react-native';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useCartStore } from '../stores/useCartStore';
import { expiryInfo } from '../utils/format';
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
        showFeedback(`Code inconnu : ${code}`, false);
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
    showFeedback(`Ajouté : ${pending.label} ×${qty}`, true);
    pendingRef.current = null;
    setPending(null);
  };

  const handleCancelPending = () => {
    pendingRef.current = null;
    setPending(null);
  };

  const renderBody = () => {
    if (!permission) {
      return <ActivityIndicator color="#10b981" size="large" />;
    }
    if (!permission.granted) {
      return (
        <View style={styles.permissionBox}>
          <ScanBarcode size={48} color="#64748b" />
          <Text style={styles.permissionText}>
            L'accès à la caméra est nécessaire pour scanner les codes-barres.
          </Text>
          {permission.canAskAgain ? (
            <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
              <Text style={styles.permissionBtnText}>Autoriser la caméra</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.permissionHint}>
              Autorisez la caméra dans les paramètres de l'appareil.
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
            <Text style={styles.cardStock}>Stock : {pending.product.stock}</Text>
            {pending.lot && (
              <Text style={[styles.cardLot, exp && { color: exp.color }]}>
                Lot {pending.lot.lot} · exp {exp?.label}
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
                <Text style={styles.cancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addBtn} onPress={handleConfirmAdd}>
                <Text style={styles.addText}>Ajouter au panier</Text>
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
              Dernier ajout : {lastAdded.label}
            </Text>
          ) : (
            <Text style={styles.hint}>Visez un code-barres — l'ajout est automatique</Text>
          )}
          <View style={styles.autoRow}>
            <Text style={styles.autoTotals}>
              {totalArticles} article(s) · {totalTTC.toLocaleString('fr-FR')} F
            </Text>
            <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
              <Text style={styles.doneText}>Terminer</Text>
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
      <Text style={styles.hint}>Visez un code-barres — confirmez l'ajout</Text>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Scanner un produit</Text>
          <View style={styles.headerRight}>
            <Text style={styles.switchLabel}>Ajout automatique</Text>
            <Switch
              value={autoAddScan}
              onValueChange={setAutoAddScan}
              trackColor={{ false: 'rgba(255,255,255,0.15)', true: '#10b981' }}
              thumbColor="#f1f5f9"
            />
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={22} color="#f1f5f9" />
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
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  title: { fontSize: 17, fontWeight: '700', color: '#f1f5f9' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  switchLabel: { fontSize: 12, color: '#94a3b8' },
  closeBtn: { padding: 6 },
  body: { flex: 1, justifyContent: 'center' },
  cameraWrap: { flex: 1 },
  camera: { flex: 1 },
  frame: {
    position: 'absolute',
    top: '30%',
    left: '12%',
    right: '12%',
    height: '28%',
    borderWidth: 2,
    borderColor: '#10b981',
    borderRadius: 12,
  },
  frozenOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(15,23,42,0.55)',
  },
  permissionBox: { alignItems: 'center', gap: 16, paddingHorizontal: 32 },
  permissionText: { color: '#f1f5f9', fontSize: 15, textAlign: 'center' },
  permissionHint: { color: '#64748b', fontSize: 13, textAlign: 'center' },
  permissionBtn: {
    backgroundColor: '#10b981',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  permissionBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  footer: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: '#1e293b',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
  },
  hint: { color: '#64748b', fontSize: 13 },
  feedback: {
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    maxWidth: '100%',
  },
  feedbackOk: { backgroundColor: 'rgba(16,185,129,0.15)' },
  feedbackKo: { backgroundColor: 'rgba(239,68,68,0.15)' },
  feedbackText: { color: '#f1f5f9', fontSize: 14, fontWeight: '600' },
  autoFooter: { width: '100%', alignItems: 'center', gap: 10 },
  lastAdded: { color: '#10b981', fontSize: 13, fontWeight: '600', maxWidth: '100%' },
  lastAddedStale: { color: '#64748b', fontWeight: '400' },
  autoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  autoTotals: { color: '#f1f5f9', fontSize: 14, fontWeight: '700' },
  doneBtn: {
    flex: 1,
    marginLeft: 16,
    backgroundColor: '#10b981',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  doneText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  card: {
    width: '100%',
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.35)',
  },
  cardName: { fontSize: 15, fontWeight: '700', color: '#f1f5f9' },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4, flexWrap: 'wrap' },
  cardPrice: { fontSize: 14, fontWeight: '700', color: '#10b981' },
  cardStock: { fontSize: 12, color: '#94a3b8' },
  cardLot: { fontSize: 12, fontWeight: '600' },
  cardActions: { marginTop: 12, gap: 10 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'center' },
  qtyBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: 'rgba(99,102,241,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyBtnText: { fontSize: 18, color: '#818cf8', fontWeight: '700' },
  qtyVal: { fontSize: 17, fontWeight: '700', color: '#f1f5f9', minWidth: 28, textAlign: 'center' },
  cardBtns: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  cancelText: { color: '#f1f5f9', fontWeight: '600', fontSize: 14 },
  addBtn: {
    flex: 2,
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: '#10b981',
    alignItems: 'center',
  },
  addText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
