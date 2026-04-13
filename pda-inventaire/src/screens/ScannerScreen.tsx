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
    offlineLignes,
    updateOffline, // Ajouté
    removeOffline  // Ajouté
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

  // Saisie Multi-Lots
  const [lotQuantities, setLotQuantities] = useState<{[key: string]: string}>({});
  const [newLotNumber, setNewLotNumber] = useState('');
  const [newLotExpiration, setNewLotExpiration] = useState('');

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
        setQuantity(''); // Vide par défaut pour éviter les nouveaux lots fantômes
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

  // Valider la ligne (Offline First Systematique)
  const handleValidate = async () => {
    if (!scannedProduct) return;

    setLoading(true);
    try {
      let savedCount = 0;

      // 1. Enregistrer les lots existants qui ont une quantité saisie
      const existingLotEntries = Object.entries(lotQuantities).filter(([_, qty]) => {
        const q = parseInt(qty, 10);
        return !isNaN(q) && q > 0;
      });

      for (const [lotId, qtyStr] of existingLotEntries) {
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
        savedCount++;
      }

      // 2. Enregistrer le nouveau lot si renseigné
      const newQty = parseInt(quantity, 10);
      if (!scannedProduct.use_lot_management && !isNaN(newQty) && newQty > 0) {
          // Produit sans gestion de lot
          await saveOffline(
            { id: scannedProduct.id, name: scannedProduct.name, cip1: scannedProduct.cip1 || undefined },
            newQty,
            inventaire
          );
          savedCount++;
      } else if (scannedProduct.use_lot_management && !isNaN(newQty) && newQty > 0) {
          // Nouveau lot pour produit avec gestion de lot
          
          // --- VALIDATION DATE ---
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
        Alert.alert('Attention', 'Veuillez saisir au moins une quantité positive.');
        setLoading(false);
        return;
      }

      // Reset UI
      setScannedProduct(null);
      setQuantity('1'); // Reset pour le prochain scan
      setLotQuantities({});
      setNewLotNumber('');
      setNewLotExpiration('');
      setScanInput('');
      Vibration.vibrate([0, 50, 50, 50]);
      setTimeout(() => scanInputRef.current?.focus(), 200);

    } catch (error: any) {
      console.error('Erreur ajout ligne:', error);
      Alert.alert('Erreur', 'Impossible de sauvegarder localement');
    } finally {
      setLoading(false);
    }
  };

  // Annuler scan
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

  const handleEditLine = (ligne: LigneInventaire) => {
    setEditingLine(ligne);
    setEditQuantity(String(ligne.quantite_comptee));
    Vibration.vibrate(50);
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
      const isOffline = (editingLine as any).id < 0 || (editingLine as any).details?.isOffline;
      
      if (isOffline) {
        // En mode offline-first, les ID locaux sont négatifs (marqués l.99 loadLignes)
        // Mais useOfflineSync utilise tempId. On doit retrouver le tempId si possible ou modifier par ID.
        // AMELIORATION: On va chercher dans offlineLignes celle qui correspond à cet index/id négatif.
        const offLine = offlineLignes.find(l => {
             const derivedId = -1 * parseInt(l.tempId.split('_')[1] || '0');
             return derivedId === editingLine.id;
        });
        
        if (offLine) {
            await updateOffline(offLine.tempId, qty);
        } else {
            // Fallback si on ne retrouve pas via ID négatif
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
          <View style={styles.productMeta}>
            <Text style={styles.productCip}>CIP: {scannedProduct.cip1 || '-'}</Text>
            <View style={styles.stockBadge}>
               <Text style={styles.stockBadgeText}>Stock: {scannedProduct.stock}</Text>
            </View>
          </View>

          <FlatList
            style={styles.lotScroll}
            data={scannedProduct.stock_lots || []}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <View style={styles.lotItem}>
                <View style={styles.lotInfo}>
                  <Text style={styles.lotLabel}>Lot: <Text style={styles.lotValue}>{item.lot}</Text></Text>
                  <Text style={styles.lotExp}>Exp: {item.date_expiration || 'N/A'}</Text>
                  <Text style={styles.lotStock}>Théorique: {item.quantity_remaining}</Text>
                </View>
                <View style={styles.lotQtyContainer}>
                   <TextInput
                     style={styles.lotQtyInput}
                     value={lotQuantities[item.id] || ''}
                     onChangeText={(val) => setLotQuantities(prev => ({...prev, [item.id]: val}))}
                     placeholder="0"
                     placeholderTextColor="#444"
                     keyboardType="number-pad"
                     selectTextOnFocus
                   />
                </View>
              </View>
            )}
            ListFooterComponent={
              <View style={styles.newLotSection}>
                <Text style={styles.newLotTitle}>➕ Nouveau Lot / Sans Lot</Text>
                <View style={styles.newLotRow}>
                    <TextInput
                      style={[styles.lotInput, { flex: 2 }]}
                      placeholder="Numéro de Lot"
                      placeholderTextColor="#666"
                      value={newLotNumber}
                      onChangeText={setNewLotNumber}
                    />
                    <TextInput
                      style={[styles.lotInput, { flex: 2 }]}
                      placeholder="Expiration (AAAA-MM-JJ)"
                      placeholderTextColor="#666"
                      value={newLotExpiration}
                      onChangeText={setNewLotExpiration}
                    />
                    <TextInput
                      style={[styles.lotInput, { flex: 1, backgroundColor: '#2d2d44', color: '#fff', fontWeight: 'bold' }]}
                      placeholder="Qté"
                      placeholderTextColor="#888"
                      value={quantity}
                      onChangeText={setQuantity}
                      keyboardType="number-pad"
                      selectTextOnFocus
                    />
                </View>
              </View>
            }
          />

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
                  💾 Sauver (Local)
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
    backgroundColor: '#1e1e35',
    margin: 15,
    padding: 20,
    borderRadius: 15,
    elevation: 5,
    maxHeight: '65%', // Limiter la hauteur pour garder l'historique visible
    borderWidth: 1,
    borderColor: '#4f46e5',
  },
  productName: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  productMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  productCip: {
    color: '#888',
    fontSize: 14,
  },
  stockBadge: {
    backgroundColor: '#2d2d44',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  stockBadgeText: {
    color: '#4f46e5',
    fontWeight: 'bold',
    fontSize: 12,
  },
  lotScroll: {
    maxHeight: 300,
    marginBottom: 15,
  },
  lotItem: {
    flexDirection: 'row',
    backgroundColor: '#151525',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  lotInfo: {
    flex: 1,
  },
  lotLabel: { color: '#ccc', fontSize: 13 },
  lotValue: { color: '#fff', fontWeight: 'bold' },
  lotExp: { color: '#888', fontSize: 11 },
  lotStock: { color: '#4f46e5', fontSize: 11, marginTop: 2 },
  lotQtyContainer: {
    width: 70,
    marginLeft: 10,
  },
  lotQtyInput: {
    backgroundColor: '#2d2d44',
    color: '#fff',
    textAlign: 'center',
    padding: 10,
    borderRadius: 8,
    fontWeight: 'bold',
    fontSize: 18,
    borderWidth: 1,
    borderColor: '#4f46e5',
  },
  newLotSection: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#333',
    paddingTop: 15,
    paddingBottom: 10,
  },
  newLotTitle: {
    color: '#aaa',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  newLotRow: {
    flexDirection: 'row',
    gap: 8,
  },
  // lotInput est défini plus bas avec le reste des éléments de formulaire
  productStock: {
    color: '#888',
    fontSize: 16,
    marginBottom: 20,
  },
  stockValue: {
    color: '#fff',
    fontWeight: 'bold',
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  qtyBtn: {
    width: 64,
    height: 64,
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
    width: 120,
    height: 64,
    backgroundColor: '#0f0f1a',
    borderRadius: 16,
    marginHorizontal: 16,
    color: '#fff',
    fontSize: 32,
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
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#2d2d44',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4b4b6a',
  },
  cancelBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  validateBtn: {
    flex: 2,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    elevation: 4,
  },
  validateBtnText: {
    color: '#fff',
    fontSize: 16,
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
