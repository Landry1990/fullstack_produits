import { Search } from 'lucide-react';
import { cn } from '../../lib/utils';

interface EmptyStateProps {
    icon?: React.ReactNode;
    title: React.ReactNode;
    description?: React.ReactNode;
    action?: React.ReactNode;
    variant?: 'slate' | 'base';
    compact?: boolean;
    className?: string;
}

export function EmptyState({
    icon,
    title,
    description,
    action,
    variant = 'slate',
    compact = false,
    className,
}: EmptyStateProps) {
    const isBase = variant === 'base';

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
                    isBase ? "bg-base-200 text-base-content/40" : "bg-slate-100 text-slate-400"
                )}
            >
                {icon ?? <Search className={compact ? "size-6" : "size-8"} />}
            </div>
            <h3
                className={cn(
                    "font-semibold",
                    compact ? "text-sm" : "text-base",
                    isBase ? "text-base-content/60" : "text-slate-500"
                )}
            >
                {title}
            </h3>
            {description && (
                <p
                    className={cn(
                        "text-sm mt-1 max-w-sm",
                        isBase ? "text-base-content/50" : "text-slate-400"
                    )}
                >
                    {description}
                </p>
            )}
            {action && <div className="mt-6">{action}</div>}
        </div>
    );
}
