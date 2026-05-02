import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSidebar } from '../context/SidebarContext';
import ZenithLogo from './ZenithLogo';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useReapproStats } from '../hooks/useDashboard';
import { LogOut, ChevronLeft, ChevronRight, ChevronDown, Menu, X } from 'lucide-react';


export default function Sidebar() {
  const { t } = useTranslation(['sidebar', 'common']);
  const { user, logout } = useAuth();
  const { isOpen, isCollapsed, toggleSidebar, closeSidebar, toggleCollapse } = useSidebar();
  const location = useLocation();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const { data: reapproStats } = useReapproStats();
  
  const allMenuItems = [
    { path: '/app', label: t('dashboard'), key: 'dashboard', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
    )},
    { path: '/app/manager-dashboard', label: t('manager_sidebar'), key: 'manager_sidebar', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" /></svg>
    )},
    { 
      label: t('ventes.title'), 
      key: 'ventes', 
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      ),
      submenus: [
        { path: '/app/ventes', label: t('ventes.consultation'), key: 'ventes_consultation' },
        { path: '/app/historique-ventes', label: t('ventes.historique'), key: 'ventes_historique' },
        { path: '/app/journal-caisse', label: t('ventes.journal'), key: 'ventes_journal' },
        { path: '/app/historique-clotures', label: t('ventes.clotures'), key: 'ventes_clotures' },
        { path: '/app/ordonnancier', label: t('ventes.ordonnancier'), key: 'ventes_ordonnancier' },
        { path: '/app/promotions', label: t('ventes.promotions'), key: 'ventes_promotions' },
        { path: '/app/caisse-centralisee', label: t('ventes.caisse_centralisee'), key: 'caisse' } // Keeping 'caisse' as it might be a specific top-level permission
      ]
    },
    { path: '/app/facturation', label: t('facturation'), key: 'facturation', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
    )},
    { path: '/app/produits', label: t('produits'), key: 'produits', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
    )},
    { path: '/app/vitrine', label: t('vitrine'), key: 'vitrine', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
    )},
    { 
      label: t('commandes.local_title'), 
      key: 'commandes_loc', 
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
      ),
      submenus: [
        { path: '/app/commandes/locales', label: t('commandes.new_current'), key: 'commandes_loc_current' },
        { path: '/app/historique-achats/locales', label: t('commandes.history'), key: 'commandes_loc_history' },
      ]
    },
    { 
      label: t('commandes.direct_title'), 
      key: 'commandes_dir', 
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
      ),
      submenus: [
        { path: '/app/commandes/directes', label: t('commandes.new_current'), key: 'commandes_dir_current' },
        { path: '/app/historique-achats/directes', label: t('commandes.history'), key: 'commandes_dir_history' },
      ]
    },
    { path: '/app/fournisseurs', label: t('fournisseurs.title'), key: 'fournisseurs', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
    )},
    { 
      label: t('clients'), 
      key: 'clients', 
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
      ),
      submenus: [
        { path: '/app/clients', label: t('clients_consultation', 'Consultation'), key: 'clients_consultation' },
        { path: '/app/outils/imc', label: t('clients_imc', 'Calculateur IMC'), key: 'clients_imc' },
      ]
    },
    { path: '/app/creances', label: t('creances'), key: 'creances', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
    )},
    { 
      label: t('stock.title'), 
      key: 'inventaire', 
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
      ),
      submenus: [
        { path: '/app/inventaire', label: t('stock.inventaire.title'), key: 'inventaire_saisie' },
        { path: '/app/journal-ajustements', label: t('stock.journal'), key: 'inventaire_journal' },
        { path: '/app/stock-analysis', label: t('stock.analyse.title'), key: 'inventaire_analyse' },
        { path: '/app/ruptures', label: t('stock.ruptures.title', 'Suivi des Ruptures'), key: 'inventaire_ruptures' },
        { path: '/app/reappro-rayon', label: t('stock.reappro.title', 'Réappro Rayon'), key: 'inventaire_reappro' },
        { path: '/app/avoirs', label: t('stock.avoirs'), key: 'inventaire_avoirs' },
        { path: '/app/promis', label: t('stock.promis'), key: 'inventaire_promis' },
        { path: '/app/transformations', label: t('stock.transformations.title'), key: 'inventaire_transformations' },
        { path: '/app/perimes', label: t('stock.perimes.title'), key: 'inventaire_perimes' },
        { path: '/app/organisation', label: t('stock.organisation.title', 'Organisation'), key: 'inventaire_organisation' },
        { path: '/app/etats-inventaire', label: t('stock.etats_inventaire.title', 'États Inventaires'), key: 'inventaire_etats' },
        { path: '/app/rapport-ug', label: t('stock.rapport_ug.title', 'Rapport Unités Gratuites (UG)'), key: 'inventaire_rapport_ug' }
      ]
    },
    { 
      label: t('statistiques.title'), 
      key: 'statistiques', 
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" /></svg>
      ),
      submenus: [
        { path: '/app/centre-rapports', label: t('statistiques.rapports'), key: 'statistiques_rapports' },
        { path: '/app/analyse-abc', label: t('statistiques.abc'), key: 'statistiques_abc' },
        { path: '/app/statistiques-fournisseurs', label: t('statistiques.fournisseurs'), key: 'statistiques_fournisseurs' },
        { path: '/app/rapports-mensuels', label: t('statistiques.mensuel'), key: 'statistiques_mensuels' },
        { path: '/app/module-financier', label: t('statistiques.finances'), key: 'statistiques_finances' },
        { path: '/app/classement-vendeurs', label: t('statistiques.classement_vendeurs', 'Classement Vendeurs'), key: 'statistiques_vendeurs' },
        { path: '/app/analyse-temporelle', label: t('statistiques.analyse_temporelle', 'Analyse Temporelle'), key: 'statistiques_temporelle' },
        { path: '/app/guide-financier', label: t('statistiques.guide', 'Guide Financier 📖'), key: 'statistiques_guide' }
      ]
    },
    {
      label: t('parametres.title'),
      key: 'settings',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
      ),
      submenus: [
        // { path: '/app/invoice-settings', label: t('parametres.facture'), key: 'settings_facture' }, (removed)
        { path: '/app/pharmacy-settings', label: t('parametres.pharmacie'), key: 'settings_pharmacie' },
        { path: '/app/whatsapp-history', label: t('parametres.whatsapp'), key: 'settings_whatsapp' },
      ]
    },
    { path: '/app/aide-formation', label: t('aide_formation'), key: 'aide_formation', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 10 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
    )},
    { path: '/app/changelog', label: t('changelog', 'Quoi de neuf ?'), key: 'changelog', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
    )},
  ];

  // Logic to calculate menuItems based on authentication
  const menuItems = allMenuItems.map(item => {
    if (user?.is_superuser) return item;
    
    const allowed = (user as any)?.allowed_menus || [];
    
    // 1. Explicit parent permission
    const hasExplicitParent = allowed.includes(item.key);

    // 2. Legacy broad categories (compatibility)
    const hasLegacyCategory = 
      (item.key === 'commandes_loc' && allowed.includes('commandes')) ||
      (item.key === 'commandes_dir' && allowed.includes('commandes')) ||
      (item.key === 'vitrine' && allowed.includes('produits'));

    if (item.submenus) {
      // Filter submenus: only show if explicitly allowed OR if parent is fully allowed
      const filteredSubmenus = item.submenus.filter(sub => {
        // Direct match for submenu
        if (allowed.includes(sub.key)) return true;
        
        // Full parent access allows all children
        if (hasExplicitParent || hasLegacyCategory) return true;

        // Specific legacy mappings (one-to-one)
        if (sub.key === 'caisse' && allowed.includes('caisse')) return true;
        if (sub.key === 'inventaire_perimes' && allowed.includes('perimes')) return true;
        if (sub.key === 'inventaire_avoirs' && allowed.includes('avoirs')) return true;
        if (sub.key === 'inventaire_promis' && allowed.includes('promis')) return true;
        
        return false;
      });
      
      return filteredSubmenus.length > 0 ? { ...item, submenus: filteredSubmenus } : null;
    }
    
    if (item.key === 'changelog') return item;
    return hasExplicitParent || hasLegacyCategory || allowed.includes(item.key) ? item : null;
  }).filter(Boolean) as typeof allMenuItems;

  if (user?.is_superuser) {
    menuItems.push({
      path: '/app/utilisateurs',
      label: t('utilisateurs'),
      key: 'utilisateurs',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
      )
    });
    menuItems.push({
      path: '/app/user-sessions',
      label: t('user_sessions_sidebar'),
      key: 'user_sessions',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      )
    });
    menuItems.push({
      path: '/app/journal-audit',
      label: t('audit'),
      key: 'audit',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
      )
    });
    menuItems.push({
      path: '/app/maintenance',
      label: t('maintenance'),
      key: 'maintenance',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
      )
    });
    menuItems.push({
      path: '/app/corbeille',
      label: t('corbeille', 'Corbeille'),
      key: 'corbeille',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
      )
    });
  }

  // Effect to automatically handle expansion and collapsing
  useEffect(() => {
    // Find if current location belongs to a submenu
    const parent = menuItems.find(item => 
      item.submenus?.some(sub => location.pathname === sub.path)
    );

    if (parent) {
      setOpenMenu(parent.key);
    } else {
      // If we are not in a submenu path, check if we are in a top-level path that is NOT a submenu
      const isTopLevel = menuItems.some(item => !item.submenus && item.path === location.pathname);
      if (isTopLevel) {
        setOpenMenu(null);
      }
    }
  }, [location.pathname]);

  const toggleMenu = (key: string) => {
    setOpenMenu(prev => prev === key ? null : key);
  }

  const userInitials = user
    ? `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`.toUpperCase() || user.username?.[0]?.toUpperCase() || '?'
    : '?';
  const userFullName = user
    ? `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || user.username
    : '';

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={toggleSidebar}
        className="fixed top-3 left-3 z-50 lg:hidden w-9 h-9 rounded-xl bg-neutral text-white flex items-center justify-center shadow-lg"
        aria-label="Toggle menu"
      >
        {isOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
      </button>

      {/* Overlay mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={closeSidebar}
        />
      )}

      <aside
        className={`pharma-sidebar flex flex-col h-screen fixed lg:sticky top-0 z-50 transition-all duration-300 ease-in-out
          ${isCollapsed ? 'w-[72px]' : 'w-[268px]'}
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* ── HEADER ── */}
        <div className={`flex items-center gap-3 px-4 py-5 border-b border-white/5 ${isCollapsed ? 'justify-center' : ''}`}>
          <div className="shrink-0">
            <ZenithLogo variant={1} size={isCollapsed ? 30 : 38} />
          </div>
          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <h1 className="text-base font-black text-white tracking-widest uppercase leading-none">Zenith</h1>
              <p className="text-[9px] font-bold text-emerald-400/70 uppercase tracking-[0.2em] mt-0.5 truncate">{t('app_subtitle')}</p>
            </div>
          )}
          {/* Collapse button desktop */}
          <button
            onClick={toggleCollapse}
            className="hidden lg:flex shrink-0 w-6 h-6 rounded-lg bg-white/5 hover:bg-white/15 text-white/40 hover:text-white items-center justify-center transition-all"
            title={isCollapsed ? 'Déplier' : 'Replier'}
          >
            {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* ── NAV ── */}
        <nav className="flex-1 overflow-y-auto py-3 custom-scrollbar">
          <ul className={`flex flex-col gap-1.5 ${isCollapsed ? 'px-2' : 'px-3'}`}>
            {menuItems.map((item) => {
              const hasSubmenus = !!item.submenus;
              const isParentOfActive = item.submenus?.some(sub => location.pathname.startsWith(sub.path));
              const isMenuOpen = openMenu === item.key;

              if (hasSubmenus) {
                return (
                  <li key={item.key}>
                    {isCollapsed ? (
                      <div className="dropdown dropdown-right w-full">
                        <div tabIndex={0} role="button"
                          className={`flex items-center justify-center w-full h-10 rounded-xl cursor-pointer transition-all
                            ${isParentOfActive ? 'bg-emerald-500/15 text-emerald-400' : 'text-white/50 hover:text-white hover:bg-white/5'}`}
                          title={item.label}
                        >
                          <span className="w-5 h-5">{item.icon}</span>
                        </div>
                        <ul tabIndex={0} className="dropdown-content z-[100] menu p-2 shadow-2xl bg-[#1a2235] border border-white/10 rounded-2xl w-52 ml-2">
                          <li className="px-3 py-1.5">
                            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">{item.label}</span>
                          </li>
                          {item.submenus?.map((sub) => (
                            <li key={sub.path}>
                              <NavLink to={sub.path} onClick={closeSidebar}
                                className={({ isActive }) =>
                                  `rounded-xl text-xs py-2 px-3 transition-all ${isActive ? 'bg-emerald-500/15 text-emerald-300 font-bold' : 'text-white/60 hover:text-white hover:bg-white/5'}`
                                }
                              >
                                {sub.label}
                              </NavLink>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <>
                        {/* Parent button */}
                        <button
                          onClick={() => toggleMenu(item.key)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 group
                            ${isMenuOpen || isParentOfActive
                              ? 'bg-emerald-500/15 text-emerald-300'
                              : 'text-white/50 hover:text-white/90 hover:bg-white/5'
                            }`}
                        >
                          <span className={`w-5 h-5 shrink-0 transition-colors ${isMenuOpen || isParentOfActive ? 'text-emerald-400' : ''}`}>
                            {item.icon}
                          </span>
                          <span className="flex-1 text-left text-[15px] font-semibold tracking-tight truncate">{item.label}</span>
                          <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${isMenuOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Submenus with vertical connector */}
                        <div className={`overflow-hidden transition-all duration-250 ease-in-out ${isMenuOpen ? 'max-h-[600px] opacity-100 mt-0.5' : 'max-h-0 opacity-0'}`}>
                          <ul className="relative ml-4 pl-3 border-l border-white/10 flex flex-col gap-1 py-1">
                            {item.submenus?.map((sub) => (
                              <li key={sub.path}>
                                <NavLink
                                  to={sub.path}
                                  onClick={closeSidebar}
                                  className={({ isActive }) =>
                                    `flex items-center justify-between px-3 py-2 rounded-lg text-[13px] transition-all
                                    ${isActive
                                      ? 'bg-emerald-500/20 text-emerald-300 font-bold'
                                      : 'text-white/45 hover:text-white/90 hover:bg-white/5 font-medium'
                                    }`
                                  }
                                >
                                  <span className="truncate">{sub.label}</span>
                                  {sub.key === 'inventaire_reappro' && reapproStats && reapproStats.product_count > 0 && (
                                    <span className="ml-2 shrink-0 bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full animate-pulse">
                                      {reapproStats.product_count}
                                    </span>
                                  )}
                                </NavLink>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </>
                    )}
                  </li>
                );
              }

              return (
                <li key={item.path}>
                  <NavLink
                    to={item.path!}
                    end={item.path === '/app'}
                    onClick={closeSidebar}
                    title={isCollapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      `flex items-center ${isCollapsed ? 'justify-center w-full h-10' : 'gap-3 px-3 py-2.5'} rounded-xl transition-all duration-200
                      ${isActive
                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 font-bold'
                        : 'text-white/50 hover:text-white/90 hover:bg-white/5'
                      }`
                    }
                  >
                    <span className="w-5 h-5 shrink-0">{item.icon}</span>
                    {!isCollapsed && <span className="text-[15px] font-semibold tracking-tight truncate">{item.label}</span>}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* FOOTER utilisateur retiré car présent ailleurs */}
      </aside>
    </>
  );
}
