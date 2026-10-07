import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Platform, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Storage from 'expo-sqlite/kv-store';
import { LoginScreen } from './src/screens/LoginScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { FacturationScreen } from './src/screens/FacturationScreen';
import { HistoriqueScreen } from './src/screens/HistoriqueScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { AjustementScreen } from './src/screens/AjustementScreen';
import { SignalementScreen } from './src/screens/SignalementScreen';
import { EntreeStockScreen } from './src/screens/EntreeStockScreen';
import { LockScreen } from './src/components/LockScreen';
import { useAuthStore } from './src/stores/useAuthStore';
import { useSettingsStore } from './src/stores/useSettingsStore';
import { useLockStore } from './src/stores/useLockStore';
import { useCartStore, type CartDraft } from './src/stores/useCartStore';
import { usePendingStore } from './src/stores/usePendingStore';
import { getMe, ensurePosteVente } from './src/services/api';
import { ensureClientDivers } from './src/services/clientDivers';
import { theme } from './src/config/theme';
import i18n from './src/i18n';

const Stack = createNativeStackNavigator();

export default function App() {
  const { isAuthenticated } = useAuthStore();
  const locked = useLockStore((s) => s.locked);
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
          if (user) {
            // Session restaurée sans saisie de mot de passe → si un PIN
            // est défini pour ce vendeur, l'app démarre verrouillée.
            await useLockStore.getState().loadFor(user);
            useLockStore.getState().lock();
            await hydrateDraft(user);
          }
          try {
            const me = await getMe();
            if (cancelled) return;
            useAuthStore.getState().setUserId(me.id);
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
              Alert.alert(i18n.t('app.session_title'), i18n.t('app.server_down'));
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
    if (!isAuthenticated) {
      useLockStore.getState().reset();
      return;
    }
    const user = useAuthStore.getState().username;
    if (user) {
      // Client « comptoir » (CLIENTS DIVERS) auto-sélectionné après
      // restauration du brouillon — même convention que le web ; ignoré
      // si le brouillon avait déjà un client.
      void hydrateDraft(user).then(() => ensureClientDivers());
      // Login frais : charge l'état PIN du vendeur SANS verrouiller —
      // le mot de passe vient d'être saisi (session restaurée : c'est le
      // boot ci-dessus qui verrouille).
      void useLockStore.getState().loadFor(user);
    }
  }, [isAuthenticated, hydrateDraft]);

  // Verrouillage PIN au retour de veille : 'background'/'inactive'
  // mémorise l'heure de sortie ; au retour 'active', si le délai est
  // dépassé → écran de verrouillage (délai 0 = verrouillage immédiat).
  const bgAt = useRef<number | null>(null);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        if (bgAt.current === null) bgAt.current = Date.now();
      } else if (state === 'active' && bgAt.current !== null) {
        const { pinSet, delaySec, loaded } = useLockStore.getState();
        const elapsed = Date.now() - bgAt.current;
        bgAt.current = null;
        if (loaded && pinSet && elapsed >= delaySec * 1000
            && useAuthStore.getState().isAuthenticated) {
          useLockStore.getState().lock();
        }
      }
    });
    return () => sub.remove();
  }, []);

  if (restoring) {
    return (
      <View style={styles.restoring}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <NavigationContainer>
        <StatusBar style="dark" />
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {!isAuthenticated ? (
            <Stack.Screen name="Login">
              {(props) => <LoginScreen {...props} onLoginSuccess={() => {}} />}
            </Stack.Screen>
          ) : (
            <>
              <Stack.Screen name="Home">
                {(props) => <HomeScreen {...props} />}
              </Stack.Screen>
              <Stack.Screen name="Facturation">
                {(props) => <FacturationScreen {...props} />}
              </Stack.Screen>
              <Stack.Screen name="Historique">
                {(props) => <HistoriqueScreen {...props} onBack={props.navigation.goBack} />}
              </Stack.Screen>
              <Stack.Screen name="Dashboard">
                {(props) => <DashboardScreen {...props} onBack={props.navigation.goBack} />}
              </Stack.Screen>
              <Stack.Screen name="Ajustement">
                {(props) => <AjustementScreen {...props} onBack={props.navigation.goBack} />}
              </Stack.Screen>
              <Stack.Screen name="Signalement">
                {(props) => <SignalementScreen {...props} onBack={props.navigation.goBack} />}
              </Stack.Screen>
              <Stack.Screen name="EntreeStock">
                {(props) => <EntreeStockScreen {...props} onBack={props.navigation.goBack} />}
              </Stack.Screen>
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
      {/* Verrouillage PIN — recouvre tout l'app tant que locked */}
      {locked && <LockScreen />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  restoring: {
    flex: 1,
    backgroundColor: theme.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
