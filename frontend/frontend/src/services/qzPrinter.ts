import { logger } from '../utils/logger';
import * as esc from '../utils/escpos/encoder';

const STORAGE_PRINTER_KEY = 'qz_printer_name';
const STORAGE_DRAWER_KEY = 'qz_open_drawer';

type QzApi = import('qz-tray').default;

let qzLoadPromise: Promise<QzApi> | null = null;
let connectionPromise: Promise<void> | null = null;

async function loadQz(): Promise<QzApi> {
  if (qzLoadPromise) return qzLoadPromise;
  qzLoadPromise = import('qz-tray').then((m) => m.default ?? (m as unknown as QzApi));
  return qzLoadPromise;
}

async function ensureConnected(): Promise<void> {
  const qz = await loadQz();
  if (qz.websocket.isActive()) return Promise.resolve();
  if (connectionPromise) return connectionPromise;

  // L'app est servie en HTTP : on tente les ports non sécurisés de QZ Tray
  // (8182…) puis les sécurisés en secours. 'localhost.qz.io' est inclus car
  // QZ le résout vers 127.0.0.1 avec un certificat valide en mode sécurisé.
  connectionPromise = qz.websocket.connect({
    host: ['localhost', 'localhost.qz.io'],
    usingSecureProtocol: window.location.protocol === 'https:',
    port: {
      secure: [8181, 8282, 8383, 8484],
      insecure: [8182, 8283, 8384, 8485],
    },
    retries: 2,
    delay: 0,
  } as never).then(() => {
    logger.info('QZ Tray connecté');
  }).catch((err: unknown) => {
    connectionPromise = null;
    logger.error('QZ Tray connexion échouée', err);
    throw err;
  });
  return connectionPromise;
}

export function getSavedPrinterName(): string | null {
  try {
    return localStorage.getItem(STORAGE_PRINTER_KEY);
  } catch {
    return null;
  }
}

export function setPrinterName(name: string): void {
  try {
    if (name) {
      localStorage.setItem(STORAGE_PRINTER_KEY, name);
    } else {
      localStorage.removeItem(STORAGE_PRINTER_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function shouldOpenDrawer(): boolean {
  try {
    return localStorage.getItem(STORAGE_DRAWER_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setOpenDrawer(value: boolean): void {
  try {
    localStorage.setItem(STORAGE_DRAWER_KEY, String(value));
  } catch {
    /* ignore */
  }
}

export async function listPrinters(): Promise<string[]> {
  const qz = await loadQz();
  await ensureConnected();
  return qz.printers.find();
}

async function resolvePrinterName(): Promise<string | null> {
  const qz = await loadQz();
  await ensureConnected();
  const saved = getSavedPrinterName();
  if (saved) {
    try {
      const found = await qz.printers.find(saved);
      if (Array.isArray(found)) {
        return found[0] || null;
      }
      return found;
    } catch (err) {
      logger.warn(`Imprimante QZ Tray sauvegardée introuvable (${saved}), fallback sur l'imprimante par défaut.`, err);
    }
  }
  try {
    return await qz.printers.getDefault();
  } catch (err) {
    logger.warn('Aucune imprimante par défaut QZ Tray détectée.', err);
    return null;
  }
}

/**
 * Envoie des commandes ESC/POS brutes à l'imprimante via QZ Tray.
 * Retourne `true` si le job a été envoyé, `false` si la connexion/ impression a échoué.
 */
export async function printEscpos(commands: string | string[]): Promise<boolean> {
  const qz = await loadQz();
  await ensureConnected();

  const printer = await resolvePrinterName();
  if (!printer) {
    logger.warn('Impression ESC/POS annulée : aucune imprimante QZ Tray disponible.');
    return false;
  }

  const data = Array.isArray(commands) ? commands.join('') : commands;
  const config = qz.configs.create(printer);

  await qz.print(config, [
    { type: 'RAW', format: 'COMMAND', data },
  ]);
  return true;
}

/** Ouvre le tiroir-caisse via une impulsion ESC/POS. */
export async function openCashDrawer(): Promise<boolean> {
  return printEscpos(esc.init() + esc.drawerPulse());
}

/** Imprime un ticket de test minimal (texte + coupe). */
export async function printTestTicket(pharmacyName?: string): Promise<boolean> {
  const commands =
    esc.init() +
    esc.center() +
    esc.boldOn() +
    esc.line('TEST IMPRESSION') +
    esc.boldOff() +
    esc.line(pharmacyName || 'Zenith POS') +
    esc.lf() +
    esc.line('0123456789 ABC abc') +
    esc.feed(3) +
    esc.cut(true);
  return printEscpos(commands);
}
