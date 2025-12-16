import { useState, type RefObject } from 'react';

export interface UseSearchNavigationOptions {
    resetOnSelect?: boolean;
    searchInputRef?: RefObject<HTMLInputElement | null>;
}

export interface SearchNavigationItemProps {
    id: string;
    style: React.CSSProperties;
    onMouseEnter: () => void;
    className: string;
}

export function useSearchNavigation<T>(
    searchResults: T[],
    onSelect: (item: T) => void,
    options: UseSearchNavigationOptions = {}
) {
    const { resetOnSelect = true, searchInputRef } = options;
    const [selectedIndex, setSelectedIndex] = useState(-1);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (searchResults.length === 0) return;

        if (e.key === 'ArrowDown' || e.key === 'Down') {
            e.preventDefault();
            setSelectedIndex(prev => {
                const newIndex = prev === -1 ? 0 : (prev < searchResults.length - 1 ? prev + 1 : prev);
                // Scroll into view
                const el = document.getElementById(`search-result-${newIndex}`);
                el?.scrollIntoView({ block: 'nearest' });
                return newIndex;
            });
        } else if (e.key === 'ArrowUp' || e.key === 'Up') {
            e.preventDefault();
            setSelectedIndex(prev => {
                // If on first result, go back to search input
                if (prev === 0 && searchInputRef) {
                    searchInputRef.current?.focus();
                    return -1;
                }
                const newIndex = prev > 0 ? prev - 1 : 0;
                const el = document.getElementById(`search-result-${newIndex}`);
                el?.scrollIntoView({ block: 'nearest' });
                return newIndex;
            });
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedIndex >= 0 && selectedIndex < searchResults.length) {
                onSelect(searchResults[selectedIndex]);
                if (resetOnSelect) {
                    setSelectedIndex(-1);
                }
            } else if (searchResults.length > 0) {
                onSelect(searchResults[0]);
                if (resetOnSelect) {
                    setSelectedIndex(-1);
                }
            }
        }
    };

    const getItemProps = (index: number): SearchNavigationItemProps => ({
        id: `search-result-${index}`,
        style: index === selectedIndex ? {
            backgroundColor: '#3b82f6',
            color: 'white',
            fontWeight: 'bold'
        } : {},
        onMouseEnter: () => setSelectedIndex(index),
        className: index === selectedIndex ? 'active' : ''
    });

    return {
        selectedIndex,
        setSelectedIndex,
        handleKeyDown,
        getItemProps
    };
}
