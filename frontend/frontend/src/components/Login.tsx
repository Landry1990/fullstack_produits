import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import ZenithLogo from './ZenithLogo';
import { User, Lock, ArrowRight, Loader2, AlertCircle, Monitor, ChevronDown, Shield, Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import './Login.css';

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
        const response = await api.get('users/login_options/');
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
      // Persist the current workstation name
      localStorage.setItem('zenith_workstation', workstationName);

      const response = await api.post('auth/token/', {
        username,
        password,
        workstation: workstationName
      });

      const { token, is_superuser, allowed_menus, can_cash_out, can_do_returns, can_sell_negative_stock } = response.data;
      login({ username, token, is_superuser, allowed_menus, can_cash_out, can_do_returns, can_sell_negative_stock });
      navigate('/app');
    } catch (err) {
      console.error('Login error:', err);
      const e = err as any;
      if (!e.response) {
        setError(t('common:messages.server_unreachable'));
      } else if (e.response.status === 400 || e.response.status === 401) {
        setError(t('common:messages.login_invalid'));
      } else if (e.response.status === 403) {
        setError(t('common:messages.forbidden'));
      } else if (e.response.status >= 500) {
        setError(t('common:messages.server_error'));
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

            <div style={{ position: 'relative', zIndex: isOpen ? 200 : 1 }}>
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
                  <div className="zl-input-container" ref={dropdownRef} style={{ position: 'relative', zIndex: isOpen ? 200 : 1 }}>
                    <div className="zl-input-icon">
                      <User size={18} />
                    </div>
                    {users.length > 0 ? (
                      <>
                        <button
                          type="button"
                          onClick={() => { setIsOpen(prev => { if (!prev) setSearchTerm(''); return !prev; }); }}
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
                            <div style={{ padding: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
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
                                  boxSizing: 'border-box',
                                }}
                              />
                            </div>
                            
                            <div style={{ overflowY: 'auto', flex: 1 }} className="custom-scrollbar">
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
