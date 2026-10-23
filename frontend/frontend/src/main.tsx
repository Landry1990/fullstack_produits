import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

// Fonts Local (Offline Support) — subset latin uniquement : les variantes
// vietnamese/cyrillic/greek/ext étaient precachées (~50 fichiers morts).
import "@fontsource/inter/latin-300.css";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";

import './i18n'
import App from './App.tsx'
import { syncSessionFromOpener, consumePrintAuthSync } from './utils/storage'

// Pour les onglets ouverts via window.open() (ex: page d'impression), sessionStorage n'est pas
// partagé avec l'onglet parent → on copie les clés d'auth depuis l'opener (same-origin).
syncSessionFromOpener();

// Fallback pour les onglets ouverts avec `noopener` : on récupère les clés d'auth depuis
// un localStorage temporaire posé par `preparePrintAuthSync()`.
consumePrintAuthSync();

// Filet de sécurité boot : un chunk qui échoue au chargement ou un binding
// non initialisé (import circulaire) laisse sinon une page blanche — React
// n'ayant jamais monté, aucune ErrorBoundary ne peut s'afficher. On recharge
// une fois ; le compteur (réinitialisé 30 s après un boot réussi) évite la
// boucle de reloads si l'erreur est déterministe.
const BOOT_RELOAD_KEY = 'boot_reload_count';
const isBootFatal = (reason: unknown): boolean => {
  const msg = String(reason instanceof Error ? reason.message : reason ?? '');
  return msg.includes('dynamically imported module')
    || msg.includes('error loading dynamically imported module')
    || msg.includes('Importing a module script failed')
    || msg.includes('before initialization')
    || msg.includes('ChunkLoadError');
};
const bootReload = (): void => {
  const count = parseInt(sessionStorage.getItem(BOOT_RELOAD_KEY) || '0', 10);
  if (count < 3) {
    sessionStorage.setItem(BOOT_RELOAD_KEY, String(count + 1));
    window.location.reload();
  }
};
window.addEventListener('error', (e) => { if (isBootFatal(e.message)) bootReload(); });
window.addEventListener('unhandledrejection', (e) => { if (isBootFatal(e.reason)) bootReload(); });
setTimeout(() => sessionStorage.removeItem(BOOT_RELOAD_KEY), 30_000);

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Désactivé par défaut : évite de refetch TOUTES les queries au switch d'onglet.
      // Les hooks critiques (stock, caisse) activent refetchOnWindowFocus: true localement.
      refetchOnWindowFocus: false,
      refetchOnMount: true,       // S'assure que les données sont fraîches au montage
      refetchOnReconnect: true,   // Rafraîchit si la connexion réseau coupe puis revient
      staleTime: 1000 * 60,       // 60 secondes de cache avant de considérer les données comme périmées
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
