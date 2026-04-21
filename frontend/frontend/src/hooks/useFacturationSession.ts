import { useEffect, useMemo, useRef } from 'react';
import { safeStorage } from '../utils/storage';
import { useAuth } from '../context/AuthContext';

export interface UseFacturationSessionProps {
    clientsHook: any; 
    ui: any;
    isRetrocession: boolean;
    setIsRetrocession: (v: boolean) => void;
    isFactureA4: boolean;
    setIsFactureA4: (v: boolean) => void;
    cartLength: number;
}

export function useFacturationSession({
    clientsHook,
    ui,
    isRetrocession,
    setIsRetrocession,
    isFactureA4,
    setIsFactureA4,
    cartLength
}: UseFacturationSessionProps) {
    const { user } = useAuth();
    const contextStorageKey = useMemo(() => user?.id ? `activeSaleContext_${user.id}` : null, [user?.id]);
    const hasHydratedContextRef = useRef(false);

    useEffect(() => {
        if (contextStorageKey && !hasHydratedContextRef.current) {
            const saved = safeStorage.getItem(contextStorageKey, 'local');
            if (saved) {
                try {
                    const data = JSON.parse(saved);
                    if (data.selectedClient !== undefined) clientsHook.setSelectedClient(data.selectedClient);
                    if (data.useManualClient !== undefined) clientsHook.setUseManualClient(data.useManualClient);
                    if (data.manualClientName !== undefined) clientsHook.setManualClientName(data.manualClientName);
                    if (data.remiseGlobale !== undefined) ui.setRemiseGlobale(data.remiseGlobale);
                    if (data.remiseMode !== undefined) ui.setRemiseMode(data.remiseMode);
                    if (data.isRetrocession !== undefined) setIsRetrocession(data.isRetrocession);
                    if (data.isFactureA4 !== undefined) setIsFactureA4(data.isFactureA4);
                    if (data.tempOrdonnanceData !== undefined) ui.setTempOrdonnanceData(data.tempOrdonnanceData);
                    if (data.selectedAyantDroit !== undefined) clientsHook.setSelectedAyantDroit(data.selectedAyantDroit);
                    if (data.ayantDroitNom !== undefined) clientsHook.setAyantDroitNom(data.ayantDroitNom);
                    if (data.ayantDroitMatricule !== undefined) clientsHook.setAyantDroitMatricule(data.ayantDroitMatricule);
                    if (data.ayantDroitSociete !== undefined) clientsHook.setAyantDroitSociete(data.ayantDroitSociete);
                } catch (e) {
                    console.error("Erreur lors de la restauration de la session:", e);
                }
            }
            hasHydratedContextRef.current = true;
            safeStorage.removeItem('activeSaleContext', 'local');
        }
    }, [contextStorageKey, clientsHook, ui, setIsRetrocession, setIsFactureA4]);

    useEffect(() => {
        if (!contextStorageKey || !hasHydratedContextRef.current) return;

        const sessionData = {
            selectedClient: clientsHook.selectedClient,
            useManualClient: clientsHook.useManualClient,
            manualClientName: clientsHook.manualClientName,
            remiseGlobale: ui.remiseGlobale,
            remiseMode: ui.remiseMode,
            isRetrocession,
            isFactureA4,
            tempOrdonnanceData: ui.tempOrdonnanceData,
            selectedAyantDroit: clientsHook.selectedAyantDroit,
            ayantDroitNom: clientsHook.ayantDroitNom,
            ayantDroitMatricule: clientsHook.ayantDroitMatricule,
            ayantDroitSociete: clientsHook.ayantDroitSociete
        };
        
        const isDefaultClient = !clientsHook.selectedClient || (clientsHook.clients.find((c: any) => c.id === clientsHook.selectedClient)?.name.toLowerCase().includes('divers'));
        
        if (cartLength > 0 || !isDefaultClient || clientsHook.useManualClient) {
            safeStorage.setItem(contextStorageKey, JSON.stringify(sessionData), 'local');
        } else {
            safeStorage.removeItem(contextStorageKey, 'local');
        }
    }, [
        contextStorageKey,
        clientsHook.selectedClient, clientsHook.useManualClient, clientsHook.manualClientName, clientsHook.clients,
        ui.remiseGlobale, ui.remiseMode, isRetrocession, isFactureA4, ui.tempOrdonnanceData,
        clientsHook.selectedAyantDroit, clientsHook.ayantDroitNom, clientsHook.ayantDroitMatricule,
        clientsHook.ayantDroitSociete, cartLength
    ]);
}
