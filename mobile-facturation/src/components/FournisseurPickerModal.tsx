import React, { useMemo, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Search, Truck } from 'lucide-react-native';
import { theme } from '../config/theme';
import { moderateScale as ms } from '../utils/scale';
import type { Fournisseur } from '../types';

interface Props {
  visible: boolean;
  fournisseurs: Fournisseur[];
  selectedId: number | null;
  onPick: (f: Fournisseur) => void;
  onClose: () => void;
}

// Menu déroulant du fournisseur de l'entrée en stock — liste complète
// avec filtre local (les catalogues fournisseurs peuvent être longs).
export function FournisseurPickerModal({ visible, fournisseurs, selectedId, onPick, onClose }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState('');

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return fournisseurs;
    return fournisseurs.filter((f) => f.name.toLowerCase().includes(q));
  }, [fournisseurs, filter]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.overlay, {
        paddingTop: Math.max(insets.top, 24),
        paddingBottom: Math.max(insets.bottom, 24),
      }]}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{t('entree.fournisseur_modal_title')}</Text>

          <View style={styles.filterBar}>
            <Search size={ms(16)} color={theme.textMuted} />
            <TextInput
              style={styles.filterInput}
              placeholder={t('entree.fournisseur_search')}
              placeholderTextColor={theme.textMuted}
              value={filter}
              onChangeText={setFilter}
              autoFocus
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(f) => String(f.id)}
            style={styles.list}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Text style={styles.empty}>{t('entree.fournisseur_empty')}</Text>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.row, item.id === selectedId && styles.rowSelected]}
                onPress={() => onPick(item)}
              >
                <Truck size={ms(18)} color={item.id === selectedId ? theme.info : theme.textMuted} />
                <Text
                  style={[styles.rowText, item.id === selectedId && { color: theme.info }]}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
              </TouchableOpacity>
            )}
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
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(8),
    backgroundColor: theme.bgMuted,
    borderRadius: ms(10),
    paddingHorizontal: ms(10),
    paddingVertical: ms(8),
    marginBottom: ms(10),
  },
  filterInput: { flex: 1, fontSize: ms(14), color: theme.text, padding: 0 },
  list: { flexGrow: 0 },
  empty: { fontSize: ms(13), color: theme.textMuted, fontStyle: 'italic', padding: ms(10) },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(10),
    padding: ms(14),
    backgroundColor: theme.bgMuted,
    borderRadius: ms(10),
    marginBottom: ms(6),
  },
  rowSelected: { backgroundColor: theme.infoWash, borderWidth: 1, borderColor: theme.info },
  rowText: { flex: 1, fontSize: ms(15), fontWeight: '600', color: theme.text },
  cancelBtn: { marginTop: ms(12), alignItems: 'center', paddingVertical: ms(10) },
  cancelText: { color: theme.textMuted, fontSize: ms(14), fontWeight: '600' },
});
