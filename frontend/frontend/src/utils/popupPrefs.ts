import { useSyncExternalStore } from 'react';

/**
 * Préférence locale (par poste) pour les panneaux de notifications
 * automatiques affichés en bas à droite — certains utilisateurs les
 * trouvent intrusifs. Activé par défaut.
 */
const STORAGE_KEY = 'popup_alerts_enabled';
const CHANGE_EVENT = 'popup-alerts-changed';

export function arePopupAlertsEnabled(): boolean {
    return localStorage.getItem(STORAGE_KEY) !== '0';
}

export function setPopupAlertsEnabled(enabled: boolean): void {
    localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
    window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(callback: () => void): () => void {
    window.addEventListener(CHANGE_EVENT, callback);
    window.addEventListener('storage', callback);
    return () => {
        window.removeEventListener(CHANGE_EVENT, callback);
        window.removeEventListener('storage', callback);
    };
}

export function usePopupAlertsEnabled(): boolean {
    return useSyncExternalStore(subscribe, arePopupAlertsEnabled, () => true);
}
