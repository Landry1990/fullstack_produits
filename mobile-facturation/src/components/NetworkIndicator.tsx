/**
 * Composant — Indicateur de statut réseau
 * Affiche un badge coloré en haut de l'écran
 */
import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

interface NetworkIndicatorProps {
  isOnline: boolean;
  pendingCount?: number;
  isSyncing?: boolean;
}

export function NetworkIndicator({ isOnline, pendingCount = 0, isSyncing = false }: NetworkIndicatorProps) {
  if (isOnline && pendingCount === 0 && !isSyncing) {
    return null; // Pas besoin de bannière si tout va bien
  }

  return (
    <View style={[styles.container, isOnline ? styles.online : styles.offline]}>
      <View style={styles.dot}>
        <View style={[styles.dotInner, { backgroundColor: isOnline ? '#22c55e' : '#ef4444' }]} />
      </View>
      <Text style={styles.text}>
        {!isOnline
          ? '⚡ Hors ligne — Les ventes sont sauvegardées localement'
          : isSyncing
          ? `🔄 Synchronisation en cours…`
          : `📤 ${pendingCount} facture(s) en attente de sync`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  online: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
  },
  offline: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  text: {
    fontSize: 12,
    color: '#e2e8f0',
    flex: 1,
    fontWeight: '500',
  },
});
