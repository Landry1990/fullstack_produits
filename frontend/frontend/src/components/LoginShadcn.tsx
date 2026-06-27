import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLicence } from '../context/LicenceContext';
import api from '../services/api';
import ZenithLogo from './ZenithLogo';
import {
  User, Lock, ArrowRight, Loader2, AlertCircle, Monitor,
  ChevronDown, Shield, Eye, EyeOff, RefreshCcw, Sun, Moon,
  Search, Check
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from './shadcn/button';
import { Card, CardContent } from './shadcn/card';
import { Badge } from './shadcn/badge';
import { cn } from '../lib/utils';

export default function LoginShadcn() {
  const { t } = useTranslation(['auth', 'common']);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    // Forcer light mode sur la page login, ignorer le thème global sauvegardé
    document.documentElement.classList.remove('theme-midnight');
    document.documentElement.setAttribute('data-theme', 'light');
    return false;
  });
  const { login } = useAuth();
  const { licence, loading: licenceLoading } = useLicence();
  const navigate = useNavigate();
  const [users, setUsers] = useState<{ username: string; full_name: string }[]>([]);
  const [showResetButton, setShowResetButton] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const filteredUsers = users.filter(u =>
    u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Fetch users
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await api.get('users/login_options/');
        if (Array.isArray(response.data)) {
          setUsers(response.data);
        }
      } catch (err) {
        console.error('Error fetching users:', err);
      }
    };
    fetchUsers();
  }, []);

  // Secret shortcut Ctrl+Shift+Alt+L for reset licence
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.altKey && e.key.toLowerCase() === 'l') {
        setShowResetButton(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset highlighted index when dropdown opens or filtered list changes
  useEffect(() => {
    if (isOpen) {
      setHighlightedIndex(0);
    }
  }, [isOpen, searchTerm]);

  // Keyboard navigation for dropdown
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (filteredUsers.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex(prev => {
            const next = prev < filteredUsers.length - 1 ? prev + 1 : 0;
            return next;
          });
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex(prev => {
            const next = prev > 0 ? prev - 1 : filteredUsers.length - 1;
            return next;
          });
          break;
        case 'Enter':
          e.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < filteredUsers.length) {
            const u = filteredUsers[highlightedIndex];
            setUsername(u.username);
            setIsOpen(false);
            setError('');
          }
          break;
        case 'Escape':
          setIsOpen(false);
          break;
        case 'Tab':
          setIsOpen(false);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredUsers, highlightedIndex]);

  // Workstation naming
  const getDeviceType = () => {
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) return 'TABLET';
    if (/Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|NetFront|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) return 'MOBILE';
    return 'PC';
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
      } else if (e.response.status === 429) {
        setError('Trop de tentatives de connexion. Attendez 1 minute avant de réessayer.');
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

  const handleResetLicence = async () => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer la licence actuelle ? Le système se verrouillera à nouveau.')) {
      try {
        await api.delete('/licence/');
        window.location.reload();
      } catch (err) {
        console.error('Error resetting licence:', err);
      }
    }
  };

  const currentTime = new Date();
  const hours = currentTime.getHours();
  const greeting = hours < 12 ? 'Bonjour' : hours < 18 ? 'Bon après-midi' : 'Bonsoir';

  return (
    <div className={cn(
      "min-h-[100dvh] w-full flex font-sans transition-colors duration-500",
      isDark
        ? 'bg-slate-950 text-white'
        : 'bg-slate-50 text-slate-900'
    )}>
      {/* Theme Toggle - Fixed top right */}
      <button
        onClick={() => setIsDark(!isDark)}
        className={cn(
          "fixed top-4 right-4 z-50 p-2.5 rounded-xl transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2",
          isDark
            ? 'bg-slate-800 text-amber-400 hover:bg-slate-700 focus-visible:ring-offset-slate-950'
            : 'bg-white text-slate-600 shadow-md hover:bg-slate-100 focus-visible:ring-offset-white'
        )}
      >
        {isDark ? <Sun className="size-5" /> : <Moon className="size-5" />}
      </button>

      <div className="flex w-full min-h-[100dvh]">
        {/* Left Panel - Brand */}
        <div className={cn(
          "hidden lg:flex flex-col w-[45%] items-center justify-center p-12 relative overflow-hidden",
          isDark ? 'bg-slate-900 border-r border-slate-800' : 'bg-white border-r border-slate-200'
        )}>
          {/* Background gradient */}
          <div className={cn(
            "absolute inset-0 opacity-30",
            isDark
              ? 'bg-gradient-to-br from-emerald-500/10 via-cyan-500/5 to-transparent'
              : 'bg-gradient-to-br from-emerald-100/50 via-cyan-50/30 to-transparent'
          )} />

          <div className="relative z-10 flex flex-col items-center text-center">
            <div className={cn(
              "p-6 rounded-3xl mb-6",
              isDark ? 'bg-slate-800/50' : 'bg-slate-100'
            )}>
              <ZenithLogo variant={1} size={80} />
            </div>

            <h1 className="text-3xl font-bold tracking-tight mb-2">
              {licenceLoading && !licence
                ? <span className={cn('inline-block rounded-lg animate-pulse w-40 h-8', isDark ? 'bg-slate-700' : 'bg-slate-200')} />
                : (licence?.pharmacie_nom || 'Zenith')
              }
            </h1>
            <p className={cn(
              "text-sm mb-12",
              isDark ? 'text-slate-400' : 'text-slate-500'
            )}>
              {licenceLoading && !licence
                ? <span className={cn('inline-block rounded-md animate-pulse w-48 h-4', isDark ? 'bg-slate-700' : 'bg-slate-200')} />
                : (licence?.pharmacien_nom || t('subtitle'))
              }
            </p>

            {/* Features */}
            <div className="space-y-3 w-full max-w-xs">
              {/* Feature: Multi-Postes (style capture) */}
              <div className={cn(
                "flex items-center gap-3.5 p-3.5 rounded-2xl",
                isDark ? 'bg-slate-800/50' : 'bg-[#f0f4f8]'
              )}>
                <div className={cn(
                  "shrink-0 h-10 w-10 rounded-xl flex items-center justify-center",
                  isDark ? 'bg-cyan-500/20 text-cyan-400' : 'bg-cyan-100 text-cyan-600'
                )}>
                  <Monitor className="size-5" />
                </div>
                <div className="text-left min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                      {t('features.multi_postes')}
                    </h4>
                    <span className={cn(
                      "text-[10px] font-medium tracking-wide",
                      isDark ? 'text-slate-500' : 'text-slate-400'
                    )}>
                      Phase 2 • v2.1
                    </span>
                  </div>
                  <p className={cn(
                    "text-xs mt-0.5",
                    isDark ? 'text-slate-400' : 'text-slate-500'
                  )}>
                    {t('features.multi_postes_desc')}
                  </p>
                </div>
              </div>

              {/* Feature: Sécurité */}
              <div className={cn(
                "flex items-center gap-3.5 p-3.5 rounded-2xl",
                isDark ? 'bg-slate-800/50' : 'bg-[#f0f4f8]'
              )}>
                <div className={cn(
                  "shrink-0 h-10 w-10 rounded-xl flex items-center justify-center",
                  isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-600'
                )}>
                  <Shield className="size-5" />
                </div>
                <div className="text-left min-w-0">
                  <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                    {t('features.advanced_security')}
                  </h4>
                  <p className={cn(
                    "text-xs mt-0.5",
                    isDark ? 'text-slate-400' : 'text-slate-500'
                  )}>
                    {t('features.security_desc')}
                  </p>
                </div>
              </div>
            </div>

            <p className={cn(
              "absolute bottom-8 text-xs font-medium tracking-wider",
              isDark ? 'text-slate-600' : 'text-slate-400'
            )}>
              Zenith OS
            </p>
          </div>
        </div>

        {/* Right Panel - Form */}
        <div className={cn(
          "flex-1 flex items-center justify-center p-6 relative overflow-y-auto",
          isDark ? 'bg-slate-950' : 'bg-[#eef2f6]'
        )}>
          <Card className={cn(
            "w-full max-w-md border shadow-xl",
            isDark
              ? 'bg-slate-900/90 backdrop-blur-xl border-slate-700'
              : 'bg-white border-slate-300'
          )}>
            <CardContent className="p-8">
              {/* Mobile Header */}
              <div className="lg:hidden flex flex-col items-center mb-8">
                <div className={cn(
                  "p-4 rounded-2xl mb-4",
                  isDark ? 'bg-slate-800' : 'bg-slate-100'
                )}>
                  <ZenithLogo variant={1} size={48} />
                </div>
                <h1 className="text-xl font-bold">{licence?.pharmacie_nom || 'Zenith'}</h1>
                <p className={cn(
                  "text-sm",
                  isDark ? 'text-slate-400' : 'text-slate-500'
                )}>{licence?.pharmacien_nom || t('subtitle')}</p>
              </div>

              {/* Greeting */}
              <div className="mb-6">
                <p className={cn(
                  "text-xs font-bold uppercase tracking-wider mb-1",
                  isDark ? 'text-emerald-400' : 'text-emerald-600'
                )}>
                  {greeting}
                </p>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('title')}</h2>
                <p className={cn(
                  "text-sm mt-1.5",
                  isDark ? 'text-slate-400' : 'text-slate-600'
                )}>
                  {t('login_form.subtitle')}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Error */}
                {error && (
                  <div className={cn(
                    "flex items-center gap-2 p-3 rounded-xl text-sm",
                    isDark
                      ? 'bg-red-500/10 border border-red-500/20 text-red-400'
                      : 'bg-red-50 border border-red-200 text-red-600'
                  )}>
                    <AlertCircle className="size-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Username Field */}
                <div className="space-y-2">
                  <label className={cn(
                    "text-sm font-bold",
                    isDark ? 'text-slate-200' : 'text-slate-800'
                  )}>
                    {t('username')}
                  </label>

                  {users.length > 0 ? (
                    <div className="relative" ref={dropdownRef}>
                      <button
                        type="button"
                        onClick={() => { setIsOpen(prev => { if (!prev) setSearchTerm(''); return !prev; }); }}
                        className={cn(
                          "w-full flex items-center justify-between px-4 py-3 rounded-xl text-left transition-all shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2",
                          isDark
                            ? 'bg-slate-800 border border-slate-600 hover:border-slate-500 text-white focus-visible:ring-offset-slate-950'
                            : 'bg-white border border-slate-300 hover:border-slate-400 text-slate-900 focus-visible:ring-offset-white',
                          isOpen && (isDark ? 'border-emerald-500/50 ring-1 ring-emerald-500/20' : 'border-emerald-500 ring-1 ring-emerald-500/20')
                        )}
                      >
                        <span className="flex items-center gap-2">
                          <User className={cn(
                            "size-4",
                            isDark ? 'text-slate-400' : 'text-slate-500'
                          )} />
                          {users.find(u => u.username === username)?.full_name || "Sélectionner un utilisateur"}
                        </span>
                        <ChevronDown className={cn(
                          "size-4 transition-transform duration-200",
                          isOpen && 'rotate-180',
                          isDark ? 'text-slate-400' : 'text-slate-500'
                        )} />
                      </button>

                      {isOpen && (
                        <div className={cn(
                          "absolute top-full left-0 right-0 mt-2 rounded-xl overflow-hidden z-50 shadow-2xl",
                          isDark
                            ? 'bg-slate-800 border border-slate-700'
                            : 'bg-white border border-slate-200'
                        )}>
                          {/* Search */}
                          <div className={cn(
                            "p-3 border-b",
                            isDark ? 'border-slate-700' : 'border-slate-100'
                          )}>
                            <div className="relative">
                              <Search className={cn(
                                "absolute left-3 top-1/2 -translate-y-1/2 size-4",
                                isDark ? 'text-slate-400' : 'text-slate-400'
                              )} />
                              <input
                                type="text"
                                autoFocus
                                placeholder="Rechercher..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                className={cn(
                                  "w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none transition-all",
                                  isDark
                                    ? 'bg-slate-900 border border-slate-700 focus:border-emerald-500/50 text-white placeholder:text-slate-500'
                                    : 'bg-slate-50 border border-slate-200 focus:border-emerald-500 text-slate-900 placeholder:text-slate-400'
                                )}
                              />
                            </div>
                          </div>

                          {/* User list */}
                          <div ref={listRef} className="max-h-64 overflow-y-auto">
                            {filteredUsers.map((u, index) => (
                              <button
                                key={u.username}
                                type="button"
                                ref={index === highlightedIndex ? (el) => {
                                  if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                                } : undefined}
                                onClick={() => {
                                  setUsername(u.username);
                                  setIsOpen(false);
                                  setError('');
                                }}
                                className={cn(
                                  "w-full flex items-center justify-between px-4 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset",
                                  isDark
                                    ? 'hover:bg-slate-700/50 focus-visible:ring-emerald-500/50'
                                    : 'hover:bg-slate-50 focus-visible:ring-emerald-500',
                                  index === highlightedIndex && (isDark ? 'bg-emerald-500/20' : 'bg-emerald-100'),
                                  username === u.username && (isDark ? 'bg-emerald-500/10' : 'bg-emerald-50')
                                )}
                              >
                                <div>
                                  <p className={cn(
                                    "font-medium text-sm",
                                    isDark ? 'text-slate-200' : 'text-slate-800'
                                  )}>{u.full_name}</p>
                                  <p className={cn(
                                    "text-xs",
                                    isDark ? 'text-slate-500' : 'text-slate-400'
                                  )}>@{u.username}</p>
                                </div>
                                {username === u.username && (
                                  <Check className={cn(
                                    "size-4",
                                    isDark ? 'text-emerald-400' : 'text-emerald-600'
                                  )} />
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="relative">
                      <User className={cn(
                        "absolute left-3 top-1/2 -translate-y-1/2 size-4",
                        isDark ? 'text-slate-400' : 'text-slate-500'
                      )} />
                      <input
                        type="text"
                        required
                        autoFocus
                        placeholder="ADMIN"
                        value={username}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
                        className={cn(
                          "pl-10 py-3 rounded-xl transition-all shadow-sm flex h-10 w-full border bg-white px-3 text-sm ring-offset-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                          isDark
                            ? 'bg-slate-800 border-slate-600 focus:border-emerald-500/50 text-white placeholder:text-slate-500'
                            : 'bg-white border-slate-300 focus:border-emerald-500'
                        )}
                      />
                    </div>
                  )}
                </div>

                {/* Password Field (shown when username selected) */}
                {username && (
                  <div className="space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="space-y-2">
                      <label className={cn(
                        "text-sm font-bold",
                        isDark ? 'text-slate-200' : 'text-slate-800'
                      )}>
                        {t('password')}
                      </label>
                      <div className="relative">
                        <Lock className={cn(
                          "absolute left-3 top-1/2 -translate-y-1/2 size-4",
                          isDark ? 'text-slate-400' : 'text-slate-500'
                        )} />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          autoFocus
                          placeholder="••••••••"
                          value={password}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                          className={cn(
                            "pl-10 pr-10 py-3 rounded-xl transition-all shadow-sm flex h-10 w-full border bg-white px-3 text-sm ring-offset-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                            isDark
                              ? 'bg-slate-800 border-slate-600 focus:border-emerald-500/50 text-white placeholder:text-slate-500'
                              : 'bg-white border-slate-300 focus:border-emerald-500'
                          )}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className={cn(
                            "absolute right-3 top-1/2 -translate-y-1/2 transition-colors p-1 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
                            isDark ? 'text-slate-400 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'
                          )}
                        >
                          {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Workstation */}
                    <div className={cn(
                      "flex items-center gap-3 p-3 rounded-xl",
                      isDark
                        ? 'bg-slate-800 border border-slate-700'
                        : 'bg-slate-100 border border-slate-200'
                    )}>
                      <Monitor className={cn(
                        "size-4",
                        isDark ? 'text-slate-400' : 'text-slate-500'
                      )} />
                      <div className="flex-1">
                        <input
                          type="text"
                          value={workstationName}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setWorkstationName(e.target.value)}
                          spellCheck={false}
                          className={cn(
                            "border-0 p-0 h-auto text-sm font-medium bg-transparent focus-visible:ring-0 w-full outline-none",
                            isDark ? 'text-slate-200' : 'text-slate-800'
                          )}
                        />
                        <p className={cn(
                          "text-xs",
                          isDark ? 'text-slate-500' : 'text-slate-400'
                        )}>
                          {t('workstation_label')} • {getDeviceType()}
                        </p>
                      </div>
                    </div>

                    {/* Submit Button */}
                    <Button
                      type="submit"
                      disabled={loading}
                      className={cn(
                        "w-full py-3 h-auto text-base font-semibold rounded-xl transition-all focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2",
                        isDark
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 focus-visible:ring-offset-slate-950'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20 focus-visible:ring-offset-white'
                      )}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="size-5 mr-2 animate-spin" />
                          {t('loading')}
                        </>
                      ) : (
                        <>
                          {t('submit')}
                          <ArrowRight className="size-5 ml-2" />
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {/* Footer */}
                <p className={cn(
                  "text-center text-xs tracking-wider pt-4",
                  isDark ? 'text-slate-600' : 'text-slate-400'
                )}>
                  © {new Date().getFullYear()} Zenith OS • Cryptographie AES-256
                </p>

                {/* Reset Licence Button (hidden) */}
                {showResetButton && (
                  <div className="pt-4 animate-in fade-in duration-300">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleResetLicence}
                      className={cn(
                        "w-full text-xs",
                        isDark ? 'text-red-400 hover:text-red-300 hover:bg-red-500/10' : 'text-red-600 hover:text-red-700 hover:bg-red-50'
                      )}
                    >
                      <RefreshCcw className="size-3 mr-2" />
                      {t('login_form.reset_licence')}
                    </Button>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
