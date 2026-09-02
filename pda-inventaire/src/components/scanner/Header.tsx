import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';

interface HeaderProps {
  reference: string;
  isOnline: boolean;
  offlineCount: number;
  onBack: () => void;
  onExport: () => void;
  onToggleContinuous: () => void;
  onToggleRapid: () => void;
  continuousScanMode: boolean;
  rapidCountMode: boolean;
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
  onToggleContinuous,
  onToggleRapid,
  continuousScanMode,
  rapidCountMode,
  keyboardEnabled,
  onToggleKeyboard,
  count,
}: HeaderProps) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <Text style={styles.backBtnText}>Terminer</Text>
      </TouchableOpacity>

      <View style={styles.headerTitles}>
        <Text style={styles.headerTitle}>{reference}</Text>
        <View
          style={[
            styles.statusBadge,
            isOnline ? styles.statusOnline : styles.statusOffline,
          ]}
        >
          <Text style={styles.statusText}>{isOnline ? 'EN LIGNE' : 'HORS LIGNE'}</Text>
        </View>
      </View>

      <View style={styles.headerRight}>
        {/* Mode Scan Continu */}
        <TouchableOpacity
          onPress={onToggleContinuous}
          style={[styles.modeBtn, continuousScanMode && styles.modeBtnActive]}
        >
          <Text style={styles.modeBtnText}>CONT</Text>
        </TouchableOpacity>

        {/* Mode Rapide (+1) */}
        <TouchableOpacity
          onPress={onToggleRapid}
          style={[styles.modeBtn, rapidCountMode && styles.modeBtnActive]}
        >
          <Text style={styles.modeBtnText}>+1</Text>
        </TouchableOpacity>

        {onToggleKeyboard && (
          <TouchableOpacity
            onPress={onToggleKeyboard}
            style={[
              styles.exportBtn,
              { marginRight: 8, backgroundColor: keyboardEnabled ? '#4f46e5' : '#2d2d44' },
            ]}
          >
            <Text style={styles.exportBtnText}>KBD</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity onPress={onExport} style={styles.exportBtn}>
          <Text style={styles.exportBtnText}>CSV</Text>
        </TouchableOpacity>

        {typeof count === 'number' && (
          <View style={styles.counter}>
            <Text style={styles.counterText}>{count}</Text>
          </View>
        )}

        {offlineCount > 0 && (
          <View style={styles.offlineBadge}>
            <Text style={styles.offlineBadgeText}>{offlineCount}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'web' ? 10 : 14,
    paddingTop: Platform.OS === 'web' ? 0 : 48,
    minHeight: 56,
  },
  backBtn: {
    padding: 8,
  },
  backBtnText: {
    color: '#4f46e5',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitles: {
    flex: 1,
    marginLeft: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 4,
    minWidth: 70,
    maxWidth: 90,
    alignItems: 'center',
  },
  statusOnline: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
  },
  statusOffline: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  statusText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  modeBtn: {
    padding: 8,
    backgroundColor: '#2d2d44',
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#4b4b6a',
    minWidth: 44,
    alignItems: 'center',
  },
  modeBtnActive: {
    backgroundColor: '#22c55e',
    borderColor: '#22c55e',
  },
  modeBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  exportBtn: {
    padding: 8,
    backgroundColor: '#2d2d44',
    borderRadius: 8,
    marginRight: 8,
    minWidth: 44,
    alignItems: 'center',
  },
  exportBtnText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  offlineBadge: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  offlineBadgeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  counter: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  counterText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
