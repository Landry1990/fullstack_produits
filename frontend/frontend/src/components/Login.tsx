import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Use the configured API base URL or default to relative path
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL 
        ? `${String(import.meta.env.VITE_API_BASE_URL).replace(/\/$/, '')}/api-token-auth/`
        : '/api-token-auth/';

      const response = await axios.post(apiBaseUrl, {
        username,
        password
      });

      const { token, is_superuser, allowed_menus } = response.data;
      login({ username, token, is_superuser, allowed_menus });
      navigate('/');
    } catch (err) {
      console.error('Login error:', err);
      setError('Identifiants incorrects. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center">
      <div className="card w-full max-w-sm shadow-2xl bg-base-100">
        <div className="card-body">
          <div className="text-center mb-4">
            <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center text-primary-content text-2xl font-bold mx-auto mb-2">
              P
            </div>
            <h2 className="card-title justify-center text-2xl">PharmaStock</h2>
            <p className="text-base-content/60">Connexion à votre espace</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="alert alert-error text-sm py-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span>{error}</span>
              </div>
            )}

            <div className="form-control">
              <label className="label">
                <span className="label-text">Nom d'utilisateur</span>
              </label>
              <input 
                type="text" 
                placeholder="admin" 
                className="input input-bordered" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Mot de passe</span>
              </label>
              <input 
                type="password" 
                placeholder="••••••••" 
                className="input input-bordered" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="form-control mt-6">
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? <span className="loading loading-spinner"></span> : 'Se connecter'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
