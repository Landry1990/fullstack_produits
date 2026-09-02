import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';

interface SyncBannerProps {
  offlineCount: number;
  isOnline: boolean;
  syncing: boolean;
  onSync: () => void;
}

export default function SyncBanner({
  offlineCount,
  isOnline,
  syncing,
  onSync,
}: SyncBannerProps) {
  if (offlineCount === 0) return null;

  return (
    <TouchableOpacity
      style={[
        styles.syncBanner,
        isOnline ? styles.syncBannerActive : styles.syncBannerDisabled,
      ]}
      onPress={onSync}
      disabled={!isOnline || syncing}
      activeOpacity={0.8}
    >
      {syncing ? (
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <Text style={styles.syncBannerText}>
          {offlineCount} ligne(s) en attente — Terminer pour envoyer
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  syncBanner: {
    backgroundColor: '#f59e0b',
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  syncBannerActive: {
    backgroundColor: '#f59e0b',
  },
  syncBannerDisabled: {
    backgroundColor: '#92400e',
    opacity: 0.8,
  },
  syncBannerText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
