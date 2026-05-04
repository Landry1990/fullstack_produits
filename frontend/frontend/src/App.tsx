import { Suspense } from 'react'
import { RouterProvider } from 'react-router-dom'
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
  return (
    <ErrorBoundary>
      <AuthProvider>
        <LicenceProvider>
          <PharmacySettingsProvider>
            <ConfirmProvider>
              <Toaster position="top-right" />
              <LicenceNotifications />
              <GlobalAlerts />
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
            </ConfirmProvider>
          </PharmacySettingsProvider>
        </LicenceProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}