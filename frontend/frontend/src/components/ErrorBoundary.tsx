import React, { Component, ErrorInfo, ReactNode } from 'react';

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
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
          <div className="card w-96 bg-base-100 shadow-xl">
            <div className="card-body items-center text-center">
              <h2 className="card-title text-error">Oups ! Une erreur est survenue.</h2>
              <p className="py-4 text-sm text-gray-500">
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
