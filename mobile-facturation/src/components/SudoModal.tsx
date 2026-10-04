import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, StyleSheet,
} from 'react-native';
import { verifySudoPassword } from '../services/api';

interface Props {
  visible: boolean;
  title: string;
  message: string;
  permission: string;
  onValidate: (validatorId: number, password: string) => void | Promise<void>;
  onClose: () => void;
}

export function SudoModal({ visible, title, message, permission, onValidate, onClose }: Props) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setPassword('');
      setError(null);
      setLoading(false);
    }
  }, [visible]);

  const handleConfirm = async () => {
    if (!password || loading) return;
    setLoading(true);
    setError(null);
    try {
      const user = await verifySudoPassword(password, permission);
      if (!user) {
        setPassword('');
        setError('Mot de passe incorrect');
        return;
      }
      await onValidate(user.id, password);
    } catch (err: unknown) {
      setPassword('');
      const e = err as { response?: { data?: { detail?: string; error?: string } }; message?: string };
      setError(e?.response?.data?.detail || e?.response?.data?.error || 'Mot de passe incorrect');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{title || 'Validation requise'}</Text>
          <Text style={styles.subtitle}>
            Saisissez le mot de passe d'un utilisateur disposant des droits requis
          </Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}

          <TextInput
            style={[styles.input, error ? styles.inputError : null]}
            placeholder="Mot de passe"
            placeholderTextColor="#64748b"
            value={password}
            onChangeText={(t) => { setPassword(t); setError(null); }}
            secureTextEntry
            autoFocus
            onSubmitEditing={handleConfirm}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={loading}>
              <Text style={styles.cancelText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.validateBtn, (!password || loading) && styles.validateBtnDisabled]}
              onPress={handleConfirm}
              disabled={!password || loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.validateText}>Valider</Text>
              )}
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
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  sheet: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    padding: 20,
  },
  title: { fontSize: 17, fontWeight: '700', color: '#f1f5f9' },
  subtitle: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  message: { fontSize: 13, color: '#cbd5e1', marginTop: 12 },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#f1f5f9',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginTop: 14,
  },
  inputError: { borderColor: '#ef4444' },
  error: { color: '#ef4444', fontSize: 12, marginTop: 6 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 18 },
  cancelBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  cancelText: { color: '#f1f5f9', fontWeight: '600', fontSize: 14 },
  validateBtn: {
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#10b981',
    minWidth: 90,
    alignItems: 'center',
  },
  validateBtnDisabled: { opacity: 0.5 },
  validateText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
