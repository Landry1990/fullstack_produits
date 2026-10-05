import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../config/theme';
import { moderateScale as ms } from '../utils/scale';
import type { CartLine } from '../types';

interface Props {
  visible: boolean;
  line: CartLine | null;
  onApply: (prix: number, remise: number) => void;
  onClose: () => void;
}

export function LineEditModal({ visible, line, onApply, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [prix, setPrix] = useState('');
  const [remise, setRemise] = useState('');

  useEffect(() => {
    if (visible && line) {
      setPrix(String(line.prix_unitaire));
      setRemise(String(line.remise));
    }
  }, [visible, line]);

  if (!line) return null;

  const handleApply = () => {
    const p = parseFloat(prix.replace(',', '.'));
    const r = parseFloat(remise.replace(',', '.'));
    onApply(
      Number.isFinite(p) && p >= 0 ? p : line.prix_unitaire,
      Number.isFinite(r) ? Math.min(100, Math.max(0, r)) : line.remise
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.overlay, {
        paddingTop: Math.max(insets.top, 24),
        paddingBottom: Math.max(insets.bottom, 24),
      }]}>
        <View style={styles.sheet}>
          <Text style={styles.title} numberOfLines={1}>{line.product.name}</Text>
          <Text style={styles.subtitle}>Modifier la ligne</Text>

          <Text style={styles.label}>Prix unitaire (F)</Text>
          <TextInput
            style={styles.input}
            value={prix}
            onChangeText={setPrix}
            keyboardType="decimal-pad"
          />

          <Text style={styles.label}>Remise (%)</Text>
          <TextInput
            style={styles.input}
            value={remise}
            onChangeText={setRemise}
            keyboardType="decimal-pad"
          />

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyBtn} onPress={handleApply}>
              <Text style={styles.applyText}>Appliquer</Text>
            </TouchableOpacity>
          </View>
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
    padding: ms(20),
  },
  title: { fontSize: ms(17), fontWeight: '700', color: theme.text },
  subtitle: { fontSize: ms(12), color: theme.textMuted, marginTop: ms(4), marginBottom: ms(14) },
  label: { fontSize: ms(11), fontWeight: '700', color: theme.textMuted, textTransform: 'uppercase', marginBottom: ms(6), marginTop: ms(10) },
  input: {
    backgroundColor: theme.bg,
    borderRadius: ms(8),
    paddingHorizontal: ms(12),
    paddingVertical: ms(10),
    color: theme.text,
    fontSize: ms(14),
    borderWidth: 1,
    borderColor: theme.border,
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: ms(10), marginTop: ms(20) },
  cancelBtn: {
    paddingHorizontal: ms(18),
    paddingVertical: ms(10),
    borderRadius: ms(8),
    backgroundColor: theme.bgMuted,
  },
  cancelText: { color: theme.text, fontWeight: '600', fontSize: ms(14) },
  applyBtn: {
    paddingHorizontal: ms(22),
    paddingVertical: ms(10),
    borderRadius: ms(8),
    backgroundColor: theme.primary,
  },
  applyText: { color: '#fff', fontWeight: '700', fontSize: ms(14) },
});
