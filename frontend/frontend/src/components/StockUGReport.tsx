import React, { useState, useEffect } from 'react';
import { PackageOpen, Calendar, Download, RefreshCw, Banknote, Printer } from 'lucide-react';
import api from '../services/api';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import toast, { Toaster } from 'react-hot-toast';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { getLocale } from '../utils/dateUtils';

interface UGDetail {
  lot_id: number;
  lot_numero: string;
  produit_nom: string;
  date_reception: string | null;
  commande_numero: string;
  facture_numero: string;
  quantity_free: number;
  quantity_free_remaining: number;
  valeur_estimee: number;
  valeur_restante: number;
  prix_vente: number;
}

interface FournisseurUGStat {
  fournisseur_id: number;
  fournisseur_nom: string;
  total_ug: number;
  total_ug_restantes: number;
  total_valeur: number;
  total_valeur_restante: number;
  lots_count: number;
  details: UGDetail[];
}

interface UGReportData {
  global_total_ug: number;
  global_total_ug_restantes: number;
  global_total_valeur: number;
  global_total_valeur_restante: number;
  fournisseurs: FournisseurUGStat[];
}

export default function StockUGReport() {
  const { t } = useTranslation(['stock', 'common']);
  const [data, setData] = useState<UGReportData | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Date filers
  const [dateDebut, setDateDebut] = useState<string>('');
  const [dateFin, setDateFin] = useState<string>('');
  
  const [expandedSupplierIds, setExpandedSupplierIds] = useState<Set<number>>(new Set());

  const toggleRow = (id: number) => {
    const newSet = new Set(expandedSupplierIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedSupplierIds(newSet);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (dateDebut) params.append('date_debut', dateDebut);
      if (dateFin) params.append('date_fin', dateFin);
      
      const response = await api.get(`stock-lots/rapport_ug/?${params.toString()}`);
      
      setData(response.data);
    } catch (error) {
      console.error('Error fetching UG report:', error);
      toast.error(t('common:messages.error_loading'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dateDebut, dateFin]); // eslint-disable-line react-hooks/exhaustive-deps

  const exportCSV = () => {
    if (!data?.fournisseurs.length) return;
    
    const headers = [
      t('stock:rapport_ug.table.supplier'),
      t('stock:rapport_ug.table.lots_count'),
      t('stock:rapport_ug.table.received_ug'),
      t('stock:rapport_ug.table.remaining_value')
    ];
    const rows = data.fournisseurs.map(f => [
      f.fournisseur_nom,
      f.lots_count,
      f.total_ug,
      f.total_valeur
    ]);
    
    // Add total row
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
  };

  const handlePrint = () => {
     if (!data) return;
     const win = window.open('', '', 'height=600,width=800');
     if (win) {
        win.document.write(`
          <html>
            <head>
              <title>${t('stock:rapport_ug.print_template.title')} - ${format(new Date(), 'dd/MM/yyyy')}</title>
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
                      <td colspan="2">${f.fournisseur_nom} (${f.lots_count} lots)</td>
                      <td style="text-align: right;">${formatNumber(f.total_ug)}</td>
                      <td style="text-align: right;">${formatNumber(f.total_ug_restantes)}</td>
                      <td style="text-align: right;">${formatCurrency(f.total_valeur_restante)}</td>
                    </tr>
                    ${f.details.map(d => `
                      <tr>
                        <td style="padding-left: 25px;">${d.produit_nom}</td>
                        <td style="color: #64748b; font-size: 9px; white-space: nowrap;">Lot: ${d.lot_numero}<br/>Fact: ${d.facture_numero}</td>
                        <td style="text-align: right;">${formatNumber(d.quantity_free)}</td>
                        <td style="text-align: right; font-weight: bold; color: #10b981;">${formatNumber(d.quantity_free_remaining)}</td>
                        <td style="text-align: right; font-weight: bold; color: #1e293b;">${formatCurrency(d.valeur_restante)}</td>
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
        win.document.close();
        win.onload = () => win.print();
        setTimeout(() => { if(win) win.print(); }, 500);
     }
  };

  return (
    <div className="min-h-screen bg-base-200 p-3 sm:p-4 lg:p-8">
      <Toaster position="top-right" />
      
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 sm:gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="size-12 rounded-2xl bg-indigo-500/100 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
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
          </div>
          
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 w-full md:w-auto">
            <button 
              onClick={handlePrint}
              className="btn bg-base-100 hover:bg-base-200/50 border-base-200 text-base-content/90 shadow-sm w-full"
              disabled={loading || !data?.fournisseurs.length}
            >
              <Printer className="size-4" />
              {t('stock:rapport_ug.print')}
            </button>
            <button 
              onClick={exportCSV}
              className="btn bg-base-100 hover:bg-base-200/50 border-base-200 text-base-content/90 shadow-sm w-full"
              disabled={loading || !data?.fournisseurs.length}
            >
              <Download className="size-4" />
              {t('stock:rapport_ug.export')}
            </button>
            <button 
              onClick={fetchData}
              className="btn btn-primary shadow-sm w-full col-span-2 sm:col-span-1 sm:w-auto"
              disabled={loading}
            >
              <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
              {t('stock:rapport_ug.refresh')}
            </button>
          </div>
        </div>

        {/* Global KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-base-100 rounded-xl p-6 shadow-sm border border-base-200 flex flex-col justify-center">
            <div className="flex items-center gap-4 mb-2">
              <div className="size-12 rounded-xl bg-base-200 text-base-content/60 flex items-center justify-center">
                 <PackageOpen className="size-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-base-content/40 tracking-wider uppercase">{t('stock:rapport_ug.stats.history_ug')}</p>
                <p className="text-2xl font-black text-base-content tracking-tight">
                  {loading ? '…' : formatNumber(data?.global_total_ug ?? 0)}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-base-100 rounded-xl p-6 shadow-sm border border-base-200 flex flex-col justify-center">
            <div className="flex items-center gap-4 mb-2">
              <div className="size-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                 <PackageOpen className="size-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-base-content/40 tracking-wider uppercase">{t('stock:rapport_ug.stats.current_stock_ug')}</p>
                <p className="text-2xl font-black text-emerald-500 tracking-tight">
                  {loading ? '…' : formatNumber(data?.global_total_ug_restantes ?? 0)}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-base-100 rounded-xl p-6 shadow-sm border border-base-200 flex flex-col justify-center">
            <div className="flex items-center gap-4 mb-2">
              <div className="size-12 rounded-xl bg-base-200 text-base-content/60 flex items-center justify-center">
                 <Banknote className="size-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-base-content/40 tracking-wider uppercase">{t('stock:rapport_ug.stats.estimated_value')}</p>
                <p className="text-2xl font-black text-base-content/80 tracking-tight">
                  {loading ? '…' : `${formatCurrency(data?.global_total_valeur ?? 0)}`}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-base-100 rounded-xl p-6 shadow-sm border border-base-200 flex flex-col justify-center ring-1 ring-blue-500/10">
            <div className="flex items-center gap-4 mb-2">
              <div className="size-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                 <Banknote className="size-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-blue-400 tracking-wider uppercase">{t('stock:rapport_ug.stats.latent_cash')}</p>
                <p className="text-2xl font-black text-base-content tracking-tight">
                  {loading ? '…' : `${formatCurrency(data?.global_total_valeur_restante ?? 0)}`}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* List Card */}
        <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 overflow-hidden flex flex-col">
          {/* Toolbar */}
          <div className="px-6 py-4 border-b border-base-200 flex flex-col sm:flex-row justify-between items-center gap-4 bg-base-200/50">
            <h2 className="text-lg font-bold text-base-content flex items-center gap-2">
              {t('stock:rapport_ug.filters.supplier_split')}
              {data && <span className="badge badge-primary badge-sm ml-2">{data.fournisseurs.length}</span>}
            </h2>
            
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="flex items-center gap-2 bg-base-100 px-3 py-1.5 rounded-xl border border-base-200 focus-within:ring-2 focus-within:ring-indigo-100 focus-within:border-indigo-300 transition-all shadow-sm w-full sm:w-auto">
                <Calendar className="size-4 text-base-content/40" />
                <input 
                  type="date"
                  lang={getLocale()}
                  className="bg-transparent border-none outline-none text-sm text-base-content/90 w-full"
                  value={dateDebut}
                  onChange={e => setDateDebut(e.target.value)}
                  placeholder={t('stock:rapport_ug.filters.date_from')}
                />
              </div>
              <span className="text-base-content/40 font-medium whitespace-nowrap">{t('stock:rapport_ug.filters.to')}</span>
              <div className="flex items-center gap-2 bg-base-100 px-3 py-1.5 rounded-xl border border-base-200 focus-within:ring-2 focus-within:ring-indigo-100 focus-within:border-indigo-300 transition-all shadow-sm w-full sm:w-auto">
                <Calendar className="size-4 text-base-content/40" />
                <input 
                  type="date"
                  lang={getLocale()}
                  className="bg-transparent border-none outline-none text-sm text-base-content/90 w-full"
                  value={dateFin}
                  onChange={e => setDateFin(e.target.value)}
                  placeholder={t('stock:rapport_ug.filters.date_to')}
                />
              </div>
              
              {(dateDebut || dateFin) && (
                <button 
                  className="btn btn-ghost btn-sm btn-circle text-base-content/40 hover:text-red-500"
                  onClick={() => { setDateDebut(''); setDateFin(''); }}
                  title={t('stock:rapport_ug.filters.clear_dates')}
                >
                  <RefreshCw className="size-4" />
                </button>
              )}
            </div>
          </div>
          
          {/* Table */}
          <div className="overflow-x-auto w-full">
            <table className="table table-zebra w-full whitespace-nowrap">
              <thead className="bg-base-200/50 sticky top-0 opacity-100 z-10 text-base-content/60 text-xs uppercase font-extrabold tracking-wider border-b border-base-200">
                <tr>
                  <th className="px-6 py-4">{t('stock:rapport_ug.table.supplier')}</th>
                  <th className="px-6 py-4 text-right">{t('stock:rapport_ug.table.lots_count')}</th>
                  <th className="px-6 py-4 text-right">{t('stock:rapport_ug.table.received_ug')}</th>
                  <th className="px-6 py-4 text-right text-emerald-500 bg-emerald-500/10">{t('stock:rapport_ug.table.remaining_stock')}</th>
                  <th className="px-6 py-4 text-right text-blue-500 bg-blue-500/10">{t('stock:rapport_ug.table.remaining_value')}</th>
                </tr>
              </thead>
              <tbody className="text-sm font-medium text-base-content/80">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-6 py-4"><div className="h-4 bg-base-300 rounded w-48"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-base-300 rounded w-16 ml-auto"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-base-300 rounded w-20 ml-auto"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-base-300 rounded w-24 ml-auto"></div></td>
                    </tr>
                  ))
                ) : data?.fournisseurs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-base-content/40">
                      <PackageOpen className="size-12 mx-auto mb-3 text-base-content/20" />
                      <p className="font-medium text-base-content/60">{t('stock:rapport_ug.table.empty')}</p>
                    </td>
                  </tr>
                ) : (
                  data?.fournisseurs.map((stat, idx) => (
                    <React.Fragment key={stat.fournisseur_id || idx}>
                    <tr 
                      className={`hover hover:bg-base-200/50 transition-colors cursor-pointer ${expandedSupplierIds.has(stat.fournisseur_id) ? 'bg-indigo-500/100/5' : ''}`}
                      onClick={() => toggleRow(stat.fournisseur_id)}
                    >
                      <td className="px-6 py-3 font-semibold text-base-content/90 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 text-base-content/40 transition-transform ${expandedSupplierIds.has(stat.fournisseur_id) ? 'rotate-90' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                        {stat.fournisseur_nom}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <span className="badge badge-sm badge-ghost font-bold text-base-content/60">
                          {stat.lots_count} lots
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <span className="font-medium text-base-content/40">
                          {formatNumber(stat.total_ug)}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right bg-emerald-500/100/5">
                        <span className="font-bold text-emerald-500 px-3 py-1 rounded-lg">
                          {formatNumber(stat.total_ug_restantes)} UG
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right font-black text-base-content bg-blue-500/100/5">
                        {formatCurrency(stat.total_valeur_restante)}
                      </td>
                    </tr>
                    {expandedSupplierIds.has(stat.fournisseur_id) && (
                      <tr>
                        <td colSpan={5} className="px-0 py-0 bg-base-200/50 border-b border-base-200">
                           <div className="px-10 py-4">
                             <div className="overflow-x-auto">
                               <table className="table table-sm w-full bg-base-100 rounded-xl shadow-sm border border-base-200">
                                 <thead className="bg-base-200 text-base-content/60">
                                   <tr>
                                     <th>{t('stock:rapport_ug.table.details.product')}</th>
                                     <th>{t('stock:rapport_ug.table.details.lot')}</th>
                                     <th>{t('stock:rapport_ug.table.details.date')}</th>
                                     <th>{t('stock:rapport_ug.table.details.order')}</th>
                                     <th>{t('stock:rapport_ug.table.details.invoice')}</th>
                                     <th className="text-right">{t('stock:rapport_ug.table.details.price')}</th>
                                     <th className="text-right">{t('stock:rapport_ug.table.details.received')}</th>
                                     <th className="text-right text-emerald-500">{t('stock:rapport_ug.table.details.remaining')}</th>
                                     <th className="text-right text-blue-500">{t('stock:rapport_ug.table.details.val_rest')}</th>
                                   </tr>
                                 </thead>
                                 <tbody>
                                   {stat.details.map(detail => (
                                     <tr key={detail.lot_id} className={detail.quantity_free_remaining === 0 ? 'text-base-content/50' : ''}>
                                       <td className="font-medium text-base-content/90">{detail.produit_nom}</td>
                                       <td className="text-base-content/60 font-mono text-xs">{detail.lot_numero}</td>
                                       <td className="text-base-content/80">
                                          {detail.date_reception ? format(new Date(detail.date_reception), 'dd/MM/yyyy HH:mm') : 'N/A'}
                                       </td>
                                       <td className="text-base-content/60 font-mono text-xs">{detail.commande_numero}</td>
                                       <td className="text-base-content/60 font-mono text-xs whitespace-nowrap">{detail.facture_numero}</td>
                                       <td className="text-right text-base-content/80">{formatCurrency(detail.prix_vente)}</td>
                                       <td className="text-right text-base-content/40">{formatNumber(detail.quantity_free)}</td>
                                       <td className="text-right font-bold text-emerald-500">{formatNumber(detail.quantity_free_remaining)}</td>
                                       <td className="text-right font-bold text-blue-500">{formatCurrency(detail.valeur_restante)}</td>
                                     </tr>
                                   ))}
                                 </tbody>
                               </table>
                             </div>
                           </div>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
