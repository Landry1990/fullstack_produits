/**
 * Hook pour le scan de codes-barres via expo-camera
 * Gestion du debounce anti-rebond, du son, et du feedback haptique
 */
import { useState, useCallback, useRef } from 'react';
import { Vibration } from 'react-native';
import { SCANNER_CONFIG } from '../config';

interface BarcodeScanResult {
  type: string;
  data: string;
}

interface UseBarcodeReturn {
  /** Dernier code-barres scanné */
  lastScannedCode: string | null;
  /** Le scanner est-il prêt à accepter un nouveau scan ? */
  isReady: boolean;
  /** Callback à brancher sur `onBarcodeScanned` de CameraView */
  handleBarcodeScan: (result: BarcodeScanResult) => void;
  /** Réinitialiser le scanner pour un nouveau scan */
  resetScanner: () => void;
}

/**
 * Hook de gestion du scanner de codes-barres
 * @param onScan Callback appelé avec le code-barres scanné (après debounce)
 */
export function useBarcodeScanner(
  onScan: (barcode: string) => void
): UseBarcodeReturn {
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(true);
  const lastScanTime = useRef<number>(0);

  /**
   * Callback principal — branché sur CameraView.onBarcodeScanned
   * Applique le debounce anti-rebond configurable
   */
  const handleBarcodeScan = useCallback(
    (result: BarcodeScanResult) => {
      const now = Date.now();

      // Anti-rebond : ignorer si trop proche du dernier scan
      if (now - lastScanTime.current < SCANNER_CONFIG.DEBOUNCE_MS) {
        return;
      }

      // Ignorer si même code que le précédent (double scan)
      if (result.data === lastScannedCode) {
        return;
      }

      lastScanTime.current = now;
      setLastScannedCode(result.data);
      setIsReady(false);

      // Feedback haptique (vibration courte)
      Vibration.vibrate(100);

      // Notifier le parent
      onScan(result.data);

      // Réactiver le scanner après le debounce
      setTimeout(() => {
        setIsReady(true);
      }, SCANNER_CONFIG.DEBOUNCE_MS);
    },
    [onScan, lastScannedCode]
  );

  /**
   * Réinitialiser le scanner pour permettre un nouveau scan du même code
   */
  const resetScanner = useCallback(() => {
    setLastScannedCode(null);
    setIsReady(true);
    lastScanTime.current = 0;
  }, []);

  return {
    lastScannedCode,
    isReady,
    handleBarcodeScan,
    resetScanner,
  };
}
