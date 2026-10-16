import React, { useMemo, useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, FlatList, TextInput, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Search, Check } from 'lucide-react-native';
import { theme } from '../config/theme';
import { moderateScale as ms } from '../utils/scale';

export interface PickerOption {
  id: number | null;
  label: string;
}

interface Props {
  visible: boolean;
  title: string;
  options: PickerOption[];
  selectedId: number | null;
  onPick: (id: number | null) => void;
  onClose: () => void;
}

// Picker générique de référentiel (rayon, forme…) — liste filtrable,
// option « null » possible pour vider la valeur (passée dans options).
export function OptionPickerModal({ visible, title, options, selectedId, onPick, onClose }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.overlay, {
        paddingTop: Math.max(insets.top, 24),
        paddingBottom: Math.max(insets.bottom, 24),
      }]}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{title}</Text>

          <View style={styles.searchBar}>
            <Search size={ms(16)} color={theme.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder={t('common.search')}
              placeholderTextColor={theme.textMuted}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(o) => String(o.id ?? 'none')}
            style={styles.list}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const active = item.id === selectedId;
              return (
                <TouchableOpacity
                  style={[styles.row, active && styles.rowActive]}
                  onPress={() => onPick(item.id)}
                >
                  <Text style={[styles.rowText, active && styles.rowTextActive]} numberOfLines={1}>
                    {item.label}
                  </Text>
                  {active && <Check size={ms(16)} color={theme.primary} />}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <Text style={styles.empty}>{t('common.no_results')}</Text>
            }
          />

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: theme.bgOverlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: ms(24),
  },
  sheet: {
    backgroundColor: theme.bgElevated,
    borderRadius: ms(16),
    width: '100%',
    maxWidth: ms(400),
    maxHeight: '80%',
    padding: ms(20),
  },
  title: { fontSize: ms(18), fontWeight: '700', color: theme.text, marginBottom: ms(12) },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(8),
    backgroundColor: theme.bgMuted,
    borderRadius: ms(8),
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: ms(10),
    paddingVertical: ms(8),
    marginBottom: ms(10),
  },
  searchInput: { flex: 1, fontSize: ms(14), color: theme.text, padding: 0 },
  list: { flexGrow: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(10),
    padding: ms(12),
    backgroundColor: theme.bgMuted,
    borderRadius: ms(10),
    marginBottom: ms(6),
  },
  rowActive: { backgroundColor: theme.primaryWash, borderWidth: 1, borderColor: theme.primary },
  rowText: { flex: 1, fontSize: ms(14), fontWeight: '600', color: theme.text },
  rowTextActive: { color: theme.primaryDark },
  empty: { textAlign: 'center', color: theme.textMuted, paddingVertical: ms(24) },
  cancelBtn: { marginTop: ms(12), alignItems: 'center', paddingVertical: ms(10) },
  cancelText: { color: theme.textMuted, fontSize: ms(14), fontWeight: '600' },
});
