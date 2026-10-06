import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { useAuthStore } from '../stores/useAuthStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../stores/useSettingsStore';
import { login, getMe, ensurePosteVente, PosteChoiceRequired } from '../services/api';
import { theme } from '../config/theme';
import { moderateScale as ms } from '../utils/scale';

export function LoginScreen({ onLoginSuccess }: { onLoginSuccess: () => void }) {
  const { serverUrl, setServerUrl, setAuth, setMaxDiscountRate, setPosteVente, setUserId } = useAuthStore();
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
      // Nginx écoute sur le port 80 (par défaut HTTP) et proxyfie /api/ vers
      // Django — l'URL doit rester telle quelle, seul le schéma est ajouté.
      if (!/^https?:\/\//i.test(cleanUrl)) {
        cleanUrl = `http://${cleanUrl}`;
      }
      console.log('[Login] Tentative connexion vers:', cleanUrl);
      setServerUrl(cleanUrl);
      const { token, username } = await login(cleanUrl, password);
      console.log('[Login] Connexion réussie');
      setAuth(token, username);
      // Plafond de remise de l'utilisateur (échec silencieux → 0 = pas de plafond connu)
      try {
        const me = await getMe();
        setUserId(me.id);
        setMaxDiscountRate(me.is_superuser ? 100 : Number(me.profile?.max_discount_rate) || 0);
      } catch {
        setMaxDiscountRate(0);
      }
      // Point de vente : réutilise un poste actif ou active la 1re
      // définition disponible. Jamais bloquant pour le login.
      try {
        setPosteVente(await ensurePosteVente());
      } catch (err: unknown) {
        if (err instanceof PosteChoiceRequired) {
          // Choix différé : le sélecteur s'ouvre sur l'écran de facturation.
        } else if ((err as Error)?.message === 'NO_POSTE_DISPONIBLE') {
          Alert.alert(t('poste.none'), t('poste.none_alert'));
        } else {
          const detail = (err as { response?: { data?: { detail?: string } }; message?: string })?.response?.data?.detail
            || (err as Error)?.message || '';
          Alert.alert(t('poste.none'), t('poste.open_error', { detail }));
        }
      }
      onLoginSuccess();
    } catch (err: any) {
      console.error('[Login] Erreur:', err);
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
    <View style={[styles.container, {
      paddingTop: insets.top,
      paddingBottom: insets.bottom,
      paddingLeft: insets.left,
      paddingRight: insets.right,
    }]}>
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

        {/* Bascule FR/EN — choix persisté par appareil (kv-store). */}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bg,
    justifyContent: 'center',
    alignItems: 'center',
    padding: ms(24),
  },
  card: {
    backgroundColor: theme.bgElevated,
    borderRadius: ms(16),
    padding: ms(24),
    width: '100%',
    maxWidth: ms(400),
    borderWidth: 1,
    borderColor: theme.border,
  },
  title: { fontSize: ms(24), fontWeight: '700', color: theme.text, marginBottom: ms(4) },
  subtitle: { fontSize: ms(14), color: theme.textMuted, marginBottom: ms(8) },
  hint: { fontSize: ms(12), color: theme.textSecondary, marginBottom: ms(20) },
  input: {
    backgroundColor: theme.bg,
    borderRadius: ms(8),
    paddingHorizontal: ms(14),
    paddingVertical: ms(12),
    marginBottom: ms(12),
    color: theme.text,
    fontSize: ms(15),
    borderWidth: 1,
    borderColor: theme.border,
  },
  button: {
    backgroundColor: theme.primary,
    borderRadius: ms(8),
    paddingVertical: ms(14),
    alignItems: 'center',
    marginTop: ms(8),
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: ms(16), fontWeight: '600' },
  langRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: ms(8),
    marginTop: ms(18),
  },
  langBtn: {
    paddingHorizontal: ms(14),
    paddingVertical: ms(6),
    borderRadius: ms(14),
    backgroundColor: theme.bgMuted,
    borderWidth: 1,
    borderColor: theme.border,
  },
  langBtnActive: { backgroundColor: theme.primaryWash, borderColor: theme.primary },
  langBtnText: { fontSize: ms(12), fontWeight: '700', color: theme.textSecondary },
  langBtnTextActive: { color: theme.primaryDark },
});
