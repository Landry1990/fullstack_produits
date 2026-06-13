import { useState, useCallback } from 'react';

interface SudoOptions {
    title?: string;
    message?: string;
    permission?: string;
    onCancel?: () => void;
}

interface SudoState {
    isOpen: boolean;
    onValidate: (validatorId: number, password: string) => Promise<void>;
    onCancel?: () => void;
    title?: string;
    message?: string;
    permission?: string;
    isValidating: boolean;
}

export const useSudo = () => {
    const [sudoState, setSudoState] = useState<SudoState>({
        isOpen: false,
        onValidate: async () => { },
        isValidating: false,
    });

    const requireSudo = useCallback((
        onSuccess: (validatorId: number, password: string) => void | Promise<void>,
        options?: SudoOptions
    ) => {
        setSudoState({
            isOpen: true,
            isValidating: false,
            onValidate: async (validatorId: number, password: string) => {
                setSudoState(prev => ({ ...prev, isValidating: true }));
                try {
                    await onSuccess(validatorId, password);
                    // Fermer le modal uniquement si la validation réussit
                    setSudoState(prev => ({ ...prev, isOpen: false, onCancel: undefined, isValidating: false }));
                } catch (error) {
                    // Laisser le modal ouvert pour permettre de resaisir le mot de passe
                    // L'erreur est gérée par le composant qui appelle requireSudo (toast)
                    setSudoState(prev => ({ ...prev, isValidating: false }));
                    throw error; // Re-lancer pour que l'appelant puisse gérer l'erreur
                }
            },
            onCancel: options?.onCancel,
            title: options?.title,
            message: options?.message,
            permission: options?.permission,
        });
    }, []);

    const closeSudo = useCallback(() => {
        if (sudoState.onCancel) {
            sudoState.onCancel();
        }
        setSudoState(prev => ({ ...prev, isOpen: false, onCancel: undefined }));
    }, [sudoState.onCancel]);

    return {
        sudoState,
        requireSudo,
        closeSudo,
    };
};
