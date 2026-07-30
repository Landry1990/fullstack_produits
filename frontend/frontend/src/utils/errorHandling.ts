/**
 * Utility to extract readable error messages from API responses.
 * Handles diverse formats (Django REST Framework, standard HTTP errors, etc.)
 */

interface _StartErrorExtraction {
    title?: string;
    message: string;
}

/**
 * Type-safe helper to extract the API detail string from an Axios-like error.
 * Returns the `response.data.detail` if present, or falls back to the provided default.
 */
export function getApiErrorDetail(err: unknown, fallback: string): string {
    if (
        typeof err === 'object' && err !== null &&
        'response' in err &&
        typeof (err as Record<string, unknown>).response === 'object' &&
        (err as Record<string, unknown>).response !== null
    ) {
        const response = (err as { response: Record<string, unknown> }).response;
        if (typeof response.data === 'object' && response.data !== null && 'detail' in response.data) {
            return String((response.data as { detail: unknown }).detail);
        }
    }
    return fallback;
}

export function extractErrorMessage(err: unknown): string {
    if (!err) return "Une erreur inconnue est survenue.";

    const errObj = err as Record<string, unknown>;

    // 1. Gestion de la réponse API (Axios)
    if (errObj.response) {
        const response = errObj.response as Record<string, unknown>;
        const status = response.status as number;
        const data = response.data as Record<string, unknown> | string | undefined;

        // Cas Erreur Serveur (500)
        if (status >= 500) {
            // Parfois Django renvoie du HTML en mode debug, on évite de l'afficher brut
            if (typeof data === 'string' && data.includes('<!DOCTYPE html>')) {
                return `Erreur Serveur (${status}) : Veuillez contacter le support technique.`;
            }
            // Si l'API renvoie un message JSON explicite même en 500 (rare mais possible)
            if (data && typeof data === 'object' && 'detail' in data) {
                return `Erreur Serveur (${status}) : ${data.detail}`;
            }

            return `Erreur Serveur (${status}) : Veuillez réessayer plus tard.`;
        }

        // Cas Erreur Client (400, 403, 404...)
        if (data && typeof data === 'object') {
            const dataObj = data as Record<string, unknown>;
            // Cas standard DRF: { "detail": "Message..." }
            if (dataObj.detail) {
                return String(dataObj.detail);
            }

            // Cas Validation par champ: { "field_name": ["Error 1"], ... }
            const messages: string[] = [];

            // Gérer 'non_field_errors' en priorité
            if (Array.isArray(dataObj.non_field_errors)) {
                messages.push(...(dataObj.non_field_errors as string[]));
            }

            // Parcourir les champs
            Object.keys(dataObj).forEach(key => {
                if (key === 'non_field_errors' || key === 'detail') return;

                const fieldError = dataObj[key];
                let fieldMessage = '';

                if (Array.isArray(fieldError)) {
                    fieldMessage = (fieldError as string[]).join(' ');
                } else if (typeof fieldError === 'string') {
                    fieldMessage = fieldError;
                }

                if (fieldMessage) {
                    // Capitaliser la clé pour l'affichage (ex: 'client' -> 'Client')
                    const fieldName = key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
                    messages.push(`${fieldName}: ${fieldMessage}`);
                }
            });

            if (messages.length > 0) {
                // Retourner la première erreur ou une liste
                return messages.length === 1 ? messages[0] : messages.join(' | ');
            }
        }
    }

    // 2. Gestion des erreurs réseau ou sans réponse
    if (errObj.message) {
        const msg = String(errObj.message);
        if (msg === 'Network Error') {
            return "Erreur de connexion : Impossible de joindre le serveur.";
        }
        return msg;
    }

    // 3. Fallback
    return typeof err === 'string' ? err : "Une erreur inattendue est survenue.";
}

