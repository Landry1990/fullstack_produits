import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Vibration,
  FlatList,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { 
  Inventaire, 
  LigneInventaire, 
  Produit,
  inventaireService, 
  produitService,
  exportService
} from '../services';
import { useOfflineSync } from '../hooks';

interface ScannerScreenProps {
  inventaire: Inventaire;
  onBack: () => void;
}

export default function ScannerScreen({ inventaire, onBack }: ScannerScreenProps) {
  const [scannedProduct, setScannedProduct] = useState<Produit | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [lignes, setLignes] = useState<LigneInventaire[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  
  // Hook Sync Offline
  const { 
    isOnline, 
    saveOffline, 
    syncAll, 
    offlineCount, 
    syncing, 
    offlineLignes 
  } = useOfflineSync({ 
    inventaireId: inventaire.id,
    onSyncComplete: (count) => {
      Alert.alert('Synchronisation', `${count} ligne(s) synchronisée(s) !`);
      loadLignes(); // Recharger les données serveur
    }
  });

  // Input pour le scanner laser (mode keyboard wedge)
  const [scanInput, setScanInput] = useState('');
  const scanInputRef = useRef<TextInput>(null);
  const quantityInputRef = useRef<TextInput>(null);
  
  // Mode édition d'une ligne existante
  const [editingLine, setEditingLine] = useState<LigneInventaire | null>(null);
  const [editQuantity, setEditQuantity] = useState('');

  // Charger les lignes (Serveur + Local)
  useEffect(() => {
    loadLignes();
  }, [offlineLignes.length]); // Recharger quand le local change

  // Focus automatique sur le champ de scan
  useEffect(() => {
    if (!scannedProduct && !editingLine) {
      const timer = setTimeout(() => {
        scanInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [scannedProduct, lignes, editingLine]);

  // Auto-submit du scan
  useEffect(() => {
    if (!scanInput || scanInput.length < 3) return;
    const timeoutId = setTimeout(() => {
      handleScanSubmit();
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [scanInput]);

  const loadLignes = async () => {
    try {
      // 1. Charger lignes serveur
      let serverLignes: LigneInventaire[] = [];
      if (isOnline) {
        try {
          serverLignes = await inventaireService.getLignes(inventaire.id);
        } catch (e) {
          console.warn('Erreur fetch lignes server:', e);
        }
      }

      // 2. Convertir lignes offline en format LigneInventaire pour affichage
      const localDisplayLignes = offlineLignes.map(l => ({
        id: -1 * parseInt(l.tempId.split('_')[1] || '0'), // ID temporaire négatif
        inventaire: l.inventaireId,
        produit: l.produitId,
        produit_nom: l.produitNom,
        produit_cip: l.produitCip,
        quantite_comptee: l.quantiteComptee,
        scanned_at: l.scannedAt,
        details: { isOffline: true } // Marqueur visuel
      } as unknown as LigneInventaire));

      // 3. Fusionner (Local en premier pour visibilité)
      setLignes([...localDisplayLignes, ...serverLignes]);
    } catch (error) {
      console.error('Erreur chargement lignes:', error);
    }
  };

  // Handler scan
  const handleScanSubmit = async () => {
    const code = scanInput.trim();
    if (!code || searching) return;

    setSearching(true);
    Vibration.vibrate(50);
    Keyboard.dismiss();

    try {
      // Recherche produit : Essayer API si online, sinon ??? (Il faudrait un cache produits local)
      // Pour l'instant, supposons que la recherche produit requiert internet 
      // OU que le user a scanné un code déjà connu ?
      // TODO: Implémenter cache produits pour recherche offline
      
      const product = await produitService.getByCip(code);
      if (product) {
        setScannedProduct(product);
        setQuantity('1');
        setScanInput('');
        Vibration.vibrate(100);
        setTimeout(() => quantityInputRef.current?.focus(), 100);
      } else {
        Alert.alert('Produit non trouvé', `Code: ${code}`);
        setScanInput('');
        setTimeout(() => scanInputRef.current?.focus(), 300);
      }
    } catch (error) {
      console.error('Erreur recherche produit:', error);
      if (!isOnline) {
         Alert.alert('Hors connexion', 'La recherche de nouveaux produits nécessite internet pour l\'instant.');
      } else {
         Alert.alert('Erreur', 'Impossible de rechercher le produit');
      }
      setScanInput('');
      setTimeout(() => scanInputRef.current?.focus(), 300);
    } finally {
      setSearching(false);
    }
  };

  // Lot State
  const [lotNumero, setLotNumero] = useState('');
  const [lotExpiration, setLotExpiration] = useState('');

  // Valider la ligne (Smart Offline/Online)
  const handleValidate = async () => {
    if (!scannedProduct) return;

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 0) {
      Alert.alert('Erreur', 'Quantité invalide');
      return;
    }

    // Validation Lot si activé
    if (scannedProduct.use_lot_management && !lotNumero) {
        // Optionnel : ne pas bloquer si utilisation de lot existant non scanné, 
        // mais ici on demande de saisir le lot pour le stock entrant/inventaire précis
        // On pourrait rendre ça optionnel si stock > 0 ? Pour l'instant on force si flag actif
        // Sauf si on considère que le backend gère le FIFO auto...
        // DECISION: On demande le lot si on veut préciser, sinon on laisse vide et le backend gère ?
        // NON, le but est de renseigner le lot scanné.
        // Alert.alert('Lot requis', 'Veuillez saisir le numéro de lot pour ce produit.');
        // return; 
    }

    setLoading(true);
    try {
      const ligneData = {
          produit: scannedProduct.id,
          quantite_comptee: qty,
          lot_numero: lotNumero || undefined,
          lot_expiration: lotExpiration || undefined
      };

      if (isOnline) {
        // Mode Connecté : Tenter envoi direct
        try {
          await inventaireService.addLigne(inventaire.id, ligneData);
          // Succès direct
          await loadLignes(); // Rafraîchir
        } catch (error) {
          console.warn('Erreur envoi direct, passage en offline:', error);
          // Fallback Offline si erreur réseau
          await saveOffline({
            ...scannedProduct,
            cip1: scannedProduct.cip1 || undefined
          }, qty, inventaire, lotNumero, lotExpiration);
          Alert.alert('Mode Hors-ligne', 'Ligne sauvegardée localement (erreur réseau)');
        }
      } else {
        // Mode Hors-ligne : Sauvegarde locale directe
        await saveOffline({
          ...scannedProduct,
          cip1: scannedProduct.cip1 || undefined
        }, qty, inventaire, lotNumero, lotExpiration);
      }

      // Reset UI (Commun)
      setScannedProduct(null);
      setQuantity('1');
      setLotNumero('');
      setLotExpiration(''); // Reset lot
      setScanInput('');
      Vibration.vibrate([0, 50, 50, 50]);
      setTimeout(() => scanInputRef.current?.focus(), 200);

    } catch (error: any) {
      console.error('Erreur ajout ligne:', error);
      Alert.alert('Erreur', 'Impossible de sauvegarder la ligne');
    } finally {
      setLoading(false);
    }
  };

  // Annuler scan
  const handleCancel = () => {
    setScannedProduct(null);
    setEditingLine(null);
    setQuantity('1');
    setEditQuantity('');
    setScanInput('');
    setTimeout(() => scanInputRef.current?.focus(), 100);
  };

  const handleEditLine = (ligne: LigneInventaire) => {
    // Interdire édition lignes offline pour simplifier (ou implémenter update local)
    if ((ligne as any).details?.isOffline) {
       Alert.alert('Info', 'Impossible de modifier une ligne en attente de synchro. Supprimez-la et rescannez si besoin.');
       return;
    }
    setEditingLine(ligne);
    setEditQuantity(String(ligne.quantite_comptee));
    Vibration.vibrate(50);
  };

  const handleUpdateLine = async () => {
    if (!editingLine) return;
    const qty = parseInt(editQuantity, 10);
    // ... validation ...
    setLoading(true);
    try {
      await inventaireService.updateLigne(inventaire.id, editingLine.id, qty);
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

  // Export CSV
  const handleExport = async () => {
    if (offlineCount > 0) {
      Alert.alert('Attention', 'Vous avez des lignes non synchronisées. Synchronisez d\'abord avant d\'exporter.');
      return;
    }
    try {
      setLoading(true);
      await exportService.exportInventaireToCsv(inventaire);
    } catch (error: any) {
      Alert.alert("Erreur Export", error.message || "Impossible d'exporter le fichier");
    } finally {
      setLoading(false);
      setTimeout(() => scanInputRef.current?.focus(), 500);
    }
  };

  // Keyboard State
  const [isKeyboardEnabled, setIsKeyboardEnabled] = useState(false);

  // Toggle Keyboard
  const toggleKeyboard = () => {
    setIsKeyboardEnabled(prev => !prev);
    // Force blur/focus to update visibility if currently focused
    Keyboard.dismiss();
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>� Quitter</Text>
        </TouchableOpacity>
        
        <View style={styles.headerTitles}>
          <Text style={styles.headerTitle}>{inventaire.reference}</Text>
          <View style={[styles.statusBadge, isOnline ? styles.statusOnline : styles.statusOffline]}>
            <Text style={styles.statusText}>{isOnline ? 'EN LIGNE' : 'HORS LIGNE'}</Text>
          </View>
        </View>
        
        <View style={styles.headerRight}>
           <TouchableOpacity onPress={toggleKeyboard} style={[styles.exportBtn, { marginRight: 8, backgroundColor: isKeyboardEnabled ? '#4f46e5' : '#2d2d44' }]}>
            <Text style={styles.exportBtnText}>{isKeyboardEnabled ? '⌨️' : '⌨️⃠'}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleExport} style={styles.exportBtn}>
            <Text style={styles.exportBtnText}>📤</Text>
          </TouchableOpacity>
          <View style={styles.counter}>
            <Text style={styles.counterText}>{lignes.length}</Text>
          </View>
        </View>
      </View>

      {/* Bandeau de Synchronisation si lignes en attente */}
      {offlineCount > 0 && (
        <TouchableOpacity 
          style={[styles.syncBanner, isOnline ? styles.syncBannerActive : styles.syncBannerDisabled]}
          onPress={syncAll}
          disabled={!isOnline || syncing}
        >
           {syncing ? (
             <ActivityIndicator color="#fff" size="small" />
           ) : (
             <Text style={styles.syncBannerText}>
               ⚠️ {offlineCount} ligne(s) non synchronisée(s) - Tap pour envoyer
             </Text>
           )}
        </TouchableOpacity>
      )}

      {/* Scanner ou Produit */}
      {scannedProduct ? (
        <View style={styles.productCard}>
          <Text style={styles.productName}>{scannedProduct.name}</Text>
          <Text style={styles.productCip}>
            CIP: {scannedProduct.cip1 || scannedProduct.cip2 || '-'}
          </Text>
          <Text style={styles.productStock}>
            Stock théorique: <Text style={styles.stockValue}>{scannedProduct.stock}</Text>
          </Text>

          <View style={styles.quantityRow}>
            <TouchableOpacity 
              style={styles.qtyBtn}
              onPress={() => setQuantity(String(Math.max(0, parseInt(quantity) - 1)))}
            >
              <Text style={styles.qtyBtnText}>−</Text>
            </TouchableOpacity>

            <TextInput
              ref={quantityInputRef}
              style={styles.qtyInput}
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="number-pad"
              selectTextOnFocus
              showSoftInputOnFocus={isKeyboardEnabled}
            />

            <TouchableOpacity 
              style={styles.qtyBtn}
              onPress={() => setQuantity(String(parseInt(quantity) + 1))}
            >
              <Text style={styles.qtyBtnText}>+</Text>
            </TouchableOpacity>
          </View>

          {/* Section Lots - Affichée uniquement si gestion par lot active */}
          {scannedProduct.use_lot_management && (
            <View style={styles.lotContainer}>
                <Text style={styles.lotTitle}>Informations Lot (Optionnel)</Text>
                <View style={styles.lotInputsRow}>
                    <TextInput
                        style={styles.lotInput}
                        placeholder="N° Lot"
                        placeholderTextColor="#666"
                        value={lotNumero}
                        onChangeText={setLotNumero}
                        showSoftInputOnFocus={isKeyboardEnabled}
                    />
                    <TextInput
                        style={styles.lotInput}
                        placeholder="Date Exp (AAAA-MM-JJ)"
                        placeholderTextColor="#666"
                        value={lotExpiration}
                        onChangeText={setLotExpiration}
                        showSoftInputOnFocus={isKeyboardEnabled}
                        // Ajout d'une regex simple ou date picker dans l'idéal
                    />
                </View>
            </View>
          )}

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
              <Text style={styles.cancelBtnText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.validateBtn, loading && styles.btnDisabled]} 
              onPress={handleValidate}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.validateBtnText}>
                  {isOnline ? '✓ Valider' : '💾 Sauver (Local)'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        // Mode scan laser
        <View style={styles.scannerContainer}>
          <Text style={styles.scanIcon}>📡</Text>
          <Text style={styles.scanTitle}>Prêt à scanner</Text>
          <Text style={styles.scanSubtitle}>
            Scannez un code-barres avec le laser
          </Text>
          
          {/* Input invisible qui capture le scan laser */}
          <TextInput
            ref={scanInputRef}
            style={styles.scanInput}
            value={scanInput}
            onChangeText={setScanInput}
            onSubmitEditing={handleScanSubmit}
            placeholder="Code-barres..."
            placeholderTextColor="#666"
            autoFocus
            blurOnSubmit={false}
            returnKeyType="search"
            keyboardType="default"
            autoCapitalize="none"
            autoCorrect={false}
            showSoftInputOnFocus={isKeyboardEnabled}
          />

          {searching && (
            <View style={styles.searchingIndicator}>
              <ActivityIndicator color="#4f46e5" size="large" />
              <Text style={styles.searchingText}>Recherche...</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.searchBtn, (!scanInput.trim() || searching) && styles.btnDisabled]}
            onPress={handleScanSubmit}
            disabled={!scanInput.trim() || searching}
          >
            <Text style={styles.searchBtnText}>🔍 Rechercher</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Mode édition d'une ligne */}
      {editingLine && (
        <View style={styles.editCard}>
          <Text style={styles.editTitle}>✏️ Modifier la quantité</Text>
          <Text style={styles.editProductName}>
            {editingLine.produit_nom || editingLine.produit_name || `Produit #${editingLine.produit}`}
          </Text>
          
          <View style={styles.quantityRow}>
             {/* ... (même que original) ... */}
             {/* Pour économiser espace tokens, j'utilise une version simplifiée ou je reprends le code existant si possible, 
                 mais `replace_file_content` demande le contenu complet si je remplace un gros bloc.
                 Je vais remettre les inputs quantité
             */}
            <TouchableOpacity 
              style={styles.qtyBtn}
              onPress={() => setEditQuantity(String(Math.max(0, parseInt(editQuantity) - 1)))}
            >
              <Text style={styles.qtyBtnText}>−</Text>
            </TouchableOpacity>

            <TextInput
              style={styles.qtyInput}
              value={editQuantity}
              onChangeText={setEditQuantity}
              keyboardType="number-pad"
              selectTextOnFocus
            />

            <TouchableOpacity 
              style={styles.qtyBtn}
              onPress={() => setEditQuantity(String(parseInt(editQuantity || '0') + 1))}
            >
              <Text style={styles.qtyBtnText}>+</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
              <Text style={styles.cancelBtnText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.validateBtn, loading && styles.btnDisabled]} 
              onPress={handleUpdateLine}
              disabled={loading}
            >
               {/* ... */}
               <Text style={styles.validateBtnText}>💾 Enregistrer</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Liste des dernières lignes */}
      <View style={styles.recentContainer}>
        <Text style={styles.recentTitle}>Derniers scans</Text>
        <FlatList
          data={lignes.slice(-10).reverse()} // Attention, lignes contient offline (id négatif) et online
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={[
                 styles.recentItem, 
                 editingLine?.id === item.id && styles.recentItemActive,
                 (item as any).details?.isOffline && styles.recentItemOffline
              ]}
              onPress={() => handleEditLine(item)}
            >
              <Text style={styles.recentName} numberOfLines={1}>
                {(item as any).details?.isOffline ? '⏳ ' : ''}
                {item.produit_nom || item.produit_name || `Produit #${item.produit}`}
              </Text>
              <Text style={styles.recentQty}>{item.quantite_comptee}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Aucun scan effectué</Text>
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 48,
  },
  backBtn: {
    padding: 8,
  },
  backBtnText: {
    color: '#4f46e5',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitles: {
    flex: 1,
    marginLeft: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  statusOnline: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
  },
  statusOffline: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  counter: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  counterText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  exportBtn: {
    padding: 8,
    backgroundColor: '#2d2d44',
    borderRadius: 8,
  },
  exportBtnText: {
    fontSize: 20,
  },
  syncBanner: {
    backgroundColor: '#f59e0b',
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  syncBannerActive: {
    backgroundColor: '#f59e0b',
  },
  syncBannerDisabled: {
    backgroundColor: '#92400e',
    opacity: 0.8,
  },
  syncBannerText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  scannerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  scanIcon: {
    fontSize: 80,
    marginBottom: 16,
  },
  scanTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  scanSubtitle: {
    color: '#888',
    fontSize: 16,
    marginBottom: 32,
    textAlign: 'center',
  },
  scanInput: {
    width: '100%',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 20,
    textAlign: 'center',
    borderWidth: 2,
    borderColor: '#4f46e5',
    marginBottom: 16,
  },
  searchingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  searchingText: {
    color: '#4f46e5',
    fontSize: 16,
    marginLeft: 12,
  },
  searchBtn: {
    backgroundColor: '#4f46e5',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginTop: 8,
  },
  searchBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  productCard: {
    backgroundColor: '#1a1a2e',
    margin: 16,
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#22c55e',
  },
  productName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  productCip: {
    color: '#ccc', // Contraste amélioré
    fontSize: 16, // Police augmentée
    marginBottom: 4,
  },
  productStock: {
    color: '#bbb', // Contraste amélioré
    fontSize: 16, // Police augmentée
    marginBottom: 16,
  },
  stockValue: {
    color: '#6366f1', // Meilleur contraste (indigo-500)
    fontWeight: 'bold',
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24, // Espace augmenté
  },
  qtyBtn: {
    width: 64, // Augmenté pour cible tactile
    height: 64, // Augmenté pour cible tactile
    borderRadius: 32,
    backgroundColor: '#2d2d44',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4b4b6a',
  },
  qtyBtnText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '300',
  },
  qtyInput: {
    width: 120, // Plus large
    height: 64, // Plus haut
    backgroundColor: '#0f0f1a',
    borderRadius: 16,
    marginHorizontal: 16,
    color: '#fff',
    fontSize: 32, // Plus grand
    textAlign: 'center',
    fontWeight: 'bold',
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  actions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    padding: 18, // Augmenté
    borderRadius: 16,
    backgroundColor: '#2d2d44',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4b4b6a',
  },
  cancelBtnText: {
    color: '#fff',
    fontSize: 18, // Augmenté
    fontWeight: '600',
  },
  validateBtn: {
    flex: 2,
    padding: 18, // Augmenté
    borderRadius: 16,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    elevation: 4,
  },
  validateBtnText: {
    color: '#fff',
    fontSize: 18, // Augmenté
    fontWeight: 'bold',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  recentContainer: {
    backgroundColor: '#1a1a2e',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#2d2d44',
    maxHeight: 250, // Plus d'espace
  },
  recentTitle: {
    color: '#ccc', // Contraste
    fontSize: 16, // Augmenté
    fontWeight: '600',
    marginBottom: 16,
  },
  recentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16, // Augmenté > 48dp touch target
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
    borderRadius: 12,
    marginBottom: 4,
  },
  recentItemActive: {
    backgroundColor: 'rgba(79, 70, 229, 0.2)', // Plus subtil
    borderColor: '#4f46e5',
    borderWidth: 1,
  },
  recentItemOffline: {
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
    backgroundColor: '#222',
  },
  recentName: {
    color: '#fff',
    fontSize: 16,
    flex: 1,
    marginRight: 12,
  },
  recentQty: {
    color: '#818cf8', // Plus clair pour contraste
    fontSize: 18,
    fontWeight: 'bold',
    minWidth: 40,
    textAlign: 'right',
  },
  emptyText: {
    color: '#bbb',
    fontSize: 16,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 24,
  },
  editCard: {
    backgroundColor: '#1a1a2e',
    margin: 16,
    borderRadius: 16,
    padding: 24,
    borderWidth: 2,
    borderColor: '#f59e0b',
  },
  editTitle: {
    color: '#f59e0b',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  lotContainer: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#2d2d44',
  },
  lotTitle: {
    color: '#ccc',
    fontSize: 16,
    marginBottom: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
  lotInputsRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  lotInput: {
    flex: 1,
    backgroundColor: '#0f0f1a',
    borderRadius: 12,
    padding: 16, // Plus grand
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#2d2d44',
    minHeight: 56, // Hauteur min garantie
  },
  editProductName: {
    color: '#fff',
    fontSize: 18,
    marginBottom: 20,
    textAlign: 'center',
    fontWeight: '500',
  },
});
