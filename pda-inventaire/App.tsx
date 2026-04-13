import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { LoginScreen, HomeScreen, ScannerScreen } from './src/screens';
import { authService, Inventaire } from './src/services';
import { setUnauthorizedCallback } from './src/services/api';

// Client React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30000,
    },
  },
});

type Screen = 'loading' | 'login' | 'home' | 'scanner';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('loading');
  const [selectedInventaire, setSelectedInventaire] = useState<Inventaire | null>(null);

  // Enregistrer le callback de déconnexion globale
  useEffect(() => {
    setUnauthorizedCallback(() => {
      setSelectedInventaire(null);
      setCurrentScreen('login');
    });
  }, []);

  // Vérifier l'authentification au démarrage
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { isAuthenticated } = await authService.checkAuth();
    setCurrentScreen(isAuthenticated ? 'home' : 'login');
  };

  const handleLoginSuccess = () => {
    setCurrentScreen('home');
  };

  const handleLogout = () => {
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
        <ActivityIndicator size="large" color="#4f46e5" />
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <View style={styles.container}>
        <StatusBar style="light" />
        
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
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1a',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f0f1a',
  },
});
