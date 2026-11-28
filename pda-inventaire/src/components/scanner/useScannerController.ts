import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Vibration, Keyboard, TextInput } from 'react-native';
import { createAudioPlayer } from 'expo-audio';
import { useTranslation } from 'react-i18next';
import { showAlert } from '../../utils/alert';
import type { Inventaire, LigneInventaire, Produit } from '../../services/inventaire';
import { inventaireService, produitService } from '../../services/inventaire';
import { localStorageService } from '../../services/localStorage';
import type { OfflineLigne } from '../../services/localStorage';
import { useOfflineSync } from '../../hooks/useOfflineSync';

export interface DisplayLigne extends LigneInventaire {
  tempId?: string;
  details?: { isOffline: boolean };
}

/** Une ligne offline (produit + lot) couvre la ligne serveur pré-remplie
 * correspondante : masquage/dédoublonnage et calcul « restants ». */
const isCoveredByOffline = (sv: LigneInventaire, offs: OfflineLigne[]) =>
  offs.some(ol =>
    ol.produitId === sv.produit && (
      (ol.stockLotId != null && ol.stockLotId === sv.stock_lot) ||
      (ol.lotNumero != null && ol.lotNumero === sv.lot_numero) ||
      (ol.stockLotId == null && ol.lotNumero == null && sv.stock_lot == null)
    )
  );

const expiryMMYYToISO = (value: string) => {
  const match = value.match(/^(0[1-9]|1[0-2])\/(\d{2})$/);
  if (!match) return null;
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
};

