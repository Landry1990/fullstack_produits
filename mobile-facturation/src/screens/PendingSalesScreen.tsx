/**
 * Écran de suivi des ventes envoyées à la caisse
 * Affiche le statut en temps réel via WebSocket
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { Clock, CheckCircle, XCircle, ShoppingCart, RefreshCw, Store, ArrowLeft } from 'lucide-react-native';
import { useWebSocketPDA } from '../hooks';
import { useCashierQueueStore } from '../stores';
import type { CashierQueueItem, TicketCaisse } from '../types';
import * as Device from 'expo-device';

interface PendingSalesScreenProps {
  onClose: () => void;
}

export function PendingSalesScreen({ onClose }: PendingSalesScreenProps) {
  const queueStore = useCashierQueueStore();
  const [refreshing, setRefreshing] = useState(false);
  const [completedTickets, setCompletedTickets] = useState<Map<string, TicketCaisse>>(new Map());

  // WebSocket pour mises à jour temps réel
  const { status, pendingCount } = useWebSocketPDA({
    pdaId: `PDA-${(Device as any).deviceId || Device.modelName || 'UNKNOWN'}`,
    onStatusUpdate: (data) => {
      if (data.status === 'completed' && data.ticket) {
        const ticket = data.ticket;
        setCompletedTickets(prev => new Map([...prev, [data.item_id, ticket]]));
      }
      // Rafraîchir la liste depuis le store
      queueStore.loadPendingItems();
    },
  });

  // Chargement initial
  useEffect(() => {
    queueStore.loadPendingItems();
  }, []);

  // Pull to refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await queueStore.loadPendingItems();
    setRefreshing(false);
  };

  // Regrouper les items par statut
  const waitingItems = queueStore.items.filter(i => i.status === 'waiting');
  const processingItems = queueStore.items.filter(i => i.status === 'processing');
  const completedItems = queueStore.items.filter(i => i.status === 'completed');
  const cancelledItems = queueStore.items.filter(i => i.status === 'cancelled');

  const allItems = [...waitingItems, ...processingItems, ...completedItems, ...cancelledItems];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'waiting':
        return <Clock size={20} color="#f59e0b" />;
      case 'processing':
        return <Store size={20} color="#6366f1" />;
      case 'completed':
        return <CheckCircle size={20} color="#22c55e" />;
      case 'cancelled':
        return <XCircle size={20} color="#ef4444" />;
      default:
        return <Clock size={20} color="#9ca3af" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'waiting':
        return 'En attente';
      case 'processing':
        return 'En cours';
      case 'completed':
        return 'Validé';
      case 'cancelled':
        return 'Annulé';
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'waiting':
        return '#f59e0b';
      case 'processing':
        return '#6366f1';
      case 'completed':
        return '#22c55e';
      case 'cancelled':
        return '#ef4444';
      default:
        return '#9ca3af';
    }
  };

  const renderItem = ({ item }: { item: CashierQueueItem }) => {
    const completedTicket = completedTickets.get(item.id);
    const isCompleted = item.status === 'completed';

    return (
      <View style={[styles.itemCard, isCompleted && styles.completedCard]}>
        {/* Header */}
        <View style={styles.itemHeader}>
          <View style={styles.statusRow}>
            {getStatusIcon(item.status)}
            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
              {getStatusText(item.status)}
            </Text>
          </View>
          <Text style={styles.dateText}>
            {new Date(item.created_at).toLocaleTimeString('fr-FR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>

        {/* Articles summary */}
        <View style={styles.articlesSummary}>
          <ShoppingCart size={16} color="#6b7280" />
          <Text style={styles.articlesText}>
            {item.articles_count} article{item.articles_count > 1 ? 's' : ''}
          </Text>
        </View>

        {/* Client info */}
        {item.client && (
          <View style={styles.clientRow}>
            <Text style={styles.clientName}>{item.client.name}</Text>
            {item.ayant_droit && (
              <Text style={styles.ayantText}>
                → {item.ayant_droit.nom} ({item.ayant_droit.taux_couverture}%)
              </Text>
            )}
          </View>
        )}

        {/* Total */}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total estimé</Text>
          <Text style={styles.totalValue}>{item.total_estime} FCFA</Text>
        </View>

        {/* Ticket info (si complété) */}
        {isCompleted && completedTicket && (
          <View style={styles.ticketInfo}>
            <CheckCircle size={14} color="#22c55e" />
            <Text style={styles.ticketText}>
              Ticket: {completedTicket.numero_ticket || 'N/A'}
            </Text>
          </View>
        )}

        {/* Actions */}
        {item.status === 'waiting' && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => queueStore.markAsCancelled(item.id)}
          >
            <XCircle size={16} color="#ef4444" />
            <Text style={styles.cancelButtonText}>Annuler</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Ventes en attente</Text>
        <View style={styles.connectionBadge}>
          <View style={[
            styles.statusDot,
            { backgroundColor: status === 'connected' ? '#22c55e' : '#ef4444' }
          ]} />
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{waitingItems.length}</Text>
          <Text style={styles.statLabel}>En attente</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{processingItems.length}</Text>
          <Text style={styles.statLabel}>En cours</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{completedItems.length}</Text>
          <Text style={styles.statLabel}>Validées</Text>
        </View>
      </View>

      {/* Liste */}
      {allItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <ShoppingCart size={64} color="#d1d5db" />
          <Text style={styles.emptyTitle}>Aucune vente en attente</Text>
          <Text style={styles.emptySubtitle}>
            Les ventes envoyées à la caisse apparaîtront ici
          </Text>
        </View>
      ) : (
        <FlatList
          data={allItems}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  connectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statsRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  itemCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  completedCard: {
    borderColor: '#22c55e',
    backgroundColor: '#f0fdf4',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  dateText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  articlesSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  articlesText: {
    fontSize: 13,
    color: '#6b7280',
  },
  clientRow: {
    marginBottom: 8,
  },
  clientName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  ayantText: {
    fontSize: 12,
    color: '#6366f1',
    marginTop: 2,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  totalLabel: {
    fontSize: 13,
    color: '#6b7280',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  ticketInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#dcfce7',
  },
  ticketText: {
    fontSize: 13,
    color: '#22c55e',
    fontWeight: '500',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    alignSelf: 'flex-start',
  },
  cancelButtonText: {
    fontSize: 13,
    color: '#ef4444',
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
    textAlign: 'center',
  },
});
