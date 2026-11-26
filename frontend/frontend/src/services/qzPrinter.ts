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
export const STORAGE_LABEL_PRINTER_KEY = 'qz_label_printer_name';
const STORAGE_DRAWER_KEY = 'qz_open_drawer';

type QzApi = import('qz-tray').default;

let qzLoadPromise: Promise<QzApi> | null = null;
let connectionPromise: Promise<void> | null = null;
let securityConfigured = false;
let socketCallbacksConfigured = false;
let qzUnavailableUntil = 0;
let printQueue: Promise<unknown> = Promise.resolve();

/** Durée pendant laquelle QZ Tray est considéré absent après un échec de
 * connexion. Évite de relancer la tempête de tentatives WebSocket (8 ports ×
 * retries) à chaque clic sur Imprimer — c'était la cause du blocage Safari. */
const QZ_UNAVAILABLE_COOLDOWN_MS = 60_000;

/** Sans timeout, un qz.print/connect sur une socket morte-mais-pas-close
 * (QZ Tray relancé, veille PC, prompt « Allow » ignoré) peut pendre
 * indéfiniment : rien ne s'imprime et aucun fallback ne se déclenche. */
const QZ_CONNECT_TIMEOUT_MS = 15_000;
const QZ_PRINT_TIMEOUT_MS = 10_000;
const QZ_DISCOVERY_TIMEOUT_MS = 5_000;
const QZ_DISCONNECT_TIMEOUT_MS = 3_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} : délai dépassé (${ms} ms)`)),
      ms
    );
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

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
    // Sans certificat, QZ Tray connecte en « anonymous » : la fenêtre de
    // confiance ne peut alors PAS être mémorisée (Allow grisé avec
    // « Remember »). On retente donc le fetch avant d'abandonner — un backend
    // qui redémarre ou un coup de latence ne doit pas dégrader la session
    // en anonyme jusqu'à la fermeture de la page.
    const attempt = (remaining: number) => {
      fetch('/api/qz/certificate/')
        .then((res) => {
          if (!res.ok) throw new Error(`Certificat QZ HTTP ${res.status}`);
          return res.text();
        })
        .then(resolve)
        .catch((err) => {
          if (remaining > 0) {
            setTimeout(() => attempt(remaining - 1), 500);
          } else {
            reject(err);
          }
        });
    };
    attempt(2);
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

  // Surveille les fermetures/erreurs de socket : sans ces callbacks, une
  // déconnexion silencieuse n'était visible qu'au prochain print. La remise
  // à null de connectionPromise (voir .then ci-dessous) permet la reconnexion.
  if (!socketCallbacksConfigured) {
    socketCallbacksConfigured = true;
    qz.websocket.setClosedCallbacks((evt: unknown) => {
      logger.warn('QZ Tray : socket fermée', evt);
    });
    qz.websocket.setErrorCallbacks((evt: unknown) => {
      logger.error('QZ Tray : erreur socket', evt);
    });
  }

  // L'app est servie en HTTP : on tente les ports non sécurisés de QZ Tray
  // (8182…) puis les sécurisés en secours. 'localhost.qz.io' est inclus car
  // QZ le résout vers 127.0.0.1 avec un certificat valide en mode sécurisé.
  connectionPromise = withTimeout(qz.websocket.connect({
    host: ['localhost', 'localhost.qz.io'],
    usingSecureProtocol: window.location.protocol === 'https:',
    port: {
      secure: [8181, 8282, 8383, 8484],
      insecure: [8182, 8283, 8384, 8485],
    },
    retries: 2,
    delay: 0,
  } as never), QZ_CONNECT_TIMEOUT_MS, 'Connexion QZ Tray').then(() => {
    // IMPORTANT : remettre à null aussi en cas de succès. Sinon la promesse
    // résolue restait figée à vie : après une déconnexion, isActive() === false
    // mais on retournait cette vieille promesse → jamais de reconnexion, et
    // qz.print() sur socket morte → ticket perdu silencieusement.
    connectionPromise = null;
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

export function getSavedLabelPrinterName(): string | null {
  try {
    return localStorage.getItem(STORAGE_LABEL_PRINTER_KEY);
  } catch {
    return null;
  }
}

export function setLabelPrinterName(name: string): void {
  try {
    if (name) {
      localStorage.setItem(STORAGE_LABEL_PRINTER_KEY, name);
    } else {
      localStorage.removeItem(STORAGE_LABEL_PRINTER_KEY);
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

function enqueueQzOperation<T>(operation: () => Promise<T>): Promise<T> {
  const task = printQueue.then(operation);
  printQueue = task.then(() => undefined, () => undefined);
  return task;
}

export async function listPrinters(): Promise<string[]> {
  return enqueueQzOperation(async () => {
    const qz = await loadQz();
    // La détection manuelle (Paramètres > Impression) ignore le cooldown :
    // l'utilisateur vient peut-être de (ré)installer QZ Tray.
    await ensureConnected(true);
    return discoverWithRecovery(qz, () => qz.printers.find());
  });
}

async function discoverWithRecovery<T>(qz: QzApi, discover: () => Promise<T>): Promise<T> {
  try {
    return await withTimeout(discover(), QZ_DISCOVERY_TIMEOUT_MS, 'Détection imprimantes QZ Tray');
  } catch (err) {
    logger.warn('Détection QZ Tray interrompue, reconnexion automatique avant impression.', err);
    if (qz.websocket.isActive()) {
      await withTimeout(qz.websocket.disconnect(), QZ_DISCONNECT_TIMEOUT_MS, 'Déconnexion QZ Tray');
    }
    await ensureConnected(true);
    return withTimeout(discover(), QZ_DISCOVERY_TIMEOUT_MS, 'Détection imprimantes QZ Tray');
  }
}

async function resolvePrinterName(printerNameOverride?: string): Promise<string | null> {
  if (printerNameOverride === '') return null;
  const qz = await loadQz();
  await ensureConnected();
  const saved = printerNameOverride ?? getSavedPrinterName();
  try {
    return await discoverWithRecovery(qz, async () => {
      if (saved) {
        const printers = await qz.printers.find();
        if (!printers.includes(saved)) throw new Error(`Imprimante QZ Tray introuvable : ${saved}`);
        return saved;
      }
      return qz.printers.getDefault();
    });
  } catch (err) {
    logger.warn('Imprimante QZ Tray indisponible après redétection automatique.', err);
    return null;
  }
}

/**
 * Envoie des commandes ESC/POS brutes à l'imprimante via QZ Tray.
 * Les appels sont sérialisés : deux impressions ne tournent jamais en
 * parallèle (protège la connexion WebSocket et l'imprimante).
 * Retourne `true` si le job a été envoyé, `false` si la connexion/ impression a échoué.
 */
export async function printEscpos(commands: string | string[], printerNameOverride?: string): Promise<boolean> {
  return enqueueQzOperation(() => printEscposInternal(commands, printerNameOverride));
}

async function printEscposInternal(commands: string | string[], printerNameOverride?: string): Promise<boolean> {
  const qz = await loadQz();
  await ensureConnected();

  let printer: string | null;
  if (printerNameOverride !== undefined) {
    // Une imprimante dédiée ne doit jamais retomber sur celle des tickets.
    printer = await resolvePrinterName(printerNameOverride);
  } else {
    printer = await resolvePrinterName();
  }
  if (!printer) {
    logger.warn('Impression ESC/POS annulée : aucune imprimante QZ Tray disponible.');
    return false;
  }

  const joined = Array.isArray(commands) ? commands.join('') : commands;
  const data = commandsToBase64(joined);
  const config = qz.configs.create(printer);

  await withTimeout(qz.print(config, [
    { type: 'RAW', format: 'BASE64', data },
  ]), QZ_PRINT_TIMEOUT_MS, 'Impression QZ Tray');
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
