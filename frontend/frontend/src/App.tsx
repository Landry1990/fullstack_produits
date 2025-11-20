import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import Layout from './components/Layout'
import Produit from './components/Produit'
import Commandes from './components/Commandes'
import Ventes from './components/Ventes'
import Fournisseurs from './components/Fournisseurs'
import Clients from './components/Clients'
import Rayons from './components/Rayons'
import Facturation from './components/Facturation'
import Dashboard from './components/Dashboard'

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'produits', element: <Produit /> },
      { path: 'commandes', element: <Commandes /> },
      { path: 'ventes', element: <Ventes /> },
      { path: 'fournisseurs', element: <Fournisseurs /> },
      { path: 'clients', element: <Clients /> },
      { path: 'rayons', element: <Rayons /> },
      { path: 'facturation', element: <Facturation /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}