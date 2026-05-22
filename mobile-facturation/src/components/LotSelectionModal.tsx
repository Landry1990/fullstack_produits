/**
 * Modal — Sélection de lot (FEFO) pour mobile
 * Version simplifiée pour PDA
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { X, Package, Calendar, AlertCircle } from 'lucide-react-native';
import type { Product, StockLot } from '../types';
import { lotService } from '../services/lotService';
import { formatPrice } from '../utils';

interface LotSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  product: Product | null;
  currentLotId?: number | null;
  onSelectLot: (lot: StockLot | null) => void;
}

export function LotSelectionModal({
  visible,
  onClose,
  product,
  currentLotId,
  onSelectLot,
}: LotSelectionModalProps) {
  const [lots, setLots] = useState<StockLot[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && product) {
      loadLots();
    }
  }, [visible, product]);

  const loadLots = async () => {
    if (!product) return;
    setLoading(true);
    const data = await lotService.getLots(product.id);
    setLots(data);
    setLoading(false);
  };

  const handleAutoSelect = () => {
    onSelectLot(null); // null = mode FEFO automatique
    onClose();
  };

  const handleLotSelect = (lot: StockLot) => {
    onSelectLot(lot);
    onClose();
  };

  const renderLotItem = ({ item }: { item: StockLot }) => {
    const isSelected = item.id === currentLotId;
    const daysLeft = lotService.getDaysUntilExpiry(item.date_expiration);
    const expiryStyle = lotService.getExpiryColor(daysLeft);

    return (
      <TouchableOpacity
        style={[styles.lotItem, isSelected && styles.lotItemSelected]}
        onPress={() => handleLotSelect(item)}
      >
        <View style={styles.lotHeader}>
          <Package size={16} color={isSelected ? '#10b981' : '#64748b'} />
          <Text style={[styles.lotNumber, isSelected && styles.lotNumberSelected]}>
            {item.lot || 'Sans lot'}
          </Text>
          {isSelected && <Text style={styles.selectedBadge}>✓</Text>}
        </View>

        <View style={styles.lotDetails}>
          <View style={styles.detailRow}>
            <Calendar size={12} color={expiryStyle.color} />
            <Text style={[styles.expiryText, { color: expiryStyle.color }]}>
              Exp: {lotService.formatExpiry(item.date_expiration)}
              {daysLeft !== null && ` (${daysLeft}j)`}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.stockText}>
              Stock: {item.quantity_remaining}
            </Text>
            <Text style={styles.priceText}>
              {formatPrice(Number(item.selling_price || 0))}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (!product) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Sélection du lot</Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {product.designation}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          {/* Option Auto FEFO */}
          <TouchableOpacity
            style={[
              styles.autoOption,
              !currentLotId && styles.autoOptionSelected
            ]}
            onPress={handleAutoSelect}
          >
            <View style={styles.autoHeader}>
              <Text style={styles.autoTitle}>🚀 AUTOMATIQUE (FEFO)</Text>
              {!currentLotId && <Text style={styles.selectedBadge}>✓</Text>}
            </View>
            <Text style={styles.autoDesc}>
              Le système choisit automatiquement le lot expirant le plus tôt
            </Text>
          </TouchableOpacity>

          {/* Liste des lots */}
          {loading ? (
            <ActivityIndicator size="large" color="#10b981" style={styles.loader} />
          ) : lots.length === 0 ? (
            <View style={styles.emptyState}>
              <AlertCircle size={40} color="#64748b" />
              <Text style={styles.emptyText}>
                Aucun lot spécifique disponible.{'\n'}
                Le stock global sera utilisé (FEFO).
              </Text>
            </View>
          ) : (
            <FlatList
              data={lots}
              renderItem={renderLotItem}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
            />
          )}

          {/* Footer */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Fermer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    width: '100%',
    maxHeight: '80%',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f1f5f9',
  },
  subtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
    maxWidth: 250,
  },
  closeButton: {
    padding: 4,
  },
  autoOption: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  autoOptionSelected: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10b981',
  },
  autoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  autoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#10b981',
  },
  autoDesc: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 16,
  },
  list: {
    paddingBottom: 12,
  },
  lotItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  lotItemSelected: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10b981',
  },
  lotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  lotNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f1f5f9',
    flex: 1,
  },
  lotNumberSelected: {
    color: '#10b981',
  },
  selectedBadge: {
    fontSize: 14,
    color: '#10b981',
  },
  lotDetails: {
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  expiryText: {
    fontSize: 12,
    fontWeight: '500',
  },
  stockText: {
    fontSize: 12,
    color: '#64748b',
  },
  priceText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10b981',
  },
  loader: {
    marginVertical: 40,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyText: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: 13,
    lineHeight: 18,
  },
  closeBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  closeBtnText: {
    color: '#f1f5f9',
    fontWeight: '600',
  },
});
