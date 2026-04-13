import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import ZenithLogo from './ZenithLogo';
import { User, Lock, ArrowRight, Loader2, AlertCircle, Monitor, ChevronDown, Shield, Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function Login() {
  const { t } = useTranslation(['auth', 'common']);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<{username: string, full_name: string}[]>([]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const url = import.meta.env.VITE_API_BASE_URL 
          ? `${String(import.meta.env.VITE_API_BASE_URL).replace(/\/$/, '')}/api/users/login_options/`
          : '/api/users/login_options/';
        const response = await axios.get(url);
        if (Array.isArray(response.data)) {
          setUsers(response.data);
          // Wait for user manual selection
          /* if (response.data.length > 0 && !username) {
            setUsername(response.data[0].username);
          } */
        }
      } catch (err) {
        console.error('Error fetching users:', err);
      }
    };
    fetchUsers();
  }, []);

  // Workstation naming logic
  const getDeviceType = () => {
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) return "TABLET";
    if (/Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|NetFront|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) return "MOBILE";
    return "PC";
  };
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [workstationName, setWorkstationName] = useState(() => {
    const saved = localStorage.getItem('zenith_workstation');
    if (saved) return saved;
    const type = getDeviceType();
    const randomId = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${type}-${randomId}`;
  });

  // Focus states for input glow effects
  const [focusedField, setFocusedField] = useState<string | null>(null);

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

  const currentTime = new Date();
  const hours = currentTime.getHours();
  const greeting = hours < 12 ? 'Bonjour' : hours < 18 ? 'Bon après-midi' : 'Bonsoir';

  return (
    <div className="zl-page">
      <style>{`
        /* ══════════════════════════════════════════════
           ZENITH PRO — SOPHISTICATED LOGIN REDESIGN
           Minimal weight • Pure CSS • Native App Feel
           ══════════════════════════════════════════════ */

        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');

        :root {
          --primary-pro: #10b981;
          --primary-glow: rgba(16, 185, 129, 0.4);
          --cyan-accent: #06b6d4;
          --obsidian: #020617;
          --midnight: #0a0f1d;
          --glass-bg: rgba(255, 255, 255, 0.02);
          --glass-border: rgba(255, 255, 255, 0.08);
        }

        /* ─── Animations ─── */
        @keyframes zenFadeUp {
          from { opacity: 0; transform: translateY(30px); filter: blur(10px); }
          to   { opacity: 1; transform: translateY(0); filter: blur(0); }
        }
        @keyframes zenFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes zenPulseLogo {
          0%   { transform: scale(1); filter: drop-shadow(0 0 0px var(--primary-glow)); }
          50%  { transform: scale(1.05); filter: drop-shadow(0 0 20px var(--primary-glow)); }
          100% { transform: scale(1); filter: drop-shadow(0 0 0px var(--primary-glow)); }
        }
        @keyframes zenMeshMove {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes zenRotateGlow {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes zenShimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }

        /* ─── Page Root & Layout ─── */
        .zl-page {
          min-height: 100dvh;
          display: flex;
          font-family: 'Outfit', system-ui, sans-serif;
          background: var(--obsidian);
          overflow: hidden;
          color: #fff;
        }

        .zl-layout {
          display: flex;
          width: 100%;
          min-height: 100dvh;
        }

        /* ─── Panels ─── */
        .zl-panel-left {
          flex: 0 0 42%;
          background: var(--obsidian);
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 4rem;
          border-right: 1px solid var(--glass-border);
          overflow: hidden;
        }

        .zl-panel-right {
          flex: 1;
          background: var(--midnight);
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          overflow-y: auto;
          /* Texture Noise */
          background-image: 
            radial-gradient(circle at 100% 0%, rgba(16, 185, 129, 0.08) 0%, transparent 40%),
            radial-gradient(circle at 0% 100%, rgba(6, 182, 212, 0.05) 0%, transparent 40%),
            url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
          background-blend-mode: overlay;
        }

        /* ─── Elements ─── */
        .zl-logo-container {
          position: relative;
          width: 140px;
          height: 140px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 3rem;
          animation: zenPulseLogo 4s ease-in-out infinite;
        }

        .zl-logo-container::before {
          content: '';
          position: absolute;
          inset: -15px;
          border: 1px dashed rgba(16, 185, 129, 0.2);
          border-radius: 50%;
          animation: zenRotateGlow 20s linear infinite;
        }

        .zl-brand-title {
          font-size: 3.5rem;
          font-weight: 900;
          letter-spacing: -0.05em;
          background: linear-gradient(to bottom, #fff, rgba(255,255,255,0.6));
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 0.5rem;
          line-height: 1;
        }

        .zl-brand-tagline {
          font-size: 0.85rem;
          font-weight: 500;
          color: var(--primary-pro);
          text-transform: uppercase;
          letter-spacing: 0.4em;
          margin-bottom: 3rem;
          opacity: 0.8;
        }

        .zl-features-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1.5rem;
          width: 100%;
          max-width: 320px;
        }

        .zl-feature-item {
          display: flex;
          align-items: flex-start;
          gap: 1.25rem;
          padding: 1.25rem;
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--glass-border);
          border-radius: 1.25rem;
          transition: transform 0.3s ease, border-color 0.3s ease;
        }

        .zl-feature-item:hover {
          transform: translateY(-5px);
          border-color: rgba(16, 185, 129, 0.3);
          background: rgba(255,255,255,0.05);
        }

        .zl-feature-icon {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 0.75rem;
          background: rgba(16, 185, 129, 0.1);
          color: var(--primary-pro);
          flex-shrink: 0;
        }

        .zl-feature-text h4 {
          font-size: 0.9rem;
          font-weight: 700;
          margin-bottom: 0.25rem;
          color: #f1f5f9;
        }

        .zl-feature-text p {
          font-size: 0.75rem;
          color: #94a3b8;
          line-height: 1.4;
        }

        /* ─── Form Panel (The "Native App" Feel) ─── */
        .zl-form-panel {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          position: relative;
        }

        .zl-card {
          width: 100%;
          max-width: 440px;
          background: rgba(15, 23, 42, 0.4);
          backdrop-filter: blur(50px) saturate(2);
          -webkit-backdrop-filter: blur(50px) saturate(2);
          border: 1px solid var(--glass-border);
          border-radius: 2.5rem;
          padding: 3.5rem;
          box-shadow: 
            0 50px 100px -20px rgba(0, 0, 0, 0.7),
            inset 0 1px 1px rgba(255, 255, 255, 0.05);
          animation: zenFadeUp 0.8s cubic-bezier(0.16, 1, 0.3, 1);
          position: relative;
        }

        .zl-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(16, 185, 129, 0.3), transparent);
        }

        /* ─── Header Mobile (Centered) ─── */
        .zl-mobile-header {
          display: none;
          text-align: center;
          margin-bottom: 2.5rem;
        }

        .zl-greeting {
          font-size: 0.8rem;
          font-weight: 700;
          color: var(--primary-pro);
          text-transform: uppercase;
          letter-spacing: 0.2em;
          margin-bottom: 0.5rem;
          display: block;
        }

        .zl-card-title {
          font-size: 2rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          margin-bottom: 0.5rem;
        }

        .zl-card-subtitle {
          font-size: 0.9rem;
          color: #64748b;
          margin-bottom: 2.5rem;
        }

        /* ─── Form Fields ─── */
        .zl-field {
          margin-bottom: 1.5rem;
        }

        .zl-field-label {
          display: block;
          font-size: 0.75rem;
          font-weight: 600;
          color: #94a3b8;
          margin-bottom: 0.75rem;
          margin-left: 0;
        }

        .zl-input-container {
          position: relative;
          transition: transform 0.2s ease;
        }

        .zl-input-container:focus-within {
          transform: scale(1.02);
        }

        .zl-input-icon {
          position: absolute;
          left: 1.25rem;
          top: 50%;
          transform: translateY(-50%);
          color: #475569;
          transition: color 0.3s ease;
          pointer-events: none;
        }

        .zl-input-container:focus-within .zl-input-icon {
          color: var(--primary-pro);
        }

        .zl-input-base {
          width: 100%;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 1.25rem;
          padding: 1.1rem 1.25rem 1.1rem 3.5rem;
          color: #fff;
          font-size: 0.95rem;
          font-weight: 500;
          font-family: inherit;
          outline: none;
          transition: all 0.3s ease;
          box-sizing: border-box;
        }

        .zl-input-base:focus {
          background: rgba(0, 0, 0, 0.5);
          border-color: var(--primary-pro);
          box-shadow: 0 0 20px rgba(16, 185, 129, 0.1);
        }

        /* Password toggle */
        .zl-password-toggle {
          position: absolute;
          right: 1.25rem;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: #475569;
          cursor: pointer;
          padding: 0.5rem;
          display: flex;
          align-items: center;
          transition: color 0.2s ease;
        }

        .zl-password-toggle:hover {
          color: #94a3b8;
        }

        /* Dropdown Trigger */
        .zl-dropdown-btn {
          display: flex;
          align-items: center;
          justify-content: space-between;
          text-align: left;
          cursor: pointer;
        }

        /* Dropdown Menu */
        .zl-dropdown-overlay {
          position: absolute;
          z-index: 100;
          top: 100%;
          left: 0;
          right: 0;
          margin-top: 0.75rem;
          background: rgba(15, 23, 42, 0.98);
          backdrop-filter: blur(25px);
          -webkit-backdrop-filter: blur(25px);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 1.25rem;
          box-shadow: 0 25px 60px rgba(0,0,0,0.8);
          max-height: 50vh;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          animation: zenFadeIn 0.2s ease;
        }

        .zl-dropdown-item {
          width: 100%;
          padding: 1rem 1.5rem;
          background: transparent;
          border: none;
          border-bottom: 1px solid rgba(255, 255, 255, 0.03);
          color: #94a3b8;
          font-size: 0.9rem;
          text-align: left;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .zl-dropdown-item:hover {
          background: rgba(16, 185, 129, 0.1);
          color: #fff;
        }

        .zl-dropdown-item.is-active {
          color: var(--primary-pro);
          font-weight: 700;
        }

        /* ─── Workstation ID ─── */
        .zl-station-id {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.75rem 1.25rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px dashed var(--glass-border);
          border-radius: 1rem;
          margin-bottom: 2rem;
        }

        .zl-station-icon {
          color: var(--primary-pro);
          opacity: 0.6;
        }

        .zl-station-info {
          flex: 1;
        }

        .zl-station-info input {
          width: 100%;
          background: transparent;
          border: none;
          color: #cbd5e1;
          font-size: 0.8rem;
          font-weight: 700;
          outline: none;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .zl-station-info span {
          display: block;
          font-size: 0.6rem;
          color: #64748b;
          text-transform: uppercase;
          margin-top: 2px;
        }

        /* ─── Submit Button ─── */
        .zl-submit-btn {
          width: 100%;
          height: 3.75rem;
          background: linear-gradient(135deg, #059669 0%, #10b981 100%);
          border: none;
          border-radius: 1.25rem;
          color: #fff;
          font-size: 1rem;
          font-weight: 800;
          letter-spacing: 0.02em;
          cursor: pointer;
          position: relative;
          overflow: hidden;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          box-shadow: 0 10px 20px -5px rgba(16, 185, 129, 0.3);
        }

        .zl-submit-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 15px 30px -5px rgba(16, 185, 129, 0.4);
        }

        .zl-submit-btn:active:not(:disabled) {
          transform: translateY(0) scale(0.98);
        }

        .zl-submit-btn:disabled {
          opacity: 0.5;
          cursor: wait;
        }

        .zl-btn-shimmer {
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
          transform: translateX(-100%);
          animation: zenShimmer 3s infinite;
        }

        /* ─── Error State ─── */
        .zl-error-box {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem 1.25rem;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: 1.25rem;
          margin-bottom: 1.5rem;
          color: #fca5a5;
          font-size: 0.85rem;
          font-weight: 500;
          animation: zenFadeIn 0.3s ease;
        }

        /* ─── Desktop-only versioning ─── */
        .zl-version-tag {
          position: absolute;
          bottom: 2rem;
          left: 2rem;
          font-size: 0.65rem;
          font-weight: 700;
          color: #475569;
          letter-spacing: 0.3em;
          text-transform: uppercase;
          opacity: 0.5;
        }

        /* ═══════════════════════════════
           RESPONSIVE: MOBILE & TABLET
           ═══════════════════════════════ */

        @media (max-width: 1024px) {
          .zl-panel-left {
            flex: 0 0 35%;
            padding: 2.5rem;
          }
          .zl-brand-title {
            font-size: 2.5rem;
          }
          .zl-card {
            padding: 2.5rem;
          }
        }

        @media (max-width: 850px) {
          .zl-panel-left {
            display: none;
          }
          .zl-panel-right {
            padding: 1.5rem;
          }
          .zl-card {
            max-width: 480px;
            padding: 2.5rem 1.75rem;
            background: rgba(15, 23, 42, 0.8);
          }
          .zl-mobile-header {
            display: flex;
            flex-direction: column;
            align-items: center;
            margin-bottom: 2rem;
          }
          .zl-logo-mobile-pulsing {
            width: 80px;
            height: 80px;
            margin-bottom: 1rem;
            animation: zenPulseLogo 4s ease-in-out infinite;
            background: radial-gradient(circle, rgba(16, 185, 129, 0.2) 0%, transparent 70%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .zl-mobile-header h1 {
            font-size: 2.25rem;
            font-weight: 900;
            letter-spacing: -0.04em;
          }
          .zl-mobile-header p {
            font-size: 0.75rem;
            letter-spacing: 0.3em;
            text-transform: uppercase;
            color: var(--primary-pro);
          }
        }

        @media (max-width: 450px) {
          .zl-form-panel {
            padding: 1rem;
          }
          .zl-card {
            border-radius: 2rem;
            padding: 2rem 1.25rem;
            box-shadow: none;
            border: 1px solid rgba(255, 255, 255, 0.05);
          }
          .zl-card-title {
            font-size: 1.75rem;
          }
          .zl-input-base {
            padding: 1rem 1.25rem 1rem 3.25rem;
            font-size: 0.9rem;
          }
          .zl-submit-btn {
            height: 3.5rem;
            border-radius: 1rem;
          }
        }

        /* Dark Scrollbar */
        .zl-dropdown-overlay::-webkit-scrollbar {
          width: 5px;
        }
        .zl-dropdown-overlay::-webkit-scrollbar-track {
          background: transparent;
        }
        .zl-dropdown-overlay::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 5px;
        }
      `}</style>

      <div className="zl-layout">
        {/* ═══ Left Panel: Solid & Brand ═══ */}
        <div className="zl-panel-left">
          <div className="zl-logo-container">
            <ZenithLogo variant={1} size={80} />
          </div>
          
          <h1 className="zl-brand-title">Zenith</h1>
          <p className="zl-brand-tagline">{t('subtitle')}</p>

          <div className="zl-features-grid">
            <div className="zl-feature-item">
              <div className="zl-feature-icon">
                <Shield size={20} />
              </div>
              <div className="zl-feature-text">
                <h4>Sécurité Avancée</h4>
                <p>Authentification SSL et protection des données.</p>
              </div>
            </div>
            
            <div className="zl-feature-item">
              <div className="zl-feature-icon">
                <Monitor size={20} />
              </div>
              <div className="zl-feature-text">
                <h4>Multi-Postes</h4>
                <p>Synchronisation en temps réel.</p>
              </div>
            </div>
          </div>

          <span className="zl-version-tag">Zenith OS • Phase 2 • v2.1</span>
        </div>

        {/* ═══ Right Panel: Textured & Form ═══ */}
        <div className="zl-panel-right">
          <div className="zl-card">
            
            {/* Mobile-only Centered Header */}
            <div className="zl-mobile-header">
              <div className="zl-logo-mobile-pulsing">
                <ZenithLogo variant={1} size={48} />
              </div>
              <h1>Zenith</h1>
              <p>{t('subtitle')}</p>
            </div>

            <div style={{ position: 'relative', zIndex: 1 }}>
              <span className="zl-greeting">{greeting}</span>
              <h2 className="zl-card-title">{t('title')}</h2>
              <p className="zl-card-subtitle">Identifiez-vous pour accéder à votre espace pro</p>

              <form onSubmit={handleSubmit}>
                {/* Error Logic */}
                {error && (
                  <div className="zl-error-box">
                    <AlertCircle size={18} />
                    <span>{error}</span>
                  </div>
                )}

                {/* USERNAME FIELD */}
                <div className="zl-field">
                  <label className="zl-field-label">{t('username')}</label>
                  <div className="zl-input-container" ref={dropdownRef}>
                    <div className="zl-input-icon">
                      <User size={18} />
                    </div>
                    {users.length > 0 ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setIsOpen(!isOpen)}
                          onFocus={() => setFocusedField('username')}
                          onBlur={() => setFocusedField(null)}
                          className={`zl-input-base zl-dropdown-btn ${isOpen ? 'is-active' : ''}`}
                        >
                          <span>
                            {users.find(u => u.username === username)?.full_name || "Sélectionner un utilisateur"}
                          </span>
                          <ChevronDown size={16} style={{ 
                            transform: isOpen ? 'rotate(180deg)' : 'rotate(0)',
                            transition: 'transform 0.3s ease',
                            opacity: 0.5
                          }} />
                        </button>
                        
                        {isOpen && (
                          <div className="zl-dropdown-overlay custom-scrollbar">
                            {/* Search Box in Dropdown */}
                            <div style={{ padding: '0.75rem', position: 'sticky', top: 0, background: 'rgba(15, 23, 42, 0.95)', borderBottom: '1px solid rgba(255,255,255,0.05)', zIndex: 10 }}>
                              <input 
                                type="text"
                                autoFocus
                                placeholder="Rechercher un opérateur..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  width: '100%',
                                  background: 'rgba(255,255,255,0.05)',
                                  border: '1px solid rgba(255,255,255,0.1)',
                                  borderRadius: '0.75rem',
                                  padding: '0.6rem 1rem',
                                  color: '#fff',
                                  fontSize: '0.8rem',
                                  outline: 'none',
                                }}
                              />
                            </div>
                            
                            {users
                              .filter(u => 
                                u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                u.username.toLowerCase().includes(searchTerm.toLowerCase())
                              )
                              .map((u) => (
                              <button
                                key={u.username}
                                type="button"
                                className={`zl-dropdown-item ${username === u.username ? 'is-active' : ''}`}
                                onClick={() => {
                                  setUsername(u.username);
                                  setIsOpen(false);
                                  // Optional: clear error when changing user
                                  setError('');
                                }}
                              >
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{u.full_name}</span>
                                  <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>@{u.username}</span>
                                </div>
                                {username === u.username && <Shield size={14} style={{ color: 'var(--primary-pro)' }} />}
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <input
                        type="text"
                        required
                        className="zl-input-base"
                        placeholder="ADMIN"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        onFocus={() => setFocusedField('username')}
                        onBlur={() => setFocusedField(null)}
                      />
                    )}
                  </div>
                </div>

                {/* Progressive Revelation: Show only when username is selected */}
                {username && (
                  <div style={{ animation: 'zenFadeUp 0.5s ease-out' }}>
                    {/* PASSWORD FIELD */}
                    <div className="zl-field">
                      <label className="zl-field-label">{t('password')}</label>
                      <div className="zl-input-container">
                        <div className="zl-input-icon">
                          <Lock size={18} />
                        </div>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          className="zl-input-base"
                          placeholder="••••••••"
                          value={password}
                          autoFocus
                          onChange={(e) => setPassword(e.target.value)}
                          onFocus={() => setFocusedField('password')}
                          onBlur={() => setFocusedField(null)}
                        />
                        <button
                          type="button"
                          className="zl-password-toggle"
                          onClick={() => setShowPassword(!showPassword)}
                          tabIndex={-1}
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    {/* STATION ID (WORKSTATION) */}
                    <div className="zl-station-id">
                      <div className="zl-station-icon">
                        <Monitor size={18} />
                      </div>
                      <div className="zl-station-info">
                        <input
                          type="text"
                          value={workstationName}
                          onChange={(e) => setWorkstationName(e.target.value)}
                          spellCheck="false"
                        />
                        <span>{t('workstation_label')} • {getDeviceType()}</span>
                      </div>
                    </div>

                    {/* SUBMIT BUTTON */}
                    <button type="submit" disabled={loading} className="zl-submit-btn">
                      {!loading && <div className="zl-btn-shimmer" />}
                      {loading ? (
                        <>
                          <Loader2 size={20} className="zl-spin" style={{ animation: 'zenRotateGlow 1s linear infinite' }} />
                          <span>{t('loading')}</span>
                        </>
                      ) : (
                        <>
                          <span>{t('submit')}</span>
                          <ArrowRight size={18} />
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Mobile Footer Version */}
                <div style={{ 
                  textAlign: 'center', 
                  marginTop: '1.5rem', 
                  fontSize: '0.65rem', 
                  color: '#475569',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em'
                }}>
                  © {new Date().getFullYear()} Zenith OS • Cryptographie AES-256
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
