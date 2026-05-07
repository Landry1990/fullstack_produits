import { useEffect } from 'react';
import { useRouteError, useNavigate, isRouteErrorResponse } from 'react-router-dom';

export default function RouteErrorBoundary() {
  const error = useRouteError() as any;
  const navigate = useNavigate();

  const errorMessage = error?.message || error?.error?.message || error?.data || '';
  const errorName = error?.name || error?.error?.name || '';
  const isChunkError = String(errorMessage).includes('dynamically imported module')
    || String(errorMessage).includes('Failed to fetch dynamically imported module')
    || String(errorMessage).includes('error loading dynamically imported module')
    || String(errorMessage).includes('Importing a module script failed')
    || errorName === 'ChunkLoadError';

  useEffect(() => {
    if (isChunkError) {
      console.warn('Chunk load error détecté par le routeur — rechargement automatique...');
      const reloadCount = parseInt(sessionStorage.getItem('chunk_reload_count') || '0', 10);
      if (reloadCount < 3) {
        sessionStorage.setItem('chunk_reload_count', (reloadCount + 1).toString());
        window.location.reload();
      }
    } else {
      console.error('Route error caught by RouteErrorBoundary:', error);
    }
  }, [isChunkError, error]);

  const reloadCount = parseInt(sessionStorage.getItem('chunk_reload_count') || '0', 10);
  const showLoading = isChunkError && reloadCount < 3;

  if (showLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-200 p-4">
        <div className="card w-96 bg-base-100 shadow-xl">
          <div className="card-body items-center text-center">
            <span className="loading loading-spinner loading-lg text-primary"></span>
            <h2 className="card-title mt-4">Mise à jour détectée</h2>
            <p className="py-2 text-sm text-base-content/60">Rechargement de l'application en cours...</p>
          </div>
        </div>
      </div>
    );
  }

  let displayError = 'Erreur inconnue';
  if (isRouteErrorResponse(error)) {
    displayError = `${error.status} ${error.statusText}: ${error.data}`;
  } else if (error instanceof Error) {
    displayError = error.message;
  } else if (typeof error === 'string') {
    displayError = error;
  } else if (error?.message) {
    displayError = error.message;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200 p-4">
      <div className="card w-full max-w-md bg-base-100 shadow-xl border border-error/20">
        <div className="card-body items-center text-center">
          <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center mb-2 text-error">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="card-title text-error mb-2">Oups ! Une erreur est survenue.</h2>
          <p className="text-sm text-base-content/70 mb-4">
            L'application a rencontré un problème inattendu lors de l'affichage de cette page.
          </p>
          <div className="bg-base-200 p-3 rounded-lg w-full text-left overflow-x-auto mb-6">
            <code className="text-xs text-error font-mono whitespace-pre-wrap">{displayError}</code>
          </div>
          <div className="flex w-full gap-3">
            <button 
              className="btn btn-outline flex-1"
              onClick={() => {
                navigate('/');
                window.location.reload();
              }}
            >
              Accueil
            </button>
            <button 
              className="btn btn-primary flex-1"
              onClick={() => {
                sessionStorage.removeItem('chunk_reload_count');
                window.location.reload();
              }}
            >
              Rafraîchir
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
