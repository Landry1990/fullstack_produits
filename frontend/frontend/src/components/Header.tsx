import { NavLink } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';

export default function Header() {
  const linkClasses = 'btn btn-ghost normal-case text-xl';
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  const handleMenuToggle = (menuName: string) => {
    setOpenMenu(openMenu === menuName ? null : menuName);
  };

  const closeMenus = () => {
    setOpenMenu(null);
  };

  // Ferme le menu si on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        closeMenus();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <header className="navbar bg-base-300 shadow-md mb-6">
      <div className="flex-1">
        <NavLink to="/" className="btn btn-ghost normal-case text-2xl">
          StockApp
        </NavLink>
      </div>
      <div className="flex-none">
        <ul className="menu menu-horizontal px-1" ref={menuRef}>
          <li className={`dropdown dropdown-end ${openMenu === 'ventes' ? 'dropdown-open' : ''}`}>
            <div tabIndex={0} role="button" className={linkClasses} onClick={() => handleMenuToggle('ventes')}>
              Ventes
            </div>
            <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52" onClick={closeMenus}>
              <li>
                <NavLink to="/ventes">Gestion des Ventes</NavLink>
              </li>
              <li>
                <NavLink to="/facturation">Facturation</NavLink>
              </li>
            </ul>
          </li>
          <li className={`dropdown dropdown-end ${openMenu === 'listes' ? 'dropdown-open' : ''}`}>
            <div tabIndex={0} role="button" className={linkClasses} onClick={() => handleMenuToggle('listes')}>
              Listes
            </div>
            <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52" onClick={closeMenus}>
                <li><NavLink to="/produits">Produits</NavLink></li>
                <li><NavLink to="/commandes">Commandes</NavLink></li>
                <li><NavLink to="/fournisseurs">Fournisseurs</NavLink></li>
                <li><NavLink to="/clients">Clients</NavLink></li>
                <li><NavLink to="/rayons">Catégories</NavLink></li>
            </ul>
          </li>
        </ul>
      </div>
    </header>
  );
}
