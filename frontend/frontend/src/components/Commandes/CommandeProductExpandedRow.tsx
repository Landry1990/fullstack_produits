import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { TableRow, TableCell } from '../shadcn/table';
import type { CommandeProduit } from '../../types';

interface CommandeProductExpandedRowProps {
    p: CommandeProduit;
    colSpan: number;
}

const DATE_OPTIONS: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };

export function CommandeProductExpandedRow({ p, colSpan }: CommandeProductExpandedRowProps) {
    const { t, i18n } = useTranslation(['orders', 'common']);

    const pObj = (p.produit && typeof p.produit === 'object') ? p.produit : null;

    const s = {
        dernier_achat: pObj?.dernier_achat || p.produit_dernier_achat,
        dernier_vente: pObj?.dernier_vente || p.produit_dernier_vente,
        rotation_moyenne: pObj?.rotation_moyenne || p.produit_rotation_moyenne,
        stock_minimum: pObj?.stock_minimum || p.produit_stock_minimum || 0,
        stock_maximum: pObj?.stock_maximum || p.produit_stock_maximum || 0,
        stock_alert: pObj?.stock_alert || p.produit_stock_alert || 0,
        cost_price: pObj?.cost_price || p.produit_cost_price || p.price,
        stock: pObj?.stock ?? p.produit_stock ?? 0,
    };

    const formatAchat = s.dernier_achat ? new Date(s.dernier_achat).toLocaleDateString(i18n.language, DATE_OPTIONS) : t('orders:product_table.info_row.unknown');
    const formatVente = s.dernier_vente ? new Date(s.dernier_vente).toLocaleDateString(i18n.language, DATE_OPTIONS) : t('orders:product_table.info_row.never');

    return (
        <TableRow className="bg-blue-50/30 border-b border-slate-200">
            <TableCell colSpan={colSpan} className="p-0">
                <div className="p-4 md:px-8 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 text-sm">
                    <div>
                        <div className="text-xs uppercase font-bold text-slate-400 mb-1">{t('orders:product_table.info_row.purchase_history')}</div>
                        <div className="font-medium text-slate-800">{formatAchat}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{t('orders:product_table.info_row.last_buy_price')}: {s.cost_price ? formatCurrency(Number(s.cost_price)) : '-'}</div>
                    </div>
                    <div>
                        <div className="text-xs uppercase font-bold text-slate-400 mb-1">{t('orders:product_table.info_row.sales_history')}</div>
                        <div className="font-medium text-slate-800">{formatVente}</div>
                        {s.rotation_moyenne && Number(s.rotation_moyenne) > 0 && (
                            <div className="text-xs text-blue-600 mt-0.5 font-medium">
                                {t('orders:product_table.info_row.rotation')}: {Number(s.rotation_moyenne).toFixed(2)} / {t('orders:product_table.month')}
                                <span className="text-slate-400 ml-1">({(Number(s.rotation_moyenne) / 30).toFixed(2)} / {t('orders:product_table.day')})</span>
                            </div>
                        )}
                    </div>
                    <div>
                        <div className="text-xs uppercase font-bold text-slate-400 mb-1">{t('orders:product_table.info_row.stock_alerts')}</div>
                        <div className="font-medium">
                            {t('orders:product_table.min')}: <span className="text-amber-600">{s.stock_minimum}</span> / {t('orders:product_table.max')}: <span className="text-emerald-600">{s.stock_maximum}</span>
                        </div>
                        {s.stock_alert > 0 && (
                            <div className="text-xs text-red-600 mt-0.5">{t('orders:product_table.info_row.alert_threshold')}: {s.stock_alert}</div>
                        )}
                    </div>
                    <div>
                        <div className="text-xs uppercase font-bold text-slate-400 mb-1">{t('orders:product_table.info_row.indicators')}</div>
                        <div className="flex flex-col gap-1">
                            {s.stock <= 0 ? (
                                <div className="text-xs text-red-600 font-medium flex items-center gap-1">
                                    <AlertTriangle className="size-3" />
                                    {t('orders:product_table.info_row.stock_out')}
                                </div>
                            ) : s.rotation_moyenne && Number(s.rotation_moyenne) > 0 ? (
                                <div className="text-xs">
                                    {t('orders:product_table.info_row.stock_life')}: <span className="font-bold">~{Math.round(s.stock / (Number(s.rotation_moyenne) / 30))} {t('orders:product_table.day')}</span>
                                </div>
                            ) : (
                                <div className="text-xs text-slate-400">{t('orders:product_table.info_row.rotation_unknown')}</div>
                            )}
                        </div>
                    </div>
                </div>
            </TableCell>
        </TableRow>
    );
}
