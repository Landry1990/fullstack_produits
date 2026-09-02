import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TextInput,
  Modal,
} from 'react-native';
import { inventaireService } from '../services/inventaire';
import { produitService } from '../services/inventaire';
import { productCacheService } from '../services/productCache';
import type { Inventaire } from '../services/inventaire';
import { authService } from '../services/auth';
import type { User } from '../services/auth';

interface HomeScreenProps {
  onSelectInventaire: (inventaire: Inventaire) => void;
  onLogout: () => void;
}

const generateDefaultReference = () => {
  const now = new Date();
  return `INV-${now.toLocaleDateString('fr-FR').replace(/\//g, '')}-${now.getHours()}${now.getMinutes()}`;
};

export default function HomeScreen({ onSelectInventaire, onLogout }: HomeScreenProps) {
  const [inventaires, setInventaires] = useState<Inventaire[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogCount, setCatalogCount] = useState<number | null>(null);
  const [user, setUser] = useState<User | null>(null);
  
  // Filtre: Mes inventaires vs Tous
  const [filter, setFilter] = useState<'MINE' | 'ALL'>('MINE');
  
  // Modal création inventaire
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newReference, setNewReference] = useState('');
  const [creating, setCreating] = useState(false);

  const loadData = async () => {
    try {
      const [invData, userData] = await Promise.all([
        inventaireService.getInventaires(),
        authService.getUser(),
      ]);
      setInventaires(invData.filter(i => i.statut === 'EN_COURS'));
      setUser(userData);
    } catch (error) {
      console.error('Erreur chargement:', error);
      Alert.alert('Erreur', 'Impossible de charger les inventaires');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    loadCatalogCount();
  }, []);

  const loadCatalogCount = async () => {
    const count = await productCacheService.getCount();
    setCatalogCount(count);
  };

  const handleDownloadCatalog = async () => {
    setCatalogLoading(true);
    try {
      const produits = await produitService.downloadCatalog();
      setCatalogCount(produits.length);
      Alert.alert('Catalogue téléchargé', `${produits.length} produit(s) mis en cache. Le scan est maintenant utilisable hors ligne.`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Impossible de télécharger le catalogue';
      Alert.alert('Erreur', message);
    } finally {
      setCatalogLoading(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleLogout = () => {
    Alert.alert(
      'Déconnexion',
      'Voulez-vous vraiment vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { 
          text: 'Déconnexion', 
          style: 'destructive',
          onPress: async () => {
            await authService.logout();
            onLogout();
          }
        },
      ]
    );
  };

  // Créer un nouvel inventaire
  const handleCreateInventaire = async () => {
    const reference = newReference.trim();
    if (!reference) {
      Alert.alert('Erreur', 'Veuillez entrer une référence');
      return;
    }

    setCreating(true);
    try {
      const newInv = await inventaireService.createInventaire(reference);
      setShowCreateModal(false);
      setNewReference('');
      // Aller directement au scanner
      onSelectInventaire(newInv);
    } catch (error: unknown) {
      console.error('Erreur création:', error);
      const axiosError = error as { response?: { data?: { detail?: string } } };
      Alert.alert('Erreur', axiosError.response?.data?.detail || 'Impossible de créer l\'inventaire');
    } finally {
      setCreating(false);
    }
  };

  // Générer une référence par défaut
  const openCreateModal = () => {
    setNewReference(generateDefaultReference());
    setShowCreateModal(true);
  };

  const renderItem = ({ item }: { item: Inventaire }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onSelectInventaire(item)}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{item.reference}</Text>
        <Text style={styles.badgeText}>{item.lignes_count} lignes</Text>
      </View>
      <Text style={styles.cardDate}>
        {new Date(item.date_debut).toLocaleDateString('fr-FR')}
      </Text>
    </TouchableOpacity>
  );

  const filteredInventaires = inventaires.filter(i => {
    if (filter === 'MINE' && user) {
        return i.created_by === user.id;
    }
    return true;
  });

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4f46e5" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Bonjour,</Text>
          <Text style={styles.username}>{user?.username || 'Utilisateur'}</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>⏻</Text>
        </TouchableOpacity>
      </View>

      {/* Catalogue offline */}
      <View style={styles.catalogBar}>
        <View style={styles.catalogInfo}>
          <Text style={styles.catalogLabel}>Catalogue offline</Text>
          <Text style={styles.catalogCount}>
            {catalogLoading ? 'Téléchargement...' : catalogCount !== null ? `${catalogCount} produit(s)` : 'Non chargé'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.catalogBtn, catalogLoading && styles.btnDisabled]}
          onPress={handleDownloadCatalog}
          disabled={catalogLoading}
        >
          {catalogLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.catalogBtnText}>Télécharger</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, filter === 'MINE' && styles.tabActive]} 
          onPress={() => setFilter('MINE')}
        >
          <Text style={[styles.tabText, filter === 'MINE' && styles.tabTextActive]}>Mes Inventaires</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, filter === 'ALL' && styles.tabActive]} 
          onPress={() => setFilter('ALL')}
        >
          <Text style={[styles.tabText, filter === 'ALL' && styles.tabTextActive]}>Tous</Text>
        </TouchableOpacity>
      </View>

      {filteredInventaires.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            {filter === 'MINE' ? 'Aucun inventaire trouvé' : 'Aucun inventaire en cours'}
          </Text>
          <TouchableOpacity style={styles.createBtn} onPress={openCreateModal}>
            <Text style={styles.createBtnText}>Créer un inventaire</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredInventaires}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        />
      )}

      {/* FAB pour créer un inventaire */}
      {inventaires.length > 0 && (
        <TouchableOpacity style={styles.fab} onPress={openCreateModal}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}
      {/* Modal création */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nouvel Inventaire</Text>
            
            <TextInput
              style={styles.modalInput}
              value={newReference}
              onChangeText={setNewReference}
              placeholder="Référence de l'inventaire"
              placeholderTextColor="#666"
              autoFocus
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowCreateModal(false)}
              >
                <Text style={styles.modalCancelText}>Annuler</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalCreateBtn, creating && styles.btnDisabled]}
                onPress={handleCreateInventaire}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalCreateText}>Créer</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1a',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f0f1a',
  },
  loadingText: {
    color: '#666',
    marginTop: 16,
    fontSize: 15,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 20,
    backgroundColor: '#1a1a2e',
  },
  greeting: {
    color: '#666',
    fontSize: 14,
  },
  username: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  logoutBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1e1e35',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutText: {
    fontSize: 22,
    color: '#ef4444',
  },
  list: {
    padding: 16,
    gap: 10,
  },
  card: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  badgeText: {
    color: '#818cf8',
    fontSize: 13,
    fontWeight: '500',
  },
  cardDate: {
    color: '#666',
    fontSize: 13,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 48,
  },
  emptyText: {
    color: '#888',
    fontSize: 16,
    marginBottom: 20,
  },
  createBtn: {
    backgroundColor: '#4f46e5',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 10,
  },
  createBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4f46e5',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  fabText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '300',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: '#0f0f1a',
    borderRadius: 10,
    padding: 14,
    color: '#fff',
    fontSize: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#2d2d44',
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#888',
    fontSize: 15,
    fontWeight: '600',
  },
  modalCreateBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
  },
  modalCreateText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 10,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#4f46e5',
  },
  tabText: {
    color: '#666',
    fontSize: 15,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#fff',
  },
  catalogBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a2e',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  catalogInfo: {
    flex: 1,
  },
  catalogLabel: {
    color: '#888',
    fontSize: 13,
    marginBottom: 2,
  },
  catalogCount: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  catalogBtn: {
    backgroundColor: '#4f46e5',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    minWidth: 120,
    alignItems: 'center',
  },
  catalogBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
