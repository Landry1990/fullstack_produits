import { useState, useEffect, useRef, useCallback } from 'react';
import { Alert, Vibration, Keyboard, TextInput } from 'react-native';
import { Audio } from 'expo-av';
import type { Inventaire, LigneInventaire, Produit } from '../../services/inventaire';
import { inventaireService, produitService } from '../../services/inventaire';
import { exportService } from '../../services/export';
import { useOfflineSync } from '../../hooks/useOfflineSync';

export interface DisplayLigne extends LigneInventaire {
  tempId?: string;
  details?: { isOffline: boolean };
}

export function useScannerController(inventaire: Inventaire, onBack: () => void) {
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
    offlineLignes,
    updateOffline,
    removeOffline,
  } = useOfflineSync({
    inventaireId: inventaire.id,
    onSyncComplete: (count) => {
      Alert.alert('Synchronisation', `${count} ligne(s) synchronisée(s)`);
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
      let serverLignes: LigneInventaire[] = [];
      if (isOnline) {
        try {
          serverLignes = await inventaireService.getLignes(inventaire.id);
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
        quantite_theorique: 0,
        quantite_comptee: l.quantiteComptee,
        ecart: 0,
        scanned_at: l.scannedAt,
        details: { isOffline: true }
      }));

      setLignes([...localDisplayLignes, ...serverLignes]);
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

      const { sound } = await Audio.Sound.createAsync({ uri });
      await sound.playAsync();
      setTimeout(() => sound.unloadAsync(), 500);
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
        { id: product.id, name: product.name, cip1: product.cip1 || undefined },
        qty,
        inventaire
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
      Alert.alert('Erreur', 'Impossible de sauvegarder');
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
        if (continuousScanMode && !product.use_lot_management) {
          await handleContinuousSave(product);
          return;
        }

        if (rapidCountMode && !product.use_lot_management) {
          await saveOffline(
            { id: product.id, name: product.name, cip1: product.cip1 || undefined },
            1,
            inventaire
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

        setScannedProduct(product);
        setQuantity(rapidCountMode ? '1' : '');
        setScanInput('');
        await playSound('success');
        Vibration.vibrate(50);

        if (!rapidCountMode) {
          setTimeout(() => quantityInputRef.current?.focus(), 100);
        }
      } else {
        await playSound('error');
        Vibration.vibrate([0, 100, 50, 100]);
        Alert.alert('Produit non trouvé', `Code: ${trimmedCode}`);
        setScanInput('');
        setTimeout(() => scanInputRef.current?.focus(), 300);
      }
    } catch (error: unknown) {
      console.error('Erreur recherche produit:', error);
      await playSound('error');
      if (error instanceof Error && error.message === 'OFFLINE_NOT_CACHED') {
        Alert.alert('Produit hors ligne', `Ce produit n'est pas dans le catalogue téléchargé. Téléchargez le catalogue depuis l'accueil.`);
      } else if (!isOnline) {
        Alert.alert('Hors connexion', 'La recherche de nouveaux produits nécessite internet ou un catalogue téléchargé.');
      } else {
        Alert.alert('Erreur', 'Impossible de rechercher le produit');
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
        return !isNaN(q) && q > 0;
      });

      await Promise.all(existingLotEntries.map(async ([lotId, qtyStr]) => {
        const qty = parseInt(qtyStr, 10);
        const lot = scannedProduct.stock_lots?.find(l => String(l.id) === lotId);

        await saveOffline(
          {
            id: scannedProduct.id,
            name: scannedProduct.name,
            cip1: scannedProduct.cip1 || undefined
          },
          qty,
          inventaire,
          lot?.lot,
          lot?.date_expiration || undefined
        );
      }));
      savedCount = existingLotEntries.length;

      const newQty = parseInt(quantity, 10);
      if (!scannedProduct.use_lot_management && !isNaN(newQty) && newQty > 0) {
        await saveOffline(
          { id: scannedProduct.id, name: scannedProduct.name, cip1: scannedProduct.cip1 || undefined },
          newQty,
          inventaire
        );
        savedCount++;
      } else if (scannedProduct.use_lot_management && !isNaN(newQty) && newQty > 0) {
        if (newLotExpiration && !/^\d{4}-\d{2}-\d{2}$/.test(newLotExpiration)) {
          Alert.alert('Format Date Invalide', 'Veuillez utiliser le format AAAA-MM-JJ (ex: 2026-12-31)');
          setLoading(false);
          return;
        }

        await saveOffline(
          { id: scannedProduct.id, name: scannedProduct.name, cip1: scannedProduct.cip1 || undefined },
          newQty,
          inventaire,
          newLotNumber || undefined,
          newLotExpiration || undefined
        );
        savedCount++;
      }

      if (savedCount === 0) {
        await playSound('warning');
        Alert.alert('Attention', 'Veuillez saisir au moins une quantité positive.');
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
      Alert.alert('Erreur', 'Impossible de sauvegarder localement');
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
    setEditQuantity(String(ligne.quantite_comptee));
    Vibration.vibrate(50);
  };

  const handleRemoveLine = async (id: string | number) => {
    if (typeof id === 'string') {
      try {
        await removeOffline(id);
        Vibration.vibrate([0, 50, 50, 50]);
      } catch (error) {
        Alert.alert('Erreur', 'Impossible de supprimer la ligne');
      }
    } else {
      Alert.alert('Information', 'La suppression des lignes synchronisées n\'est pas disponible.');
    }
  };

  const handleUpdateLine = async () => {
    if (!editingLine) return;
    const qty = parseInt(editQuantity, 10);
    if (isNaN(qty) || qty < 0) {
      Alert.alert('Erreur', 'Quantité invalide');
      return;
    }

    setLoading(true);
    try {
      const isOffline = editingLine.id < 0 || editingLine.details?.isOffline;

      if (isOffline) {
        if (editingLine.tempId) {
          await updateOffline(editingLine.tempId, qty);
        } else {
          Alert.alert('Erreur', 'Ligne locale non trouvée');
        }
      } else {
        await inventaireService.updateLigne(inventaire.id, editingLine.id, qty);
      }

      await loadLignes();
      setEditingLine(null);
      setEditQuantity('');
      Vibration.vibrate([0, 50, 50, 50]);
      setTimeout(() => scanInputRef.current?.focus(), 200);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de modifier');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (offlineCount > 0) {
      Alert.alert('Attention', 'Vous avez des lignes non synchronisées. Synchronisez d\'abord avant d\'exporter.');
      return;
    }
    try {
      setLoading(true);
      await exportService.exportInventaireToCsv(inventaire);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Impossible d'exporter le fichier";
      Alert.alert("Erreur Export", message);
    } finally {
      setLoading(false);
      setTimeout(() => scanInputRef.current?.focus(), 500);
    }
  };

  const toggleKeyboard = () => {
    setIsKeyboardEnabled(prev => !prev);
    Keyboard.dismiss();
  };

  const handleFinishAndSync = async () => {
    if (offlineCount === 0) {
      onBack();
      return;
    }
    if (!isOnline) {
      Alert.alert(
        'Hors ligne',
        'Vous êtes hors ligne. Les scans seront conservés localement et synchronisés ultérieurement.',
        [{ text: 'OK', onPress: onBack }]
      );
      return;
    }
    Alert.alert(
      'Terminer la session',
      `Envoyer ${offlineCount} ligne(s) vers le serveur ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Envoyer',
          onPress: async () => {
            const count = await syncAll();
            if (count !== undefined && count > 0) {
              Alert.alert('Succès', `${count} ligne(s) envoyée(s)`, [
                { text: 'OK', onPress: onBack }
              ]);
            } else {
              onBack();
            }
          }
        }
      ]
    );
  };

  const handleBack = () => {
    if (offlineCount > 0) {
      Alert.alert(
        'Lignes non envoyées',
        `Vous avez ${offlineCount} ligne(s) non synchronisée(s). Que voulez-vous faire ?`,
        [
          { text: 'Tout envoyer', onPress: handleFinishAndSync },
          { text: 'Garder et quitter', style: 'default', onPress: onBack },
        ]
      );
    } else {
      onBack();
    }
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
    // Setters
    setQuantity,
    setScanInput,
    setEditingLine,
    setEditQuantity,
    setLotQuantities,
    setNewLotNumber,
    setNewLotExpiration,
    // Handlers
    handleScanSubmit,
    handleValidate,
    handleCancel,
    handleEditLine,
    handleRemoveLine,
    handleUpdateLine,
    handleExport,
    toggleKeyboard,
    handleFinishAndSync,
    handleBack,
    toggleContinuousMode,
    toggleRapidMode,
  };
}
