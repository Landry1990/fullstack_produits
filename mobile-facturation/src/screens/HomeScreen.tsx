/**
 * Écran d'accueil (Dashboard)
 * Point d'entrée pour la vente, la synchro catalogue, et les factures
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuthStore, useConnectionStore } from '../stores';
import { authService, productSyncService } from '../services';
import { useOfflineSync } from '../hooks';
import { productRepo } from '../database';

interface HomeScreenProps {
  onNavigateToSale: () => void;
  onNavigateToInvoices: () => void;
}

export function HomeScreen({ onNavigateToSale, onNavigateToInvoices }: HomeScreenProps) {
  const { user, setUnauthenticated } = useAuthStore();
  const { isOnline } = useConnectionStore();
  const { pendingCount, isSyncing, syncNow } = useOfflineSync();

  const [catalogCount, setCatalogCount] = useState(0);
  const [isSyncingCatalog, setIsSyncingCatalog] = useState(false);
  const [lastSyncDate, setLastSyncDate] = useState<string | null>(null);

  // ─── Initialisation ─────────────────────────────────────

  useEffect(() => {
    refreshCatalogInfo();
  }, []);

  const refreshCatalogInfo = async () => {
    const count = await productRepo.count();
    const lastSync = await productSyncService.getLastSyncDate();
    setCatalogCount(count);
    setLastSyncDate(lastSync);
  };

  // ─── Actions ──────────────────────────────────────────

  const handleLogout = () => {
    Alert.alert(
      'Déconnexion',
      'Êtes-vous sûr de vouloir vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnexion',
          style: 'destructive',
          onPress: async () => {
            await authService.logout();
            setUnauthenticated();
          },
        },
      ]
    );
  };

  const handleSyncCatalog = async () => {
    if (!isOnline) {
      Alert.alert('Hors ligne', 'Le réseau local n\'est pas disponible.');
      return;
    }

    setIsSyncingCatalog(true);
    const result = await productSyncService.syncFullCatalog();
    setIsSyncingCatalog(false);

    if (result.success) {
      await refreshCatalogInfo();
      Alert.alert('✅ Catalogue à jour', `${result.count} produit(s) synchronisé(s).`);
    } else {
      Alert.alert('❌ Erreur de synchronisation', result.error?.message);
    }
  };

  const handleSyncInvoices = () => {
    if (!isOnline) {
      Alert.alert('Hors ligne', 'Le réseau local n\'est pas disponible.');
      return;
    }
    syncNow();
  };

  // ─── Rendu ────────────────────────────────────────────

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* En-tête */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Bonjour,</Text>
          <Text style={styles.username}>{user?.username || 'Vendeur'}</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Déconnexion</Text>
        </TouchableOpacity>
      </View>

      {/* Cartes d'actions principales */}
      <View style={styles.grid}>
        <TouchableOpacity style={styles.primaryCard} onPress={onNavigateToSale}>
          <Text style={styles.cardEmoji}>🛒</Text>
          <Text style={styles.primaryCardTitle}>Nouvelle Vente</Text>
          <Text style={styles.cardSubtitle}>Scanner et facturer</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryCard} onPress={onNavigateToInvoices}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardEmoji}>📄</Text>
            {pendingCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pendingCount}</Text>
              </View>
            )}
          </View>
          <Text style={styles.secondaryCardTitle}>Factures</Text>
          <Text style={styles.cardSubtitle}>Historique & attente</Text>
        </TouchableOpacity>
      </View>

      {/* Section Administration / Synchronisation */}
      <Text style={styles.sectionTitle}>Système & Synchronisation</Text>

      <View style={styles.syncContainer}>
        {/* Sync Factures */}
        <View style={styles.syncRow}>
          <View style={styles.syncInfo}>
            <Text style={styles.syncTitle}>Factures en attente</Text>
            <Text style={styles.syncDesc}>
              {pendingCount === 0
                ? 'Toutes les factures sont synchronisées'
                : `${pendingCount} facture(s) en attente d'envoi`}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.syncBtn, (isSyncing || pendingCount === 0 || !isOnline) && styles.syncBtnDisabled]}
            onPress={handleSyncInvoices}
            disabled={isSyncing || pendingCount === 0 || !isOnline}
          >
            {isSyncing ? (
              <ActivityIndicator color="#34d399" size="small" />
            ) : (
              <Text style={styles.syncBtnText}>Envoyer</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Séparateur */}
        <View style={styles.divider} />

        {/* Sync Catalogue */}
        <View style={styles.syncRow}>
          <View style={styles.syncInfo}>
            <Text style={styles.syncTitle}>Catalogue Produits</Text>
            <Text style={styles.syncDesc}>
              {catalogCount} produits en local
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.syncBtn, (isSyncingCatalog || !isOnline) && styles.syncBtnDisabled]}
            onPress={handleSyncCatalog}
            disabled={isSyncingCatalog || !isOnline}
          >
            {isSyncingCatalog ? (
              <ActivityIndicator color="#34d399" size="small" />
            ) : (
              <Text style={styles.syncBtnText}>Mettre à jour</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* État du réseau (Debug) */}
      <View style={styles.statusFooter}>
        <View style={[styles.statusDot, { backgroundColor: isOnline ? '#22c55e' : '#ef4444' }]} />
        <Text style={styles.statusText}>
          {isOnline ? 'Réseau LAN Connecté' : 'Hors ligne - Mode autonome'}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  content: {
    padding: 20,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  greeting: {
    fontSize: 16,
    color: '#94a3b8',
  },
  username: {
    fontSize: 24,
    fontWeight: '800',
    color: '#f1f5f9',
  },
  logoutBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 40,
  },
  primaryCard: {
    flex: 3,
    backgroundColor: '#10b981',
    borderRadius: 20,
    padding: 20,
    justifyContent: 'center',
    minHeight: 140,
  },
  primaryCardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginTop: 8,
    marginBottom: 4,
  },
  secondaryCard: {
    flex: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: 20,
    justifyContent: 'center',
    minHeight: 140,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  secondaryCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f1f5f9',
    marginTop: 8,
    marginBottom: 4,
  },
  cardEmoji: {
    fontSize: 32,
  },
  cardSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  badge: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: 16,
  },
  syncContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  syncInfo: {
    flex: 1,
    paddingRight: 16,
  },
  syncTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f1f5f9',
    marginBottom: 4,
  },
  syncDesc: {
    fontSize: 13,
    color: '#64748b',
  },
  syncBtn: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  syncBtnDisabled: {
    opacity: 0.5,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  syncBtnText: {
    color: '#34d399',
    fontWeight: '600',
    fontSize: 14,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginHorizontal: 16,
  },
  statusFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
});
