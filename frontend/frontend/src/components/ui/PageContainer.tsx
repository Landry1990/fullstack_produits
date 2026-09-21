import { cn } from '../../lib/utils';

interface PageContainerProps {
    children: React.ReactNode;
    /** 'dense' = pages data (1600px), 'form' = formulaires (4xl), 'full' = pleine largeur (POS) */
    variant?: 'dense' | 'form' | 'full';
    className?: string;
}

/**
 * Conteneur de page standardisé — remplace les max-w-* dispersés.
 * dense : max-w-[1600px] (tableaux, journaux, rapports)
 * form  : max-w-4xl (formulaires, paramètres)
 * full  : pleine largeur (caisse, facturation)
 */
export function PageContainer({ children, variant = 'dense', className }: PageContainerProps) {
    return (
        <div
            className={cn(
                "mx-auto w-full p-3 sm:p-6",
                variant === 'dense' && "max-w-[1600px]",
                variant === 'form' && "max-w-4xl",
                className
            )}
        >
            {children}
        </div>
    );
}
