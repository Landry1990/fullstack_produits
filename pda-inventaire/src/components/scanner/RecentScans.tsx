import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';

interface RecentLine {
  id: number;
  tempId?: string;
  produit: number;
  produit_nom?: string;
  produit_name?: string;
  quantite_comptee: number;
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
            {item.produit_nom || item.produit_name || `Produit #${item.produit}`}
          </Text>
          <Text style={styles.recentQty}>{item.quantite_comptee}</Text>
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
    backgroundColor: '#1a1a2e',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#2d2d44',
    height: 220,
  },
  recentTitle: {
    color: '#ccc',
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
    borderBottomColor: '#2d2d44',
    borderRadius: 12,
    marginBottom: 4,
  },
  recentItemActive: {
    backgroundColor: 'rgba(79, 70, 229, 0.2)',
    borderColor: '#4f46e5',
    borderWidth: 1,
  },
  recentItemOffline: {
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
    backgroundColor: '#222',
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
    color: '#fff',
    fontSize: 15,
    flex: 1,
    marginRight: 12,
  },
  recentQty: {
    color: '#818cf8',
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
    backgroundColor: '#ef4444',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    lineHeight: 20,
  },
  emptyText: {
    color: '#bbb',
    fontSize: 16,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 24,
  },
});
