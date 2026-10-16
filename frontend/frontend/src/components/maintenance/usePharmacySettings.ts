import { useState, useEffect } from 'react';
import api from '../../services/api';
import { logger } from '../../utils/logger';
import type { PharmacySettings } from './types';

/**
 * Charge et expose les paramètres pharmacie (backup + rétention).
 */
export function usePharmacySettings() {
  const [pharmacySettings, setPharmacySettings] = useState<PharmacySettings | null>(null);

  useEffect(() => {
    api.get('pharmacy-settings/')
      .then(res => setPharmacySettings(res.data))
      .catch(() => logger.error('Error loading pharmacy settings'));
  }, []);

  return { pharmacySettings, setPharmacySettings };
}

export type UsePharmacySettingsReturn = ReturnType<typeof usePharmacySettings>;
