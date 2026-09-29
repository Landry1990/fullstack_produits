import { logger } from '../utils/logger';
import { safeStorage } from '../utils/storage';
import * as esc from '../utils/escpos/encoder';

/** Convertit une chaîne de commandes ESC/POS (1 caractère = 1 octet) en Base64 pour QZ Tray. */
function commandsToBase64(commands: string): string {
  let binary = '';
  for (let i = 0; i < commands.length; i++) {
    binary += String.fromCharCode(commands.charCodeAt(i) & 0xFF);
  }
  return btoa(binary);
}

const STORAGE_PRINTER_KEY = 'qz_printer_name';
const STORAGE_DRAWER_KEY = 'qz_open_drawer';

type QzApi = import('qz-tray').default;

let qzLoadPromise: Promise<QzApi> | null = null;
let connectionPromise: Promise<void> | null = null;
let securityConfigured = false;
let qzUnavailableUntil = 0;
let printQueue: Promise<unknown> = Promise.resolve();

/** Durée pendant laquelle QZ Tray est considéré absent après un échec de
 * connexion. Évite de relancer la tempête de tentatives WebSocket (8 ports ×
 * retries) à chaque clic sur Imprimer — c'était la cause du blocage Safari. */
const QZ_UNAVAILABLE_COOLDOWN_MS = 60_000;

async function loadQz(): Promise<QzApi> {
  if (qzLoadPromise) return qzLoadPromise;
  qzLoadPromise = import('qz-tray').then((m) => m.default ?? (m as unknown as QzApi));
  return qzLoadPromise;
}

async function configureSecurity(qz: QzApi): Promise<void> {
  if (securityConfigured) return;
  securityConfigured = true;

  const qzAny = qz as unknown as Record<string, unknown>;
  const security = qzAny.security as {
    setSignatureAlgorithm: (algo: string) => void;
    setCertificatePromise: (fn: (resolve: (v: string) => void, reject: (e: unknown) => void) => void) => void;
    setSignaturePromise: (
      fn: (toSign: string) => (resolve: (sig: string) => void, reject: (e: unknown) => void) => void
    ) => void;
  };

  // Algorithme de signature attendu par QZ Tray 2.1+
  security.setSignatureAlgorithm('SHA512');

  const getToken = (): string | null => {
    // Le token est stocké en sessionStorage par défaut dans cette app.
    return safeStorage.getItem('authToken');
  };

  security.setCertificatePromise((resolve, reject) => {
    fetch('/api/qz/certificate/')
      .then((res) => {
        if (!res.ok) throw new Error(`Certificat QZ HTTP ${res.status}`);
        return res.text();
      })
      .then(resolve)
      .catch(reject);
  });

  security.setSignaturePromise((toSign) => (resolve, reject) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) headers.Authorization = `Token ${token}`;
    fetch('/api/qz/sign/', {
      method: 'POST',
      headers,
      body: JSON.stringify({ request: toSign }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Signature QZ HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => resolve(data.signature as string))
      .catch(reject);
  });
}

async function ensureConnected(force = false): Promise<void> {
  const qz = await loadQz();
  await configureSecurity(qz);
  if (qz.websocket.isActive()) return Promise.resolve();

  // QZ Tray est absent/injoignable : on refuse immédiatement pendant le
  // cooldown pour que le fallback HTML démarre sans délai ni tempête réseau.
  if (!force && Date.now() < qzUnavailableUntil) {
    throw new Error('QZ Tray indisponible (cooldown actif)');
  }
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
    qzUnavailableUntil = 0;
    logger.info('QZ Tray connecté');
  }).catch((err: unknown) => {
    connectionPromise = null;
    qzUnavailableUntil = Date.now() + QZ_UNAVAILABLE_COOLDOWN_MS;
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
  // La détection manuelle (Paramètres > Impression) ignore le cooldown :
  // l'utilisateur vient peut-être de (ré)installer QZ Tray.
  await ensureConnected(true);
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
 * Les appels sont sérialisés : deux impressions ne tournent jamais en
 * parallèle (protège la connexion WebSocket et l'imprimante).
 * Retourne `true` si le job a été envoyé, `false` si la connexion/ impression a échoué.
 */
export async function printEscpos(commands: string | string[]): Promise<boolean> {
  const task = printQueue.then(() => printEscposInternal(commands));
  printQueue = task.then(
    () => undefined,
    () => undefined
  );
  return task;
}

async function printEscposInternal(commands: string | string[]): Promise<boolean> {
  const qz = await loadQz();
  await ensureConnected();

  const printer = await resolvePrinterName();
  if (!printer) {
    logger.warn('Impression ESC/POS annulée : aucune imprimante QZ Tray disponible.');
    return false;
  }

  const joined = Array.isArray(commands) ? commands.join('') : commands;
  const data = commandsToBase64(joined);
  const config = qz.configs.create(printer);

  await qz.print(config, [
    { type: 'RAW', format: 'BASE64', data },
  ]);
  return true;
}

/** Ouvre le tiroir-caisse via une impulsion ESC/POS. */
export async function openCashDrawer(): Promise<boolean> {
  return printEscpos(esc.init() + esc.drawerPulse());
}

/** Imprime un ticket de test minimal (texte + accents + coupe). */
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
    esc.line('Accents : é è à ç ï ô') +
    esc.feed(3) +
    esc.cut(true);
  return printEscpos(commands);
}
