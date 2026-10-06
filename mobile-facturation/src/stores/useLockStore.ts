import { create } from 'zustand';
import { Platform } from 'react-native';
import Storage from 'expo-sqlite/kv-store';
import secureStore from '../utils/secureStore';
import { useAuthStore } from './useAuthStore';

// Verrouillage rapide par code PIN (appareil partagé, session longue) :
// le PIN est PAR VENDEUR et vit dans le SecureStore (chiffré) sous
// `lock.pin.<username>` — sa présence seule signifie « PIN activé ».
// Le délai de verrouillage est un réglage d'appareil (kv-store).
// Décision actée : PIN seul, pas de biométrie.
const KEY_DELAY = 'lock.delaySec';
const DEFAULT_DELAY_SEC = 60;
const pinKey = (user: string) => `lock.pin.${user}`;

const currentUser = () => useAuthStore.getState().username ?? 'anon';

interface LockState {
  pinSet: boolean;
  locked: boolean;
  delaySec: number;
  loaded: boolean;

  loadFor: (username: string) => Promise<void>;
  setPin: (pin: string | null) => Promise<void>;
  checkPin: (pin: string) => Promise<boolean>;
  setDelaySec: (s: number) => void;
  lock: () => void;
  unlock: () => void;
  reset: () => void;
}

export const useLockStore = create<LockState>((set, get) => ({
  pinSet: false,
  locked: false,
  delaySec: DEFAULT_DELAY_SEC,
  loaded: false,

  // Charge l'état PIN du vendeur + le délai de l'appareil. Ne touche pas
  // à `locked` : le verrouillage est décidé par l'appelant (boot = verrou
  // immédiat si PIN, login frais = non — le mot de passe vient d'être
  // saisi).
  loadFor: async (username) => {
    if (Platform.OS === 'web') {
      set({ loaded: true });
      return;
    }
    try {
      const [pin, delay] = await Promise.all([
        secureStore.getItemAsync(pinKey(username)),
        Storage.getItemAsync(KEY_DELAY),
      ]);
      const parsed = delay ? parseInt(delay, 10) : NaN;
      set({
        pinSet: !!pin,
        delaySec: Number.isFinite(parsed) ? parsed : DEFAULT_DELAY_SEC,
        loaded: true,
      });
    } catch {
      set({ loaded: true });
    }
  },

  setPin: async (pin) => {
    const key = pinKey(currentUser());
    if (pin === null) {
      set({ pinSet: false });
      await secureStore.deleteItemAsync(key).catch(() => {});
    } else {
      await secureStore.setItemAsync(key, pin);
      set({ pinSet: true });
    }
  },

  checkPin: async (pin) => {
    try {
      const stored = await secureStore.getItemAsync(pinKey(currentUser()));
      return !!stored && stored === pin;
    } catch {
      return false;
    }
  },

  setDelaySec: (s) => {
    set({ delaySec: s });
    if (Platform.OS === 'web') return;
    Storage.setItemAsync(KEY_DELAY, String(s)).catch(() => {});
  },

  lock: () => {
    if (get().pinSet) set({ locked: true });
  },

  unlock: () => set({ locked: false }),

  // Déconnexion : oublie le verrou affiché (le PIN lui-même survit — il
  // est rattaché au compte, pas à la session).
  reset: () => set({ locked: false, pinSet: false }),
}));
