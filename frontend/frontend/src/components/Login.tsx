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

  // Color constants
  const PHARMA_GREEN = '#10B981'; // Emerald 500 equivalent

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL 
        ? `${String(import.meta.env.VITE_API_BASE_URL).replace(/\/$/, '')}/api-token-auth/`
        : '/api-token-auth/';

      const response = await axios.post(apiBaseUrl, {
        username,
        password
      });

      const { token, is_superuser, allowed_menus, can_cash_out, can_do_returns, can_sell_negative_stock } = response.data;
      login({ username, token, is_superuser, allowed_menus, can_cash_out, can_do_returns, can_sell_negative_stock });
      navigate('/app');
    } catch (err) {
      console.error('Login error:', err);
      setError('Identifiants incorrects. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden font-sans" style={{ background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)' }}>
      
      {/* Animated Background Elements */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        {/* Soft Gradients - Adjusted opacity for dark background */}
        <div className="absolute -top-[20%] -left-[10%] w-[70vw] h-[70vw] bg-emerald-500/10 rounded-full blur-[100px] animate-pulse-slow"></div>
        <div className="absolute top-[40%] -right-[10%] w-[50vw] h-[50vw] bg-teal-500/10 rounded-full blur-[80px] animate-pulse-slow delay-1000"></div>
        <div className="absolute bottom-[-10%] left-[20%] w-[40vw] h-[40vw] bg-cyan-500/10 rounded-full blur-[90px] animate-pulse-slow delay-2000"></div>
      </div>


      {/* Main Card */}
      <div className="relative z-10 w-full max-w-md p-8 mx-4">
        
        {/* Glassmorphism Card */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/10 shadow-2xl rounded-3xl p-8 transition-all duration-500">
          
          {/* Header & Logo */}
          <div className="text-center mb-10">
            <div 
              className="w-20 h-20 mx-auto mb-6 flex items-center justify-center rounded-2xl shadow-lg transform rotate-3 hover:rotate-6 transition-transform duration-300"
              style={{ backgroundColor: PHARMA_GREEN }}
            >
              {/* Medical Cross Icon */}
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 10h-5V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v5H5a1 1 0 00-1 1v2a1 1 0 001 1h5v5a1 1 0 001 1h2a1 1 0 001-1v-5h5a1 1 0 001-1v-2a1 1 0 00-1-1z" />
              </svg>
            </div>
            
            <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2 font-sans">
              PharmaStock
            </h1>
            <p className="text-sm text-gray-400 font-medium tracking-wide uppercase">
              Portail de Gestion Sécurisé
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r shadow-sm animate-fade-in-up">
                <div className="flex">
                  <div className="flex-shrink-0 text-red-500">
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                       <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Inputs */}
            <div className="space-y-5">
              <div className="group">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 ml-1">Utilisateur</label>
                <div className="relative">
                   <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                     <svg className="h-5 w-5 text-gray-500 group-focus-within:text-emerald-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                     </svg>
                   </div>
                   <input
                    type="text"
                    required
                    className="block w-full pl-10 pr-3 py-3 border border-gray-700/50 rounded-xl leading-5 bg-gray-900/50 text-white placeholder-gray-500 focus:outline-none focus:bg-gray-900 focus:ring-2 focus:ring-offset-0 transition-all duration-200 ease-in-out sm:text-sm shadow-inner"
                    style={{ '--tw-ring-color': PHARMA_GREEN } as React.CSSProperties}
                    placeholder="Entrez votre identifiant"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                   />
                </div>
              </div>

              <div className="group">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 ml-1">Mot de passe</label>
                <div className="relative">
                   <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                     <svg className="h-5 w-5 text-gray-500 group-focus-within:text-emerald-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                     </svg>
                   </div>
                   <input
                    type="password"
                    required
                    className="block w-full pl-10 pr-3 py-3 border border-gray-700/50 rounded-xl leading-5 bg-gray-900/50 text-white placeholder-gray-500 focus:outline-none focus:bg-gray-900 focus:ring-2 focus:ring-offset-0 transition-all duration-200 ease-in-out sm:text-sm shadow-inner"
                    style={{ '--tw-ring-color': PHARMA_GREEN } as React.CSSProperties}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                   />
                </div>
              </div>
            </div>

            {/* Action Button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 transform transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                style={{ backgroundColor: PHARMA_GREEN, '--tw-ring-color': PHARMA_GREEN } as React.CSSProperties}
              >
                {loading ? (
                   <div className="flex items-center space-x-2">
                     <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                       <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                       <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                     </svg>
                     <span>Connexion en cours...</span>
                   </div>
                ) : (
                  'Se connecter'
                )}
              </button>
            </div>

          </form>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-gray-500">
          © {new Date().getFullYear()} PharmaStock v2.0 - Tous droits réservés.
        </p>

      </div>
    </div>
  );
}
