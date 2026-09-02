import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

interface EditLine {
  id: number;
  produit: number;
  produit_nom?: string;
  produit_name?: string;
  quantite_comptee: number;
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
  const decrease = () => {
    const current = parseInt(quantity || '0', 10);
    setQuantity(String(Math.max(0, current - 1)));
  };

  const increase = () => {
    const current = parseInt(quantity || '0', 10);
    setQuantity(String(current + 1));
  };

  return (
    <View style={styles.editCard}>
      <Text style={styles.editTitle}>Modifier la quantité</Text>
      <Text style={styles.editProductName}>
        {line.produit_nom || line.produit_name || `Produit #${line.produit}`}
      </Text>

      <View style={styles.quantityRow}>
        <TouchableOpacity style={styles.qtyBtn} onPress={decrease}>
          <Text style={styles.qtyBtnText}>−</Text>
        </TouchableOpacity>

        <TextInput
          style={styles.qtyInput}
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="number-pad"
          selectTextOnFocus
        />

        <TouchableOpacity style={styles.qtyBtn} onPress={increase}>
          <Text style={styles.qtyBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelBtnText}>Annuler</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.validateBtn, loading && styles.btnDisabled]}
          onPress={onSave}
          disabled={loading}
        >
          <Text style={styles.validateBtnText}>Enregistrer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  editCard: {
    backgroundColor: '#1a1a2e',
    margin: 16,
    borderRadius: 16,
    padding: 24,
    borderWidth: 2,
    borderColor: '#f59e0b',
  },
  editTitle: {
    color: '#f59e0b',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  editProductName: {
    color: '#fff',
    fontSize: 18,
    marginBottom: 20,
    textAlign: 'center',
    fontWeight: '500',
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  qtyBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#2d2d44',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4b4b6a',
  },
  qtyBtnText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '300',
  },
  qtyInput: {
    width: 120,
    height: 64,
    backgroundColor: '#0f0f1a',
    borderRadius: 16,
    marginHorizontal: 16,
    color: '#fff',
    fontSize: 32,
    textAlign: 'center',
    fontWeight: 'bold',
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  actions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#2d2d44',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4b4b6a',
  },
  cancelBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  validateBtn: {
    flex: 2,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    elevation: 4,
  },
  validateBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
