import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import Layout from './components/Layout'
import Produit from './components/Produit'
import Commandes from './components/Commandes'
import Ventes from './components/Ventes'
import Fournisseurs from './components/Fournisseurs'
import Clients from './components/Clients'
import Rayons from './components/Rayons'

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Produit /> },
      { path: 'produits', element: <Produit /> },
      { path: 'commandes', element: <Commandes /> },
      { path: 'ventes', element: <Ventes /> },
      { path: 'fournisseurs', element: <Fournisseurs /> },
      { path: 'clients', element: <Clients /> },
      { path: 'rayons', element: <Rayons /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}