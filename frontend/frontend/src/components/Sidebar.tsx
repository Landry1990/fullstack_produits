import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSidebar } from '../context/SidebarContext';
import PharmaCrossLogo from './PharmaCrossLogo';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export default function Sidebar() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const { isOpen, isCollapsed, toggleSidebar, closeSidebar, toggleCollapse } = useSidebar();
  const location = useLocation();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  
  const allMenuItems = [
    { path: '/app', label: t('sidebar.dashboard'), key: 'dashboard', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
    )},
    { path: '/app/manager-dashboard', label: t('sidebar.manager_sidebar'), key: 'manager_sidebar', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" /></svg>
    )},
    { 
      label: t('sidebar.ventes.title'), 
      key: 'ventes', 
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      ),
      submenus: [
        { path: '/app/ventes', label: t('sidebar.ventes.consultation'), key: 'ventes' },
        { path: '/app/historique-ventes', label: t('sidebar.ventes.historique'), key: 'ventes' },
        { path: '/app/journal-caisse', label: t('sidebar.ventes.journal'), key: 'ventes' },
        { path: '/app/historique-clotures', label: t('sidebar.ventes.clotures'), key: 'ventes' },
        { path: '/app/ordonnancier', label: t('sidebar.ventes.ordonnancier'), key: 'ventes' },
        { path: '/app/promotions', label: t('sidebar.ventes.promotions'), key: 'ventes' },
        { path: '/app/caisse-centralisee', label: t('sidebar.ventes.caisse_centralisee'), key: 'caisse' }
      ]
    },
    { path: '/app/facturation', label: t('sidebar.facturation'), key: 'facturation', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
    )},
    { path: '/app/produits', label: t('sidebar.produits'), key: 'produits', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
    )},
    { path: '/app/vitrine', label: t('sidebar.vitrine'), key: 'produits', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
    )},
    { 
      label: t('sidebar.commandes.local_title'), 
      key: 'commandes_loc', 
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
      ),
      submenus: [
        { path: '/app/commandes/locales', label: t('sidebar.commandes.new_current'), key: 'commandes' },
        { path: '/app/historique-achats/locales', label: t('sidebar.commandes.history'), key: 'commandes' },
      ]
    },
    { 
      label: t('sidebar.commandes.direct_title'), 
      key: 'commandes_dir', 
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
      ),
      submenus: [
        { path: '/app/commandes/directes', label: t('sidebar.commandes.new_current'), key: 'commandes' },
        { path: '/app/historique-achats/directes', label: t('sidebar.commandes.history'), key: 'commandes' },
      ]
    },
    { path: '/app/fournisseurs', label: t('sidebar.fournisseurs.title'), key: 'fournisseurs', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
    )},
    { path: '/app/clients', label: t('sidebar.clients'), key: 'clients', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
    )},
    { path: '/app/creances', label: t('sidebar.creances'), key: 'creances', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
    )},
    { 
      label: t('sidebar.stock.title'), 
      key: 'stock', 
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
      ),
      submenus: [
        { path: '/app/inventaire', label: t('sidebar.stock.inventaire'), key: 'inventaire' },
        { path: '/app/journal-ajustements', label: t('sidebar.stock.journal'), key: 'inventaire' },
        { path: '/app/stock-analysis', label: t('sidebar.stock.analyse'), key: 'inventaire' },
        { path: '/app/avoirs', label: t('sidebar.stock.avoirs'), key: 'avoirs' },
        { path: '/app/promis', label: t('sidebar.stock.promis'), key: 'promis' },
        { path: '/app/transformations', label: t('sidebar.stock.transformations'), key: 'inventaire' },
        { path: '/app/perimes', label: t('sidebar.stock.perimes'), key: 'inventaire' },
        { path: '/app/formes', label: t('sidebar.stock.formes'), key: 'formes' },
        { path: '/app/groupes', label: t('sidebar.stock.groupes'), key: 'groupes' },
        { path: '/app/rayons', label: t('sidebar.stock.rayons'), key: 'rayons' },
        { path: '/app/etats-inventaire', label: 'États Inventaires', key: 'inventaire' }
      ]
    },
    { 
      label: t('sidebar.statistiques.title'), 
      key: 'statistiques', 
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" /></svg>
      ),
      submenus: [
        { path: '/app/centre-rapports', label: t('sidebar.statistiques.rapports'), key: 'statistiques' },
        { path: '/app/analyse-abc', label: t('sidebar.statistiques.abc'), key: 'statistiques' },
        { path: '/app/statistiques-fournisseurs', label: t('sidebar.statistiques.fournisseurs'), key: 'statistiques' },
        { path: '/app/rapports-mensuels', label: t('sidebar.statistiques.mensuel'), key: 'statistiques' },
        { path: '/app/module-financier', label: t('sidebar.statistiques.finances'), key: 'statistiques' },
        { path: '/app/classement-vendeurs', label: t('sidebar.statistiques.classement_vendeurs', 'Classement Vendeurs'), key: 'statistiques' },
        { path: '/app/analyse-temporelle', label: t('sidebar.statistiques.analyse_temporelle', 'Analyse Temporelle'), key: 'statistiques' }
      ]
    },
    {
      label: t('sidebar.parametres.title'),
      key: 'settings',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
      ),
      submenus: [
        { path: '/app/invoice-settings', label: t('sidebar.parametres.facture'), key: 'settings' },
        { path: '/app/pharmacy-settings', label: t('sidebar.parametres.pharmacie'), key: 'settings' },
        { path: '/app/settings/options', label: t('sidebar.parametres.etiquettes'), key: 'settings' }
      ]
    },
  ];

  // Logic to calculate menuItems based on authentication
  const menuItems = allMenuItems.filter(item => {
    if (user?.is_superuser) return true;
    const allowed = (user as any)?.allowed_menus || [];
    if (item.submenus) {
      return item.submenus.some(sub => allowed.includes(sub.key));
    }
    return allowed.includes(item.key);
  });

  if (user?.is_superuser) {
    menuItems.push({
      path: '/app/utilisateurs',
      label: t('sidebar.utilisateurs'),
      key: 'utilisateurs',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
      )
    });
    menuItems.push({
      path: '/app/journal-audit',
      label: t('sidebar.audit'),
      key: 'audit',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
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

  return (
    <>
      <button
        onClick={toggleSidebar}
        className="fixed top-4 left-4 z-50 lg:hidden btn btn-circle btn-primary shadow-lg"
        aria-label="Toggle menu"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          {isOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      <aside 
        className={`pharma-sidebar flex flex-col h-screen fixed lg:sticky top-0 z-50 transition-all duration-300 ease-in-out
          ${isCollapsed ? 'w-[72px]' : 'w-64'}
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="pharma-sidebar-header p-4 flex items-center gap-3">
          <PharmaCrossLogo size={isCollapsed ? 32 : 48} />
          {!isCollapsed && (
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-white truncate">Zenith</h1>
              <p className="text-xs text-green-400 truncate">{t('sidebar.app_subtitle')}</p>
            </div>
          )}
        </div>

        <button
          onClick={toggleCollapse}
          className="hidden lg:flex items-center justify-center mx-auto my-1 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all duration-200"
          title={isCollapsed ? 'Déplier le menu' : 'Replier le menu'}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
        
        <nav className="flex-1 overflow-y-auto py-2">
          <ul className={`menu w-full gap-1 ${isCollapsed ? 'px-1' : 'px-2'}`}>
            {menuItems.map((item) => {
              const hasSubmenus = !!item.submenus;
              const isParentOfActive = item.submenus?.some(sub => location.pathname === sub.path);
              const isOpen = openMenu === item.key;

              if (hasSubmenus) {
                return (
                  <li key={item.key}>
                    {isCollapsed ? (
                      /* Mode replié : Dropdown */
                      <div className="dropdown dropdown-right w-full">
                        <div tabIndex={0} role="button" 
                          className={`pharma-menu-item flex items-center justify-center px-2 py-3 rounded-lg hover:text-white cursor-pointer ${isParentOfActive ? 'text-green-400' : 'text-white/70'}`}
                        >
                          {item.icon}
                        </div>
                        <ul tabIndex={0} className="dropdown-content z-[100] menu p-2 shadow-xl bg-slate-800 rounded-box w-56 ml-1">
                          <li className="menu-title text-green-400 text-xs font-semibold px-2 py-1">{item.label}</li>
                          {item.submenus?.map((sub) => (
                            <li key={sub.path}>
                              <NavLink to={sub.path} onClick={closeSidebar}
                                className={({ isActive }) => `rounded-lg text-sm ${isActive ? 'bg-green-500/10 text-green-400 font-medium' : 'text-white/80 hover:text-white hover:bg-white/10'}`}
                              >
                                {sub.label}
                              </NavLink>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      /* Mode déployé : Contrôlé */
                      <>
                        <div 
                          className={`pharma-menu-item flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-colors duration-200
                            ${isParentOfActive || isOpen ? 'text-green-400' : 'text-white/70 hover:text-white'}
                          `}
                          onClick={() => toggleMenu(item.key)}
                        >
                          {item.icon}
                          <span className="flex-1 font-medium">{item.label}</span>
                          <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                          <ul className="menu menu-sm pl-8 gap-1 mt-1">
                            {item.submenus?.map((sub) => (
                              <li key={sub.path}>
                                <NavLink to={sub.path} onClick={closeSidebar}
                                  className={({ isActive }) => `rounded-lg text-sm ${isActive ? 'bg-green-500/10 text-green-400 font-medium' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
                                >
                                  {sub.label}
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
                    className={({ isActive }) => 
                      `pharma-menu-item flex items-center ${isCollapsed ? 'justify-center px-2' : 'gap-3 px-4'} py-3 rounded-lg ${
                        isActive ? 'text-green-400 font-medium' : 'text-white/70 hover:text-white'
                      }`
                    }
                    title={isCollapsed ? item.label : undefined}
                  >
                    {item.icon}
                    {!isCollapsed && item.label}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className={`p-3 border-t border-white/10 ${isCollapsed ? 'flex flex-col items-center' : ''}`}>
          {!isCollapsed ? (
            <>
              <div className="flex items-center gap-3 p-2 rounded-lg bg-white/5 mb-2">
                <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center text-sm uppercase font-bold">
                  {user?.username.charAt(0) || 'A'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{user?.username || 'Admin'}</p>
                  <p className="text-xs text-white/60 truncate">
                    {user?.is_superuser ? t('sidebar.roles.pharmacist') : t('sidebar.roles.user')}
                  </p>
                </div>
              </div>
              <button onClick={logout} className="btn btn-sm btn-ghost w-full text-red-400 hover:bg-red-500/10 hover:text-red-300 gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                {t('sidebar.logout')}
              </button>
              <div className="mt-3 flex gap-2 justify-center">
                <button className={`btn btn-xs ${i18n.language === 'fr' ? 'btn-primary' : 'btn-ghost text-white/50'}`} onClick={() => i18n.changeLanguage('fr')}>FR</button>
                <button className={`btn btn-xs ${i18n.language === 'en' ? 'btn-primary' : 'btn-ghost text-white/50'}`} onClick={() => i18n.changeLanguage('en')}>EN</button>
              </div>
            </>
          ) : (
            <>
              <div className="w-9 h-9 rounded-full bg-green-500 text-white flex items-center justify-center text-sm uppercase font-bold mb-2" title={user?.username || 'Admin'}>
                {user?.username.charAt(0) || 'A'}
              </div>
              <button onClick={logout} className="btn btn-xs btn-ghost text-red-400 hover:bg-red-500/10 hover:text-red-300" title="Déconnexion">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              </button>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
