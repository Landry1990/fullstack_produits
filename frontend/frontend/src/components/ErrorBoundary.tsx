import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);

    // Rechargement automatique si c'est une erreur de chargement de chunk lazy
    const isChunkError = error.message?.includes('dynamically imported module')
      || error.message?.includes('Failed to fetch dynamically imported module')
      || error.message?.includes('error loading dynamically imported module')
      || error.name === 'ChunkLoadError';

    if (isChunkError) {
      console.warn('Chunk load error détecté — rechargement automatique...');
      window.location.reload();
    }
  }

  public render() {
    if (this.state.hasError) {
      const isChunkError = this.state.error?.message?.includes('dynamically imported module')
        || this.state.error?.message?.includes('Failed to fetch dynamically imported module')
        || this.state.error?.name === 'ChunkLoadError';

      if (isChunkError) {
        return (
          <div className="min-h-screen flex items-center justify-center bg-base-200 p-4">
            <div className="card w-96 bg-base-100 shadow-xl">
              <div className="card-body items-center text-center">
                <span className="loading loading-spinner loading-lg text-primary"></span>
                <h2 className="card-title mt-4">Mise à jour détectée</h2>
                <p className="py-2 text-sm text-base-content/60">Rechargement en cours...</p>
              </div>
            </div>
          </div>
        );
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-base-200 p-4">
          <div className="card w-96 bg-base-100 shadow-xl">
            <div className="card-body items-center text-center">
              <h2 className="card-title text-error">Oups ! Une erreur est survenue.</h2>
              <p className="py-4 text-sm text-base-content/60">
                L'application a rencontré un problème inattendu.
              </p>
              {this.state.error && (
                <div className="alert alert-error text-xs text-left overflow-auto max-h-32 mb-4">
                  <code>{this.state.error.toString()}</code>
                </div>
              )}
              <div className="card-actions justify-end">
                <button 
                  className="btn btn-primary"
                  onClick={() => window.location.reload()}
                >
                  Rafraîchir la page
                </button>
                <button 
                  className="btn btn-ghost"
                  onClick={() => window.location.href = '/'}
                >
                  Retour à l'accueil
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
