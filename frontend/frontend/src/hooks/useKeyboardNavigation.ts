
import { useEffect, useRef, type RefObject } from 'react';

interface UseKeyboardNavigationProps {
    viewMode: 'LIST' | 'CREATE' | 'DETAILS' | 'EDIT';
}

interface UseKeyboardNavigationReturn {
    searchInputRef: RefObject<HTMLInputElement>;
    fournisseurSelectRef: RefObject<HTMLSelectElement>;
}

export function useKeyboardNavigation({ viewMode }: UseKeyboardNavigationProps): UseKeyboardNavigationReturn {
    const searchInputRef = useRef<HTMLInputElement>(null);
    const fournisseurSelectRef = useRef<HTMLSelectElement>(null);

    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            // Active only in CREATE or EDIT modes
            if (viewMode !== 'CREATE' && viewMode !== 'EDIT') return;

            // F2 : Focus Product Search
            if (e.key === 'F2') {
                e.preventDefault();
                searchInputRef.current?.focus();
                return;
            }

            // F4 : Focus Supplier Select
            if (e.key === 'F4') {
                e.preventDefault();
                fournisseurSelectRef.current?.focus();
                return;
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [viewMode]);

    return {
        searchInputRef: searchInputRef as RefObject<HTMLInputElement>,
        fournisseurSelectRef: fournisseurSelectRef as RefObject<HTMLSelectElement>
    };
}
