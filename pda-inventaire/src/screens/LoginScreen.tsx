import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { login } from '../services/api';
import { useAuthStore } from '../stores/useAuthStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { theme } from '../config/theme';

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const { serverUrl, setServerUrl, setAuth } = useAuthStore();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const [url, setUrl] = useState(serverUrl);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!url || !password) {
      Alert.alert(t('common.error'), t('login.error_required'));
      return;
    }

    setLoading(true);
    try {
      let cleanUrl = url.trim().replace(/\/+$/, '');
      if (!/^https?:\/\//i.test(cleanUrl)) {
        cleanUrl = `http://${cleanUrl}`;
      }
      console.log('[Login PDA] Tentative connexion vers:', cleanUrl);
      setServerUrl(cleanUrl);
      const { token, username } = await login(cleanUrl, password);
      console.log('[Login PDA] Connexion réussie :', username);
      setAuth(token, username);
      onLoginSuccess();
    } catch (err: any) {
      console.error('[Login PDA] Erreur:', err);
      const status = err?.response?.status;
      let msg: string;
      if (status === 400) {
        msg = t('login.error_bad_password');
      } else if (status === 429) {
        msg = err?.response?.data?.detail || t('login.error_bad_password');
      } else {
        msg = t('login.error_server');
      }
      Alert.alert(t('login.error_title'), msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, {
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
        paddingLeft: insets.left,
        paddingRight: insets.right,
      }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        persistentScrollbar
      >
        <View style={styles.card}>
          <Text style={styles.title}>{t('login.title')}</Text>
          <Text style={styles.subtitle}>{t('login.subtitle')}</Text>
          <Text style={styles.hint}>{t('login.hint')}</Text>

          <TextInput
            style={styles.input}
            placeholder={t('login.url_placeholder')}
            placeholderTextColor={theme.textMuted}
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            keyboardType="default"
          />

          <TextInput
            style={styles.input}
            placeholder={t('login.password')}
            placeholderTextColor={theme.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            onSubmitEditing={handleLogin}
            returnKeyType="go"
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>{t('login.submit')}</Text>
            )}
          </TouchableOpacity>

          <View style={styles.langRow}>
            {(['fr', 'en'] as const).map((lng) => (
              <TouchableOpacity
                key={lng}
                style={[styles.langBtn, i18n.language === lng && styles.langBtnActive]}
                onPress={() => useSettingsStore.getState().setLanguage(lng)}
              >
                <Text style={[styles.langBtnText, i18n.language === lng && styles.langBtnTextActive]}>
                  {lng.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bg,
    padding: 24,
  },
  scroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    backgroundColor: theme.bgElevated,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: theme.border,
  },
  title: { fontSize: 24, fontWeight: '700', color: theme.text, marginBottom: 4 },
  subtitle: { fontSize: 14, color: theme.textMuted, marginBottom: 8 },
  hint: { fontSize: 12, color: theme.textSecondary, marginBottom: 20 },
  input: {
    backgroundColor: theme.bg,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    color: theme.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: theme.border,
  },
  button: {
    backgroundColor: theme.primary,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  langRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 18,
  },
  langBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: theme.bgMuted,
    borderWidth: 1,
    borderColor: theme.border,
  },
  langBtnActive: { backgroundColor: theme.primaryWash, borderColor: theme.primary },
  langBtnText: { fontSize: 12, fontWeight: '700', color: theme.textSecondary },
  langBtnTextActive: { color: theme.primaryDark },
});
