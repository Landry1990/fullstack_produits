/**
 * Écran — Historique et statut des factures
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { invoiceRepo } from '../database';
import { useOfflineSync } from '../hooks';
import { useConnectionStore } from '../stores';
import { InvoiceCard, NetworkIndicator } from '../components';
import type { Invoice, InvoiceStatus } from '../types';

interface InvoiceListScreenProps {
  onBack: () => void;
  onInvoicePress: (invoice: Invoice) => void;
}

export function InvoiceListScreen({ onBack, onInvoicePress }: InvoiceListScreenProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<InvoiceStatus | 'all'>('all');

  const { isOnline } = useConnectionStore();
  const { isSyncing, syncNow, refreshCounts, statusCounts } = useOfflineSync();

  const loadInvoices = useCallback(async () => {
    setIsLoading(true);
    try {
      let data: Invoice[];
      if (filter === 'all') {
        data = await invoiceRepo.getRecent(100);
      } else if (filter === 'pending') {
        data = await invoiceRepo.getPending();
      } else if (filter === 'error') {
        data = await invoiceRepo.getErrors();
      } else {
        const all = await invoiceRepo.getRecent(100);
        data = all.filter((inv) => inv.status === 'synced');
      }
      setInvoices(data);
      await refreshCounts();
    } catch (error) {
      console.error('[InvoiceList] Erreur chargement factures:', error);
    } finally {
      setIsLoading(false);
    }
  }, [filter, refreshCounts]);

  // Recharger lors d'un changement de filtre ou après une synchro
  useEffect(() => {
    loadInvoices();
  }, [loadInvoices, isSyncing]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Factures</Text>
        <View style={{ width: 60 }} />
      </View>

      <NetworkIndicator isOnline={isOnline} pendingCount={statusCounts.pending} isSyncing={isSyncing} />

      {/* Onglets de filtre */}
      <View style={styles.tabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          <FilterTab
            label={`Toutes`}
            active={filter === 'all'}
            onPress={() => setFilter('all')}
          />
          <FilterTab
            label={`En attente (${statusCounts.pending})`}
            active={filter === 'pending'}
            onPress={() => setFilter('pending')}
            color="#f59e0b"
          />
          <FilterTab
            label={`Erreurs (${statusCounts.error})`}
            active={filter === 'error'}
            onPress={() => setFilter('error')}
            color="#ef4444"
          />
          <FilterTab
            label={`Synchronisées`}
            active={filter === 'synced'}
            onPress={() => setFilter('synced')}
            color="#22c55e"
          />
        </ScrollView>
      </View>

      {/* Bouton de sync manuel si attente/erreur */}
      {(statusCounts.pending > 0 || statusCounts.error > 0) && isOnline && filter !== 'synced' && (
        <View style={styles.syncActionContainer}>
          <TouchableOpacity
            style={[styles.syncButton, isSyncing && styles.syncButtonDisabled]}
            onPress={syncNow}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.syncButtonText}>
                🔄 Forcer la synchronisation
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Liste */}
      <FlatList
        data={invoices}
        keyExtractor={(item) => item.uuid}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isLoading && !isSyncing}
            onRefresh={loadInvoices}
            tintColor="#10b981"
          />
        }
        renderItem={({ item }) => (
          <InvoiceCard invoice={item} onPress={onInvoicePress} />
        )}
        ListEmptyComponent={
          !isLoading ? (
            <Text style={styles.emptyText}>Aucune facture trouvée.</Text>
          ) : null
        }
      />
    </View>
  );
}

// ─── Composant interne : Onglet de filtre ──────────────

interface FilterTabProps {
  label: string;
  active: boolean;
  onPress: () => void;
  color?: string;
}

function FilterTab({ label, active, onPress, color }: FilterTabProps) {
  return (
    <TouchableOpacity
      style={[
        styles.tab,
        active && styles.tabActive,
        active && color ? { borderColor: color, backgroundColor: `${color}15` } : null,
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.tabText,
          active && styles.tabTextActive,
          active && color ? { color } : null,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  backButton: {
    paddingVertical: 8,
    width: 80,
  },
  backButtonText: {
    color: '#34d399',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f1f5f9',
    flex: 1,
    textAlign: 'center',
  },
  tabsContainer: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  tabs: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#34d399',
  },
  tabText: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#34d399',
  },
  syncActionContainer: {
    padding: 16,
    paddingBottom: 0,
  },
  syncButton: {
    backgroundColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  syncButtonDisabled: {
    opacity: 0.6,
  },
  syncButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  listContent: {
    paddingVertical: 16,
    paddingBottom: 40,
  },
  emptyText: {
    color: '#64748b',
    textAlign: 'center',
    marginTop: 40,
    fontSize: 15,
  },
});
