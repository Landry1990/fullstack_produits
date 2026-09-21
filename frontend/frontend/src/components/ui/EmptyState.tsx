import { Search } from 'lucide-react';
import { cn } from '../../lib/utils';

interface EmptyStateProps {
    icon?: React.ReactNode;
    title: React.ReactNode;
    description?: React.ReactNode;
    action?: React.ReactNode;
    /** @deprecated Conservé pour compatibilité — les deux variantes rendent pareil désormais */
    variant?: 'slate' | 'base';
    compact?: boolean;
    className?: string;
}

export function EmptyState({
    icon,
    title,
    description,
    action,
    compact = false,
    className,
}: EmptyStateProps) {

    return (
        <div
            className={cn(
                "flex flex-col items-center justify-center text-center",
                compact ? "p-4" : "p-8",
                className
            )}
        >
            <div
                className={cn(
                    "rounded-full flex items-center justify-center",
                    compact ? "size-12 mb-2" : "size-16 mb-4",
                    "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
                )}
            >
                {icon ?? <Search className={compact ? "size-6" : "size-8"} />}
            </div>
            <h3
                className={cn(
                    "font-semibold",
                    compact ? "text-sm" : "text-base",
                    "text-slate-500 dark:text-slate-400"
                )}
            >
                {title}
            </h3>
            {description && (
                <p
                    className={cn(
                        "text-sm mt-1 max-w-sm",
                        "text-slate-400 dark:text-slate-500"
                    )}
                >
                    {description}
                </p>
            )}
            {action && <div className="mt-6">{action}</div>}
        </div>
    );
}
