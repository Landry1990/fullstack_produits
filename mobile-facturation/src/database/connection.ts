/**
 * Connexion et initialisation de la base de données SQLite
 * Utilise l'API asynchrone d'expo-sqlite
 */
import * as SQLite from 'expo-sqlite';
import { DB_NAME } from '../config';

/** Instance unique de la base de données et promesse d'initialisation */
let dbInstance: SQLite.SQLiteDatabase | null = null;
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Récupère l'instance de la base de données (singleton avec verrou d'initialisation)
 * Initialise la DB et crée les tables si nécessaire
 */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;
  if (dbPromise) return dbPromise;

  dbPromise = (async () => {
    try {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      
      // Activer le mode WAL pour de meilleures performances en écriture concurrente
      await db.execAsync('PRAGMA journal_mode = WAL;');
      
      // Créer les tables
      await initializeTables(db);
      
      dbInstance = db;
      return db;
    } catch (error) {
      dbPromise = null; // Réinitialiser le verrou en cas d'erreur pour permettre un nouvel essai
      throw error;
    }
  })();

  return dbPromise;
}

/**
 * Crée les tables si elles n'existent pas
 * Migration v1 — schéma initial
 */
async function initializeTables(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    -- Table des produits (catalogue local synchronisé depuis le serveur)
    CREATE TABLE IF NOT EXISTS products (
      id            INTEGER PRIMARY KEY,
      code_barre    TEXT NOT NULL,
      designation   TEXT NOT NULL,
      prix_vente    REAL NOT NULL DEFAULT 0,
      stock_local   INTEGER NOT NULL DEFAULT 0,
      lot           TEXT,
      updated_at    TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- Index pour recherche rapide par code-barres
    CREATE INDEX IF NOT EXISTS idx_products_code_barre ON products(code_barre);

    -- Index pour recherche par désignation
    CREATE INDEX IF NOT EXISTS idx_products_designation ON products(designation);

    -- Table des factures en attente de synchronisation
    CREATE TABLE IF NOT EXISTS pending_invoices (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid            TEXT NOT NULL UNIQUE,
      date_creation   TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      client          TEXT,
      total           REAL NOT NULL DEFAULT 0,
      items_json      TEXT NOT NULL DEFAULT '[]',
      status          TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'synced', 'error')),
      server_id       INTEGER,
      server_number   TEXT,
      error_message   TEXT,
      synced_at       TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- Index pour retrouver rapidement les factures à synchroniser
    CREATE INDEX IF NOT EXISTS idx_pending_invoices_status ON pending_invoices(status);
    CREATE INDEX IF NOT EXISTS idx_pending_invoices_uuid ON pending_invoices(uuid);
  `);

  console.log('[DB] Tables initialisées avec succès');
}

/**
 * Ferme la connexion à la base de données
 * À appeler lors de la fermeture de l'application
 */
export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    await dbInstance.closeAsync();
    dbInstance = null;
    dbPromise = null;
    console.log('[DB] Connexion fermée');
  }
}

/**
 * Réinitialise la base de données (suppression + recréation)
 * ⚠️ Usage uniquement en développement ou reset complet
 */
export async function resetDatabase(): Promise<void> {
  if (dbInstance) {
    await dbInstance.closeAsync();
    dbInstance = null;
    dbPromise = null;
  }
  await SQLite.deleteDatabaseAsync(DB_NAME);
  console.log('[DB] Base de données réinitialisée');
  // Recréer
  await getDatabase();
}
