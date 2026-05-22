/**
 * Composant — Carte de facture dans la liste
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { Invoice } from '../types';
import { formatPrice, formatDate } from '../utils';

interface InvoiceCardProps {
  invoice: Invoice;
  onPress?: (invoice: Invoice) => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'En attente', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
  synced: { label: 'Synchronisée', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)' },
  error: { label: 'Erreur', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
};

export function InvoiceCard({ invoice, onPress }: InvoiceCardProps) {
  const statusInfo = STATUS_CONFIG[invoice.status] || STATUS_CONFIG.pending;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress?.(invoice)}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.number}>
            {invoice.server_number ?? `#${invoice.uuid.slice(0, 8)}…`}
          </Text>
          <Text style={styles.date}>{formatDate(invoice.date_creation)}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: statusInfo.bg }]}>
          <Text style={[styles.badgeText, { color: statusInfo.color }]}>
            {statusInfo.label}
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.client}>
          {invoice.client || 'Client anonyme'}
        </Text>
        <Text style={styles.itemsCount}>
          {invoice.items.length} article(s)
        </Text>
        <Text style={styles.total}>{formatPrice(invoice.total)}</Text>
      </View>

      {!!invoice.error_message && (
        <Text style={styles.error} numberOfLines={1}>
          ⚠ {invoice.error_message}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  number: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f1f5f9',
    fontFamily: 'monospace',
  },
  date: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  client: {
    fontSize: 13,
    color: '#94a3b8',
    flex: 1,
  },
  itemsCount: {
    fontSize: 12,
    color: '#64748b',
    marginHorizontal: 8,
  },
  total: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10b981',
  },
  error: {
    fontSize: 11,
    color: '#ef4444',
    fontStyle: 'italic',
  },
});
