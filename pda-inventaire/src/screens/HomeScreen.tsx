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
import { inventaireService, Inventaire, authService, User } from '../services';

interface HomeScreenProps {
  onSelectInventaire: (inventaire: Inventaire) => void;
  onLogout: () => void;
}

export default function HomeScreen({ onSelectInventaire, onLogout }: HomeScreenProps) {
  const [inventaires, setInventaires] = useState<Inventaire[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
  }, []);

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
    } catch (error: any) {
      console.error('Erreur création:', error);
      Alert.alert('Erreur', error.response?.data?.detail || 'Impossible de créer l\'inventaire');
    } finally {
      setCreating(false);
    }
  };

  // Générer une référence par défaut
  const generateDefaultReference = () => {
    const now = new Date();
    return `INV-${now.toLocaleDateString('fr-FR').replace(/\//g, '')}-${now.getHours()}${now.getMinutes()}`;
  };

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
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{item.lignes_count} lignes</Text>
        </View>
      </View>
      <Text style={styles.cardDate}>
        Démarré le {new Date(item.date_debut).toLocaleDateString('fr-FR')}
      </Text>
      {item.created_by !== user?.id && (
         <Text style={styles.cardAuthor}>Par: {item.created_by}</Text>
      )}
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
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyText}>
            {filter === 'MINE' ? 'Aucun inventaire trouvé' : 'Aucun inventaire en cours'}
          </Text>
          <TouchableOpacity style={styles.createBtn} onPress={openCreateModal}>
            <Text style={styles.createBtnText}>➕ Créer un inventaire</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={inventaires}
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
    color: '#888',
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingTop: 48,
    backgroundColor: '#1a1a2e',
  },
  greeting: {
    color: '#888',
    fontSize: 16,
  },
  username: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  logoutBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2d2d44',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutText: {
    fontSize: 24,
    color: '#ef4444',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    padding: 24,
    paddingBottom: 12,
  },
  list: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2d2d44',
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  badge: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  cardDate: {
    color: '#888',
    fontSize: 14,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 48,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
  },
  createBtn: {
    backgroundColor: '#4f46e5',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginTop: 24,
  },
  createBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#4f46e5',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fabText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '300',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    marginBottom: 24,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  modalCancelBtn: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#2d2d44',
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#888',
    fontSize: 16,
    fontWeight: '600',
  },
  modalCreateBtn: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
  },
  modalCreateText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  // Tabs styles
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 24, // Espace augmenté
    gap: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 16, // Augmenté pour cible tactile > 48dp
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#4f46e5',
  },
  tabText: {
    color: '#ccc', // Contraste amélioré
    fontSize: 18, // Police augmentée
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#fff',
  },
  cardAuthor: {
    color: '#818cf8', // Contraste amélioré
    fontSize: 14, // Police augmentée
    marginTop: 8,
    fontStyle: 'italic',
  },
});
