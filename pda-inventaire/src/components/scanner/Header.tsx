import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface HeaderProps {
  reference: string;
  isOnline: boolean;
  offlineCount: number;
  onBack: () => void;
  onExport: () => void;
  keyboardEnabled?: boolean;
  onToggleKeyboard?: () => void;
  count?: number;
}

export default function Header({
  reference,
  isOnline,
  offlineCount,
  onBack,
  onExport,
  keyboardEnabled,
  onToggleKeyboard,
  count,
}: HeaderProps) {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'web' ? 8 : Math.min(insets.top, 32);

  return (
    <View style={[styles.header, { paddingTop: topInset }]}> 
      <View style={styles.topRow}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Terminer</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{reference}</Text>
        {typeof count === 'number' && (
          <View style={styles.counter}>
            <Text style={styles.counterText}>{count}</Text>
          </View>
        )}
      </View>

      <View style={styles.bottomRow}>
        <View style={[styles.statusBadge, isOnline ? styles.statusOnline : styles.statusOffline]}>
          <Text style={styles.statusText}>{isOnline ? 'EN LIGNE' : 'HORS LIGNE'}</Text>
        </View>
        <View style={styles.headerRight}>
          {onToggleKeyboard && (
            <TouchableOpacity
              onPress={onToggleKeyboard}
              style={[styles.actionBtn, keyboardEnabled && styles.actionBtnActive]}
            >
              <Text style={styles.actionBtnText}>Clavier</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onExport} style={styles.actionBtn}>
            <Text style={styles.actionBtnText}>CSV</Text>
          </TouchableOpacity>
          {offlineCount > 0 && (
            <View style={styles.offlineBadge}>
              <Text style={styles.offlineBadgeText}>{offlineCount} attente</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  topRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
  },
  bottomRow: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    minHeight: 44,
    justifyContent: 'center',
    paddingRight: 12,
  },
  backBtnText: {
    color: '#818cf8',
    fontSize: 15,
    fontWeight: '700',
  },
  headerTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginHorizontal: 8,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    minWidth: 76,
    alignItems: 'center',
  },
  statusOnline: {
    backgroundColor: '#15803d',
  },
  statusOffline: {
    backgroundColor: '#b91c1c',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    minHeight: 36,
    minWidth: 58,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2d2d44',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4b4b6a',
  },
  actionBtnActive: {
    backgroundColor: '#4f46e5',
    borderColor: '#818cf8',
  },
  actionBtnText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '700',
  },
  offlineBadge: {
    backgroundColor: '#b45309',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
  },
  offlineBadgeText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 11,
  },
  counter: {
    minWidth: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#4f46e5',
    borderRadius: 18,
  },
  counterText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
});
