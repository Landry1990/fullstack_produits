import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import ZenithLogo from './ZenithLogo';
import { User, Lock, ArrowRight, Loader2, AlertCircle, Monitor } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function Login() {
  const { t } = useTranslation(['auth', 'common']);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  // Workstation naming logic
  const getDeviceType = () => {
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) return "TABLET";
    if (/Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|NetFront|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) return "MOBILE";
    return "PC";
  };

  const [workstationName, setWorkstationName] = useState(() => {
    const saved = localStorage.getItem('zenith_workstation');
    if (saved) return saved;
    const type = getDeviceType();
    const randomId = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${type}-${randomId}`;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL 
        ? `${String(import.meta.env.VITE_API_BASE_URL).replace(/\/$/, '')}/api-token-auth/`
        : '/api-token-auth/';

      // Persist the current workstation name
      localStorage.setItem('zenith_workstation', workstationName);

      const response = await axios.post(apiBaseUrl, {
        username,
        password,
        workstation: workstationName
      });

      const { token, is_superuser, allowed_menus, can_cash_out, can_do_returns, can_sell_negative_stock } = response.data;
      login({ username, token, is_superuser, allowed_menus, can_cash_out, can_do_returns, can_sell_negative_stock });
      navigate('/app');
    } catch (err) {
      console.error('Login error:', err);
      if (axios.isAxiosError(err)) {
        if (!err.response) {
          setError(t('common:messages.server_unreachable'));
        } else if (err.response.status === 400 || err.response.status === 401) {
          setError(t('common:messages.login_invalid'));
        } else if (err.response.status === 403) {
           setError(t('common:messages.forbidden'));
        } else if (err.response.status >= 500) {
          setError(t('common:messages.server_error'));
        } else {
          setError(t('common:messages.error_generic'));
        }
      } else {
        setError(t('common:messages.error_generic'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-[100dvh] flex items-center justify-center overflow-x-hidden overflow-y-auto font-sans bg-slate-950 p-4">
      
      {/* Cinematic Background Elements */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[60vw] h-[60vw] bg-emerald-500/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-blue-600/10 rounded-full blur-[100px] animate-pulse delay-700"></div>
        <div className="absolute top-[30%] right-[20%] w-[30vw] h-[30vw] bg-indigo-500/5 rounded-full blur-[80px] animate-pulse delay-1000"></div>
      </div>

      {/* Main Glassmorphic Container */}
      <div className="relative z-10 w-full max-w-[min(420px,100%)] group my-auto">
        
        {/* Decorative elements outside the card */}
        <div className="absolute -top-4 -right-4 w-24 h-24 bg-emerald-500/10 blur-xl rounded-full group-hover:bg-emerald-500/20 transition-colors duration-500 hidden sm:block"></div>
        <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-blue-500/10 blur-xl rounded-full group-hover:bg-blue-500/20 transition-colors duration-500 hidden sm:block"></div>

        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-[1.5rem] sm:rounded-[2.5rem] p-5 sm:p-10 transition-all duration-300 hover:border-white/20">
          
          {/* Header & Identity */}
          <div className="text-center mb-5 sm:mb-10">
            <div className="relative inline-block mb-3 sm:mb-6">
              <div className="absolute inset-0 bg-emerald-500/20 blur-2xl rounded-full animate-pulse"></div>
              <div className="relative w-16 h-16 sm:w-24 sm:h-24 flex items-center justify-center rounded-[1rem] sm:rounded-3xl bg-slate-900/50 backdrop-blur-md border border-white/10 shadow-inner transform rotate-6 transition-transform hover:rotate-12 duration-500">
                <ZenithLogo variant={1} size={40} className="sm:hidden" />
                <ZenithLogo variant={1} size={56} className="hidden sm:block" />
              </div>
            </div>
            
            <h1 className="text-xl sm:text-4xl font-black text-white tracking-tighter uppercase mb-1 sm:mb-2">
              Zenith
            </h1>
            <div className="flex items-center justify-center gap-2">
              <div className="h-px w-6 sm:w-8 bg-gradient-to-r from-transparent to-white/20"></div>
              <p className="text-[9px] sm:text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">
                {t('subtitle')}
              </p>
              <div className="h-px w-6 sm:w-8 bg-gradient-to-l from-transparent to-white/20"></div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-6">
            
            {/* Error Message */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                <p className="text-xs font-bold text-red-200">{error}</p>
              </div>
            )}

            {/* Inputs Container */}
            <div className="space-y-4">
              <div className="group/input">
                <label className="block text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-2 ml-1">{t('username')}</label>
                <div className="relative">
                   <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-white/20 group-focus-within/input:text-emerald-500 transition-colors duration-200">
                     <User className="h-4 w-4" />
                   </div>
                   <input
                    type="text"
                    required
                    className="block w-full pl-11 sm:pl-12 pr-4 py-3 sm:py-4 rounded-xl sm:rounded-2xl bg-white/[0.03] border border-white/5 text-white text-sm focus:outline-none focus:bg-white/[0.05] focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 transition-all duration-300 placeholder-white/10"
                    placeholder="ADMIN"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                   />
                </div>
              </div>

              <div className="group/input">
                <label className="block text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-2 ml-1">{t('password')}</label>
                <div className="relative">
                   <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-white/20 group-focus-within/input:text-emerald-500 transition-colors duration-200">
                     <Lock className="h-4 w-4" />
                   </div>
                   <input
                    type="password"
                    required
                    className="block w-full pl-11 sm:pl-12 pr-4 py-3 sm:py-4 rounded-xl sm:rounded-2xl bg-white/[0.03] border border-white/5 text-white text-sm focus:outline-none focus:bg-white/[0.05] focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 transition-all duration-300 placeholder-white/10 shadow-inner"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                   />
                </div>
              </div>

              {/* Workstation Identification */}
              <div className="group/input bg-white/[0.02] border border-white/5 p-3 sm:p-4 rounded-xl sm:rounded-2xl space-y-2 sm:space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] ml-1">
                    {t('workstation_label')}
                  </label>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-500/60 transition-colors group-hover/input:text-emerald-500">
                    <Monitor className="w-3 h-3" />
                    <span>{getDeviceType()}</span>
                  </div>
                </div>
                
                <div className="relative">
                  <input
                    type="text"
                    className="block w-full px-4 py-3 rounded-xl bg-slate-950/50 border border-white/5 text-white text-xs focus:outline-none focus:border-emerald-500/30 transition-all duration-300 placeholder-white/20"
                    placeholder={t('workstation_placeholder')}
                    value={workstationName}
                    onChange={(e) => setWorkstationName(e.target.value)}
                  />
                </div>
                <p className="text-[9px] text-white/20 ml-1 italic leading-relaxed hidden sm:block">
                  {t('workstation_help')}
                </p>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full h-12 sm:h-14 overflow-hidden rounded-xl sm:rounded-2xl bg-emerald-500 font-black text-white text-xs uppercase tracking-widest transition-all duration-300 hover:shadow-[0_0_30px_-5px_rgba(16,185,129,0.5)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {/* Button Glow Effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-teal-500 transition-opacity opacity-0 group-hover:opacity-100 duration-300"></div>
                
                <div className="relative flex items-center justify-center gap-3">
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin w-4 h-4" />
                      <span>{t('loading')}</span>
                    </>
                  ) : (
                    <>
                      <span>{t('submit')}</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </div>
              </button>
            </div>

          </form>
        </div>

        {/* Brand Footer */}
        <div className="mt-8 text-center space-y-2">
          <p className="text-[10px] font-black tracking-[0.4em] text-white/10 uppercase">
            © {new Date().getFullYear()} Zenith OS • v2.0
          </p>
          <div className="flex items-center justify-center gap-4 opacity-20">
             <div className="h-px w-12 bg-white/20"></div>
             <div className="w-1 h-1 rounded-full bg-white/50"></div>
             <div className="h-px w-12 bg-white/20"></div>
          </div>
        </div>

      </div>
    </div>
  );
}
