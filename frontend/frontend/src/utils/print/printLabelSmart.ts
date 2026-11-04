import { getSavedLabelPrinterName, printEscpos } from '../../services/qzPrinter';
import { buildLabelsTspl, type LabelTsplItem } from '../escpos/labelTspl';
import { logger } from '../logger';

export async function printLabelsSmart(
  items: LabelTsplItem[],
  format: '40x20' | '30x15',
  htmlFallback: () => void | Promise<void>,
): Promise<'tspl' | 'html'> {
  const savedName = getSavedLabelPrinterName();
  if (savedName) {
    try {
      if (await printEscpos(buildLabelsTspl(items, format), savedName)) return 'tspl';
    } catch (err) {
      logger.warn('Impression TSPL indisponible, secours navigateur.', err);
    }
  }
  await htmlFallback();
  return 'html';
}
