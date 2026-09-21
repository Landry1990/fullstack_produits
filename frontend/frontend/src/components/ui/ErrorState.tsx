import { useTranslation } from 'react-i18next';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ErrorStateProps {
    error: unknown;
    onRetry?: () => void;
    retrying?: boolean;
    compact?: boolean;
    className?: string;
}

function toMessage(error: unknown): string {
    if (!error) return '';
    if (error instanceof Error) return error.message;
    return String(error);
}

/**
 * Bannière d'erreur réutilisable avec bouton "Réessayer" optionnel.
 * À utiliser partout où un `{error && <div>{error}</div>}` brut était affiché.
 */
export function ErrorState({ error, onRetry, retrying = false, compact = false, className }: ErrorStateProps) {
    const { t } = useTranslation();
    const message = toMessage(error);
    if (!message) return null;

    return (
        <div
            role="alert"
            className={cn(
                "flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl text-red-700",
                compact ? "p-2 text-xs" : "p-3 text-sm",
                className
            )}
        >
            <AlertTriangle className={cn("shrink-0", compact ? "size-3.5" : "size-4")} />
            <span className="flex-1 min-w-0">{message}</span>
            {onRetry && (
                <button
                    type="button"
                    onClick={onRetry}
                    disabled={retrying}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors cursor-pointer"
                >
                    <RefreshCw className={cn("size-3.5", retrying && "animate-spin")} />
                    {t('common:retry', { defaultValue: 'Réessayer' })}
                </button>
            )}
        </div>
    );
}
