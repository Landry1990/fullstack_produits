/**
 * Logger centralisé pour le frontend.
 * En production: n'affiche que les erreurs.
 * En développement: affiche tout.
 * 
 * Usage:
 *   import { logger } from '@/utils/logger';
 *   logger.error('Message', error);
 *   logger.warn('Warning');
 *   logger.info('Info');
 *   logger.debug('Debug detail');
 */

const isDev = import.meta.env?.DEV ?? false;

export const logger = {
  error(...args: unknown[]) {
    console.error(...args);
  },

  warn(...args: unknown[]) {
    if (isDev) {
      console.warn(...args);
    }
  },

  info(...args: unknown[]) {
    if (isDev) {
      console.info(...args);
    }
  },

  debug(...args: unknown[]) {
    if (isDev) {
      console.debug(...args);
    }
  },
};
