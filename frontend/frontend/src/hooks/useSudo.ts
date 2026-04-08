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
}

export const useSudo = () => {
    const [sudoState, setSudoState] = useState<SudoState>({
        isOpen: false,
        onValidate: async () => { },
    });

    const requireSudo = useCallback((
        onSuccess: (validatorId: number, password: string) => void | Promise<void>,
        options?: SudoOptions
    ) => {
        console.log("[useSudo] requireSudo appelé avec options:", options);
        setSudoState({
            isOpen: true,
            onValidate: async (validatorId: number, password: string) => {
                console.log("[useSudo] Validation en cours pour validatorId:", validatorId);
                await onSuccess(validatorId, password);
                setSudoState(prev => ({ ...prev, isOpen: false, onCancel: undefined }));
            },
            onCancel: options?.onCancel,
            title: options?.title,
            message: options?.message,
            permission: options?.permission,
        });
    }, []);

    const closeSudo = useCallback(() => {
        console.log("[useSudo] Fermeture du Sudo");
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
