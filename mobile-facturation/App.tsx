import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View, StyleSheet, Alert } from 'react-native';

import {
  ServerSetupScreen,
  LoginScreen,
  HomeScreen,
  SaleScreen,
  CartScreenV2,
  InvoiceListScreen,
  InvoiceDetailScreen,
} from './src/screens';
import { authService } from './src/services';
import * as apiSettings from './src/services/api';
import { useAuthStore, useConnectionStore } from './src/stores';
import { getDatabase, closeDatabase } from './src/database';
import type { Invoice } from './src/types';

// Types d'écrans simples pour la navigation (sans react-navigation pour plus de légèreté ici)
type Screen =
  | 'loading'
  | 'server_setup'
  | 'login'
  | 'home'
  | 'sale'
  | 'cart'
  | 'invoice_list'
  | 'invoice_detail';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('loading');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const { isAuthenticated, setAuthenticated, setUnauthenticated } = useAuthStore();
  const { isServerConfigured, setServerUrl } = useConnectionStore();

  // ─── Initialisation ─────────────────────────────────────

  useEffect(() => {
    initializeApp();

    return () => {
      closeDatabase();
    };
  }, []);

  const initializeApp = async () => {
    try {
      // 1. Initialiser la base de données (création tables, etc.)
      await getDatabase();

      // 2. Vérifier si l'URL du serveur est configurée
      const isUrlLoaded = await apiSettings.loadBaseURL();
      if (isUrlLoaded) {
        setServerUrl(apiSettings.getBaseURL());
      }

      // 3. Configurer le callback de déconnexion globale (401)
      apiSettings.setUnauthorizedCallback(() => {
        setUnauthenticated();
        setCurrentScreen('login');
      });

      // 4. Vérifier l'authentification
      const authState = await authService.checkAuth();
      if (authState.isAuthenticated && authState.user && authState.token) {
        setAuthenticated(authState.user, authState.token);
      }

      // 5. Routage initial
      if (!isUrlLoaded) {
        setCurrentScreen('server_setup');
      } else if (authState.isAuthenticated) {
        setCurrentScreen('home');
      } else {
        setCurrentScreen('login');
      }
    } catch (error) {
      console.error('[App] Erreur initialisation:', error);
      Alert.alert('Erreur critique', 'Impossible d\'initialiser l\'application.');
    }
  };

  // ─── Routage manuel (selon état) ────────────────────────

  useEffect(() => {
    if (currentScreen !== 'loading' && currentScreen !== 'server_setup') {
      if (!isAuthenticated && currentScreen !== 'login') {
        setCurrentScreen('login');
      } else if (isAuthenticated && currentScreen === 'login') {
        setCurrentScreen('home');
      }
    }
  }, [isAuthenticated, currentScreen]);

  const handleServerConfigured = () => {
    setCurrentScreen(isAuthenticated ? 'home' : 'login');
  };

  // ─── Rendu principal ────────────────────────────────────

  if (currentScreen === 'loading') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#10b981" />
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {currentScreen === 'server_setup' && (
        <ServerSetupScreen onConfigured={handleServerConfigured} />
      )}

      {currentScreen === 'login' && <LoginScreen />}

      {currentScreen === 'home' && (
        <HomeScreen
          onNavigateToSale={() => setCurrentScreen('sale')}
          onNavigateToInvoices={() => setCurrentScreen('invoice_list')}
        />
      )}

      {currentScreen === 'sale' && (
        <SaleScreen
          onBack={() => setCurrentScreen('home')}
          onNavigateToCart={() => setCurrentScreen('cart')}
        />
      )}

      {currentScreen === 'cart' && (
        <CartScreenV2
          onBack={() => setCurrentScreen('sale')}
          onValidationSuccess={() => setCurrentScreen('home')}
        />
      )}

      {currentScreen === 'invoice_list' && (
        <InvoiceListScreen
          onBack={() => setCurrentScreen('home')}
          onInvoicePress={(invoice) => {
            setSelectedInvoice(invoice);
            setCurrentScreen('invoice_detail');
          }}
        />
      )}

      {currentScreen === 'invoice_detail' && selectedInvoice && (
        <InvoiceDetailScreen
          invoice={selectedInvoice}
          onBack={() => {
            setSelectedInvoice(null);
            setCurrentScreen('invoice_list');
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
});
