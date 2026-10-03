import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Wrapper cross-platform pour expo-secure-store.
 * Sur web, SecureStore n'existe pas → fallback localStorage (dev/preview uniquement).
 */
const webStore = {
    getItemAsync: async (key: string): Promise<string | null> => localStorage.getItem(key),
    setItemAsync: async (key: string, value: string): Promise<void> => {
        localStorage.setItem(key, value);
    },
    deleteItemAsync: async (key: string): Promise<void> => {
        localStorage.removeItem(key);
    },
};

const secureStore = Platform.OS === 'web' ? webStore : SecureStore;

export default secureStore;
