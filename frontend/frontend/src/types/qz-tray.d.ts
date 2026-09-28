/**
 * Déclarations minimales pour qz-tray (importé dynamiquement).
 * Le package ne fournit pas ses propres types ; @types/qz-tray peut être
 * installé à la place pour une couverture complète.
 */
declare module 'qz-tray' {
  export interface PrintJob {
    type: 'RAW' | 'PDF' | 'IMAGE' | 'HTML';
    format?: 'COMMAND' | 'BASE64' | 'PLAIN' | 'XML';
    data: string;
    options?: Record<string, unknown>;
  }

  export interface QzApi {
    websocket: {
      isActive(): boolean;
      connect(options?: {
        host?: string | string[];
        usingSecureProtocol?: boolean;
        port?: { secure?: number[]; insecure?: number[] };
        retries?: number;
        delay?: number;
      }): Promise<void>;
      disconnect(): Promise<void>;
    };
    printers: {
      /** Recherche une ou plusieurs imprimantes par nom, ou toutes si aucun nom. */
      find(name?: string): Promise<string[] | string>;
      /** Retourne l'imprimante par défaut. */
      getDefault(): Promise<string>;
    };
    configs: {
      /** Crée un objet de configuration pour qz.print(). */
      create(printerName: string, options?: Record<string, unknown>): unknown;
    };
    print(config: unknown, data: PrintJob[]): Promise<void>;
  }

  const qz: QzApi;
  export default qz;
}
