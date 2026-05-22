/**
 * Service d'authentification
 * Login/Logout avec token persisté dans SecureStore
 */
import * as SecureStore from 'expo-secure-store';
import api, { classifyNetworkError } from './api';
import { STORAGE_KEYS } from '../config';
import type { LoginPayload, LoginResponse, NetworkError } from '../types';

export interface AuthState {
  isAuthenticated: boolean;
  user: LoginResponse['user'] | null;
  token: string | null;
}

/**
 * Authentification auprès du serveur central
 * Stocke le token et les infos utilisateur en SecureStore
 */
export async function login(
  credentials: LoginPayload
): Promise<{ success: true; user: LoginResponse['user'] } | { success: false; error: NetworkError }> {
  try {
    const response = await api.post<any>('/api/auth/token/', credentials);
    const data = response.data;
    
    // Le backend (CustomAuthToken) renvoie les infos à plat (user_id, username, etc.)
    const token = data.token;
    const user = {
      id: data.user_id,
      username: data.username,
      email: data.email,
      role: data.role,
      is_superuser: data.is_superuser,
      allowed_menus: data.allowed_menus,
      can_do_returns: data.can_do_returns,
      can_sell_negative_stock: data.can_sell_negative_stock,
      can_cash_out: data.can_cash_out,
      permissions: data.permissions
    };

    // Persister le token et les infos utilisateur
    await SecureStore.setItemAsync(STORAGE_KEYS.AUTH_TOKEN, token);
    await SecureStore.setItemAsync(STORAGE_KEYS.USER_INFO, JSON.stringify(user));

    console.log(`[Auth] Connexion réussie : ${user.username}`);
    return { success: true, user };
  } catch (error) {
    const networkError = classifyNetworkError(error);
    console.error('[Auth] Échec connexion:', networkError.message);
    return { success: false, error: networkError };
  }
}

/**
 * Déconnexion — supprime le token et les infos utilisateur
 */
export async function logout(): Promise<void> {
  try {
    // Tenter de notifier le serveur (best-effort, on ne bloque pas)
    await api.post('/api/auth/logout/').catch(() => {});
  } finally {
    await SecureStore.deleteItemAsync(STORAGE_KEYS.AUTH_TOKEN);
    await SecureStore.deleteItemAsync(STORAGE_KEYS.USER_INFO);
    console.log('[Auth] Déconnexion effectuée');
  }
}

/**
 * Vérifie l'état d'authentification au démarrage
 * Retourne les infos sauvegardées en local (pas de vérification serveur)
 */
export async function checkAuth(): Promise<AuthState> {
  try {
    const token = await SecureStore.getItemAsync(STORAGE_KEYS.AUTH_TOKEN);
    const userJson = await SecureStore.getItemAsync(STORAGE_KEYS.USER_INFO);

    if (token && userJson) {
      const user = JSON.parse(userJson) as LoginResponse['user'];
      return { isAuthenticated: true, user, token };
    }
  } catch (error) {
    console.warn('[Auth] Erreur vérification auth:', error);
  }

  return { isAuthenticated: false, user: null, token: null };
}

/**
 * Récupère les infos de l'utilisateur courant depuis SecureStore
 */
export async function getCurrentUser(): Promise<LoginResponse['user'] | null> {
  try {
    const userJson = await SecureStore.getItemAsync(STORAGE_KEYS.USER_INFO);
    if (userJson) {
      return JSON.parse(userJson) as LoginResponse['user'];
    }
  } catch (error) {
    console.warn('[Auth] Erreur lecture user:', error);
  }
  return null;
}
