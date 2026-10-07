import React from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../../config/theme';

interface SyncBannerProps {
  offlineCount: number;
  isOnline: boolean;
  syncing: boolean;
  syncProgress: { current: number; total: number } | null;
  onSync: () => void;
}

export default function SyncBanner({
  offlineCount,
  isOnline,
  syncing,
  syncProgress,
  onSync,
}: SyncBannerProps) {
  const { t } = useTranslation();

  if (offlineCount === 0) return null;

  const label = syncing && syncProgress
    ? `${t('scanner.sync_banner', { count: offlineCount })} (${syncProgress.current}/${syncProgress.total})`
    : t('scanner.sync_banner', { count: offlineCount });

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
        <View style={styles.row}>
          <ActivityIndicator color={theme.warning} size="small" />
          <Text style={[styles.syncBannerText, styles.syncBannerTextMargin]}>
            {label}
          </Text>
        </View>
      ) : (
        <Text style={[styles.syncBannerText, !isOnline && styles.syncBannerTextMuted]}>
          {label}
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncBannerText: {
    color: theme.warning,
    fontWeight: 'bold',
    fontSize: 14,
  },
  syncBannerTextMargin: {
    marginLeft: 10,
  },
  syncBannerTextMuted: {
    color: theme.textMuted,
  },
});