export function useScannerController(inventaire: Inventaire, onBack: () => void) {
  const { t } = useTranslation();
  const [scannedProduct, setScannedProduct] = useState<Produit | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [lignes, setLignes] = useState<DisplayLigne[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  const {
    isOnline,
    saveOffline,
    syncAll,
    offlineCount,
    syncing,
    syncProgress,
    offlineLignes,
    updateOffline,
    removeOffline,
  } = useOfflineSync({
    inventaireId: inventaire.id,
    onSyncComplete: (count, errorMessage) => {
      if (errorMessage) {
        showAlert(t('scanner.sync_error_title'), t('scanner.sync_error_msg', { count, error: errorMessage }));
      } else {
        showAlert(t('scanner.sync_title'), t('scanner.sync_complete', { count }));
      }
      loadLignes();
    }
  });

  const [scanInput, setScanInput] = useState('');
  const scanInputRef = useRef<TextInput>(null);
  const quantityInputRef = useRef<TextInput>(null);

  const [editingLine, setEditingLine] = useState<DisplayLigne | null>(null);
  const [editQuantity, setEditQuantity] = useState('');

  const [lotQuantities, setLotQuantities] = useState<{[key: string]: string}>({});
  const [newLotNumber, setNewLotNumber] = useState('');
  const [newLotExpiration, setNewLotExpiration] = useState('');

  const [continuousScanMode, setContinuousScanMode] = useState(false);
  const [rapidCountMode, setRapidCountMode] = useState(false);
  const [lastSavedProduct, setLastSavedProduct] = useState<string | null>(null);
  const [isKeyboardEnabled, setIsKeyboardEnabled] = useState(false);

  // Inventaire pré-rempli (par rayon/forme) : lignes attendues à is_counted=false.
  // Source : périmètre mémorisé localement (créé ici) OU lignes serveur non comptées
  // (pré-rempli côté web). Dans ce mode, l'upload remplace la ligne pré-remplie
  // (mode 'replace') au lieu d'additionner au stock théorique.
  const [isPreloaded, setIsPreloaded] = useState(false);
  useEffect(() => {
    localStorageService.getScope(inventaire.id).then(scope => {
      if (scope) setIsPreloaded(true);
    });
  }, [inventaire.id]);

  // Étape 2 : suivi « restants à compter » sur inventaire pré-rempli.
  const [serverLignes, setServerLignes] = useState<LigneInventaire[]>([]);
  const [restantsOpen, setRestantsOpen] = useState(false);
  const [zeroing, setZeroing] = useState(false);
  // Alerte non bloquante quand un scan sort du périmètre pré-rempli.
  const [scopeWarning, setScopeWarning] = useState<string | null>(null);
  useEffect(() => {
    if (!scopeWarning) return;
    const timer = setTimeout(() => setScopeWarning(null), 4000);
    return () => clearTimeout(timer);
  }, [scopeWarning]);

  /** Lignes pré-remplies jamais comptées, non couvertes par une saisie offline. */
  const uncountedLignes = useMemo(
    () => isPreloaded
      ? serverLignes.filter(l => l.is_counted === false && !isCoveredByOffline(l, offlineLignes))
      : [],
    [isPreloaded, serverLignes, offlineLignes]
  );

  const preloadProgress = useMemo(() => {
    if (!isPreloaded || serverLignes.length === 0) return null;
    return { done: serverLignes.length - uncountedLignes.length, total: serverLignes.length };
  }, [isPreloaded, serverLignes, uncountedLignes]);

  /** Produits attendus (périmètre pré-rempli + déjà saisis offline). */
  const expectedProduitIds = useMemo(() => {
    if (!isPreloaded) return null;
    const ids = new Set(serverLignes.map(l => l.produit));
    offlineLignes.forEach(l => ids.add(l.produitId));
    return ids;
  }, [isPreloaded, serverLignes, offlineLignes]);

  // Charger les lignes (Serveur + Local)
  useEffect(() => {
    loadLignes();
  }, [offlineLignes.length]);

  // Masquer le feedback du dernier produit après 3 secondes
  useEffect(() => {
    if (lastSavedProduct) {
      const timer = setTimeout(() => setLastSavedProduct(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [lastSavedProduct]);

  // Focus automatique sur le champ de scan
  useEffect(() => {
    if (!scannedProduct && !editingLine) {
      const timer = setTimeout(() => {
        scanInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [scannedProduct, lignes, editingLine]);

  const loadLignes = useCallback(async () => {
    try {
      let fetched: LigneInventaire[] = [];
      if (isOnline) {
        try {
          fetched = await inventaireService.getLignes(inventaire.id);
        } catch (e) {
          console.warn('Erreur fetch lignes server:', e);
        }
      }

      // Clé négative unique dérivée du tempId complet pour éviter les collisions
      const negativeId = (tempId: string) => {
        let h = 0;
        for (let i = 0; i < tempId.length; i++) {
          h = (h << 5) - h + tempId.charCodeAt(i);
          h |= 0;
        }
        return Math.abs(h) > 0 ? -Math.abs(h) : -1;
      };

      const localDisplayLignes: DisplayLigne[] = offlineLignes.map(l => ({
        tempId: l.tempId,
        id: negativeId(l.tempId),
        inventaire: l.inventaireId,
        produit: l.produitId,
        produit_nom: l.produitNom,
        produit_cip: l.produitCip,
        stock_theorique: l.stockTheorique ?? 0,
        quantite_physique: l.quantiteComptee,
        ecart: l.quantiteComptee - (l.stockTheorique ?? 0),
        scanned_at: l.scannedAt,
        details: { isOffline: true }
      }));

      setServerLignes(fetched);

      // Lignes serveur pré-remplies jamais comptées → inventaire filtré
      if (fetched.some(l => l.is_counted === false)) {
        setIsPreloaded(true);
      }

      // Une ligne offline couvre la ligne serveur correspondante : masquée
      // pour éviter l'affichage en double.
      setLignes([...localDisplayLignes, ...fetched.filter(sv => !isCoveredByOffline(sv, offlineLignes))]);
    } catch (error) {
      console.error('Erreur chargement lignes:', error);
    }
  }, [isOnline, offlineLignes, inventaire.id]);

  // Sons de feedback - générés programmatiquement
  const playSound = useCallback(async (type: 'success' | 'error' | 'warning') => {
    try {
      const soundConfigs = {
        success: { frequency: 1000, duration: 100 },
        error: { frequency: 300, duration: 300 },
        warning: { frequency: 600, duration: 200 },
      };
      const config = soundConfigs[type];
      const sampleRate = 44100;
      const numSamples = Math.floor(sampleRate * config.duration / 1000);
      const buffer = new ArrayBuffer(44 + numSamples * 2);
      const view = new DataView(buffer);

      const writeString = (offset: number, str: string) => {
        for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
      };
      writeString(0, 'RIFF');
      view.setUint32(4, 36 + numSamples * 2, true);
      writeString(8, 'WAVE');
      writeString(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, 1, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * 2, true);
      view.setUint16(32, 2, true);
      view.setUint16(34, 16, true);
      writeString(36, 'data');
      view.setUint32(40, numSamples * 2, true);

      for (let i = 0; i < numSamples; i++) {
        const fadeSamples = Math.min(numSamples * 0.1, 500);
        let amplitude = 0.5;
        if (i < fadeSamples) amplitude *= i / fadeSamples;
        if (i > numSamples - fadeSamples) amplitude *= (numSamples - i) / fadeSamples;
        const sample = Math.sin(2 * Math.PI * config.frequency * i / sampleRate) * amplitude * 32767;
        view.setInt16(44 + i * 2, sample, true);
      }

      // Encoder en base64 sans btoa (non dispo sur React Native natif)
      const bytes = new Uint8Array(buffer);
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
      let base64 = '';
      for (let i = 0; i < bytes.length; i += 3) {
        const b1 = bytes[i];
        const b2 = bytes[i + 1] ?? 0;
        const b3 = bytes[i + 2] ?? 0;
        const bitmap = (b1 << 16) | (b2 << 8) | b3;
        base64 += chars[(bitmap >> 18) & 63];
        base64 += chars[(bitmap >> 12) & 63];
        base64 += i + 1 < bytes.length ? chars[(bitmap >> 6) & 63] : '=';
        base64 += i + 2 < bytes.length ? chars[bitmap & 63] : '=';
      }

      const uri = `data:audio/wav;base64,${base64}`;

      const player = createAudioPlayer({ uri });
      player.play();
      setTimeout(() => player.remove(), 800);
    } catch (e) {
      if (type === 'success') Vibration.vibrate(50);
      else if (type === 'error') Vibration.vibrate([0, 100, 50, 100]);
      else Vibration.vibrate([0, 50, 50, 50]);
    }
  }, []);

  const handleContinuousSave = async (product: Produit) => {
    try {
      const qty = rapidCountMode ? 1 : parseInt(quantity || '1', 10);

      await saveOffline(
        { id: product.id, name: product.name, cip1: product.cip1 || product.cip2 || product.cip3 || product.cip4 || undefined },
        qty,
        inventaire,
        product.stock,
        undefined, undefined, undefined,
        isPreloaded
      );

      setLastSavedProduct(`${product.name} (Qté: ${qty})`);
      await playSound('success');
      Vibration.vibrate([0, 30, 30, 30]);

      setScannedProduct(null);
      setQuantity('1');
      setScanInput('');
      setTimeout(() => scanInputRef.current?.focus(), 200);
    } catch (error) {
      await playSound('error');
      showAlert(t('common.error'), t('scanner.save_error'));
    }
  };

  const handleScanSubmit = async (code: string) => {
    const trimmedCode = code.trim();
    if (!trimmedCode || searching) return;

    setSearching(true);
    Vibration.vibrate(30);
    Keyboard.dismiss();

    try {
      const product = await produitService.getByCip(trimmedCode);
      if (product) {
        // Inventaire à périmètre : produit absent des lignes attendues →
        // avertissement (accepté quand même : peut être mal classé).
        if (expectedProduitIds && !expectedProduitIds.has(product.id)) {
          setScopeWarning(product.name);
        }

        if (continuousScanMode && !product.use_lot_management) {
          await handleContinuousSave(product);
          return;
        }

        if (rapidCountMode && !product.use_lot_management) {
          await saveOffline(
            { id: product.id, name: product.name, cip1: product.cip1 || product.cip2 || product.cip3 || product.cip4 || undefined },
            1,
            inventaire,
            product.stock,
            undefined, undefined, undefined,
            isPreloaded
          );
          setLastSavedProduct(`${product.name} (Qté: 1)`);
          await playSound('success');
          Vibration.vibrate([0, 30, 30, 30]);
          setScannedProduct(null);
          setQuantity('1');
          setScanInput('');
          setTimeout(() => scanInputRef.current?.focus(), 100);
          return;
        }

        let selectedProduct = product;
        if (product.use_lot_management) {
          const lots = isOnline
            ? await produitService.getLots(product.id, inventaire.inventory_type)
            : product.stock_lots || [];
          selectedProduct = { ...product, stock_lots: lots };
          // Ce produit a encore des lignes pré-remplies non comptées ?
          // → champs VIDES (« non compté » : le lot reste is_counted=false,
          // traité par le « Mettre à 0 » de fin). Sinon le pré-remplissage
          // théorique marquerait chaque lot validé « compté conforme »,
          // même absent. Produit déjà compté ou hors périmètre : pré-rempli.
          const hasUncountedLignes = uncountedLignes.some(l => l.produit === product.id);
          const initialQuantities: { [key: string]: string } = {};
          lots.forEach(lot => {
            const theoretical = inventaire.inventory_type === 'RESERVE'
              ? lot.quantity_reserved || 0
              : inventaire.inventory_type === 'GLOBAL'
                ? lot.quantity_remaining + (lot.quantity_reserved || 0)
                : lot.quantity_remaining;
            initialQuantities[String(lot.id)] = hasUncountedLignes ? '' : String(theoretical);
          });
          setLotQuantities(initialQuantities);
        } else {
          // Purger les quantités d'un éventuel produit à lots précédent —
          // sinon elles seraient enregistrées comme lignes du produit courant.
          setLotQuantities({});
          setNewLotNumber('');
          setNewLotExpiration('');
        }
        setScannedProduct(selectedProduct);
        setQuantity(rapidCountMode ? '1' : product.use_lot_management ? '' : String(product.stock));
        setScanInput('');
        await playSound('success');
        Vibration.vibrate(50);

        if (!rapidCountMode) {
          setTimeout(() => quantityInputRef.current?.focus(), 100);
        }
      } else {
        await playSound('error');
        Vibration.vibrate([0, 100, 50, 100]);
        showAlert(t('scanner.product_not_found'), t('scanner.product_code', { code: trimmedCode }));
        setScanInput('');
        setTimeout(() => scanInputRef.current?.focus(), 300);
      }
    } catch (error: unknown) {
      console.error('Erreur recherche produit:', error);
      await playSound('error');
      if (error instanceof Error && error.message === 'OFFLINE_NOT_CACHED') {
        showAlert(t('scanner.product_offline'), t('scanner.product_offline_msg'));
      } else if (!isOnline) {
        showAlert(t('scanner.no_connection'), t('scanner.no_connection_search'));
      } else {
        showAlert(t('common.error'), t('scanner.search_error'));
      }
      setScanInput('');
      setTimeout(() => scanInputRef.current?.focus(), 300);
    } finally {
      setSearching(false);
    }
  };

  const handleValidate = async () => {
    if (!scannedProduct) return;

    setLoading(true);
    try {
      let savedCount = 0;

      const existingLotEntries = Object.entries(lotQuantities).filter(([_, qty]) => {
        const q = parseInt(qty, 10);
        return !isNaN(q) && q >= 0;
      });

      await Promise.all(existingLotEntries.map(async ([lotId, qtyStr]) => {
        const qty = parseInt(qtyStr, 10);
        const lot = scannedProduct.stock_lots?.find(l => String(l.id) === lotId);

        const theoretical = inventaire.inventory_type === 'RESERVE'
          ? lot?.quantity_reserved || 0
          : inventaire.inventory_type === 'GLOBAL'
            ? (lot?.quantity_remaining || 0) + (lot?.quantity_reserved || 0)
            : lot?.quantity_remaining || 0;

        await saveOffline(
          {
            id: scannedProduct.id,
            name: scannedProduct.name,
            cip1: scannedProduct.cip1 || scannedProduct.cip2 || scannedProduct.cip3 || scannedProduct.cip4 || undefined
          },
          qty,
          inventaire,
          theoretical,
          lot?.id,
          lot?.lot,
          lot?.date_expiration || undefined,
          true
        );
      }));
      savedCount = existingLotEntries.length;

      const newQty = parseInt(quantity, 10);
      if (!scannedProduct.use_lot_management && !isNaN(newQty) && newQty >= 0) {
        await saveOffline(
          { id: scannedProduct.id, name: scannedProduct.name, cip1: scannedProduct.cip1 || scannedProduct.cip2 || scannedProduct.cip3 || scannedProduct.cip4 || undefined },
          newQty,
          inventaire,
          scannedProduct.stock,
          undefined,
          undefined,
          undefined,
          true
        );
        savedCount++;
      } else if (scannedProduct.use_lot_management && !isNaN(newQty) && newQty >= 0 && newLotNumber.trim()) {
        const expirationISO = newLotExpiration ? expiryMMYYToISO(newLotExpiration) : undefined;
        if (newLotExpiration && !expirationISO) {
          showAlert(t('scanner.invalid_date'), t('scanner.invalid_date_msg'));
          setLoading(false);
          return;
        }

        await saveOffline(
          { id: scannedProduct.id, name: scannedProduct.name, cip1: scannedProduct.cip1 || scannedProduct.cip2 || scannedProduct.cip3 || scannedProduct.cip4 || undefined },
          newQty,
          inventaire,
          0,
          undefined,
          newLotNumber.trim(),
          expirationISO || undefined,
          true
        );
        savedCount++;
      }

      if (savedCount === 0) {
        await playSound('warning');
        showAlert(t('common.error'), t('scanner.positive_quantity'));
        setLoading(false);
        return;
      }

      setLastSavedProduct(`${scannedProduct.name} (${savedCount} ligne(s))`);
      await playSound('success');

      setScannedProduct(null);
      setQuantity('1');
      setLotQuantities({});
      setNewLotNumber('');
      setNewLotExpiration('');
      setScanInput('');
      Vibration.vibrate([0, 30, 30, 30, 30, 30]);
      setTimeout(() => scanInputRef.current?.focus(), rapidCountMode ? 100 : 200);
    } catch (error: unknown) {
      console.error('Erreur ajout ligne:', error);
      await playSound('error');
      showAlert(t('common.error'), t('scanner.local_save_error'));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setScannedProduct(null);
    setEditingLine(null);
    setQuantity('1');
    setLotQuantities({});
    setNewLotNumber('');
    setNewLotExpiration('');
    setEditQuantity('');
    setScanInput('');
    setTimeout(() => scanInputRef.current?.focus(), 100);
  };

  const handleEditLine = (ligne: DisplayLigne) => {
    setEditingLine(ligne);
    setEditQuantity(String(ligne.quantite_physique));
    Vibration.vibrate(50);
  };

  const handleRemoveLine = async (id: string | number) => {
    if (typeof id === 'string') {
      try {
        await removeOffline(id);
        Vibration.vibrate([0, 50, 50, 50]);
      } catch (error) {
        showAlert(t('common.error'), t('scanner.delete_error'));
      }
    } else {
      showAlert(t('common.error'), t('scanner.synced_delete_info'));
    }
  };

  const handleUpdateLine = async () => {
    if (!editingLine) return;
    const qty = parseInt(editQuantity, 10);
    if (isNaN(qty) || qty < 0) {
      showAlert(t('common.error'), t('scanner.invalid_quantity'));
      return;
    }

    setLoading(true);
    try {
      const isOffline = editingLine.id < 0 || editingLine.details?.isOffline;

      if (isOffline) {
        if (!editingLine.tempId) {
          showAlert(t('common.error'), t('scanner.line_not_found'));
          return;
        }
        await updateOffline(editingLine.tempId, qty);
        setLignes(prev => prev.map(line =>
          line.tempId === editingLine.tempId
            ? {
                ...line,
                quantite_physique: qty,
                ecart: qty - (line.stock_theorique ?? 0),
              }
            : line
        ));
      } else {
        const updated = await inventaireService.updateLigne(inventaire.id, editingLine.id, qty);
        setLignes(prev => prev.map(line => line.id === editingLine.id ? { ...line, ...updated } : line));
      }

      setEditingLine(null);
      setEditQuantity('');
      Vibration.vibrate([0, 50, 50, 50]);
      setTimeout(() => scanInputRef.current?.focus(), 200);
    } catch (error) {
      showAlert(t('common.error'), t('scanner.update_error'));
    } finally {
      setLoading(false);
    }
  };

  const toggleKeyboard = () => {
    setIsKeyboardEnabled(prev => !prev);
    Keyboard.dismiss();
  };

  /**
   * Envoie au serveur les lignes pré-remplies jamais comptées avec
   * quantite_physique=0 (mode 'replace') — produit absent du rayon.
   * Idempotent : rejouable sans effet si l'envoi précédent a réussi.
   */
  const sendZeroUncounted = async (): Promise<boolean> => {
    if (uncountedLignes.length === 0) return true;
    setZeroing(true);
    try {
      const payload = uncountedLignes.map(l => ({
        produit: l.produit,
        quantite_physique: 0,
        stock_lot: l.stock_lot ?? undefined,
        lot_numero: l.lot_numero ?? undefined,
        lot_expiration: l.lot_expiration ?? undefined,
        mode: 'replace' as const,
      }));
      const res = await inventaireService.bulkImport(
        inventaire.id, payload, `inv-${inventaire.id}-zero-${Date.now()}`
      );
      if (res.errors?.length) {
        showAlert(t('scanner.sync_error_title'), res.errors.slice(0, 3).join('\n'));
        return false;
      }
      await loadLignes();
      showAlert(t('scanner.success'), t('scanner.uncounted_sent', { count: res.imported }));
      return true;
    } catch {
      showAlert(t('common.error'), t('scanner.uncounted_zero_error'));
      return false;
    } finally {
      setZeroing(false);
    }
  };

  /** Rappel « produits non scannés » → Voir / Laisser / Mettre à 0, puis `next`. */
  const promptUncounted = (next: () => void) => {
    showAlert(
      t('scanner.uncounted_title'),
      t('scanner.uncounted_msg', { count: uncountedLignes.length }),
      [
        { text: t('scanner.uncounted_list'), style: 'cancel', onPress: () => setRestantsOpen(true) },
        { text: t('scanner.uncounted_keep'), onPress: next },
        {
          text: t('scanner.uncounted_zero'),
          onPress: async () => { if (await sendZeroUncounted()) next(); },
        },
      ]
    );
  };

  /** Prompt « lignes en attente » (envoyer sans quitter). */
  const uploadPending = () => {
    if (offlineCount === 0) {
      showAlert(t('scanner.upload_title'), t('scanner.upload_empty'));
      return;
    }
    showAlert(
      t('scanner.upload_title'),
      t('scanner.upload_confirm', { count: offlineCount }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.send'), onPress: async () => { await syncAll(); } },
      ]
    );
  };

  // Téléverse les lignes en attente sans quitter l'écran (bouton dédié).
  const handleUpload = () => {
    if (!isOnline) {
      showAlert(t('scanner.no_connection'), t('scanner.upload_offline'));
      return;
    }
    if (uncountedLignes.length > 0) {
      promptUncounted(uploadPending);
      return;
    }
    uploadPending();
  };

  /** Envoie les lignes en attente puis quitte l'écran. */
  const sendPendingAndExit = () => {
    if (offlineCount === 0) {
      onBack();
      return;
    }
    if (!isOnline) {
      showAlert(
        t('scanner.no_connection'),
        t('scanner.finish_offline'),
        [{ text: t('common.ok'), onPress: onBack }]
      );
      return;
    }
    showAlert(
      t('scanner.finish_title'),
      t('scanner.finish_send', { count: offlineCount }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.send'),
          onPress: async () => {
            const count = await syncAll();
            if (count !== undefined && count > 0) {
              showAlert(t('scanner.success'), t('scanner.success_sent', { count }), [
                { text: t('common.ok'), onPress: onBack }
              ]);
            } else {
              onBack();
            }
          }
        }
      ]
    );
  };

  /** Prompt « lignes en attente » à la sortie (envoyer ou garder). */
  const askPendingThenExit = () => {
    if (offlineCount === 0) {
      onBack();
      return;
    }
    showAlert(
      t('scanner.pending_back_title'),
      t('scanner.pending_back_msg', { count: offlineCount }),
      [
        { text: t('scanner.keep_and_quit'), style: 'default', onPress: onBack },
        { text: t('scanner.send_all'), onPress: sendPendingAndExit },
      ]
    );
  };

  // SyncBanner : terminer = rappel non comptés → envoi → sortie.
  const handleFinishAndSync = () => {
    if (isOnline && uncountedLignes.length > 0) {
      promptUncounted(sendPendingAndExit);
      return;
    }
    sendPendingAndExit();
  };

  const handleBack = () => {
    if (uncountedLignes.length > 0) {
      if (isOnline) {
        promptUncounted(askPendingThenExit);
      } else {
        // Hors ligne : impossible de mettre à 0 — simple rappel.
        showAlert(
          t('scanner.uncounted_title'),
          t('scanner.uncounted_offline_msg', { count: uncountedLignes.length }),
          [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('scanner.keep_and_quit'), onPress: askPendingThenExit },
          ]
        );
      }
      return;
    }
    askPendingThenExit();
  };

  const toggleContinuousMode = () => {
    setContinuousScanMode(prev => {
      const next = !prev;
      if (next) setRapidCountMode(false);
      return next;
    });
    Vibration.vibrate(50);
  };

  const toggleRapidMode = () => {
    setRapidCountMode(prev => {
      const next = !prev;
      if (next) setContinuousScanMode(false);
      return next;
    });
    Vibration.vibrate(50);
  };

  return {
    // Refs
    scanInputRef,
    // States
    scannedProduct,
    quantity,
    lignes,
    loading,
    searching,
    scanInput,
    editingLine,
    editQuantity,
    lotQuantities,
    newLotNumber,
    newLotExpiration,
    continuousScanMode,
    rapidCountMode,
    lastSavedProduct,
    isKeyboardEnabled,
    isOnline,
    offlineCount,
    syncing,
    syncProgress,
    // Pré-rempli (étape 2)
    preloadProgress,
    uncountedLignes,
    restantsOpen,
    scopeWarning,
    zeroing,
    // Setters
    setQuantity,
    setScanInput,
    setEditingLine,
    setEditQuantity,
    setLotQuantities,
    setNewLotNumber,
    setNewLotExpiration,
    setRestantsOpen,
    // Handlers
    sendZeroUncounted,
    handleScanSubmit,
    handleValidate,
    handleCancel,
    handleEditLine,
    handleRemoveLine,
    handleUpdateLine,
    toggleKeyboard,
    handleUpload,
    handleFinishAndSync,
    handleBack,
    toggleContinuousMode,
    toggleRapidMode,
  };
}
