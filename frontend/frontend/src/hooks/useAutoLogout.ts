import { useEffect, useRef, useCallback } from 'react';
import { useAuth, LAST_ACTIVITY_KEY } from '../context/AuthContext';
import { usePharmacySettings } from './usePharmacySettings';
import { safeStorage } from '../utils/storage';

const EVENTS = [
    'mousedown',
    'keydown',
    'scroll',
    'touchstart',
    'pointerdown'
];

const CHECK_INTERVAL = 30000; // 30 seconds

export function useAutoLogout() {
    const { logout, user } = useAuth();
    const { settings } = usePharmacySettings();
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Default to 0 (disabled) if not loaded yet or undefined
    const timeoutMinutes = settings?.auto_logout_timeout ?? 0;

    const checkAndLogout = useCallback(() => {
        if (!user || timeoutMinutes <= 0) return;

        const lastActivity = parseInt(safeStorage.getItem(LAST_ACTIVITY_KEY, 'local') || '0', 10);
        if (lastActivity === 0) return;

        const now = Date.now();
        const msSinceLastActivity = now - lastActivity;
        const timeoutMs = timeoutMinutes * 60 * 1000;

        if (msSinceLastActivity >= timeoutMs) {
            console.warn(`[AutoLogout] Session expirée. Inactivité: ${Math.round(msSinceLastActivity / 1000 / 60)}min.`);
            logout();
            safeStorage.removeItem(LAST_ACTIVITY_KEY, 'local');
        }
    }, [logout, user, timeoutMinutes]);

    const resetTimer = useCallback(() => {
        if (!user || timeoutMinutes <= 0) return;

        // Update last activity in persistent storage
        safeStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString(), 'local');

        if (timerRef.current) clearTimeout(timerRef.current);

        const ms = timeoutMinutes * 60 * 1000;

        timerRef.current = setTimeout(() => {
            checkAndLogout();
        }, ms);
    }, [user, timeoutMinutes, checkAndLogout]);

    useEffect(() => {
        if (!user || timeoutMinutes <= 0) {
            if (timerRef.current) clearTimeout(timerRef.current);
            if (intervalRef.current) clearInterval(intervalRef.current);
            return;
        }

        // Initial setup
        const storedLastActivity = safeStorage.getItem(LAST_ACTIVITY_KEY, 'local');
        if (!storedLastActivity) {
            safeStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString(), 'local');
        }

        // Run an immediate check in case we just loaded/returned from background
        checkAndLogout();
        resetTimer();

        // Safety interval check (useful if setTimeout is throttled/paused)
        intervalRef.current = setInterval(checkAndLogout, CHECK_INTERVAL);

        const handleActivity = () => {
            resetTimer();
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                console.log('[AutoLogout] Application revenue au premier plan, vérification de la session...');
                checkAndLogout();
            }
        };

        // Attach listeners
        EVENTS.forEach(event => {
            window.addEventListener(event, handleActivity, { passive: true });
        });
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            if (intervalRef.current) clearInterval(intervalRef.current);
            EVENTS.forEach(event => {
                window.removeEventListener(event, handleActivity);
            });
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [user, timeoutMinutes, resetTimer, checkAndLogout]);
}
