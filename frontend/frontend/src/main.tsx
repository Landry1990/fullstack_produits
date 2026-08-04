import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

// Fonts Local (Offline Support)
import "@fontsource/inter/300.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";

import './i18n'
import App from './App.tsx'
import { syncSessionFromOpener } from './utils/storage'

// Pour les onglets ouverts via window.open() (ex: page d'impression), sessionStorage n'est pas
// partagé avec l'onglet parent → on copie les clés d'auth depuis l'opener (same-origin).
syncSessionFromOpener();

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true, // Rafraîchit quand l'utilisateur revient sur la fenêtre
      refetchOnMount: true,       // S'assure que les données sont fraîches au montage
      refetchOnReconnect: true,   // Rafraîchit si la connexion réseau coupe puis revient
      staleTime: 1000 * 30,       // 30 secondes de cache avant de considérer les données comme périmées
      refetchInterval: false,     // Pas de polling global — les hooks spécifiques peuvent l'activer
    },
  },
})



createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
