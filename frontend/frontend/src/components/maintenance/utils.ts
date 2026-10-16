import api from '../../services/api';
import { gooeyToast } from 'goey-toast';
import type { TableCategory } from './types';

// Group tables by category for display
export const getTableCategories = (t: (key: string) => string): Record<string, TableCategory> => ({
  ventes: {
    label: t('categories.ventes'),
    icon: '💰',
    keys: ['factures', 'caisse', 'releves', 'coupons', 'promis'],
  },
  achats: {
    label: t('categories.achats'),
    icon: '📦',
    keys: ['commandes', 'avoirs', 'paiements_fournisseur'],
  },
  stock: {
    label: t('categories.stock'),
    icon: '📊',
    keys: ['mouvements_stock', 'ajustements_stock'],
  },
  caisse: {
    label: t('categories.caisse'),
    icon: '🏦',
    keys: ['clotures_caisse', 'mouvements_caisse'],
  },
  audit: {
    label: t('categories.audit'),
    icon: '📋',
    // ordonnancier retiré : registre réglementé, non purgeable côté API.
    keys: ['audit_logs', 'activity_logs', 'sms_logs', 'whatsapp_logs', 'telegram_logs'],
  },
  objectifs: {
    label: t('categories.objectifs'),
    icon: '🎯',
    keys: ['objectifs'],
  },
});

export const downloadRapport = (filename: string, t: (key: string) => string) => {
  api.get(`maintenance/download_rapport/?file=${filename}`, { responseType: 'blob' })
    .then(res => {
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a'); a.href = url;
      a.setAttribute('download', filename);
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    })
    .catch(() => gooeyToast.error(t('toasts.download_report_error')));
};
