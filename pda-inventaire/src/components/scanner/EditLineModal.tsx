import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Modal,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface EditLine {
  id: number;
  produit: number;
  produit_nom?: string;
  quantite_physique: number;
}

interface EditLineModalProps {
  line: EditLine;
  quantity: string;
  setQuantity: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  loading: boolean;
}

export default function EditLineModal({
  line,
  quantity,
  setQuantity,
  onSave,
  onCancel,
  loading,
}: EditLineModalProps) {
  const insets = useSafeAreaInsets();

  const decrease = () => {
    const current = parseInt(quantity || '0', 10);
    setQuantity(String(Math.max(0, current - 1)));
  };

  const increase = () => {
    const current = parseInt(quantity || '0', 10);
    setQuantity(String(current + 1));
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <KeyboardAvoidingView
        style={[styles.overlay, { paddingTop: Math.max(insets.top, 16), paddingBottom: Math.max(insets.bottom, 16) }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <Text style={styles.title}>Modifier la quantité</Text>
          <Text style={styles.productName} numberOfLines={2}>
            {line.produit_nom || `Produit #${line.produit}`}
          </Text>

          <View style={styles.quantityRow}>
            <TouchableOpacity style={styles.qtyBtn} onPress={decrease} disabled={loading}>
              <Text style={styles.qtyBtnText}>−</Text>
            </TouchableOpacity>
            <TextInput
              style={styles.qtyInput}
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="number-pad"
              selectTextOnFocus
              autoFocus
            />
            <TouchableOpacity style={styles.qtyBtn} onPress={increase} disabled={loading}>
              <Text style={styles.qtyBtnText}>+</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} disabled={loading}>
              <Text style={styles.cancelBtnText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.validateBtn, loading && styles.disabled]}
              onPress={onSave}
              disabled={loading}
            >
              <Text style={styles.validateBtnText}>{loading ? 'Enregistrement...' : 'Valider'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: 'rgba(2, 6, 23, 0.82)',
  },
  card: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    backgroundColor: '#111827',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  title: {
    color: '#fbbf24',
    fontSize: 21,
    fontWeight: '800',
    textAlign: 'center',
  },
  productName: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 10,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 24,
    gap: 12,
  },
  qtyBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#64748b',
  },
  qtyBtnText: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '400',
  },
  qtyInput: {
    width: 118,
    height: 64,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    color: '#fff',
    fontSize: 30,
    textAlign: 'center',
    fontWeight: '800',
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    minHeight: 52,
    borderRadius: 11,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  validateBtn: {
    flex: 2,
    minHeight: 52,
    borderRadius: 11,
    backgroundColor: '#16a34a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  validateBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.6,
  },
});
