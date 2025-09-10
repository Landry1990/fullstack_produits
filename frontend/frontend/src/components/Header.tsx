import { NavLink } from 'react-router-dom'
import { useRef } from 'react'

export default function Header() {
  const linkClasses =
    'btn btn-ghost normal-case text-xl'
  const dropdownRef = useRef<HTMLDetailsElement>(null)

  const closeDropdown = () => {
    if (dropdownRef.current) {
      dropdownRef.current.removeAttribute('open');
    }
  }

  return (
    <header className="navbar bg-base-300 shadow-md mb-6">
      <div className="flex-1">
        <NavLink to="/" className="btn btn-ghost normal-case text-2xl">
          StockApp
        </NavLink>
      </div>
      <div className="flex-none">
        <ul className="menu menu-horizontal px-1">
          <li><NavLink to="/ventes" className={({ isActive }) => `${linkClasses} ${isActive ? 'btn-active' : ''}`}>Ventes</NavLink></li>
          <li>
            <details className="dropdown" ref={dropdownRef}>
              <summary className={linkClasses}>Listes</summary>
              <ul 
                className="p-2 shadow menu dropdown-content z-[1] bg-base-100 rounded-box w-52"
                onClick={closeDropdown}
              >
                <li><NavLink to="/produits">Produits</NavLink></li>
                <li><NavLink to="/commandes">Commandes</NavLink></li>
                <li><NavLink to="/fournisseurs">Fournisseurs</NavLink></li>
                <li><NavLink to="/clients">Clients</NavLink></li>
                <li><NavLink to="/rayons">Catégories</NavLink></li>
              </ul>
            </details>
          </li>
        </ul>
      </div>
    </header>
  )
}