import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator,
} from 'react-native';
import { Lock } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/useAuthStore';
import { useLockStore } from '../stores/useLockStore';
import { theme } from '../config/theme';
import { moderateScale as ms } from '../utils/scale';

// Overlay plein écran rendu par App.tsx quand useLockStore.locked.
// « Se déconnecter » efface aussi le PIN : c'est la porte de sortie
// quand le code est oublié (le prochain login exige le mot de passe).
export function LockScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { username, logout } = useAuthStore();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const submit = async () => {
    if (!pin || checking) return;
    setChecking(true);
    setError(null);
    const ok = await useLockStore.getState().checkPin(pin);
    setChecking(false);
    if (ok) {
      setPin('');
      useLockStore.getState().unlock();
    } else {
      setPin('');
      setError(t('lock.wrong'));
    }
  };

  const handleLogout = () => {
    Alert.alert(
      t('lock.logout_title'),
      t('lock.logout_msg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('lock.logout_confirm'),
          style: 'destructive',
          onPress: async () => {
            await useLockStore.getState().setPin(null);
            logout();
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.overlay, {
      paddingTop: insets.top,
      paddingBottom: insets.bottom,
    }]}>
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Lock size={ms(28)} color={theme.primary} />
        </View>
        <Text style={styles.title}>{t('lock.title')}</Text>
        {username ? <Text style={styles.subtitle}>{username}</Text> : null}

        <TextInput
          style={[styles.input, error ? styles.inputError : null]}
          placeholder={t('lock.pin_placeholder')}
          placeholderTextColor={theme.textMuted}
          value={pin}
          onChangeText={(t) => { setPin(t.replace(/\D/g, '')); setError(null); }}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={6}
          autoFocus
          onSubmitEditing={submit}
          returnKeyType="go"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.button, (!pin || checking) && styles.buttonDisabled]}
          onPress={submit}
          disabled={!pin || checking}
        >
          {checking ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.buttonText}>{t('lock.unlock')}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={handleLogout} style={styles.logoutLink}>
          <Text style={styles.logoutText}>{t('lock.forgot')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.bg,
    justifyContent: 'center',
    alignItems: 'center',
    padding: ms(24),
    zIndex: 100,
  },
  card: {
    backgroundColor: theme.bgElevated,
    borderRadius: ms(16),
    padding: ms(24),
    width: '100%',
    maxWidth: ms(360),
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
  },
  iconCircle: {
    width: ms(56),
    height: ms(56),
    borderRadius: ms(28),
    backgroundColor: theme.primaryWash,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: ms(12),
  },
  title: { fontSize: ms(18), fontWeight: '700', color: theme.text },
  subtitle: { fontSize: ms(13), color: theme.textMuted, marginTop: ms(4) },
  input: {
    backgroundColor: theme.bg,
    borderRadius: ms(8),
    paddingHorizontal: ms(14),
    paddingVertical: ms(12),
    marginTop: ms(20),
    color: theme.text,
    fontSize: ms(18),
    textAlign: 'center',
    letterSpacing: ms(6),
    borderWidth: 1,
    borderColor: theme.border,
    alignSelf: 'stretch',
  },
  inputError: { borderColor: theme.danger },
  error: { color: theme.danger, fontSize: ms(12), marginTop: ms(6) },
  button: {
    backgroundColor: theme.primary,
    borderRadius: ms(8),
    paddingVertical: ms(12),
    alignItems: 'center',
    alignSelf: 'stretch',
    marginTop: ms(16),
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: ms(15), fontWeight: '600' },
  logoutLink: { marginTop: ms(16), padding: ms(4) },
  logoutText: { color: theme.danger, fontSize: ms(12), fontWeight: '600' },
});
