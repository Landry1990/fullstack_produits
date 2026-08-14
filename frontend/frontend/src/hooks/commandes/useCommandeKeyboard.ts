import { useEffect } from 'react';
import type { CommandeProduit } from '../../types';

interface UseCommandeKeyboardParams {
    viewMode: string;
    commandeProduits: CommandeProduit[];
    selectedRows: Set<number>;
    setCommandeProduits: (updater: (prev: CommandeProduit[]) => CommandeProduit[]) => void;
    setSelectedRows: (rows: Set<number>) => void;
}

export function useCommandeKeyboard(params: UseCommandeKeyboardParams) {
    const { viewMode, commandeProduits, selectedRows, setCommandeProduits, setSelectedRows } = params;

    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

            if (e.key === 'Delete' && !isInput && selectedRows.size > 0) {
                e.preventDefault();
                setCommandeProduits(prev => prev.filter((_, i) => !selectedRows.has(i)));
                setSelectedRows(new Set());
                return;
            }

            if (e.key === 'Escape' && !isInput) {
                return;
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [viewMode, commandeProduits, selectedRows]);
}
