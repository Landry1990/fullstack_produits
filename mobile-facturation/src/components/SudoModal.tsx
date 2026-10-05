import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { verifySudoPassword } from '../services/api';
import { theme } from '../config/theme';
import { moderateScale as ms } from '../utils/scale';

interface Props {
  visible: boolean;
  title: string;
  message: string;
  permission: string;
  onValidate: (validatorId: number, password: string) => void | Promise<void>;
  onClose: () => void;
}

export function SudoModal({ visible, title, message, permission, onValidate, onClose }: Props) {
  const insets = useSafeAreaInsets();
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
      <View style={[styles.overlay, {
        paddingTop: Math.max(insets.top, 24),
        paddingBottom: Math.max(insets.bottom, 24),
      }]}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{title || 'Validation requise'}</Text>
          <Text style={styles.subtitle}>
            Saisissez le mot de passe d'un utilisateur disposant des droits requis
          </Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}

          <TextInput
            style={[styles.input, error ? styles.inputError : null]}
            placeholder="Mot de passe"
            placeholderTextColor={theme.textMuted}
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
  subtitle: { fontSize: ms(12), color: theme.textMuted, marginTop: ms(4) },
  message: { fontSize: ms(13), color: theme.textSecondary, marginTop: ms(12) },
  input: {
    backgroundColor: theme.bg,
    borderRadius: ms(8),
    paddingHorizontal: ms(12),
    paddingVertical: ms(10),
    color: theme.text,
    fontSize: ms(14),
    borderWidth: 1,
    borderColor: theme.border,
    marginTop: ms(14),
  },
  inputError: { borderColor: theme.danger },
  error: { color: theme.danger, fontSize: ms(12), marginTop: ms(6) },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: ms(10), marginTop: ms(18) },
  cancelBtn: {
    paddingHorizontal: ms(18),
    paddingVertical: ms(10),
    borderRadius: ms(8),
    backgroundColor: theme.bgMuted,
  },
  cancelText: { color: theme.text, fontWeight: '600', fontSize: ms(14) },
  validateBtn: {
    paddingHorizontal: ms(22),
    paddingVertical: ms(10),
    borderRadius: ms(8),
    backgroundColor: theme.primary,
    minWidth: ms(90),
    alignItems: 'center',
  },
  validateBtnDisabled: { opacity: 0.5 },
  validateText: { color: '#fff', fontWeight: '700', fontSize: ms(14) },
});
