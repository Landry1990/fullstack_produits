import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePharmacySettings } from './usePharmacySettings';

const EVENTS = [
    'mousemove',
    'keydown',
    'click',
    'scroll',
    'touchstart'
];

export function useAutoLogout() {
    const { logout, user } = useAuth();
    const { settings } = usePharmacySettings();
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Default to 0 (disabled) if not loaded yet or undefined
    const timeoutMinutes = settings?.auto_logout_timeout ?? 0;

    const resetTimer = useCallback(() => {
        if (timerRef.current) clearTimeout(timerRef.current);

        if (!user || timeoutMinutes <= 0) return;

        const ms = timeoutMinutes * 60 * 1000;

        timerRef.current = setTimeout(() => {
            // Auto logout when the timer expires
            console.warn(`[AutoLogout] Session expirée après ${timeoutMinutes} minutes d'inactivité.`);
            logout();
        }, ms);
    }, [logout, user, timeoutMinutes]);

    useEffect(() => {
        // Debug log to verify hook state
        console.log(`[AutoLogout] État: User=${user?.username || 'None'}, Timeout=${timeoutMinutes}min`);

        if (!user || timeoutMinutes <= 0) {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                console.log('[AutoLogout] Timer désactivé.');
            }
            return;
        }

        // Initial timer setup
        resetTimer();

        // Event listener to reset timer on activity
        const handleActivity = () => {
            // We don't want to log EVERY mousemove, but maybe log every minute?
            resetTimer();
        };

        // Attach listeners
        EVENTS.forEach(event => {
            window.addEventListener(event, handleActivity, { passive: true });
        });

        // Cleanup listeners and timer on unmount or when dependencies change
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            EVENTS.forEach(event => {
                window.removeEventListener(event, handleActivity);
            });
        };
    }, [user, timeoutMinutes, resetTimer]);
}
