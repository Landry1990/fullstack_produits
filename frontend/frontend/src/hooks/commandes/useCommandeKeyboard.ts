import { useEffect, type RefObject } from 'react';
import type { CommandeProduit } from '../../types';

interface UseCommandeKeyboardParams {
    viewMode: string;
    commandeProduits: CommandeProduit[];
    selectedRows: Set<number>;
    setCommandeProduits: (updater: (prev: CommandeProduit[]) => CommandeProduit[]) => void;
    setSelectedRows: (rows: Set<number>) => void;
    searchInputRef: RefObject<HTMLInputElement | null>;
    // Input du combobox fournisseur (F4 appelle .focus() dessus)
    fournisseurSelectRef: RefObject<HTMLElement | null>;
}

export function useCommandeKeyboard(params: UseCommandeKeyboardParams) {
    const {
        viewMode,
        commandeProduits,
        selectedRows,
        setCommandeProduits,
        setSelectedRows,
        searchInputRef,
        fournisseurSelectRef,
    } = params;

    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            // Raccourcis actifs uniquement en vue formulaire (CREATE/EDIT)
            if (viewMode !== 'CREATE' && viewMode !== 'EDIT') return;

            const target = e.target as HTMLElement;
            const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

            // F2: Focus recherche produit (même depuis un input)
            if (e.key === 'F2') {
                e.preventDefault();
                searchInputRef.current?.focus();
                return;
            }

            // F4: Focus select fournisseur (même depuis un input)
            if (e.key === 'F4') {
                e.preventDefault();
                fournisseurSelectRef.current?.focus();
                return;
            }

            // Ctrl+A: Sélectionner toutes les lignes
            // (jamais dans un input/textarea pour ne pas casser la sélection de texte)
            if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A') && !isInput) {
                e.preventDefault();
                setSelectedRows(new Set(commandeProduits.map((_, i) => i)));
                return;
            }

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
