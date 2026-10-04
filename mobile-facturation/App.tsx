import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Storage from 'expo-sqlite/kv-store';
import { LoginScreen } from './src/screens/LoginScreen';
import { FacturationScreen } from './src/screens/FacturationScreen';
import { HistoriqueScreen } from './src/screens/HistoriqueScreen';
import { useAuthStore } from './src/stores/useAuthStore';
import { useSettingsStore } from './src/stores/useSettingsStore';
import { useCartStore, type CartDraft } from './src/stores/useCartStore';
import { usePendingStore } from './src/stores/usePendingStore';
import { getMe, ensurePosteVente } from './src/services/api';
import { theme } from './src/config/theme';

const Stack = createNativeStackNavigator();

export default function App() {
  const { isAuthenticated } = useAuthStore();
  const [restoring, setRestoring] = useState(true);

  // Brouillon panier : une seule hydration par vendeur (draft.cart.<user>).
  // La promesse est partagée : le boot et l'effet ci-dessous peuvent
  // appeler hydrateDraft en même temps sans double restauration.
  const hydratedFor = useRef<string | null>(null);
  const hydratePromise = useRef<Promise<void> | null>(null);
  const hydrateDraft = useCallback((user: string): Promise<void> => {
    if (hydratedFor.current === user && hydratePromise.current) {
      return hydratePromise.current;
    }
    hydratedFor.current = user;
    hydratePromise.current = (async () => {
      if (Platform.OS === 'web') return;
      try {
        const raw = await Storage.getItemAsync(`draft.cart.${user}`);
        const draft = raw ? (JSON.parse(raw) as CartDraft) : null;
        if (draft && Array.isArray(draft.lines) && draft.lines.length > 0) {
          useCartStore.getState().hydrate(draft);
        } else {
          // Pas de brouillon pour ce vendeur → panier vide (poste partagé :
          // évite de retrouver les lignes du vendeur précédent).
          useCartStore.getState().clear();
        }
      } catch {}
      // Ventes en attente du vendeur (stockage local, comme le web).
      await usePendingStore.getState().load();
    })();
    return hydratePromise.current;
  }, []);

  // Boot : settings → session → brouillon → getMe → poste de vente
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await useSettingsStore.getState().load();
        const restored = await useAuthStore.getState().restoreSession();
        if (restored) {
          const user = useAuthStore.getState().username;
          if (user) await hydrateDraft(user);
          try {
            const me = await getMe();
            if (cancelled) return;
            useAuthStore.getState().setMaxDiscountRate(
              me.is_superuser ? 100 : Number(me.profile?.max_discount_rate) || 0
            );
            // Poste de vente silencieux : le badge en-tête gère le retry.
            try {
              const poste = await ensurePosteVente();
              if (!cancelled) useAuthStore.getState().setPosteVente(poste);
            } catch {}
          } catch (err) {
            const status = (err as { response?: { status?: number } })?.response?.status;
            // 401 → l'intercepteur de api.ts a déjà déclenché le logout,
            // l'écran de login apparaît tout seul.
            if (status !== 401 && !cancelled) {
              Alert.alert('Session', 'Serveur injoignable — session conservée, les données seront rechargées au prochain accès');
            }
          }
        }
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();
    return () => { cancelled = true; };
  }, [hydrateDraft]);

  // Login frais (isAuthenticated passe à true) : restaurer le brouillon du
  // vendeur qui vient de se connecter. Couvre aussi la session restaurée
  // au boot (même promesse partagée que ci-dessus).
  useEffect(() => {
    if (!isAuthenticated) return;
    const user = useAuthStore.getState().username;
    if (user) void hydrateDraft(user);
  }, [isAuthenticated, hydrateDraft]);

  if (restoring) {
    return (
      <View style={styles.restoring}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Login">
            {(props) => <LoginScreen {...props} onLoginSuccess={() => {}} />}
          </Stack.Screen>
        ) : (
          <>
            <Stack.Screen name="Facturation">
              {(props) => <FacturationScreen {...props} onLogout={() => {}} />}
            </Stack.Screen>
            <Stack.Screen name="Historique">
              {(props) => <HistoriqueScreen {...props} onBack={props.navigation.goBack} />}
            </Stack.Screen>
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  restoring: {
    flex: 1,
    backgroundColor: theme.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
