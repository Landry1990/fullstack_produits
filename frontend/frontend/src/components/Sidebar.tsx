import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Sidebar() {
  const { user, logout } = useAuth();
  
  const allMenuItems = [
    { path: '/', label: 'Tableau de bord', key: 'dashboard', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
    )},
    { path: '/ventes', label: 'Ventes', key: 'ventes', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    )},
    { path: '/facturation', label: 'Facturation', key: 'facturation', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
    )},
    { path: '/produits', label: 'Produits', key: 'produits', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
    )},
    { path: '/commandes', label: 'Commandes', key: 'commandes', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
    )},
    { path: '/fournisseurs', label: 'Fournisseurs', key: 'fournisseurs', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
    )},
    { path: '/clients', label: 'Clients', key: 'clients', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
    )},
    { 
      label: 'Stock', 
      key: 'stock', 
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
      ),
      submenus: [
        { path: '/inventaire', label: 'Inventaire', key: 'inventaire' },
        { path: '/formes', label: 'Formes', key: 'formes' },
        { path: '/rayons', label: 'Rayons', key: 'rayons' }
      ]
    },
    { path: '/statistiques', label: 'Statistiques', key: 'statistiques', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" /></svg>
    )},
  ];

  // Filter menu items based on permissions
  const menuItems = allMenuItems.filter(item => {
    if (user?.is_superuser) return true;
    // Dashboard is always accessible
    if (item.key === 'dashboard') return true;
    
    // Check if item has submenus
    if (item.submenus) {
      // If any submenu is allowed, show the parent
      return item.submenus.some(sub => user?.allowed_menus?.includes(sub.key));
    }
    
    return user?.allowed_menus?.includes(item.key);
  });

  // Add User Management for superusers
  if (user?.is_superuser) {
    menuItems.push({
      path: '/utilisateurs',
      label: 'Utilisateurs',
      key: 'utilisateurs',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
      )
    });
  }

  return (
    <aside className="w-64 bg-base-100 border-r border-base-300 flex flex-col h-screen sticky top-0">
      <div className="p-6 border-b border-base-300 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-content font-bold text-xl">
          P
        </div>
        <div>
          <h1 className="text-xl font-bold text-primary">PharmaStock</h1>
          <p className="text-xs text-base-content/80">Gestion Pro</p>
        </div>
      </div>
      
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="menu w-full px-2 gap-1">
          {menuItems.map((item) => (
            <li key={item.key}>
              {item.submenus ? (
                <details className="group">
                  <summary className="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-base-content/80 hover:bg-base-200 hover:text-base-content cursor-pointer marker:content-none">
                    {item.icon}
                    <span className="flex-1">{item.label}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                  </summary>
                  <ul className="menu menu-sm pl-8 mt-1 gap-1">
                    {item.submenus.map((sub) => (
                      (!user?.is_superuser && !user?.allowed_menus?.includes(sub.key)) ? null : (
                      <li key={sub.path}>
                        <NavLink 
                          to={sub.path}
                          className={({ isActive }) => 
                            `rounded-lg ${isActive ? 'bg-primary/10 text-primary font-medium' : 'text-base-content/70'}`
                          }
                        >
                          {sub.label}
                        </NavLink>
                      </li>
                      )
                    ))}
                  </ul>
                </details>
              ) : (
                <NavLink 
                  to={item.path}
                  className={({ isActive }) => 
                    `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive 
                        ? 'bg-primary/10 text-primary font-medium' 
                        : 'text-base-content/80 hover:bg-base-200 hover:text-base-content'
                    }`
                  }
                >
                  {item.icon}
                  {item.label}
                </NavLink>
              )}
            </li>
          ))}
        </ul>
      </nav>

      <div className="p-4 border-t border-base-300">
        <div className="flex items-center gap-3 p-2 rounded-lg bg-base-200/50 mb-2">
          <div className="w-8 h-8 rounded-full bg-neutral text-neutral-content flex items-center justify-center text-sm uppercase">
            {user?.username.charAt(0) || 'A'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.username || 'Admin'}</p>
            <p className="text-xs text-base-content/80 truncate">Pharmacien</p>
          </div>
        </div>
        <button 
          onClick={logout}
          className="btn btn-sm btn-ghost w-full text-error hover:bg-error/10 gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          Déconnexion
        </button>
      </div>
    </aside>
  );
}
