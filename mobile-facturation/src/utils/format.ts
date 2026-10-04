import { theme } from '../config/theme';

// Libellé d'expiration d'un lot (MM/AA) + couleur selon l'échéance.
export function expiryInfo(dateStr: string | null): { label: string; color: string } {
  if (!dateStr) return { label: 'N/A', color: theme.textMuted };
  const days = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
  const d = new Date(dateStr);
  const label = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`;
  if (days < 0) return { label, color: theme.danger };
  if (days < 30) return { label, color: theme.warning };
  return { label, color: theme.primary };
}
