import type { PharmacySettings } from '../../types';
import { buildClotureEscpos, type ClotureEscposData } from '../escpos/clotureEscpos';
import { printEscpos } from '../../services/qzPrinter';
import { logger } from '../logger';

/**
 * Tente d'imprimer un rapport de clôture en ESC/POS natif via QZ Tray.
 * En cas d'échec (QZ absent, pas d'imprimante, erreur réseau),
 * exécute le fallback HTML passé par l'appelant.
 *
 * Retourne 'escpos' si le job QZ a été soumis, 'html' sinon.
 */
export async function printClotureSmart(
  data: ClotureEscposData,
  settings: PharmacySettings,
  htmlFallback: () => void
): Promise<'escpos' | 'html'> {
  try {
    const commands = buildClotureEscpos(data, settings);
    const ok = await printEscpos(commands);
    if (ok) {
      logger.info('Rapport de clôture envoyé en ESC/POS natif via QZ Tray');
      return 'escpos';
    }
    throw new Error('QZ Tray a refusé ou aucune imprimante disponible');
  } catch (err) {
    logger.warn('Impression ESC/POS rapport de clôture échouée, fallback sur le flux HTML', err);
    htmlFallback();
    return 'html';
  }
}
