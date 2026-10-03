import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { theme } from '../../config/theme';

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
        <ActivityIndicator color={theme.textOnPrimary} size="small" />
      ) : (
        <Text style={[styles.syncBannerText, !isOnline && styles.syncBannerTextMuted]}>
          {offlineCount} ligne(s) en attente — Terminer pour envoyer
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  syncBanner: {
    backgroundColor: theme.warningWash,
    borderColor: theme.warning,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  syncBannerActive: {
    backgroundColor: theme.warningWash,
  },
  syncBannerDisabled: {
    backgroundColor: theme.bgMuted,
    borderColor: theme.border,
    opacity: 1,
  },
  syncBannerText: {
    color: theme.warning,
    fontWeight: 'bold',
    fontSize: 14,
  },
  syncBannerTextMuted: {
    color: theme.textMuted,
  },
});
