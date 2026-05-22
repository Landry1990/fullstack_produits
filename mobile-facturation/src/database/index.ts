/**
 * Barrel export — Couche Database
 */
export { getDatabase, closeDatabase, resetDatabase } from './connection';
export * as productRepo from './productRepository';
export * as invoiceRepo from './invoiceRepository';
