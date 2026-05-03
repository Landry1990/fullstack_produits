export const generateInventorySummaryText = (inventory: any, pharmacyName: string): string => {
  const date = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  
  let text = `📦 *RAPPORT INVENTAIRE ${pharmacyName.toUpperCase()}*\n`;
  text += `📅 ${date}\n`;
  text += `📋 Référence: #${inventory.id}\n\n`;
  
  text += `📊 *Statistiques*\n`;
  text += `• Produits scannés: ${inventory.total_products || 0}\n`;
  text += `• Écarts détectés: ${inventory.discrepancies_count || 0}\n`;
  text += `• Valeur totale des écarts: ${inventory.total_discrepancy_value?.toLocaleString('fr-FR') || 0} F\n\n`;
  
  if (inventory.discrepancies_count > 0) {
    text += `⚠️ *Principaux écarts*\n`;
    // Afficher les 3 plus gros écarts
    const topDiscrepancies = (inventory.discrepancies || []).slice(0, 3);
    topDiscrepancies.forEach((item: any) => {
      text += `• ${item.name}: ${item.quantity} (${item.value.toLocaleString('fr-FR')} F)\n`;
    });
  }
  
  text += `\n_Généré par PharmaGest_`;
  
  return text;
};

export const generateDashboardFlashText = (stats: any, pharmacyName: string): string => {
  const date = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  
  let text = `📊 *RAPPORT FLASH ${pharmacyName.toUpperCase()}*\n`;
  text += `📅 ${date}\n\n`;
  
  text += `💰 *Chiffre d'affaires*: ${stats.revenue?.toLocaleString('fr-FR') || 0} F\n`;
  text += `🛒 *Nombre de ventes*: ${stats.sales_count || 0}\n`;
  text += `📦 *Produits en stock*: ${stats.stock_count || 0}\n`;
  text += `⚠️ *Alertes stock bas*: ${stats.low_stock_count || 0}\n`;
  
  if (stats.expiring_soon_count > 0) {
    text += `🕐 *Produits périmant bientôt*: ${stats.expiring_soon_count}\n`;
  }
  
  text += `\n_Généré par PharmaGest_`;
  
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
    console.error('Error opening WhatsApp:', error);
    return false;
  }
};
