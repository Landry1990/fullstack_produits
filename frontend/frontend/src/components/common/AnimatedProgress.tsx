import { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { Progress } from '../shadcn/progress';
import { cn } from '../../lib/utils';

interface AnimatedProgressProps {
    value: number;
    className?: string;
}

/**
 * Progress qui anime sa barre de 0 → value au montage.
 * L'indicator Radix a déjà `transition-all` : on démarre à 0 puis on
 * applique la vraie valeur au prochain frame → le CSS fait le reste.
 * Respecte prefers-reduced-motion (valeur affichée immédiatement).
 */
export function AnimatedProgress({ value, className }: AnimatedProgressProps) {
    const reduceMotion = useReducedMotion();
    const [v, setV] = useState(0);

    useEffect(() => {
        if (reduceMotion) {
            setV(value);
            return;
        }
        const id = requestAnimationFrame(() => setV(value));
        return () => cancelAnimationFrame(id);
    }, [value, reduceMotion]);

    return (
        <Progress
            value={v}
            className={cn('[&>div]:transition-transform [&>div]:duration-700 [&>div]:ease-out', className)}
        />
    );
}
