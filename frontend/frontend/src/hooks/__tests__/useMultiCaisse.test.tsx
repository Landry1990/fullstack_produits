import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';

const svc = vi.hoisted(() => ({
    getAllCaisses: vi.fn(),
    getActivePostesVente: vi.fn(),
    getMyActivePostesVente: vi.fn(),
}));

const posteCtx = vi.hoisted(() => ({
    activePoste: null as null | { id: number },
    selectedPosteCaisseId: null as null | number,
    isPosMode: false,
    isLoading: false,
    refresh: vi.fn(() => Promise.resolve()),
    openPoste: vi.fn(),
    setActivePosteVente: vi.fn(),
    closePoste: vi.fn(),
    selectPoste: vi.fn(),
}));

vi.mock('../../services/cashSessionService', () => ({
    cashSessionService: svc,
}));

vi.mock('../../context/PosteCaisseModeContext', () => ({
    usePosteCaisseMode: () => posteCtx,
}));

import { useMultiCaisse } from '../useMultiCaisse';

const poste = (id: number, caisse = id * 10) => ({ id, caisse });

beforeEach(() => {
    vi.clearAllMocks();
    posteCtx.selectedPosteCaisseId = null;
    posteCtx.activePoste = null;
    svc.getAllCaisses.mockResolvedValue([]);
    svc.getActivePostesVente.mockResolvedValue([]);
    svc.getMyActivePostesVente.mockResolvedValue([]);
});

describe('useMultiCaisse', () => {
    it('isMultiCaisse=true quand plusieurs postes actifs', async () => {
        svc.getActivePostesVente.mockResolvedValue([poste(1), poste(2)]);
        const { result } = renderHook(() => useMultiCaisse());
        await waitFor(() => expect(result.current.multiCaisseLoading).toBe(false));
        expect(result.current.isMultiCaisse).toBe(true);
        expect(result.current.activePostesVente).toHaveLength(2);
    });

    it('isMultiCaisse=false avec un seul poste actif', async () => {
        svc.getActivePostesVente.mockResolvedValue([poste(1)]);
        const { result } = renderHook(() => useMultiCaisse());
        await waitFor(() => expect(result.current.multiCaisseLoading).toBe(false));
        expect(result.current.isMultiCaisse).toBe(false);
    });

    it('sélectionne automatiquement la caisse de mon poste actif', async () => {
        svc.getMyActivePostesVente.mockResolvedValue([poste(7, 42)]);
        renderHook(() => useMultiCaisse());
        await waitFor(() => expect(posteCtx.selectPoste).toHaveBeenCalledWith(42));
    });

    it('ne re-sélectionne pas si une caisse est déjà choisie', async () => {
        posteCtx.selectedPosteCaisseId = 99;
        svc.getMyActivePostesVente.mockResolvedValue([poste(7, 42)]);
        renderHook(() => useMultiCaisse());
        await waitFor(() => expect(svc.getMyActivePostesVente).toHaveBeenCalled());
        expect(posteCtx.selectPoste).not.toHaveBeenCalled();
    });

    it('résiste aux erreurs réseau : listes vides, pas de crash', async () => {
        svc.getAllCaisses.mockRejectedValue(new Error('network'));
        svc.getActivePostesVente.mockRejectedValue(new Error('network'));
        svc.getMyActivePostesVente.mockRejectedValue(new Error('network'));
        const { result } = renderHook(() => useMultiCaisse());
        await waitFor(() => expect(result.current.multiCaisseLoading).toBe(false));
        expect(result.current.postesCaisses).toEqual([]);
        expect(result.current.activePostesVente).toEqual([]);
        expect(result.current.isMultiCaisse).toBe(false);
    });

    it('centralizedCashRegister reste pilotable via le setter', async () => {
        const { result } = renderHook(() => useMultiCaisse());
        await waitFor(() => expect(result.current.multiCaisseLoading).toBe(false));
        expect(result.current.centralizedCashRegister).toBe(true);
    });
});
