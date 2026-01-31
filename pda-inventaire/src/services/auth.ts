import * as SecureStore from 'expo-secure-store';
import api from './api';
import { STORAGE_KEYS } from '../config';

export interface User {
    id: number;
    username: string;
    email: string;
    role: string;
    is_superuser: boolean;
}

// Format de réponse du backend Django
export interface LoginApiResponse {
    token: string;
    user_id: number;
    username: string;
    email: string;
    role: string;
    is_superuser: boolean;
    allowed_menus: string[];
}

export interface LoginResponse {
    token: string;
    user: User;
}

export interface AuthState {
    isAuthenticated: boolean;
    user: User | null;
    token: string | null;
}

class AuthService {
    /**
     * Connexion utilisateur
     */
    async login(username: string, password: string): Promise<LoginResponse> {
        const response = await api.post<LoginApiResponse>('/api/auth/token/', {
            username,
            password,
        });

        const data = response.data;

        // Transformer la réponse API en format User
        const user: User = {
            id: data.user_id,
            username: data.username,
            email: data.email,
            role: data.role,
            is_superuser: data.is_superuser,
        };

        // Stocker le token de manière sécurisée
        await SecureStore.setItemAsync(STORAGE_KEYS.AUTH_TOKEN, data.token);
        await SecureStore.setItemAsync(STORAGE_KEYS.USER_INFO, JSON.stringify(user));

        return { token: data.token, user };
    }

    /**
     * Déconnexion
     */
    async logout(): Promise<void> {
        try {
            await SecureStore.deleteItemAsync(STORAGE_KEYS.AUTH_TOKEN);
            await SecureStore.deleteItemAsync(STORAGE_KEYS.USER_INFO);
        } catch (error) {
            console.warn('Logout error (ignored):', error);
        }
    }

    /**
     * Vérifier si l'utilisateur est connecté
     */
    async checkAuth(): Promise<AuthState> {
        try {
            const token = await SecureStore.getItemAsync(STORAGE_KEYS.AUTH_TOKEN);
            const userJson = await SecureStore.getItemAsync(STORAGE_KEYS.USER_INFO);

            if (!token || !userJson) {
                return { isAuthenticated: false, user: null, token: null };
            }

            const user = JSON.parse(userJson) as User;
            return { isAuthenticated: true, user, token };
        } catch (error) {
            console.error('Erreur vérification auth:', error);
            return { isAuthenticated: false, user: null, token: null };
        }
    }

    /**
     * Récupérer le token stocké
     */
    async getToken(): Promise<string | null> {
        return SecureStore.getItemAsync(STORAGE_KEYS.AUTH_TOKEN);
    }

    /**
     * Récupérer l'utilisateur stocké
     */
    async getUser(): Promise<User | null> {
        try {
            const userJson = await SecureStore.getItemAsync(STORAGE_KEYS.USER_INFO);
            return userJson ? JSON.parse(userJson) : null;
        } catch {
            return null;
        }
    }
}

export const authService = new AuthService();
export default authService;
