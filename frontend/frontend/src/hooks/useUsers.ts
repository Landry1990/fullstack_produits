import { useState, useEffect, useRef } from 'react';
import userService, { type SimpleUser } from '../services/userService';

// Module-level cache: shared across all component instances
// Persists as long as the app is running (until full page reload)
let cachedUsers: SimpleUser[] | null = null;
let fetchPromise: Promise<SimpleUser[]> | null = null;

/**
 * Hook to get the list of users with app-level caching.
 * The users list is fetched once and shared across all consumers.
 * Call `refresh()` to force a re-fetch (e.g., after creating a user).
 */
export const useUsers = () => {
    const [users, setUsers] = useState<SimpleUser[]>(cachedUsers || []);
    const [loading, setLoading] = useState(!cachedUsers);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;

        const loadUsers = async () => {
            // If already cached, use it immediately
            if (cachedUsers) {
                setUsers(cachedUsers);
                setLoading(false);
                return;
            }

            // If a fetch is already in progress, wait for it (dedup)
            if (fetchPromise) {
                try {
                    const result = await fetchPromise;
                    if (mountedRef.current) {
                        setUsers(result);
                        setLoading(false);
                    }
                } catch {
                    if (mountedRef.current) setLoading(false);
                }
                return;
            }

            // Start a new fetch
            setLoading(true);
            fetchPromise = (async () => {
                const data = await userService.getAll();
                cachedUsers = data;
                return data;
            })();

            try {
                const result = await fetchPromise;
                if (mountedRef.current) {
                    setUsers(result);
                    setLoading(false);
                }
            } catch (error) {
                console.error("Failed to load users", error);
                if (mountedRef.current) setLoading(false);
            } finally {
                fetchPromise = null;
            }
        };

        loadUsers();

        return () => {
            mountedRef.current = false;
        };
    }, []);

    const refresh = async () => {
        cachedUsers = null;
        fetchPromise = null;
        setLoading(true);
        try {
            const data = await userService.getAll();
            cachedUsers = data;
            if (mountedRef.current) {
                setUsers(data);
                setLoading(false);
            }
        } catch (error) {
            console.error("Failed to refresh users", error);
            if (mountedRef.current) setLoading(false);
        }
    };

    return { users, loading, refresh };
};

/** Utility to invalidate the users cache (e.g., after user creation/deletion) */
export const invalidateUsersCache = () => {
    cachedUsers = null;
    fetchPromise = null;
};
