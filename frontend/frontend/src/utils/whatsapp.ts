import { formatCurrency, formatDateFr } from './formatters';

/**
 * Génère le texte du rapport Flash Stratégique pour le Dashboard.
 * Utilise des codes Unicode pour les emojis afin d'éviter les problèmes d'encodage URL.
 */
export const generateDashboardFlashText = (stats: any, pharmacyName: string) => {
    if (!stats || !stats.revenue) return "Données du rapport non disponibles pour le moment.";

    const today = new Date().toLocaleDateString('fr-FR');
    
    // Extraction des données avec fallbacks
    const ca = stats.revenue.value || 0;
    const caChange = stats.revenue.change || 0;
    const margin = stats.margin_today || 0;
    const clients = stats.sales?.value || 0;
    const lowStock = stats.low_stock?.value || 0;
    
    const changeIndicator = caChange >= 0 ? `\u{2197}\u{FE0F} +${caChange}%` : `\u{2198}\u{FE0F} ${caChange}%`;

    let message = `\u{1F31F} *${pharmacyName.toUpperCase()} - FLASH STRATEGIQUE* \u{1F31F}\n`;
    message += `\u{1F4C5} _Le ${today}_\n\n`;
    
    message += `\u{1F4B0} *CA du jour* : ${ca.toLocaleString('fr-FR')} F\n`;
    message += `\u{1F4C8} *Variation/Hier* : ${changeIndicator}\n`;
    message += `\u{1F4B8} *Marge brute* : ${margin.toLocaleString('fr-FR')} F\n`;
    message += `\u{1F465} *Clients servis* : ${clients}\n`;
    message += `\u{26A0}\u{FE0F} *Ruptures/Alertes* : ${lowStock} produits\n\n`;

    // Ajout du Top Ventes si disponible
    if (stats.top_products && stats.top_products.length > 0) {
        message += `\u{1F3C6} *Top 3 Ventes :*\n`;
        stats.top_products.slice(0, 3).forEach((p: any, i: number) => {
            message += `${['\u{1F947}', '\u{1F948}', '\u{1F949}'][i]} ${p.name} (${p.qty})\n`;
        });
        message += `\n`;
    }

    message += `\u{1F680} _Propulsé par Zenith Speed_`;
    
    return message;
};

/**
 * Génère le texte du bilan d'inventaire.
 */
export const generateInventorySummaryText = (inv: any, pharmacyName: string) => {
    if (!inv) return "";

    const dateStr = new Date(inv.date || Date.now()).toLocaleDateString('fr-FR');
    const statusLabel = inv.status === 'VAL' ? '\u{2705} VALIDE' : '\u{23F3} EN COURS';
    
    const ecart = inv.ecart_total_valeur || 0;
    const ecartIcon = ecart < 0 ? '\u{1F534}' : '\u{1F7E2}';

    let message = `\u{1F4CB} *${pharmacyName.toUpperCase()} - BILAN INVENTAIRE*\n`;
    message += `\u{1F516} *Ref* : ${inv.numero_inventaire || 'N/A'}\n`;
    message += `\u{1F4C5} *Date* : ${dateStr}\n`;
    message += `\u{1F4CA} *Statut* : ${statusLabel}\n\n`;
    
    message += `\u{1F4B3} *Valeur Théorique* : ${(inv.valeur_theorique || 0).toLocaleString('fr-FR')} F\n`;
    message += `\u{1F4B3} *Valeur Réelle* : ${(inv.valeur_reelle || 0).toLocaleString('fr-FR')} F\n`;
    message += `${ecartIcon} *Ecart Total* : ${ecart.toLocaleString('fr-FR')} F\n\n`;
    
    message += `\u{1F4F1} _Envoyé depuis Zenith Speed_`;
    
    return message;
};

/**
 * Ouvre l'interface WhatsApp (Web ou App) avec un message pré-rempli.
 */
export const openWhatsApp = (number: string, message: string) => {
    if (!number) return false;
    
    // Nettoyer le numéro (ne garder que les chiffres)
    const cleanNumber = number.replace(/\D/g, '');
    const encodedMessage = encodeURIComponent(message);
    const url = `https://wa.me/${cleanNumber}?text=${encodedMessage}`;
    
    window.open(url, '_blank');
    return true;
};
