import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import axios from 'axios';

interface User {
  username: string;
  token: string;
  is_superuser: boolean;
  allowed_menus: string[];
}

interface AuthContextType {
  user: User | null;
  login: (userData: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const username = localStorage.getItem('username');
    const is_superuser = localStorage.getItem('is_superuser') === 'true';
    const allowed_menus = JSON.parse(localStorage.getItem('allowed_menus') || '[]');

    if (token && username) {
      setUser({ username, token, is_superuser, allowed_menus });
      axios.defaults.headers.common['Authorization'] = `Token ${token}`;
    }
    setLoading(false);
  }, []);

  const login = (userData: User) => {
    localStorage.setItem('authToken', userData.token);
    localStorage.setItem('username', userData.username);
    localStorage.setItem('is_superuser', String(userData.is_superuser));
    localStorage.setItem('allowed_menus', JSON.stringify(userData.allowed_menus));
    
    setUser(userData);
    axios.defaults.headers.common['Authorization'] = `Token ${userData.token}`;
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('username');
    localStorage.removeItem('is_superuser');
    localStorage.removeItem('allowed_menus');
    setUser(null);
    delete axios.defaults.headers.common['Authorization'];
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
