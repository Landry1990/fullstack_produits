import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { useAuthStore } from '../stores';
import { login } from '../services';

export function LoginScreen({ onLoginSuccess }: { onLoginSuccess: () => void }) {
  const { serverUrl, setServerUrl, setAuth } = useAuthStore();
  const [url, setUrl] = useState(serverUrl);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!url || !username || !password) {
      Alert.alert('Erreur', 'Tous les champs sont requis');
      return;
    }

    setLoading(true);
    try {
      let cleanUrl = url.trim().replace(/\/$/, '');
      // Auto-correction : si le port est 80 (nginx), corriger en 8000 (Django)
      if (cleanUrl.match(/:80$/)) {
        cleanUrl = cleanUrl.replace(/:80$/, ':8000');
        console.log('[Login] Port corrigé:', cleanUrl);
      }
      // Si aucun port spécifié, ajouter :8000 par défaut
      if (!cleanUrl.match(/:\d+$/)) {
        cleanUrl = `${cleanUrl}:8000`;
        console.log('[Login] Port ajouté:', cleanUrl);
      }
      console.log('[Login] Tentative connexion vers:', cleanUrl);
      setServerUrl(cleanUrl);
      const token = await login(cleanUrl, username, password);
      console.log('[Login] Connexion réussie');
      setAuth(token, username);
      onLoginSuccess();
    } catch (err: any) {
      console.error('[Login] Erreur:', err);
      const msg = err?.response?.data?.detail || err?.message || 'Impossible de se connecter';
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

        <TextInput
          style={styles.input}
          placeholder="http://192.168.1.181:8000"
          placeholderTextColor="#64748b"
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          keyboardType="default"
        />

        <TextInput
          style={styles.input}
          placeholder="Nom d'utilisateur"
          placeholderTextColor="#64748b"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />

        <TextInput
          style={styles.input}
          placeholder="Mot de passe"
          placeholderTextColor="#64748b"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
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
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  title: { fontSize: 24, fontWeight: '700', color: '#f1f5f9', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#64748b', marginBottom: 24 },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    color: '#f1f5f9',
    fontSize: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  button: {
    backgroundColor: '#6366f1',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
