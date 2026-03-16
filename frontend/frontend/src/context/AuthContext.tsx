import { createContext, useState, useContext, useEffect, useCallback, type ReactNode } from 'react';
import axios from 'axios';
import type { User } from '../types';
import { safeStorage } from '../utils/storage';

// Définition du type pour le contexte d'authentification
// Ce sont les données et fonctions qui seront accessibles partout dans l'application via useAuth()
interface AuthContextType {
  user: User | null;          // L'utilisateur connecté (ou null si non connecté)
  login: (userData: User) => void; // Fonction pour connecter un utilisateur
  logout: () => void;         // Fonction pour déconnecter
  isAuthenticated: boolean;   // Booléen pratique pour savoir si on est connecté
  loading: boolean;           // État de chargement (utile au démarrage pour vérifier si une session existe)
  getServerDate: () => Date;
  syncTime: (serverTime: string) => void;
}

// Création du contexte React
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Composant Provider qui va envelopper l'application (dans App.tsx généralement)
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // État local pour stocker l'utilisateur connecté
  const [user, setUser] = useState<User | null>(null);
  // État de chargement, initialisé à true le temps de vérifier le localStorage
  const [loading, setLoading] = useState(true);
  const [timeOffset, setTimeOffset] = useState<number>(0);

  // Fonction pour obtenir la date synchronisée avec le serveur
  const getServerDate = useCallback(() => {
    return new Date(Date.now() + timeOffset);
  }, [timeOffset]);

  // Effet qui s'exécute une seule fois au chargement de l'application (mount)
  useEffect(() => {
    // On tente de récupérer les infos de connexion depuis le stockage sécurisé
    const token = safeStorage.getItem('authToken');
    const username = safeStorage.getItem('username');
    const is_superuser = safeStorage.getItem('is_superuser') === 'true';
    const allowed_menus = JSON.parse(safeStorage.getItem('allowed_menus') || '[]');
    const can_do_returns = safeStorage.getItem('can_do_returns') === 'true';
    const can_sell_negative_stock = safeStorage.getItem('can_sell_negative_stock') === 'true';
    const can_cash_out = safeStorage.getItem('can_cash_out') === 'true';
    const can_delete_product = safeStorage.getItem('can_delete_product') === 'true';
    const can_adjust_stock = safeStorage.getItem('can_adjust_stock') === 'true';
    const can_delete_fournisseur = safeStorage.getItem('can_delete_fournisseur') === 'true';
    const can_delete_commande = safeStorage.getItem('can_delete_commande') === 'true';
    const can_close_commande = safeStorage.getItem('can_close_commande') === 'true';
    const can_generate_coupon = safeStorage.getItem('can_generate_coupon') === 'true';

    const storedOffset = safeStorage.getItem('timeOffset');
    if (storedOffset) {
      setTimeOffset(parseInt(storedOffset, 10));
    }

    // Si un token et un username existent, on restaure la session
    if (token && username) {
      setUser({ 
        username, 
        token, 
        is_superuser, 
        allowed_menus,
        can_do_returns,
        can_sell_negative_stock,
        can_cash_out,
        can_delete_product,
        can_adjust_stock,
        can_delete_fournisseur,
        can_delete_commande,
        can_close_commande,
        can_generate_coupon,
        profile: {
          can_generate_coupon,
          can_close_commande,
          role: 'VENDEUR' // Default
        }
      });
      // On configure axios pour inclure ce token dans toutes les futures requêtes HTTP
      axios.defaults.headers.common['Authorization'] = `Token ${token}`;
    }
    // On indique que le chargement initial est terminé
    setLoading(false);
  }, []);

  // Fonction pour synchroniser le décalage temporel
  const syncTime = useCallback((serverTimeStr: string) => {
    const serverTime = new Date(serverTimeStr).getTime();
    const localTime = Date.now();
    const offset = serverTime - localTime;
    setTimeOffset(offset);
    safeStorage.setItem('timeOffset', String(offset));
  }, []);

  // Fonction de connexion appelée après un succès login (ex: depuis Login.tsx)
  const login = useCallback((userData: User) => {
    // Calculer le décalage temporel si l'heure serveur est fournie
    if (userData.server_time) {
      syncTime(userData.server_time);
    }

    // 1. On sauvegarde tout dans le stockage sécurisé
    safeStorage.setItem('authToken', userData.token || '');
    safeStorage.setItem('username', userData.username);
    safeStorage.setItem('is_superuser', String(userData.is_superuser));
    safeStorage.setItem('allowed_menus', JSON.stringify(userData.allowed_menus));
    safeStorage.setItem('can_do_returns', String(userData.can_do_returns || false));
    safeStorage.setItem('can_sell_negative_stock', String(userData.can_sell_negative_stock || false));
    safeStorage.setItem('can_cash_out', String(userData.can_cash_out ?? true));
    safeStorage.setItem('can_delete_product', String(userData.can_delete_product || false));
    safeStorage.setItem('can_adjust_stock', String(userData.can_adjust_stock || false));
    safeStorage.setItem('can_delete_fournisseur', String(userData.can_delete_fournisseur || false));
    safeStorage.setItem('can_delete_commande', String(userData.can_delete_commande || userData.profile?.can_delete_commande || false));
    safeStorage.setItem('can_close_commande', String(userData.can_close_commande || userData.profile?.can_close_commande || false));
    safeStorage.setItem('can_generate_coupon', String(userData.can_generate_coupon || userData.profile?.can_generate_coupon || false));
    
    // 2. On met à jour l'état de l'application
    setUser(userData);
    
    // 3. On configure le header Authorization pour les requêtes API
    axios.defaults.headers.common['Authorization'] = `Token ${userData.token || ''}`;
  }, []);

  // Fonction de déconnexion
  const logout = useCallback(async () => {
    // 1. On tente d'informer le serveur de la déconnexion pour le suivi
    try {
      const workstation = localStorage.getItem('zenith_workstation');
      await axios.post('/api/auth/logout/', { workstation });
    } catch (err) {
      console.warn('Erreur lors de l\'enregistrement de la déconnexion au serveur:', err);
    }

    // 2. On nettoie le stockage
    safeStorage.clear('session');
    
    // 3. On remet l'utilisateur à null
    setUser(null);
    
    // 4. On retire le header Authorization d'axios
    delete axios.defaults.headers.common['Authorization'];
  }, []);

  return (
    // On rend le contexte disponible pour tous les enfants
    // isAuthenticated est calculé dynamiquement : vrai si 'user' n'est pas null
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user, loading, getServerDate, syncTime }}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook personnalisé pour utiliser le contexte d'authentification plus facilement
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
