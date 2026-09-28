import type { TicketCaisse, PharmacySettings } from '../../types';
import { buildTicketEscpos } from '../escpos/ticketEscpos';
import { printEscpos, shouldOpenDrawer } from '../../services/qzPrinter';
import { logger } from '../logger';

/**
 * Tente d'imprimer un ticket en ESC/POS natif via QZ Tray.
 * En cas d'échec (QZ absent, pas d'imprimante, erreur réseau),
 * exécute le fallback HTML passé par l'appelant.
 *
 * Retourne 'escpos' si le job QZ a été soumis, 'html' sinon.
 */
export async function printTicketSmart(
  ticket: TicketCaisse,
  settings: PharmacySettings,
  htmlFallback: () => void
): Promise<'escpos' | 'html'> {
  try {
    const commands = buildTicketEscpos(ticket, settings, { openDrawer: shouldOpenDrawer() });
    const ok = await printEscpos(commands);
    if (ok) {
      logger.info('Ticket envoyé en ESC/POS natif via QZ Tray');
      return 'escpos';
    }
    throw new Error('QZ Tray a refusé ou aucune imprimante disponible');
  } catch (err) {
    logger.warn('Impression ESC/POS échouée, fallback sur le flux HTML', err);
    htmlFallback();
    return 'html';
  }
}
