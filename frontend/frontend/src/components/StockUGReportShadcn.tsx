import { useState, useEffect, useCallback, useMemo } from 'react';
import { PackageOpen, Calendar, Download, RefreshCw, Banknote, Printer, Search, Eye, X } from 'lucide-react';
import api from '../services/api';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import toast, { Toaster } from 'react-hot-toast';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { writePrintDocument, escHtml } from '../utils/print/printHelpers';
import { getLocale } from '../utils/dateUtils';

import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Input } from './ui/Input';
import { Skeleton } from './ui/Skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/Table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from './ui/Dialog';
import type { UGReportData, FournisseurUGStat } from '../types/ug';
import { logger } from '../utils/logger'

export default function StockUGReportShadcn() {
  const { t } = useTranslation(['stock', 'common']);
  const [data, setData] = useState<UGReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const [dateDebut, setDateDebut] = useState<string>('');
  const [dateFin, setDateFin] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<FournisseurUGStat | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (dateDebut) params.append('date_debut', dateDebut);
      if (dateFin) params.append('date_fin', dateFin);

      const response = await api.get(`stock-lots/rapport_ug/?${params.toString()}`);
      setData(response.data);
    } catch (error) {
      logger.error('Error fetching UG report:', error);
      toast.error(t('common:messages.error_loading'));
    } finally {
      setLoading(false);
    }
  }, [dateDebut, dateFin, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredSuppliers = useMemo(() => {
    if (!data?.fournisseurs.length) return [];
    if (!searchQuery.trim()) return data.fournisseurs;
    const q = searchQuery.toLowerCase();
    return data.fournisseurs.filter(stat =>
      stat.fournisseur_nom.toLowerCase().includes(q) ||
      stat.details.some(d => d.produit_nom.toLowerCase().includes(q) || d.lot_numero.toLowerCase().includes(q))
    );
  }, [data, searchQuery]);

  const exportCSV = useCallback(() => {
    if (!data?.fournisseurs.length) return;

    const headers = [
      t('stock:rapport_ug.table.supplier'),
      t('stock:rapport_ug.table.lots_count'),
      t('stock:rapport_ug.table.received_ug'),
      t('stock:rapport_ug.table.remaining_value'),
    ];
    const rows = data.fournisseurs.map(f => [
      f.fournisseur_nom,
      f.lots_count,
      f.total_ug,
      f.total_valeur,
    ]);

    rows.push([t('common:total_general'), '', data.global_total_ug, data.global_total_valeur]);

    const csvContent = "data:text/csv;charset=utf-8,"
      + headers.join(';') + '\n'
      + rows.map(e => e.join(';')).join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `rapport_ug_${format(new Date(), 'yyyyMMdd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [data, t]);

  const handlePrint = useCallback(() => {
    if (!data) return;
    const win = window.open('about:blank', '', 'height=600,width=800');
    if (win) {
      writePrintDocument(win, `
        <html>
          <head>
            <title>${escHtml(t('stock:rapport_ug.print_template.title'))} - ${format(new Date(), 'dd/MM/yyyy')}</title>
            <style>
              body { font-family: sans-serif; padding: 20px; color: #334155; }
              h1 { text-align: center; font-size: 24px; color: #1e293b; margin-bottom: 5px; }
              .subtitle { text-align: center; font-size: 12px; color: #64748b; font-weight: bold; text-transform: uppercase; margin-bottom: 30px; letter-spacing: 1px; }
              .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px; }
              .kpi-card { border: 1px solid #e2e8f0; padding: 15px; border-radius: 12px; }
              .kpi-label { font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; margin-bottom: 5px; }
              .kpi-value { font-size: 18px; font-weight: 900; color: #0f172a; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 11px; }
              th { background: #f8fafc; text-align: left; padding: 12px 8px; border-bottom: 2px solid #e2e8f0; text-transform: uppercase; font-size: 9px; font-weight: 800; color: #64748b; }
              td { padding: 10px 8px; border-bottom: 1px solid #f1f5f9; }
              .supplier-row { background: #f1f5f9; font-weight: bold; }
              @media print {
                .no-print { display: none; }
                body { padding: 0; }
              }
            </style>
          </head>
          <body>
            <h1>${t('stock:rapport_ug.title')}</h1>
            <div class="subtitle">${t('stock:rapport_ug.print_template.situation', { date: format(new Date(), 'dd/MM/yyyy') })}</div>

            <div class="kpi-grid">
              <div class="kpi-card">
                <div class="kpi-label">${t('stock:rapport_ug.stats.history_ug')}</div>
                <div class="kpi-value">${formatNumber(data.global_total_ug)}</div>
              </div>
              <div class="kpi-card" style="border-left: 4px solid #10b981;">
                <div class="kpi-label" style="color: #10b981;">${t('stock:rapport_ug.stats.current_stock_ug')}</div>
                <div class="kpi-value">${formatNumber(data.global_total_ug_restantes)}</div>
              </div>
              <div class="kpi-card">
                <div class="kpi-label">${t('stock:rapport_ug.stats.estimated_value')}</div>
                <div class="kpi-value">${formatCurrency(data.global_total_valeur)}</div>
              </div>
              <div class="kpi-card" style="border-left: 4px solid #3b82f6;">
                <div class="kpi-label" style="color: #3b82f6;">${t('stock:rapport_ug.stats.latent_cash')}</div>
                <div class="kpi-value">${formatCurrency(data.global_total_valeur_restante)}</div>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>${t('stock:rapport_ug.table.details.product')}</th>
                  <th>${t('stock:rapport_ug.table.details.lot')}</th>
                  <th style="text-align: right;">${t('stock:rapport_ug.table.details.received')}</th>
                  <th style="text-align: right;">${t('stock:rapport_ug.table.details.remaining')}</th>
                  <th style="text-align: right;">${t('stock:rapport_ug.table.details.val_rest')}</th>
                </tr>
              </thead>
              <tbody>
                ${data.fournisseurs.map(f => `
                  <tr class="supplier-row">
                    <td colspan="2">${escHtml(f.fournisseur_nom)} (${t('stock:rapport_ug.print_template.lots_count', { count: f.lots_count })})</td>
                    <td style="text-align: right;">${formatNumber(f.total_ug)}</td>
                    <td style="text-align: right;">${formatNumber(f.total_ug_restantes)}</td>
                    <td style="text-align: right;">${formatCurrency(f.total_valeur_restante)}</td>
                  </tr>
                  ${f.details.map(d => `
                    <tr>
                      <td style="padding-left: 25px;">${escHtml(d.produit_nom)}</td>
                      <td style="color: #64748b; font-size: 9px; white-space: nowrap;">${t('stock:rapport_ug.print_template.lot_label')}: ${escHtml(d.lot_numero)}<br/>${t('stock:rapport_ug.print_template.invoice_label')}: ${escHtml(d.facture_numero)}</td>
                      <td style="text-align: right;">${formatNumber(d.quantity_free)}</td>
                      <td style="text-align: right; font-weight: bold; color: #10b981;">${formatNumber(d.quantity_free_remaining)}</td>
                      <td style="text-align: right; font-weight: bold; color: #1d293b;">${formatCurrency(d.valeur_restante)}</td>
                    </tr>
                  `).join('')}
                `).join('')}
              </tbody>
            </table>

            <div style="text-align: center; margin-top: 40px; font-size: 9px; color: #94a3b8; font-weight: bold; text-transform: uppercase;">
              --- ${t('stock:rapport_ug.print_template.footer')} ---
            </div>
          </body>
        </html>
      `);
      win.onload = () => win.print();
      setTimeout(() => { if (win) win.print(); }, 500);
    }
  }, [data, t]);

  const kpiCards = useMemo(() => [
    {
      title: t('stock:rapport_ug.stats.history_ug'),
      value: data?.global_total_ug ?? 0,
      icon: PackageOpen,
      color: 'text-base-content',
      bg: 'bg-base-200',
    },
    {
      title: t('stock:rapport_ug.stats.current_stock_ug'),
      value: data?.global_total_ug_restantes ?? 0,
      icon: PackageOpen,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
    },
    {
      title: t('stock:rapport_ug.stats.estimated_value'),
      value: formatCurrency(data?.global_total_valeur ?? 0),
      icon: Banknote,
      color: 'text-base-content',
      bg: 'bg-base-200',
      isCurrency: true,
    },
    {
      title: t('stock:rapport_ug.stats.latent_cash'),
      value: formatCurrency(data?.global_total_valeur_restante ?? 0),
      icon: Banknote,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
      isCurrency: true,
    },
  ], [data, t]);

  const handleClearDates = useCallback(() => {
    setDateDebut('');
    setDateFin('');
  }, []);

  return (
    <div className="h-full flex flex-col bg-base-200 p-3 sm:p-4 lg:p-6">
      <Toaster position="top-right" />

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 sm:gap-6">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <PackageOpen className="size-7" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-base-content">
                {t('stock:rapport_ug.title_part1')} <span className="text-indigo-500 italic">{t('stock:rapport_ug.title_part2')}</span>
              </h1>
              <p className="text-sm font-semibold text-base-content/60 uppercase tracking-widest mt-1">
                {t('stock:rapport_ug.subtitle')}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Printer className="size-4" />}
              onClick={handlePrint}
              disabled={loading || !data?.fournisseurs.length}
            >
              {t('stock:rapport_ug.print')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Download className="size-4" />}
              onClick={exportCSV}
              disabled={loading || !data?.fournisseurs.length}
            >
              {t('stock:rapport_ug.export')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />}
              onClick={fetchData}
              disabled={loading}
            >
              {t('stock:rapport_ug.refresh')}
            </Button>
          </div>
        </div>

        {/* Global KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {kpiCards.map((kpi) => (
            <Card key={kpi.title} variant="default" className="flex items-center gap-4">
              <div className={`size-12 rounded-xl ${kpi.bg} ${kpi.color} flex items-center justify-center shrink-0`}>
                <kpi.icon className="size-6" />
              </div>
              <div>
                <p className="text-[10px] font-black text-base-content/40 tracking-wider uppercase">{kpi.title}</p>
                <p className={`text-2xl font-black tracking-tight ${kpi.color}`}>
                  {loading ? '…' : (kpi.isCurrency ? kpi.value : formatNumber(kpi.value as number))}
                </p>
              </div>
            </Card>
          ))}
        </div>

        {/* List Card */}
        <Card variant="default" className="overflow-hidden flex flex-col">
          {/* Toolbar */}
          <div className="px-6 py-4 border-b border-base-200 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-base-200/50">
            <h2 className="text-lg font-bold text-base-content flex items-center gap-2">
              {t('stock:rapport_ug.filters.supplier_split')}
              {data && <Badge variant="primary" size="sm">{filteredSuppliers.length}</Badge>}
            </h2>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
              <div className="relative flex-1 sm:flex-initial sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-base-content/40" />
                <Input
                  type="text"
                  placeholder={t('stock:rapport_ug.filters.search')}
                  className="pl-9 w-full"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content"
                    aria-label={t('common:close')}
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 bg-base-100 px-3 py-1.5 rounded-xl border border-base-200 focus-within:ring-2 focus-within:ring-indigo-100 focus-within:border-indigo-300 transition-all shadow-sm">
                <Calendar className="size-4 text-base-content/40" />
                <Input
                  type="date"
                  lang={getLocale()}
                  className="bg-transparent border-none outline-none text-sm text-base-content/90 w-full shadow-none focus-visible:ring-0 h-6 px-0"
                  value={dateDebut}
                  onChange={e => setDateDebut(e.target.value)}
                />
              </div>
              <span className="text-base-content/40 font-medium whitespace-nowrap">{t('stock:rapport_ug.filters.to')}</span>
              <div className="flex items-center gap-2 bg-base-100 px-3 py-1.5 rounded-xl border border-base-200 focus-within:ring-2 focus-within:ring-indigo-100 focus-within:border-indigo-300 transition-all shadow-sm">
                <Calendar className="size-4 text-base-content/40" />
                <Input
                  type="date"
                  lang={getLocale()}
                  className="bg-transparent border-none outline-none text-sm text-base-content/90 w-full shadow-none focus-visible:ring-0 h-6 px-0"
                  value={dateFin}
                  onChange={e => setDateFin(e.target.value)}
                />
              </div>

              {(dateDebut || dateFin) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full size-8 p-0"
                  onClick={handleClearDates}
                  title={t('stock:rapport_ug.filters.clear_dates')}
                >
                  <RefreshCw className="size-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto w-full">
            {loading ? (
              <div className="p-6 space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-base-200/50">
                    <TableHead>{t('stock:rapport_ug.table.supplier')}</TableHead>
                    <TableHead className="text-right">{t('stock:rapport_ug.table.lots_count')}</TableHead>
                    <TableHead className="text-right">{t('stock:rapport_ug.table.received_ug')}</TableHead>
                    <TableHead className="text-right text-emerald-600">{t('stock:rapport_ug.table.remaining_stock')}</TableHead>
                    <TableHead className="text-right text-blue-600">{t('stock:rapport_ug.table.remaining_value')}</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSuppliers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-12 text-center text-base-content/40">
                        <PackageOpen className="size-12 mx-auto mb-3 text-base-content/20" />
                        <p className="font-medium text-base-content/60">{t('stock:rapport_ug.table.empty')}</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSuppliers.map((stat) => (
                      <TableRow key={stat.fournisseur_id} className="hover:bg-base-200/50">
                        <TableCell>
                          <span className="font-semibold text-base-content/90">{stat.fournisseur_nom}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="ghost" size="sm">{t('stock:rapport_ug.table.lots_badge', { count: stat.lots_count })}</Badge>
                        </TableCell>
                        <TableCell className="text-right text-base-content/40">
                          {formatNumber(stat.total_ug)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-bold text-emerald-600">
                            {formatNumber(stat.total_ug_restantes)} {t('stock:rapport_ug.table.ug_suffix')}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-black text-base-content">
                          {formatCurrency(stat.total_valeur_restante)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="size-8 p-0"
                            onClick={() => setSelectedSupplier(stat)}
                            title={t('common:details')}
                          >
                            <Eye className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </Card>
      </div>

      {/* Supplier Details Dialog */}
      <Dialog open={!!selectedSupplier} onOpenChange={() => setSelectedSupplier(null)}>
        <DialogContent className="max-w-full sm:max-w-4xl lg:max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedSupplier?.fournisseur_nom}
            </DialogTitle>
            <DialogDescription>
              {selectedSupplier && t('stock:rapport_ug.dialog.details_description', { count: selectedSupplier.lots_count })}
            </DialogDescription>
          </DialogHeader>

          {selectedSupplier && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card variant="default" className="p-3">
                  <p className="text-[10px] font-black text-base-content/40 uppercase">{t('stock:rapport_ug.table.received_ug')}</p>
                  <p className="text-xl font-black text-base-content">{formatNumber(selectedSupplier.total_ug)}</p>
                </Card>
                <Card variant="default" className="p-3">
                  <p className="text-[10px] font-black text-base-content/40 uppercase">{t('stock:rapport_ug.table.remaining_stock')}</p>
                  <p className="text-xl font-black text-emerald-600">{formatNumber(selectedSupplier.total_ug_restantes)}</p>
                </Card>
                <Card variant="default" className="p-3">
                  <p className="text-[10px] font-black text-base-content/40 uppercase">{t('stock:rapport_ug.stats.estimated_value')}</p>
                  <p className="text-xl font-black text-base-content">{formatCurrency(selectedSupplier.total_valeur)}</p>
                </Card>
                <Card variant="default" className="p-3">
                  <p className="text-[10px] font-black text-base-content/40 uppercase">{t('stock:rapport_ug.table.remaining_value')}</p>
                  <p className="text-xl font-black text-blue-600">{formatCurrency(selectedSupplier.total_valeur_restante)}</p>
                </Card>
              </div>

              <div className="overflow-x-auto rounded-xl border border-base-200">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-base-200/50">
                      <TableHead>{t('stock:rapport_ug.table.details.product')}</TableHead>
                      <TableHead>{t('stock:rapport_ug.table.details.lot')}</TableHead>
                      <TableHead>{t('stock:rapport_ug.table.details.date')}</TableHead>
                      <TableHead>{t('stock:rapport_ug.table.details.order')}</TableHead>
                      <TableHead>{t('stock:rapport_ug.table.details.invoice')}</TableHead>
                      <TableHead className="text-right">{t('stock:rapport_ug.table.details.price')}</TableHead>
                      <TableHead className="text-right">{t('stock:rapport_ug.table.details.received')}</TableHead>
                      <TableHead className="text-right text-emerald-600">{t('stock:rapport_ug.table.details.remaining')}</TableHead>
                      <TableHead className="text-right text-blue-600">{t('stock:rapport_ug.table.details.val_rest')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedSupplier.details.map(detail => (
                      <TableRow key={detail.lot_id} className={detail.quantity_free_remaining === 0 ? 'opacity-50' : ''}>
                        <TableCell className="font-medium text-base-content/90 whitespace-nowrap">{detail.produit_nom}</TableCell>
                        <TableCell className="text-base-content/60 font-mono text-xs">{detail.lot_numero}</TableCell>
                        <TableCell className="text-base-content/80 whitespace-nowrap">
                          {detail.date_reception ? format(new Date(detail.date_reception), 'dd/MM/yyyy HH:mm') : t('common:not_available')}
                        </TableCell>
                        <TableCell className="text-base-content/60 font-mono text-xs">{detail.commande_numero}</TableCell>
                        <TableCell className="text-base-content/60 font-mono text-xs whitespace-nowrap">{detail.facture_numero}</TableCell>
                        <TableCell className="text-right text-base-content/80">{formatCurrency(detail.prix_vente)}</TableCell>
                        <TableCell className="text-right text-base-content/40">{formatNumber(detail.quantity_free)}</TableCell>
                        <TableCell className="text-right font-bold text-emerald-600">{formatNumber(detail.quantity_free_remaining)}</TableCell>
                        <TableCell className="text-right font-bold text-blue-600">{formatCurrency(detail.valeur_restante)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{t('common:close')}</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
