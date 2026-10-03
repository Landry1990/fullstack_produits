import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { theme } from '../../config/theme';

interface RecentLine {
  id: number;
  tempId?: string;
  produit: number;
  produit_nom?: string;
  quantite_physique: number;
  details?: { isOffline?: boolean };
}

interface RecentScansProps {
  lignes: RecentLine[];
  editingLine?: RecentLine | null;
  onEdit: (ligne: RecentLine) => void;
  onRemove?: (id: string | number) => void;
}

export default function RecentScans({
  lignes,
  editingLine,
  onEdit,
  onRemove,
}: RecentScansProps) {
  const recentLignes = lignes.slice(-10).reverse();

  const renderItem = ({ item }: { item: RecentLine }) => {
    const isActive = editingLine?.id === item.id;

    return (
      <View
        style={[
          styles.recentItem,
          isActive && styles.recentItemActive,
          item.details?.isOffline && styles.recentItemOffline,
        ]}
      >
        <TouchableOpacity
          style={styles.recentContent}
          onPress={() => onEdit(item)}
          onLongPress={() => onRemove?.(item.tempId || item.id)}
          activeOpacity={0.7}
        >
          <Text style={styles.recentName} numberOfLines={1}>
            {item.details?.isOffline ? '* ' : ''}
            {item.produit_nom || `Produit #${item.produit}`}
          </Text>
          <Text style={styles.recentQty}>{item.quantite_physique}</Text>
        </TouchableOpacity>
        {onRemove && (
          <TouchableOpacity
            style={styles.removeBtn}
            onPress={() => onRemove(item.tempId || item.id)}
            activeOpacity={0.6}
          >
            <Text style={styles.removeBtnText}>×</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.recentContainer}>
      <Text style={styles.recentTitle}>Derniers scans</Text>
      <FlatList
        data={recentLignes}
        keyExtractor={(item) => item.tempId || item.id.toString()}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={styles.emptyText}>Aucun scan effectué</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  recentContainer: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    flex: 1,
    minHeight: 160,
  },
  recentTitle: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    borderRadius: 12,
    marginBottom: 4,
  },
  recentItemActive: {
    backgroundColor: 'rgba(5, 150, 105, 0.12)',
    borderColor: '#059669',
    borderWidth: 1,
  },
  recentItemOffline: {
    borderLeftWidth: 4,
    borderLeftColor: theme.warning,
    backgroundColor: '#fffbeb',
  },
  recentContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  recentName: {
    color: '#0f172a',
    fontSize: 15,
    flex: 1,
    marginRight: 12,
  },
  recentQty: {
    color: '#059669',
    fontSize: 18,
    fontWeight: 'bold',
    minWidth: 40,
    textAlign: 'right',
  },
  removeBtn: {
    marginLeft: 8,
    minWidth: 36,
    minHeight: 36,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: theme.bgMuted,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeBtnText: {
    color: theme.danger,
    fontSize: 18,
    fontWeight: 'bold',
    lineHeight: 20,
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 16,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 24,
  },
});
