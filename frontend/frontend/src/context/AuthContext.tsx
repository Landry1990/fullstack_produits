import { createContext, useState, useContext, useEffect, type ReactNode } from 'react';
import axios from 'axios';

// Définition de la structure de l'objet User
// Cela permet de typer les données de l'utilisateur connecté
interface User {
  username: string;
  token: string;      // Le token d'authentification (ex: Token JWT ou DRF)
  is_superuser: boolean; // Indique si l'utilisateur est administrateur
  allowed_menus: string[]; // Liste des menus auxquels l'utilisateur a accès
  can_do_returns?: boolean;
  can_sell_negative_stock?: boolean;
  can_cash_out?: boolean; // Autorisé à encaisser dans la caisse centralisée
}

// Définition du type pour le contexte d'authentification
// Ce sont les données et fonctions qui seront accessibles partout dans l'application via useAuth()
interface AuthContextType {
  user: User | null;          // L'utilisateur connecté (ou null si non connecté)
  login: (userData: User) => void; // Fonction pour connecter un utilisateur
  logout: () => void;         // Fonction pour déconnecter
  isAuthenticated: boolean;   // Booléen pratique pour savoir si on est connecté
  loading: boolean;           // État de chargement (utile au démarrage pour vérifier si une session existe)
}

// Création du contexte React
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Composant Provider qui va envelopper l'application (dans App.tsx généralement)
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // État local pour stocker l'utilisateur connecté
  const [user, setUser] = useState<User | null>(null);
  // État de chargement, initialisé à true le temps de vérifier le localStorage
  const [loading, setLoading] = useState(true);

  // Effet qui s'exécute une seule fois au chargement de l'application (mount)
  useEffect(() => {
    // On tente de récupérer les infos de connexion depuis le localStorage du navigateur
    // Cela permet de garder l'utilisateur connecté même s'il rafraîchit la page
    const token = localStorage.getItem('authToken');
    const username = localStorage.getItem('username');
    const is_superuser = localStorage.getItem('is_superuser') === 'true';
    const allowed_menus = JSON.parse(localStorage.getItem('allowed_menus') || '[]');
    const can_do_returns = localStorage.getItem('can_do_returns') === 'true';
    const can_sell_negative_stock = localStorage.getItem('can_sell_negative_stock') === 'true';
    const can_cash_out = localStorage.getItem('can_cash_out') === 'true';

    // Si un token et un username existent, on restaure la session
    if (token && username) {
      setUser({ 
        username, 
        token, 
        is_superuser, 
        allowed_menus,
        can_do_returns,
        can_sell_negative_stock,
        can_cash_out
      });
      // On configure axios pour inclure ce token dans toutes les futures requêtes HTTP
      axios.defaults.headers.common['Authorization'] = `Token ${token}`;
    }
    // On indique que le chargement initial est terminé
    setLoading(false);
  }, []);

  // Fonction de connexion appelée après un succès login (ex: depuis Login.tsx)
  const login = (userData: User) => {
    // 1. On sauvegarde tout dans le localStorage pour la persistance
    localStorage.setItem('authToken', userData.token);
    localStorage.setItem('username', userData.username);
    localStorage.setItem('is_superuser', String(userData.is_superuser));
    localStorage.setItem('allowed_menus', JSON.stringify(userData.allowed_menus));
    localStorage.setItem('can_do_returns', String(userData.can_do_returns || false));
    localStorage.setItem('can_sell_negative_stock', String(userData.can_sell_negative_stock || false));
    localStorage.setItem('can_cash_out', String(userData.can_cash_out ?? true));
    
    // 2. On met à jour l'état de l'application
    setUser(userData);
    
    // 3. On configure le header Authorization pour les requêtes API
    axios.defaults.headers.common['Authorization'] = `Token ${userData.token}`;
  };

  // Fonction de déconnexion
  const logout = () => {
    // 1. On nettoie le localStorage
    localStorage.removeItem('authToken');
    localStorage.removeItem('username');
    localStorage.removeItem('is_superuser');
    localStorage.removeItem('allowed_menus');
    localStorage.removeItem('can_do_returns');
    localStorage.removeItem('can_sell_negative_stock');
    localStorage.removeItem('can_cash_out');
    
    // 2. On remet l'utilisateur à null
    setUser(null);
    
    // 3. On retire le header Authorization d'axios
    delete axios.defaults.headers.common['Authorization'];
  };

  return (
    // On rend le contexte disponible pour tous les enfants
    // isAuthenticated est calculé dynamiquement : vrai si 'user' n'est pas null
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user, loading }}>
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
