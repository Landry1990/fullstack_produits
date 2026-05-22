/**
 * Écran de sélection Client et Ayant Droit
 * Aligné avec le système GestionDivers
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Search, User, Users, ChevronRight, X, CreditCard, Building2, Phone } from 'lucide-react-native';
import { useCartStore } from '../stores';
import type { Client, AyantDroit } from '../types';
import api from '../services/api';

interface ClientSelectScreenProps {
  onClose: () => void;
  onSelect: (client: Client | null, ayantDroit: AyantDroit | null) => void;
}

export function ClientSelectScreen({ onClose, onSelect }: ClientSelectScreenProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedAyantDroit, setSelectedAyantDroit] = useState<AyantDroit | null>(null);
  const [showAyantsDroit, setShowAyantsDroit] = useState(false);

  // Recherche de clients
  const searchClients = useCallback(async (query: string) => {
    if (query.length < 2) {
      setClients([]);
      return;
    }

    setLoading(true);
    try {
      const response = await api.get('/clients/', {
        params: {
          search: query,
          limit: 20,
          is_active: true,
        },
      });

      // Adapter la réponse API au type Client
      const clientsData = (response.data?.results || response.data || []).map((c: any) => ({
        id: c.id,
        name: c.name || `${c.nom || ''} ${c.prenom || ''}`.trim(),
        phone: c.phone || c.telephone || '',
        email: c.email || '',
        type_reglement: c.type_reglement || 'FACTURE',
        delai_paiement_jours: c.delai_paiement_jours || 0,
        has_credit: c.has_credit || false,
        solde_dette: c.solde_dette || c.current_debt || '0',
        address: c.address || c.adresse || '',
        ayants_droit: c.ayants_droit || [],
        created_at: c.created_at || c.date_creation || new Date().toISOString(),
        updated_at: c.updated_at || new Date().toISOString(),
      }));

      setClients(clientsData);
    } catch (error) {
      console.error('[ClientSelect] Erreur recherche:', error);
      Alert.alert('Erreur', 'Impossible de rechercher les clients');
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce la recherche
  useEffect(() => {
    const timeout = setTimeout(() => {
      searchClients(searchQuery);
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchQuery, searchClients]);

  // Sélection d'un client
  const handleSelectClient = (client: Client) => {
    setSelectedClient(client);
    setSelectedAyantDroit(null);
    
    if (client.ayants_droit && client.ayants_droit.length > 0) {
      setShowAyantsDroit(true);
    } else {
      // Pas d'ayants droit, on confirme directement
      onSelect(client, null);
    }
  };

  // Sélection d'un ayant droit
  const handleSelectAyantDroit = (ayantDroit: AyantDroit) => {
    setSelectedAyantDroit(ayantDroit);
  };

  // Confirmation finale
  const handleConfirm = () => {
    onSelect(selectedClient, selectedAyantDroit);
  };

  // Passer sans client
  const handleSkip = () => {
    onSelect(null, null);
  };

  // Render d'un client dans la liste
  const renderClient = ({ item }: { item: Client }) => (
    <TouchableOpacity
      style={[
        styles.clientCard,
        selectedClient?.id === item.id && styles.clientCardSelected,
      ]}
      onPress={() => handleSelectClient(item)}
    >
      <View style={styles.clientIcon}>
        {item.ayants_droit && item.ayants_droit.length > 0 ? (
          <Users size={24} color="#6366f1" />
        ) : (
          <User size={24} color="#6366f1" />
        )}
      </View>
      
      <View style={styles.clientInfo}>
        <Text style={styles.clientName}>{item.name}</Text>
        
        <View style={styles.clientDetails}>
          {item.phone && (
            <View style={styles.detailRow}>
              <Phone size={12} color="#6b7280" />
              <Text style={styles.detailText}>{item.phone}</Text>
            </View>
          )}
          
          <View style={styles.detailRow}>
            <CreditCard size={12} color="#6b7280" />
            <Text style={styles.detailText}>
              {item.type_reglement === 'FACTURE' ? 'Facture' : 'Relevé'}
              {(item.delai_paiement_jours || 0) > 0 && ` (${item.delai_paiement_jours}j)`}
            </Text>
          </View>
          
          {item.has_credit && parseFloat(item.solde_dette || '0') > 0 && (
            <View style={styles.detailRow}>
              <Building2 size={12} color="#ef4444" />
              <Text style={[styles.detailText, styles.debtText]}>
                Dette: {item.solde_dette} FCFA
              </Text>
            </View>
          )}
        </View>

        {item.ayants_droit && item.ayants_droit.length > 0 && (
          <View style={styles.ayantsBadge}>
            <Text style={styles.ayantsBadgeText}>
              {item.ayants_droit.length} ayant(s) droit
            </Text>
          </View>
        )}
      </View>

      <ChevronRight size={20} color="#9ca3af" />
    </TouchableOpacity>
  );

  // Render d'un ayant droit
  const renderAyantDroit = ({ item }: { item: AyantDroit }) => (
    <TouchableOpacity
      style={[
        styles.ayantCard,
        selectedAyantDroit?.id === item.id && styles.ayantCardSelected,
      ]}
      onPress={() => handleSelectAyantDroit(item)}
    >
      <View style={styles.ayantIcon}>
        <User size={20} color={selectedAyantDroit?.id === item.id ? '#ffffff' : '#6366f1'} />
      </View>
      
      <View style={styles.ayantInfo}>
        <Text style={[
          styles.ayantName,
          selectedAyantDroit?.id === item.id && styles.ayantNameSelected,
        ]}>
          {item.nom}
          {item.taux_couverture && (
            <Text style={styles.coverageText}> ({item.taux_couverture}%)</Text>
          )}
        </Text>
        
        {item.numero_carte && (
          <Text style={[
            styles.ayantCardNum,
            selectedAyantDroit?.id === item.id && styles.ayantCardNumSelected,
          ]}>
            Carte: {item.numero_carte}
          </Text>
        )}
        
        {item.societe && (
          <Text style={styles.societeText}>{item.societe}</Text>
        )}
      </View>

      {selectedAyantDroit?.id === item.id && (
        <View style={styles.checkIcon}>
          <Text style={styles.checkIconText}>✓</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>
          {showAyantsDroit ? 'Sélectionner un ayant droit' : 'Sélectionner un client'}
        </Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <X size={24} color="#6b7280" />
        </TouchableOpacity>
      </View>

      {/* Client sélectionné (mode ayants droit) */}
      {showAyantsDroit && selectedClient && (
        <View style={styles.selectedClientBanner}>
          <User size={20} color="#6366f1" />
          <Text style={styles.selectedClientText}>{selectedClient.name}</Text>
          <TouchableOpacity
            onPress={() => {
              setShowAyantsDroit(false);
              setSelectedAyantDroit(null);
            }}
            style={styles.changeButton}
          >
            <Text style={styles.changeButtonText}>Changer</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Search Input (mode recherche client) */}
      {!showAyantsDroit && (
        <View style={styles.searchContainer}>
          <Search size={20} color="#9ca3af" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher un client (nom, téléphone...)"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={18} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Liste des résultats */}
      {!showAyantsDroit ? (
        <>
          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#6366f1" />
              <Text style={styles.loadingText}>Recherche...</Text>
            </View>
          ) : clients.length > 0 ? (
            <FlatList
              data={clients}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderClient}
              contentContainerStyle={styles.listContent}
            />
          ) : searchQuery.length >= 2 ? (
            <View style={styles.centerContainer}>
              <Text style={styles.emptyText}>Aucun client trouvé</Text>
            </View>
          ) : (
            <View style={styles.centerContainer}>
              <Users size={48} color="#d1d5db" />
              <Text style={styles.hintText}>
                Tapez au moins 2 caractères{'\n'}pour rechercher un client
              </Text>
            </View>
          )}
        </>
      ) : (
        <>
          {/* Liste des ayants droit */}
          <FlatList
            data={selectedClient?.ayants_droit || []}
            keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
            renderItem={renderAyantDroit}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={
              <TouchableOpacity
                style={[
                  styles.ayantCard,
                  selectedAyantDroit === null && styles.ayantCardSelected,
                ]}
                onPress={() => setSelectedAyantDroit(null)}
              >
                <View style={styles.ayantIcon}>
                  <User size={20} color={selectedAyantDroit === null ? '#ffffff' : '#6b7280'} />
                </View>
                <View style={styles.ayantInfo}>
                  <Text style={[
                    styles.ayantName,
                    selectedAyantDroit === null && styles.ayantNameSelected,
                  ]}>
                    Titulaire (pas d'ayant droit)
                  </Text>
                  <Text style={styles.ayantCardNum}>Utiliser le client principal</Text>
                </View>
              </TouchableOpacity>
            }
          />
        </>
      )}

      {/* Footer */}
      <View style={styles.footer}>
        {!showAyantsDroit ? (
          <>
            <TouchableOpacity
              style={styles.skipButton}
              onPress={handleSkip}
            >
              <Text style={styles.skipButtonText}>Passer (sans client)</Text>
            </TouchableOpacity>
            
            {selectedClient && (
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={() => {
                  if (selectedClient.ayants_droit?.length) {
                    setShowAyantsDroit(true);
                  } else {
                    handleConfirm();
                  }
                }}
              >
                <Text style={styles.confirmButtonText}>
                  Continuer
                  {selectedClient.ayants_droit?.length && ' →'}
                </Text>
              </TouchableOpacity>
            )}
          </>
        ) : (
          <>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                setShowAyantsDroit(false);
                setSelectedAyantDroit(null);
              }}
            >
              <Text style={styles.backButtonText}>← Retour</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={handleConfirm}
            >
              <Text style={styles.confirmButtonText}>
                Confirmer
                {selectedAyantDroit && ` (${selectedAyantDroit.taux_couverture || 0}%)`}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  closeButton: {
    padding: 4,
  },
  selectedClientBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef2ff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    gap: 8,
  },
  selectedClientText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#4338ca',
  },
  changeButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  changeButtonText: {
    fontSize: 12,
    color: '#6366f1',
    fontWeight: '500',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 8,
  },
  searchIcon: {
    opacity: 0.5,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: '#111827',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
  },
  hintText: {
    marginTop: 16,
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 20,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  clientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  clientCardSelected: {
    borderColor: '#6366f1',
    backgroundColor: '#eef2ff',
  },
  clientIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#eef2ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  clientInfo: {
    flex: 1,
  },
  clientName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  clientDetails: {
    gap: 2,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: 12,
    color: '#6b7280',
  },
  debtText: {
    color: '#ef4444',
  },
  ayantsBadge: {
    marginTop: 6,
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  ayantsBadgeText: {
    fontSize: 11,
    color: '#2563eb',
    fontWeight: '500',
  },
  ayantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  ayantCardSelected: {
    borderColor: '#6366f1',
    backgroundColor: '#6366f1',
  },
  ayantIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  ayantInfo: {
    flex: 1,
  },
  ayantName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  ayantNameSelected: {
    color: '#ffffff',
  },
  coverageText: {
    color: '#22c55e',
  },
  ayantCardNum: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  ayantCardNumSelected: {
    color: '#c7d2fe',
  },
  societeText: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
  },
  checkIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkIconText: {
    fontSize: 14,
    color: '#6366f1',
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  skipButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
  },
  skipButtonText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  confirmButton: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#6366f1',
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '600',
  },
  backButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
  },
  backButtonText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
});
