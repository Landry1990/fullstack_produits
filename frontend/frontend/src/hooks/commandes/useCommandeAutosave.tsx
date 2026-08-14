import { useEffect, useRef } from 'react';
import type { Commande, CommandeProduit } from '../../types';
import { normalizeNumberInput } from '../../utils/formatters';
import { logger } from '../../utils/logger';

export interface UseCommandeAutosaveState {
  commandeProduits: CommandeProduit[];
  newCommandeFournisseurId: string;
  numeroFacture: string;
  isMiseEnPlace: boolean;
  delaiPaiementNegocieJours: string;
  payeALaCloture: boolean;
  commandeType: 'LOC' | 'DIR' | 'DIV';
  tauxChange: string;
  fraisCoefficient: string;
  selectedCommande: Commande | null;
  viewMode: string;
  isImporting: boolean;
}

export interface UseCommandeAutosaveOptions {
  state: UseCommandeAutosaveState;
  setSaving: (saving: boolean) => void;
  handleSaveCommande: (
    commande: Partial<Commande>,
    produits: CommandeProduit[],
    mode: 'CREATE' | 'EDIT',
    originalCommande: Commande | null,
    isAutoSave?: boolean
  ) => Promise<void>;
}

export function useCommandeAutosave({ state, setSaving, handleSaveCommande }: UseCommandeAutosaveOptions): void {
  const autoSaveStateRef = useRef(state);

  useEffect(() => {
    autoSaveStateRef.current = state;
  });

  useEffect(() => {
    const interval = setInterval(async () => {
      const s = autoSaveStateRef.current;
      if (s.isImporting) return;
      if (s.viewMode !== 'CREATE' && s.viewMode !== 'EDIT') return;
      if (s.commandeProduits.length === 0 || !s.newCommandeFournisseurId) return;
      // Ne pas autosauvegarder une mise en place sans délai renseigné (backend rejette)
      // sauf si elle est réglée au comptant (paye_a_la_cloture) — pas de délai requis.
      if (s.isMiseEnPlace && !s.payeALaCloture && !s.delaiPaiementNegocieJours.trim()) return;

      setSaving(true);
      try {
        const cleanCommande: Partial<Commande> = {
          fournisseur: normalizeNumberInput(s.newCommandeFournisseurId),
          numero_facture: s.numeroFacture,
          type: s.commandeType,
          taux_change: s.commandeType === 'DIR' ? s.tauxChange : undefined,
          frais_coefficient: s.commandeType === 'DIR' ? s.fraisCoefficient : undefined,
          is_mise_en_place: s.isMiseEnPlace,
          delai_paiement_negocie_jours: s.isMiseEnPlace && s.delaiPaiementNegocieJours.trim()
            ? Number(s.delaiPaiementNegocieJours)
            : null,
          paye_a_la_cloture: s.isMiseEnPlace && s.payeALaCloture,
        };
        const mode = (s.viewMode === 'CREATE' ? 'CREATE' : 'EDIT') as 'CREATE' | 'EDIT';
        await handleSaveCommande(cleanCommande, s.commandeProduits, mode, s.selectedCommande, true);
      } catch (err) {
        logger.error('Auto-save error:', err);
      } finally {
        setSaving(false);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [handleSaveCommande, setSaving]);
}
