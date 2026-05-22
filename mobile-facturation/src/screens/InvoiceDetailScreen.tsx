/**
 * Écran — Détail d'une facture
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import type { Invoice } from '../types';
import { formatPrice, formatDate } from '../utils';

interface InvoiceDetailScreenProps {
  invoice: Invoice;
  onBack: () => void;
}

export function InvoiceDetailScreen({ invoice, onBack }: InvoiceDetailScreenProps) {
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Détail Facture</Text>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* En-tête facture */}
        <View style={styles.infoCard}>
          <Text style={styles.number}>
            {invoice.server_number ?? 'En attente de numéro…'}
          </Text>
          <Text style={styles.uuid}>Réf locale : {invoice.uuid}</Text>
          
          <View style={styles.divider} />
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Date</Text>
            <Text style={styles.infoValue}>{formatDate(invoice.date_creation)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Client</Text>
            <Text style={styles.infoValue}>{invoice.client || 'Anonyme'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Statut</Text>
            <Text style={[
              styles.infoValue,
              { color: invoice.status === 'synced' ? '#22c55e' : invoice.status === 'error' ? '#ef4444' : '#f59e0b' }
            ]}>
              {invoice.status.toUpperCase()}
            </Text>
          </View>

          {!!invoice.error_message && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠ {invoice.error_message}</Text>
            </View>
          )}
        </View>

        {/* Lignes */}
        <Text style={styles.sectionTitle}>Articles ({invoice.items.length})</Text>
        <View style={styles.itemsCard}>
          {invoice.items.map((item, index) => (
            <View key={index} style={[styles.itemRow, index > 0 && styles.itemBorder]}>
              <View style={styles.itemMain}>
                <Text style={styles.itemName}>{item.designation}</Text>
                <Text style={styles.itemQty}>
                  {item.quantity} × {formatPrice(item.unit_price)}
                </Text>
              </View>
              <Text style={styles.itemSubtotal}>{formatPrice(item.subtotal)}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Footer Total */}
      <View style={styles.footer}>
        <Text style={styles.totalLabel}>TOTAL NET</Text>
        <Text style={styles.totalValue}>{formatPrice(invoice.total)}</Text>
      </View>
    </View>
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
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 24,
  },
  infoCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  number: {
    fontSize: 22,
    fontWeight: '800',
    color: '#f1f5f9',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  uuid: {
    fontSize: 12,
    color: '#64748b',
    fontFamily: 'monospace',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoLabel: {
    color: '#94a3b8',
    fontSize: 14,
  },
  infoValue: {
    color: '#f1f5f9',
    fontSize: 14,
    fontWeight: '600',
  },
  errorBox: {
    marginTop: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    padding: 12,
    borderRadius: 8,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: -8,
  },
  itemsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  itemBorder: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  itemMain: {
    flex: 1,
    paddingRight: 16,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#e2e8f0',
    marginBottom: 4,
  },
  itemQty: {
    fontSize: 13,
    color: '#94a3b8',
  },
  itemSubtotal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f1f5f9',
  },
  footer: {
    backgroundColor: 'rgba(15, 15, 26, 0.98)',
    padding: 24,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '700',
    letterSpacing: 1,
  },
  totalValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#10b981',
  },
});
