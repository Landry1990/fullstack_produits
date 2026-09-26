import i18n from '../i18n';
import { getLocale } from './dateUtils';
import { logger } from '../utils/logger'

interface InventoryDiscrepancy {
  name: string;
  quantity: number;
  value: number;
}

interface Inventory {
  id: number | string;
  total_products?: number;
  discrepancies_count?: number;
  total_discrepancy_value?: number;
  discrepancies?: InventoryDiscrepancy[];
}

interface DashboardStats {
  revenue?: number;
  sales_count?: number;
  stock_count?: number;
  low_stock_count?: number;
  expiring_soon_count?: number;
}

export const generateInventorySummaryText = (inventory: Inventory, pharmacyName: string): string => {
  const t = i18n.t;
  const date = new Date().toLocaleDateString(getLocale(), { day: 'numeric', month: 'long', year: 'numeric' });

  let text = `📦 *${t('messaging:whatsapp_report.inventory_title', { name: pharmacyName.toUpperCase() })}*\n`;
  text += `📅 ${date}\n`;
  text += `📋 ${t('messaging:whatsapp_report.reference')} #${inventory.id}\n\n`;

  text += `📊 *${t('messaging:whatsapp_report.statistics')}*\n`;
  text += `• ${t('messaging:whatsapp_report.products_scanned')}: ${inventory.total_products || 0}\n`;
  text += `• ${t('messaging:whatsapp_report.discrepancies_detected')}: ${inventory.discrepancies_count || 0}\n`;
  text += `• ${t('messaging:whatsapp_report.total_discrepancy_value')}: ${inventory.total_discrepancy_value?.toLocaleString('fr-FR') || 0} F\n\n`;

  if ((inventory.discrepancies_count ?? 0) > 0) {
    text += `⚠️ *${t('messaging:whatsapp_report.top_discrepancies')}*\n`;
    // Afficher les 3 plus gros écarts
    const topDiscrepancies = (inventory.discrepancies || []).slice(0, 3);
    topDiscrepancies.forEach((item) => {
      text += `• ${item.name}: ${item.quantity} (${item.value.toLocaleString('fr-FR')} F)\n`;
    });
  }
  
  text += `\n_${t('messaging:whatsapp_report.generated_by')}_`;

  return text;
};

const _generateDashboardFlashText = (stats: DashboardStats, pharmacyName: string): string => {
  const t = i18n.t;
  const date = new Date().toLocaleDateString(getLocale(), { day: 'numeric', month: 'long', year: 'numeric' });

  let text = `📊 *${t('messaging:whatsapp_report.flash_title', { name: pharmacyName.toUpperCase() })}*\n`;
  text += `📅 ${date}\n\n`;

  text += `💰 *${t('messaging:whatsapp_report.revenue')}*: ${stats.revenue?.toLocaleString('fr-FR') || 0} F\n`;
  text += `🛒 *${t('messaging:whatsapp_report.sales_count')}*: ${stats.sales_count || 0}\n`;
  text += `📦 *${t('messaging:whatsapp_report.products_in_stock')}*: ${stats.stock_count || 0}\n`;
  text += `⚠️ *${t('messaging:whatsapp_report.low_stock_alerts')}*: ${stats.low_stock_count || 0}\n`;

  if ((stats.expiring_soon_count ?? 0) > 0) {
    text += `🕐 *${t('messaging:whatsapp_report.expiring_soon')}*: ${stats.expiring_soon_count}\n`;
  }

  text += `\n_${t('messaging:whatsapp_report.generated_by')}_`;
  
  return text;
};

export const openWhatsApp = (phoneNumber: string, message: string): boolean => {
  try {
    const cleanNumber = phoneNumber.replace(/[^\d]/g, '');
    const encodedMessage = encodeURIComponent(message);
    const url = `https://wa.me/${cleanNumber}?text=${encodedMessage}`;
    window.open(url, '_blank');
    return true;
  } catch (error) {
    logger.error('Error opening WhatsApp:', error);
    return false;
  }
};
