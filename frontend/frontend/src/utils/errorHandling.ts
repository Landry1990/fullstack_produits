/**
 * Utility to extract readable error messages from API responses.
 * Handles diverse formats (Django REST Framework, standard HTTP errors, etc.)
 */

export interface StartErrorExtraction {
    title?: string;
    message: string;
}

export function extractErrorMessage(err: any): string {
    if (!err) return "Une erreur inconnue est survenue.";

    // 1. Gestion de la réponse API (Axios)
    if (err.response) {
        const status = err.response.status;
        const data = err.response.data;

        // Cas Erreur Serveur (500)
        if (status >= 500) {
            // Parfois Django renvoie du HTML en mode debug, on évite de l'afficher brut
            if (typeof data === 'string' && data.includes('<!DOCTYPE html>')) {
                return `Erreur Serveur (${status}) : Veuillez contacter le support technique.`;
            }
            // Si l'API renvoie un message JSON explicite même en 500 (rare mais possible)
            if (data?.detail) return `Erreur Serveur (${status}) : ${data.detail}`;

            return `Erreur Serveur (${status}) : Veuillez réessayer plus tard.`;
        }

        // Cas Erreur Client (400, 403, 404...)
        if (data) {
            // Cas standard DRF: { "detail": "Message..." }
            if (data.detail) {
                return data.detail;
            }

            // Cas Validation par champ: { "field_name": ["Error 1"], ... }
            if (typeof data === 'object') {
                const messages: string[] = [];

                // Gérer 'non_field_errors' en priorité
                if (Array.isArray(data.non_field_errors)) {
                    messages.push(...data.non_field_errors);
                }

                // Parcourir les champs
                Object.keys(data).forEach(key => {
                    if (key === 'non_field_errors' || key === 'detail') return;

                    const fieldError = data[key];
                    let fieldMessage = '';

                    if (Array.isArray(fieldError)) {
                        fieldMessage = fieldError.join(' ');
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
    }

    // 2. Gestion des erreurs réseau ou sans réponse
    if (err.message) {
        if (err.message === 'Network Error') {
            return "Erreur de connexion : Impossible de joindre le serveur.";
        }
        return err.message;
    }

    // 3. Fallback
    return typeof err === 'string' ? err : "Une erreur inattendue est survenue.";
}
