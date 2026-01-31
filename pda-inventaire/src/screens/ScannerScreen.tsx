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
  
  // Input pour le scanner laser (mode keyboard wedge)
  const [scanInput, setScanInput] = useState('');
  const scanInputRef = useRef<TextInput>(null);
  const quantityInputRef = useRef<TextInput>(null);
  
  // Mode édition d'une ligne existante
  const [editingLine, setEditingLine] = useState<LigneInventaire | null>(null);
  const [editQuantity, setEditQuantity] = useState('');

  // Charger les lignes existantes
  useEffect(() => {
    loadLignes();
  }, []);

  // Focus automatique sur le champ de scan
  useEffect(() => {
    if (!scannedProduct && !editingLine) {
      // Refocus après un court délai pour éviter les conflits
      const timer = setTimeout(() => {
        scanInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [scannedProduct, lignes, editingLine]);

  // Auto-submit du scan (pour les scanners qui n'envoient pas "Enter")
  useEffect(() => {
    if (!scanInput || scanInput.length < 3) return;

    const timeoutId = setTimeout(() => {
      handleScanSubmit();
    }, 300); // 300ms de pause = fin du scan

    return () => clearTimeout(timeoutId);
  }, [scanInput]);

  const loadLignes = async () => {
    try {
      const data = await inventaireService.getLignes(inventaire.id);
      setLignes(data);
    } catch (error) {
      console.error('Erreur chargement lignes:', error);
    }
  };

  // Handler quand le scanner laser envoie un code (suivi de Enter)
  const handleScanSubmit = async () => {
    const code = scanInput.trim();
    if (!code || searching) return;

    setSearching(true);
    Vibration.vibrate(50);
    Keyboard.dismiss();

    try {
      const product = await produitService.getByCip(code);
      if (product) {
        setScannedProduct(product);
        setQuantity('1');
        setScanInput('');
        Vibration.vibrate(100);
        // Focus sur le champ quantité après le scan
        setTimeout(() => quantityInputRef.current?.focus(), 100);
      } else {
        Alert.alert('Produit non trouvé', `Code: ${code}`);
        setScanInput('');
        // Refocus pour prochain scan
        setTimeout(() => scanInputRef.current?.focus(), 300);
      }
    } catch (error) {
      console.error('Erreur recherche produit:', error);
      Alert.alert('Erreur', 'Impossible de rechercher le produit');
      setScanInput('');
      setTimeout(() => scanInputRef.current?.focus(), 300);
    } finally {
      setSearching(false);
    }
  };

  // Valider la ligne
  const handleValidate = async () => {
    if (!scannedProduct) return;

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 0) {
      Alert.alert('Erreur', 'Quantité invalide');
      return;
    }

    setLoading(true);
    try {
      await inventaireService.addLigne(inventaire.id, {
        produit: scannedProduct.id,
        quantite_comptee: qty,
      });

      // Rafraîchir les lignes
      await loadLignes();

      // Reset pour prochain scan
      setScannedProduct(null);
      setQuantity('1');
      setScanInput('');

      Vibration.vibrate([0, 50, 50, 50]); // Feedback succès
      
      // Refocus pour prochain scan
      setTimeout(() => scanInputRef.current?.focus(), 200);
    } catch (error: any) {
      console.error('Erreur ajout ligne:', error);
      Alert.alert('Erreur', error.response?.data?.detail || 'Impossible d\'ajouter la ligne');
    } finally {
      setLoading(false);
    }
  };

  // Annuler le scan en cours
  const handleCancel = () => {
    setScannedProduct(null);
    setEditingLine(null);
    setQuantity('1');
    setEditQuantity('');
    setScanInput('');
    setTimeout(() => scanInputRef.current?.focus(), 100);
  };

  // Éditer une ligne existante
  const handleEditLine = (ligne: LigneInventaire) => {
    setEditingLine(ligne);
    setEditQuantity(String(ligne.quantite_comptee));
    Vibration.vibrate(50);
  };

  // Sauvegarder la modification
  const handleUpdateLine = async () => {
    if (!editingLine) return;

    const qty = parseInt(editQuantity, 10);
    if (isNaN(qty) || qty < 0) {
      Alert.alert('Erreur', 'Quantité invalide');
      return;
    }

    setLoading(true);
    try {
      await inventaireService.updateLigne(inventaire.id, editingLine.id, qty);
      await loadLignes();
      setEditingLine(null);
      setEditQuantity('');
      Vibration.vibrate([0, 50, 50, 50]);
      setTimeout(() => scanInputRef.current?.focus(), 200);
    } catch (error: any) {
      console.error('Erreur modification ligne:', error);
      Alert.alert('Erreur', 'Impossible de modifier la ligne');
    } finally {
      setLoading(false);
    }
  };

  // Export CSV
  const handleExport = async () => {
    try {
      setLoading(true);
      await exportService.exportInventaireToCsv(inventaire);
    } catch (error: any) {
      Alert.alert("Erreur Export", error.message || "Impossible d'exporter le fichier");
    } finally {
      setLoading(false);
      // Refocus après export
      setTimeout(() => scanInputRef.current?.focus(), 500);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Retour</Text>
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>{inventaire.reference}</Text>
        
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={handleExport} style={styles.exportBtn}>
            <Text style={styles.exportBtnText}>📤</Text>
          </TouchableOpacity>
          <View style={styles.counter}>
            <Text style={styles.counterText}>{lignes.length}</Text>
          </View>
        </View>
      </View>

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
            />

            <TouchableOpacity 
              style={styles.qtyBtn}
              onPress={() => setQuantity(String(parseInt(quantity) + 1))}
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
              onPress={handleValidate}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.validateBtnText}>✓ Valider</Text>
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
          />

          {searching && (
            <View style={styles.searchingIndicator}>
              <ActivityIndicator color="#4f46e5" size="large" />
              <Text style={styles.searchingText}>Recherche...</Text>
            </View>
          )}

          {/* Bouton de recherche manuel */}
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
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.validateBtnText}>💾 Enregistrer</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Liste des dernières lignes */}
      <View style={styles.recentContainer}>
        <Text style={styles.recentTitle}>Derniers scans (tap pour modifier)</Text>
        <FlatList
          data={lignes.slice(-10).reverse()}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={[styles.recentItem, editingLine?.id === item.id && styles.recentItemActive]}
              onPress={() => handleEditLine(item)}
            >
              <Text style={styles.recentName} numberOfLines={1}>
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
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
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
    color: '#888',
    fontSize: 14,
    marginBottom: 4,
  },
  productStock: {
    color: '#888',
    fontSize: 14,
    marginBottom: 16,
  },
  stockValue: {
    color: '#4f46e5',
    fontWeight: 'bold',
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  qtyBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2d2d44',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyBtnText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '300',
  },
  qtyInput: {
    width: 100,
    height: 56,
    backgroundColor: '#0f0f1a',
    borderRadius: 12,
    marginHorizontal: 16,
    color: '#fff',
    fontSize: 24,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#2d2d44',
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  validateBtn: {
    flex: 2,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#22c55e',
    alignItems: 'center',
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
    maxHeight: 200,
  },
  recentTitle: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  recentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
    borderRadius: 8,
  },
  recentItemActive: {
    backgroundColor: '#4f46e5',
  },
  recentName: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
    marginRight: 12,
  },
  recentQty: {
    color: '#4f46e5',
    fontSize: 16,
    fontWeight: 'bold',
    minWidth: 40,
    textAlign: 'right',
  },
  emptyText: {
    color: '#666',
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 16,
  },
  editCard: {
    backgroundColor: '#1a1a2e',
    margin: 16,
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#f59e0b',
  },
  editTitle: {
    color: '#f59e0b',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  editProductName: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
});
