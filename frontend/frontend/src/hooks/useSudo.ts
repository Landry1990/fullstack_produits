import { useState, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useInvoiceSettings } from './useInvoiceSettings';
import { useAuth } from '../context/AuthContext';

// « Session sudo » : après une validation réussie, on ré-essaie l'action avec
// le même validateur sans mot de passe — le backend l'accepte tant que le
// cache sudo_ok:{user}:{perms} est valide (TTL = réglage, marge 30 s ici).
// Ne stocke JAMAIS le mot de passe. sudo_session_minutes = 0 → pas de réutilisation.
const SUDO_SESSION_TTL_MS = 9 * 60 * 1000; // repli si le réglage est illisible
const sudoSession = new Map<string, { validatorId: number; expiresAt: number }>();

interface SudoOptions {
    title?: string;
    message?: string;
    permission?: string;
    onCancel?: () => void;
    forceCurrentUser?: boolean;
}

interface SudoState {
    isOpen: boolean;
    onValidate: (validatorId: number, password: string) => Promise<void>;
    onCancel?: () => void;
    title?: string;
    message?: string;
    permission?: string;
    forceCurrentUser?: boolean;
    isValidating: boolean;
}

export const useSudo = () => {
    const validatingRef = useRef(false);
    const { user } = useAuth();
    const { pathname } = useLocation();
    const { settings: invSettings } = useInvoiceSettings();
    // Facturation : compte parfois partagé entre vendeurs sur le même poste —
    // la session silencieuse attribuerait leurs validations au validateur
    // précédent → toujours la modale ici (le backend garde le hash filtré).
    const sessionEnabled = !pathname.startsWith('/app/facturation');
    // Marge de 30 s sous le TTL serveur ; 0 côté réglage → session désactivée.
    const clientTtlMs = invSettings?.sudo_session_minutes != null
        ? Math.max(0, invSettings.sudo_session_minutes * 60_000 - 30_000)
        : SUDO_SESSION_TTL_MS;
    const [sudoState, setSudoState] = useState<SudoState>({
        isOpen: false,
        onValidate: async () => { },
        isValidating: false,
    });

    const requireSudo = useCallback((
        onSuccess: (validatorId: number, password: string) => void | Promise<void>,
        options?: SudoOptions
    ) => {
        const permKey = `${user?.id ?? 0}:${options?.permission || 'any'}`;

        const openModal = () => {
            setSudoState({
            isOpen: true,
            isValidating: false,
            onValidate: async (validatorId: number, password: string) => {
                // Garde synchrone : un double Enter/clic avant le re-render
                // ne doit pas déclencher onSuccess deux fois.
                if (validatingRef.current) return;
                validatingRef.current = true;
                setSudoState(prev => ({ ...prev, isValidating: true }));
                try {
                    await onSuccess(validatorId, password);
                    if (sessionEnabled && clientTtlMs > 0) sudoSession.set(permKey, { validatorId, expiresAt: Date.now() + clientTtlMs });
                    // Fermer le modal uniquement si la validation réussit
                    setSudoState(prev => ({ ...prev, isOpen: false, onCancel: undefined, isValidating: false }));
                } catch (error) {
                    // Laisser le modal ouvert pour permettre de resaisir le mot de passe
                    // L'erreur est gérée par le composant qui appelle requireSudo (toast)
                    setSudoState(prev => ({ ...prev, isValidating: false }));
                    throw error; // Re-lancer pour que l'appelant puisse gérer l'erreur
                } finally {
                    validatingRef.current = false;
                }
            },
            onCancel: options?.onCancel,
            title: options?.title,
            message: options?.message,
            permission: options?.permission,
            forceCurrentUser: options?.forceCurrentUser,
        });
        };

        const cached = sessionEnabled && clientTtlMs > 0 ? sudoSession.get(permKey) : undefined;
        if (cached && cached.expiresAt > Date.now()) {
            // Tentative silencieuse — modale si la session côté serveur est morte.
            void (async () => {
                try {
                    await onSuccess(cached.validatorId, '');
                } catch (err) {
                    const httpStatus = (err as { response?: { status?: number } })?.response?.status ?? 0;
                    if (httpStatus >= 400 && httpStatus < 500) {
                        // Session expirée OU validateur mort (désactivé,
                        // supprimé, perm perdue) → purge + repli sur la modale.
                        sudoSession.delete(permKey);
                        openModal();
                    }
                    // 5xx / réseau : déjà toastées dans onSuccess — on garde
                    // l'entrée pour le prochain essai.
                }
            })();
            return;
        }
        openModal();
    }, [clientTtlMs, user?.id, sessionEnabled]);

    const closeSudo = useCallback(() => {
        if (sudoState.onCancel) {
            sudoState.onCancel();
        }
        setSudoState(prev => ({ ...prev, isOpen: false, onCancel: undefined }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sudoState.onCancel]);

    return {
        sudoState,
        requireSudo,
        closeSudo,
    };
};
