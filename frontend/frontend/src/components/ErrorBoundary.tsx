import { Component, type ErrorInfo, type ReactNode } from 'react';
import { withTranslation, type WithTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Button } from './shadcn/button';
import { logger } from '../utils/logger'

interface Props extends WithTranslation {
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
    logger.error('Uncaught error:', error, errorInfo);

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
    const { t } = this.props;
    if (this.state.hasError) {
      const isChunkError = this.state.error?.message?.includes('dynamically imported module')
        || this.state.error?.message?.includes('Failed to fetch dynamically imported module')
        || this.state.error?.name === 'ChunkLoadError';

      if (isChunkError) {
        return (
          <div className="min-h-screen flex items-center justify-center bg-base-200 p-4">
            <div className="w-96 bg-base-100 shadow-xl rounded-2xl border border-base-200 p-6 items-center text-center">
                <Loader2 className="size-8 animate-spin text-primary" />
                <h2 className="text-lg font-bold mt-4">{t('error_boundary.update_detected')}</h2>
                <p className="py-2 text-sm text-base-content/60">{t('error_boundary.reloading')}</p>
            </div>
          </div>
        );
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-base-200 p-4">
          <div className="w-96 bg-base-100 shadow-xl rounded-2xl border border-base-200 p-6 items-center text-center">
              <h2 className="text-lg font-bold text-red-500">{t('error_boundary.oops')}</h2>
              <p className="py-4 text-sm text-base-content/60">
                {t('error_boundary.unexpected')}
              </p>
              {this.state.error && (
                <div className="bg-red-50 border border-red-200 text-red-800 text-xs text-left overflow-auto max-h-32 mb-4 p-3 rounded-lg">
                  <code>{this.state.error.toString()}</code>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button 
                  variant="default"
                  onClick={() => window.location.reload()}
                >
                  {t('error_boundary.refresh_page')}
                </Button>
                <Button 
                  variant="ghost"
                  onClick={() => window.location.href = '/'}
                >
                  {t('error_boundary.back_home')}
                </Button>
              </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default withTranslation('common')(ErrorBoundary);
