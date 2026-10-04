import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet,
} from 'react-native';
import { theme } from '../config/theme';
import type { CartLine } from '../types';

interface Props {
  visible: boolean;
  line: CartLine | null;
  onApply: (prix: number, remise: number) => void;
  onClose: () => void;
}

export function LineEditModal({ visible, line, onApply, onClose }: Props) {
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
      <View style={styles.overlay}>
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
    padding: 24,
  },
  sheet: {
    backgroundColor: theme.bgElevated,
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    padding: 20,
  },
  title: { fontSize: 17, fontWeight: '700', color: theme.text },
  subtitle: { fontSize: 12, color: theme.textMuted, marginTop: 4, marginBottom: 14 },
  label: { fontSize: 11, fontWeight: '700', color: theme.textMuted, textTransform: 'uppercase', marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: theme.bg,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: theme.border,
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20 },
  cancelBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: theme.bgMuted,
  },
  cancelText: { color: theme.text, fontWeight: '600', fontSize: 14 },
  applyBtn: {
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: theme.primary,
  },
  applyText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
