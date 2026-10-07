import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View, StyleSheet } from 'react-native';

import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import ScannerScreen from './src/screens/ScannerScreen';
import { useAuthStore } from './src/stores/useAuthStore';
import { useSettingsStore } from './src/stores/useSettingsStore';
import { loadStoredLanguage } from './src/i18n';
import { theme } from './src/config/theme';
import type { Inventaire } from './src/services/inventaire';

type Screen = 'loading' | 'login' | 'home' | 'scanner';

export default function App() {
  const { isAuthenticated } = useAuthStore();
  const [currentScreen, setCurrentScreen] = useState<Screen>('loading');
  const [selectedInventaire, setSelectedInventaire] = useState<Inventaire | null>(null);

  // Vérifier l'authentification au démarrage
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      await useSettingsStore.getState().load();
      await loadStoredLanguage();
      const restored = await useAuthStore.getState().restoreSession();
      setCurrentScreen(restored ? 'home' : 'login');
    } catch (error) {
      console.error('Erreur vérification auth:', error);
      setCurrentScreen('login');
    }
  };

  const handleLoginSuccess = () => {
    setCurrentScreen('home');
  };

  const handleLogout = () => {
    setSelectedInventaire(null);
    setCurrentScreen('login');
  };

  const handleSelectInventaire = (inventaire: Inventaire) => {
    setSelectedInventaire(inventaire);
    setCurrentScreen('scanner');
  };

  const handleBackToHome = () => {
    setSelectedInventaire(null);
    setCurrentScreen('home');
  };

  // Écran de chargement
  if (currentScreen === 'loading') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={theme.primary} />
        <StatusBar style="dark" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {currentScreen === 'login' && (
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      )}
      
      {currentScreen === 'home' && (
        <HomeScreen 
          onSelectInventaire={handleSelectInventaire}
          onLogout={handleLogout}
        />
      )}
      
      {currentScreen === 'scanner' && selectedInventaire && (
        <ScannerScreen 
          inventaire={selectedInventaire}
          onBack={handleBackToHome}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.bg,
  },
});
