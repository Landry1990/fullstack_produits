/**
 * Hook pour la découverte du serveur via scan QR Code
 * Le QR contient l'URL du serveur (ex: http://192.168.1.100:8000)
 */
import { useState, useCallback } from 'react';
import { saveBaseURL } from '../services/api';
import { useConnectionStore } from '../stores';

interface UseServerDiscoveryReturn {
  /** L'URL a été configurée avec succès */
  isConfigured: boolean;
  /** Erreur de configuration */
  error: string | null;
  /** En cours de validation */
  isValidating: boolean;
  /** Traite les données du QR Code scanné */
  handleQRCode: (data: string) => Promise<boolean>;
  /** Configuration manuelle de l'URL */
  setManualUrl: (url: string) => Promise<boolean>;
}

/**
 * Hook de découverte du serveur
 * Gère le scan QR et la validation de l'URL du serveur
 */
export function useServerDiscovery(): UseServerDiscoveryReturn {
  const [isConfigured, setIsConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const { setServerUrl } = useConnectionStore();

  /**
   * Valide et configure l'URL du serveur
   */
  const configureUrl = useCallback(
    async (url: string): Promise<boolean> => {
      setIsValidating(true);
      setError(null);

      try {
        // Valider le format de l'URL
        const trimmed = url.trim();
        if (!isValidServerUrl(trimmed)) {
          setError('URL invalide. Format attendu : http://<IP>:<PORT>');
          return false;
        }

        // Tester la connectivité au serveur
        const isReachable = await testServerConnection(trimmed);
        if (!isReachable) {
          setError('Serveur injoignable. Vérifiez le réseau Wi-Fi et l\'IP.');
          return false;
        }

        // Sauvegarder l'URL
        await saveBaseURL(trimmed);
        setServerUrl(trimmed);
        setIsConfigured(true);

        console.log(`[ServerDiscovery] Serveur configuré : ${trimmed}`);
        return true;
      } catch (err) {
        setError('Erreur lors de la configuration du serveur');
        console.error('[ServerDiscovery] Erreur:', err);
        return false;
      } finally {
        setIsValidating(false);
      }
    },
    [setServerUrl]
  );

  /**
   * Traite les données d'un QR Code scanné
   * Le QR doit contenir une URL valide ou un JSON avec { url: "..." }
   */
  const handleQRCode = useCallback(
    async (data: string): Promise<boolean> => {
      let url = data.trim();

      // Tenter de parser comme JSON (format enrichi)
      try {
        const parsed = JSON.parse(url);
        if (parsed.url || parsed.base_url) {
          url = parsed.url || parsed.base_url;
        }
      } catch {
        // Ce n'est pas du JSON — utiliser la valeur brute comme URL
      }

      return configureUrl(url);
    },
    [configureUrl]
  );

  /**
   * Configuration manuelle de l'URL
   */
  const setManualUrl = useCallback(
    async (url: string): Promise<boolean> => {
      return configureUrl(url);
    },
    [configureUrl]
  );

  return {
    isConfigured,
    error,
    isValidating,
    handleQRCode,
    setManualUrl,
  };
}

// ─── Helpers ─────────────────────────────────────────────

/**
 * Valide le format d'une URL de serveur local
 */
function isValidServerUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      parsed.hostname.length > 0
    );
  } catch {
    return false;
  }
}

/**
 * Teste la connectivité au serveur avec un timeout court
 */
async function testServerConnection(baseUrl: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${baseUrl}/api/health/`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    // On accepte tout statut < 500 (même 404 signifie que le serveur répond)
    return response.status < 500;
  } catch {
    return false;
  }
}
