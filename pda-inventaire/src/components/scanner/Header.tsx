import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { theme } from '../../config/theme';

interface HeaderProps {
  reference: string;
  isOnline: boolean;
  offlineCount: number;
  onBack: () => void;
  onUpload?: () => void;
  syncing?: boolean;
  keyboardEnabled?: boolean;
  onToggleKeyboard?: () => void;
  count?: number;
}

export default function Header({
  reference,
  isOnline,
  offlineCount,
  onBack,
  onUpload,
  syncing,
  keyboardEnabled,
  onToggleKeyboard,
  count,
}: HeaderProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const topInset = Platform.OS === 'web' ? 8 : Math.min(insets.top, 32);

  return (
    <View style={[styles.header, { paddingTop: topInset }]}> 
      <View style={styles.topRow}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>{t('common.back')}</Text>
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
          <Text style={styles.statusText}>{isOnline ? t('scanner.online') : t('scanner.offline')}</Text>
        </View>
        <View style={styles.headerRight}>
          {onToggleKeyboard && (
            <TouchableOpacity
              onPress={onToggleKeyboard}
              style={[styles.actionBtn, keyboardEnabled && styles.actionBtnActive]}
            >
              <Text style={styles.actionBtnText}>{t('scanner.keyboard')}</Text>
            </TouchableOpacity>
          )}
          {onUpload && offlineCount > 0 && (
            <TouchableOpacity
              onPress={onUpload}
              style={[styles.actionBtn, styles.uploadBtn]}
              disabled={syncing}
            >
              <Text style={styles.uploadBtnText}>{t('scanner.upload')}</Text>
            </TouchableOpacity>
          )}
          {offlineCount > 0 && (
            <View style={styles.offlineBadge}>
              <Text style={styles.offlineBadgeText}>{t('scanner.pending', { count: offlineCount })}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: theme.bgElevated,
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
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
    color: theme.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  headerTitle: {
    flex: 1,
    color: theme.text,
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
    backgroundColor: theme.primary,
  },
  statusOffline: {
    backgroundColor: theme.danger,
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
    backgroundColor: theme.bgMuted,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  actionBtnActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primaryDark,
  },
  actionBtnText: {
    fontSize: 12,
    color: theme.text,
    fontWeight: '700',
  },
  uploadBtn: {
    backgroundColor: theme.primary,
    borderColor: theme.primaryDark,
  },
  uploadBtnText: {
    fontSize: 12,
    color: theme.textOnPrimary,
    fontWeight: '700',
  },
  offlineBadge: {
    backgroundColor: theme.warningWash,
    borderColor: theme.warning,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
  },
  offlineBadgeText: {
    color: theme.warning,
    fontWeight: '700',
    fontSize: 11,
  },
  counter: {
    minWidth: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.primary,
    borderRadius: 18,
  },
  counterText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
});
