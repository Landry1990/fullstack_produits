import { useState, useCallback, useEffect, useRef } from 'react'

interface UseKeyboardNavigationProps {
    listLength: number
    onValidate?: () => void
    onDelete?: (index: number) => void
    onIncrement?: (index: number) => void
    onDecrement?: (index: number) => void
    enabled?: boolean
}

export const useKeyboardNavigation = ({
    listLength,
    onValidate,
    onDelete,
    onIncrement,
    onDecrement,
    enabled = true
}: UseKeyboardNavigationProps) => {
    const [selectedIndex, setSelectedIndex] = useState<number>(-1)

    // Reset selection when list is empty
    useEffect(() => {
        if (listLength === 0) {
            setSelectedIndex(-1)
        } else if (selectedIndex >= listLength) {
            setSelectedIndex(listLength - 1)
        }
    }, [listLength])

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (!enabled) return

        // Navigation
        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setSelectedIndex(prev => (prev < listLength - 1 ? prev + 1 : prev))
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev))
        }
        // Actions on selected item
        else if (selectedIndex !== -1) {
            if (e.key === '+' || e.key === 'Add') { // Numpad + or standard +
                e.preventDefault()
                onIncrement?.(selectedIndex)
            } else if (e.key === '-' || e.key === 'Subtract') { // Numpad - or standard -
                e.preventDefault()
                onDecrement?.(selectedIndex)
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                // Avoid deleting if focusing an input (though enabled check should handle this usually)
                if (document.activeElement?.tagName === 'INPUT') return

                e.preventDefault()
                onDelete?.(selectedIndex)
            }
        }

        // Validation
        if (e.key === 'F10' || (e.ctrlKey && e.key === 'Enter')) {
            e.preventDefault()
            onValidate?.()
        }
    }, [enabled, listLength, selectedIndex, onIncrement, onDecrement, onDelete, onValidate]);

    // Use a ref to keep the latest handler version without re-subscribing to window
    const handlerRef = useRef(handleKeyDown);
    useEffect(() => {
        handlerRef.current = handleKeyDown;
    }, [handleKeyDown]);

    useEffect(() => {
        const listener = (e: KeyboardEvent) => handlerRef.current(e);
        window.addEventListener('keydown', listener);
        return () => window.removeEventListener('keydown', listener);
    }, []); // Empty deps: subscription stays put!

    return {
        selectedIndex,
        setSelectedIndex
    }
}
