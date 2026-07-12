import { Suspense, useState, useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useLicenceShortcut } from './hooks/useLicenceShortcut'
import { AuthProvider } from './context/AuthContext'
import { ConfirmProvider } from './hooks/useConfirm'
import { PharmacySettingsProvider } from './context/PharmacySettingsContext'
import { LicenceProvider } from './context/LicenceContext'
import { Toaster } from 'react-hot-toast'
import ErrorBoundary from './components/ErrorBoundary'
import { LicenceNotifications } from './components/LicenceNotifications'
import { ExpirationAlertToasts } from './components/ExpirationAlertToast'
import { useAuth } from './context/AuthContext'
import { router } from './routes'

const MAX_ATTEMPTS = 10; // ~50 secondes d'attente max

function BackendHealthCheck({ children }: { children: React.ReactNode }) {
  const [attempts, setAttempts] = useState(0);

  const { data, errorUpdatedAt } = useQuery({
    queryKey: ['backendHealthCheck'],
    queryFn: async ({ signal }) => {
      const res = await fetch('/api/health/', { cache: 'no-store', signal });
      if (!res.ok) {
        throw new Error('Backend not ready');
      }
      return res.json();
    },
    // Poll every 5s while still waiting and under the attempt limit
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.code_erreur === 'LICENCE_INVALIDE') return false;
      if (data && !data.code_erreur) return false;
      if (attempts >= MAX_ATTEMPTS) return false;
      return 5000;
    },
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Increment attempt count on each failed health-check fetch
  useEffect(() => {
    if (errorUpdatedAt) {
      setAttempts(a => a + 1);
    }
  }, [errorUpdatedAt]);

  const ready = !!data && data.code_erreur !== 'LICENCE_INVALIDE';
  const licenceError = data?.code_erreur === 'LICENCE_INVALIDE';
  // failed is always derivable from attempts — no separate useState needed
  const failed = attempts >= MAX_ATTEMPTS;

  // Redirection vers la page de licence si erreur de licence
  if (licenceError) {
    window.location.href = '/licence';
    return (
      <div className="h-screen flex items-center justify-center bg-base-100">
        <div className="flex flex-col items-center gap-4">
          <span className="loading loading-spinner loading-lg text-primary"></span>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-base-content/40">
            Redirection vers la page de licence...
          </p>
        </div>
      </div>
    );
  }

  if (ready) return <>{children}</>;

  // Afficher message d'erreur après épuisement des tentatives
  if (failed) {
    return (
      <div className="h-screen flex items-center justify-center bg-base-100">
        <div className="flex flex-col items-center gap-4 max-w-md px-4">
          <span className="text-4xl text-error">⚠️</span>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-error animate-pulse">
            Connexion impossible
          </p>
          <p className="text-[10px] text-base-content/50 text-center">
            Le serveur backend ne répond pas après {MAX_ATTEMPTS} tentatives.
          </p>
          <div className="flex flex-col gap-2 text-center">
            <p className="text-[10px] text-base-content/30">
              Vérifiez que :
            </p>
            <ul className="text-[10px] text-base-content/40 list-disc list-inside text-left">
              <li>Le backend est démarré (docker compose up)</li>
              <li>La licence est valide</li>
              <li>La base de données est accessible</li>
            </ul>
          </div>
          <button 
            type="button"
            onClick={() => window.location.reload()}
            className="btn btn-sm btn-primary mt-4"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex items-center justify-center bg-base-100">
      <div className="flex flex-col items-center gap-4">
        <span className="loading loading-spinner loading-lg text-primary"></span>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-base-content/40 animate-pulse">
          Démarrage du système en cours...
        </p>
        <p className="text-[10px] text-base-content/30">
          {attempts > 0 ? `Tentative ${attempts}/${MAX_ATTEMPTS}...` : 'Vérification du serveur...'}
        </p>
      </div>
    </div>
  );
}

/**
 * App Component
 * 
 * Main entry point of the application.
 * Responsibilities:
 * 1. Global Context Providers (Auth, Settings, Confirmation)
 * 2. Global UI elements (Toaster, Suspense fallback)
 * 3. Router injection
 * 
 * Route definitions are now managed in src/routes.tsx for better maintainability.
 */
function GlobalAlerts() {
  const { isAuthenticated, loading } = useAuth();
  if (loading || !isAuthenticated) return null;
  return <ExpirationAlertToasts />;
}

export default function App() {
  useLicenceShortcut();

  return (
    <ErrorBoundary>
      <AuthProvider>
        <LicenceProvider>
          <PharmacySettingsProvider>
            <ConfirmProvider>
              <Toaster position="top-right" />
              <LicenceNotifications />
              <GlobalAlerts />
              <BackendHealthCheck>
                <Suspense fallback={
                  <div className="h-screen flex items-center justify-center bg-base-100">
                    <div className="flex flex-col items-center gap-4">
                      <span className="loading loading-spinner loading-lg text-primary"></span>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-base-content/40 animate-pulse">
                        Chargement du système...
                      </p>
                    </div>
                  </div>
                }>
                  <RouterProvider router={router} />
                </Suspense>
              </BackendHealthCheck>
            </ConfirmProvider>
          </PharmacySettingsProvider>
        </LicenceProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}