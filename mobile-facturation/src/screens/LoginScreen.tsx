import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { useAuthStore } from '../stores/useAuthStore';
import { login, getMe, ensurePosteVente } from '../services/api';
import { theme } from '../config/theme';

export function LoginScreen({ onLoginSuccess }: { onLoginSuccess: () => void }) {
  const { serverUrl, setServerUrl, setAuth, setMaxDiscountRate, setPosteVente } = useAuthStore();
  const [url, setUrl] = useState(serverUrl);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!url || !password) {
      Alert.alert('Erreur', "L'adresse du serveur et le mot de passe sont requis");
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
        setMaxDiscountRate(me.is_superuser ? 100 : Number(me.profile?.max_discount_rate) || 0);
      } catch {
        setMaxDiscountRate(0);
      }
      // Point de vente : réutilise un poste actif ou active la 1re
      // définition disponible. Jamais bloquant pour le login.
      try {
        setPosteVente(await ensurePosteVente());
      } catch (err: unknown) {
        if ((err as Error)?.message === 'NO_POSTE_DISPONIBLE') {
          Alert.alert('Aucun point de vente', "Aucun point de vente n'est disponible. Demandez à l'administrateur d'en créer un dans Paramètres → Points de vente.");
        } else {
          const detail = (err as { response?: { data?: { detail?: string } }; message?: string })?.response?.data?.detail
            || (err as Error)?.message || '';
          Alert.alert('Point de vente', `Impossible d'ouvrir un point de vente : ${detail}`);
        }
      }
      onLoginSuccess();
    } catch (err: any) {
      console.error('[Login] Erreur:', err);
      const status = err?.response?.status;
      let msg: string;
      if (status === 400) {
        msg = 'Mot de passe incorrect';
      } else if (status === 429) {
        msg = err?.response?.data?.detail || 'Trop de tentatives — réessayez dans une minute';
      } else {
        msg = "Serveur injoignable — vérifiez l'adresse et le réseau";
      }
      Alert.alert('Erreur de connexion', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Connexion</Text>
        <Text style={styles.subtitle}>Tablette Facturation</Text>
        <Text style={styles.hint}>Saisissez votre mot de passe — votre compte est reconnu automatiquement</Text>

        <TextInput
          style={styles.input}
          placeholder="http://192.168.1.181"
          placeholderTextColor={theme.textMuted}
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          keyboardType="default"
        />

        <TextInput
          style={styles.input}
          placeholder="Mot de passe"
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
            <Text style={styles.buttonText}>Se connecter</Text>
          )}
        </TouchableOpacity>
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
    padding: 24,
  },
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
});
