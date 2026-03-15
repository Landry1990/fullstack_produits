import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import type { ProduitModel } from '../../types';
import { useRayons } from '../../hooks/useProduits';
import PremiumModal from '../common/PremiumModal';
import SudoValidationModal from '../common/SudoValidationModal';
import { useAuth } from '../../context/AuthContext';

export default function ReapproRayon() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [products, setProducts] = useState<ProduitModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [transferringIds, setTransferringIds] = useState<number[]>([]);
  const [showConfirmAll, setShowConfirmAll] = useState(false);
  const [toProcessAll, setToProcessAll] = useState<ProduitModel[]>([]);
  
  // Sudo Mode States
  const [sudoModalOpen, setSudoModalOpen] = useState(false);
  const [sudoSaving, setSudoSaving] = useState(false);
  const [pendingTransfer, setPendingTransfer] = useState<{ 
    type: 'single' | 'all', 
    produit?: ProduitModel 
  } | null>(null);
  
  // Filtres
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRayon, setSelectedRayon] = useState<string>('');
  
  // Pagination
  const [page, setPage] = useState(1);
  const itemsPerPage = 15;

  const { data: rayons = [] } = useRayons();

  const fetchNeedsRefill = async () => {
    setLoading(true);
    try {
      // On charge tous les produits qui ont la gestion de réserve activée
      const response = await axios.get('/api/produits/?has_reserve_storage=true&page_size=1000');
      const data = response.data;
      setProducts(Array.isArray(data) ? data : (data.results || []));
    } catch (error) {
      console.error('Error fetching refill needs:', error);
      toast.error(t('stock.reappro.messages.error_loading_products'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNeedsRefill();
  }, []);

  // Filtrage local
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.cip1?.includes(searchQuery);
      const matchRayon = selectedRayon === '' || String(p.rayon) === selectedRayon;
      return matchSearch && matchRayon;
    });
  }, [products, searchQuery, selectedRayon]);

  // Stats - On ne compte en "Alerte" que ceux qui sont <= min_rayon
  const stats = useMemo(() => {
    const criticalProducts = filteredProducts.filter(p => (p.stock ?? 0) <= (p.min_rayon ?? 0));
    const totalItems = criticalProducts.length;
    const totalToTransfer = criticalProducts.reduce((acc, p) => {
        const needed = Math.max(0, (p.capacite_rayon ?? 0) - (p.stock ?? 0));
        return acc + Math.min(needed, p.stock_reserve ?? 0);
    }, 0);
    return { totalItems, totalToTransfer, totalDisplayed: filteredProducts.length };
  }, [filteredProducts]);

  // Pagination locale
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = filteredProducts.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const handleTransfer = async (produit: ProduitModel) => {
    const needed = Math.max(0, (produit.capacite_rayon ?? 0) - (produit.stock ?? 0));
    const suggest = Math.min(needed, produit.stock_reserve ?? 0);
    
    if (suggest <= 0) {
      toast.error(t('stock.reappro.messages.no_refill_needed'));
      return;
    }

    const hasPermission = user?.is_superuser || user?.can_adjust_stock || user?.profile?.can_adjust_stock;
    
    if (!hasPermission) {
      setPendingTransfer({ type: 'single', produit });
      setSudoModalOpen(true);
      return;
    }

    executeTransfer(produit, suggest);
  };

  const executeTransfer = async (produit: ProduitModel, quantity: number, sudoCreds?: { validatorId: number, password: string }) => {
    setTransferringIds(prev => [...prev, produit.id]);
    try {
      const payload: any = { quantity };
      if (sudoCreds) {
        payload.validated_by_id = sudoCreds.validatorId;
        payload.sudo_password = sudoCreds.password;
      }

      toast.success(t('stock.reappro.messages.transfer_success', { count: quantity, name: produit.name }));
      fetchNeedsRefill();
    } catch (error: any) {
      console.error('Transfer error:', error);
      toast.error(error.response?.data?.detail || t('common.transfer_error', { defaultValue: 'Erreur lors du transfert' }));
    } finally {
      setTransferringIds(prev => prev.filter(id => id !== produit.id));
    }
  };

  const handleTransferAll = async () => {
     // On transfère pour tout ce qui a une suggestion > 0
     const toProcess = filteredProducts.filter(p => {
        const needed = Math.max(0, (p.capacite_rayon ?? 0) - (p.stock ?? 0));
        return Math.min(needed, p.stock_reserve ?? 0) > 0;
     });

     if (toProcess.length === 0) {
        toast(t('stock.reappro.messages.no_products_to_refill'), { icon: 'ℹ️' });
        return;
     }

     setToProcessAll(toProcess);
     setShowConfirmAll(true);
  };

  const handleExecuteAllTransfer = async () => {
     setShowConfirmAll(false);
     if (toProcessAll.length === 0) return;

     const hasPermission = user?.is_superuser || user?.can_adjust_stock || user?.profile?.can_adjust_stock;
     
     if (!hasPermission) {
        setPendingTransfer({ type: 'all' });
        setSudoModalOpen(true);
        return;
     }

     executeAllTransfer();
  };

  const executeAllTransfer = async (sudoCreds?: { validatorId: number, password: string }) => {
     setLoading(true);
     let success = 0;
     for (const p of toProcessAll) {
        const needed = Math.max(0, (p.capacite_rayon ?? 0) - (p.stock ?? 0));
        const suggest = Math.min(needed, p.stock_reserve ?? 0);
        try {
            const payload: any = { quantity: suggest };
            if (sudoCreds) {
              payload.validated_by_id = sudoCreds.validatorId;
              payload.sudo_password = sudoCreds.password;
            }
            await axios.post(`/api/produits/${p.id}/transfer_to_shelf/`, payload);
            success++;
        } catch (e) {
            console.error(`Failed to transfer ${p.name}`, e);
        }
     }
     toast.success(t('stock.reappro.messages.bulk_success', { success, total: toProcessAll.length }));
     fetchNeedsRefill();
     setToProcessAll([]);
  };

  const handleSudoValidate = async (validatorId: number, password: string) => {
    setSudoSaving(true);
    try {
      if (pendingTransfer?.type === 'all') {
        await executeAllTransfer({ validatorId, password });
      } else if (pendingTransfer?.type === 'single' && pendingTransfer.produit) {
        const p = pendingTransfer.produit;
        const needed = Math.max(0, (p.capacite_rayon ?? 0) - (p.stock ?? 0));
        const suggest = Math.min(needed, p.stock_reserve ?? 0);
        await executeTransfer(p, suggest, { validatorId, password });
      }
      setSudoModalOpen(false);
      setPendingTransfer(null);
    } catch (err) {
      // Toast already handled in execute functions
    } finally {
      setSudoSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-base-200 p-6 space-y-6 font-sans">
      
      {/* Header & Filters Section */}
      <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 overflow-hidden">
        <div className="p-6 border-b border-base-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-base-content tracking-tight flex items-center gap-2">
              <span className="text-primary">📦</span> {t('stock.reappro.title')}
            </h1>
            <p className="text-base-content/60 text-sm mt-1">
              {t('stock.reappro.subtitle')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={fetchNeedsRefill} 
              className="btn btn-ghost btn-sm gap-2 no-print"
              disabled={loading}
            >
              <span className={loading ? 'animate-spin' : ''}>🔄</span> {t('common.refresh')}
            </button>
            <button 
              onClick={() => window.print()} 
              className="btn btn-outline btn-sm gap-2 no-print"
              disabled={loading || filteredProducts.length === 0}
            >
              🖨️ {t('common.print')}
            </button>
            <button 
              onClick={handleTransferAll} 
              className="btn btn-primary btn-sm gap-2 no-print"
              disabled={loading || stats.totalItems === 0}
            >
              🚚 {t('stock.reappro.transfer_all')}
            </button>
          </div>
        </div>

        <style>
          {`
            @media print {
              .no-print { display: none !important; }
              .print-only { display: block !important; }
              body { background: white !important; font-size: 12pt; }
              .card, .bg-base-100 { border: none !important; shadow: none !important; }
              table { width: 100%; border-collapse: collapse; }
              th, td { border: 1px solid #ddd !important; padding: 8px !important; text-align: left !important; }
              .bg-base-200\\/50 { background-color: #f3f4f6 !important; -webkit-print-color-adjust: exact; }
              @page { margin: 1cm; }
            }
            .print-only { display: none; }
          `}
        </style>

        {/* Filters Bar */}
        <div className="p-4 bg-base-200/30 grid grid-cols-1 md:grid-cols-3 gap-4 no-print">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50">🔍</span>
            <input 
              type="text" 
              placeholder={t('common.search_product_placeholder')} 
              className="input input-sm input-bordered w-full pl-10 bg-base-100"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            />
          </div>
          <select 
            className="select select-sm select-bordered w-full bg-base-100"
            value={selectedRayon}
            onChange={(e) => { setSelectedRayon(e.target.value); setPage(1); }}
          >
            <option value="">{t('common.all_rayons')}</option>
            {rayons.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          <div className="flex items-center justify-end text-sm text-base-content/60 px-2 font-medium">
            {t('stock.reappro.stats.displayed_products', { count: stats.totalDisplayed })}
          </div>
        </div>
      </div>

      {/* Print Only Header */}
      <div className="print-only mb-8">
        <h1 className="text-3xl font-bold border-b-2 border-primary pb-2">{t('stock.reappro.print_title')}</h1>
        <p className="mt-2 text-gray-600">Date: {new Date().toLocaleString(i18n.language === 'fr' ? 'fr-FR' : 'en-US')}</p>
        <p className="text-sm italic">{t('stock.reappro.print_hint')}</p>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 no-print">
        <div className="bg-base-100 p-4 rounded-xl shadow-sm border border-base-300 flex items-center gap-4">
          <div className={`w-12 h-12 rounded-lg ${stats.totalItems > 0 ? 'bg-error/10 text-error' : 'bg-success/10 text-success'} flex items-center justify-center text-xl font-bold`}>
            {stats.totalItems > 0 ? '⚠️' : '✅'}
          </div>
          <div>
            <p className="text-xs uppercase font-bold opacity-50">{t('stock.reappro.stats.urgencies')}</p>
            <p className="text-2xl font-black">{stats.totalItems}</p>
          </div>
        </div>
        <div className="bg-base-100 p-4 rounded-xl shadow-sm border border-base-300 flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xl font-bold">🚚</div>
          <div>
            <p className="text-xs uppercase font-bold opacity-50">{t('stock.reappro.stats.suggested_volume')}</p>
            <p className="text-2xl font-black">{stats.totalToTransfer} <span className="text-xs font-normal opacity-70">{t('stock.reappro.stats.units')}</span></p>
          </div>
        </div>
      </div>

      {/* Main Table Section */}
      <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table table-zebra w-full text-base-content">
            <thead className="bg-base-200/50">
              <tr>
                <th className="text-xs uppercase opacity-70">{t('stock.reappro.table.product')}</th>
                <th className="text-xs uppercase opacity-70">{t('stock.reappro.table.level')}</th>
                <th className="text-xs uppercase opacity-70 text-center hidden xl:table-cell">{t('stock.reappro.table.min')}</th>
                <th className="text-xs uppercase opacity-70 text-center hidden xl:table-cell">{t('stock.reappro.table.capacity')}</th>
                <th className="text-xs uppercase opacity-70 text-center">{t('stock.reappro.table.on_shelf')}</th>
                <th className="text-xs uppercase opacity-70 text-center">{t('stock.reappro.table.in_reserve')}</th>
                <th className="text-xs uppercase opacity-70 text-center text-primary">{t('stock.reappro.table.suggestion')}</th>
                <th className="text-xs uppercase opacity-70 text-right no-print">{t('stock.reappro.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                   <td colSpan={8} className="py-20 text-center">
                      <span className="loading loading-spinner loading-lg text-primary"></span>
                      <p className="mt-4 text-base-content/60 italic font-medium">{t('stock.reappro.messages.loading_stocks')}</p>
                   </td>
                </tr>
              ) : paginatedProducts.length === 0 ? (
                <tr>
                   <td colSpan={8} className="py-20 text-center">
                      <div className="text-5xl mb-4">🔍</div>
                      <h3 className="text-xl font-bold text-base-content">{t('common.no_product_found')}</h3>
                      <p className="text-base-content/60 mt-2">{t('stock.reappro.messages.no_reserve_products')}</p>
                   </td>
                </tr>
              ) : (
                paginatedProducts.map(p => {
                  const needed = Math.max(0, (p.capacite_rayon ?? 0) - (p.stock ?? 0));
                  const suggest = Math.min(needed, p.stock_reserve ?? 0);
                  const isTransferring = transferringIds.includes(p.id);
                  const isLow = (p.stock ?? 0) <= (p.min_rayon ?? 0);
                  
                  // Calcul pourcentage pour la jauge
                  const percent = Math.min(100, Math.max(0, ((p.stock ?? 0) / (p.capacite_rayon || 1)) * 100));

                  return (
                    <tr key={p.id} className="hover:bg-base-200/30 transition-colors">
                      <td className="max-w-xs">
                        <div className="font-bold text-sm uppercase truncate" title={p.name}>{p.name}</div>
                        <div className="text-[10px] opacity-60 font-mono">
                          {p.rayon_name || 'Sans Rayon'}
                        </div>
                      </td>
                      <td className="w-40 md:w-56 xl:w-64">
                        <div className="flex flex-col gap-1">
                          <div className="flex justify-between items-center px-1">
                             <span className={`text-[10px] font-bold ${isLow ? 'text-error' : 'text-success'}`}>
                                 {isLow ? t('stock.reappro.table.need_refill') : t('stock.reappro.table.stabilized')}
                             </span>
                             <span className="text-[10px] opacity-60 font-mono">{Math.round(percent)}%</span>
                          </div>
                          {/* Jauge de niveau colorée */}
                          <div className="h-3 w-full bg-base-300 rounded-full overflow-hidden border border-base-300 flex shadow-inner">
                            <div 
                                className={`h-full transition-all duration-1000 ${isLow ? 'bg-error shadow-[0_0_10px_rgba(255,0,0,0.5)]' : 'bg-success'}`}
                                style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="text-center font-mono text-sm opacity-70 hidden xl:table-cell">
                         {p.min_rayon ?? 0}
                      </td>
                      <td className="text-center font-mono text-sm opacity-70 hidden xl:table-cell">
                         {p.capacite_rayon ?? 0}
                      </td>
                      <td className="text-center font-mono text-sm font-bold">
                         {p.stock}
                      </td>
                      <td className="text-center">
                        <div className="badge badge-ghost font-bold py-3">{p.stock_reserve}</div>
                      </td>
                      <td className="text-center">
                        {suggest > 0 ? (
                            <div className="flex flex-col">
                                <span className="font-black text-primary text-lg">+{suggest}</span>
                                 <span className="text-[10px] text-primary/60 font-bold uppercase">{t('stock.reappro.table.suggested')}</span>
                             </div>
                         ) : (
                             <span className="text-xs opacity-30 italic">{t('stock.reappro.table.complete')}</span>
                         )}
                      </td>
                      <td className="text-right no-print">
                        <button 
                          onClick={() => handleTransfer(p)}
                          className={`btn btn-sm ${isLow ? 'btn-primary' : 'btn-outline border-base-300'} ${isTransferring ? 'loading' : ''}`}
                          disabled={isTransferring || suggest === 0}
                        >
                          {!isTransferring && `🚚 ${t('stock.reappro.table.transfer_btn')}`}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {!loading && filteredProducts.length > itemsPerPage && (
            <div className="p-4 border-t border-base-200 flex items-center justify-between bg-base-50/50 no-print">
                <div className="text-sm text-base-content/60">
                    {t('common.pagination_info', { page: 1, total: totalPages, count: paginatedProducts.length, label: t('common.items') })}
                </div>
                <div className="join shadow-sm border border-base-300">
                    <button 
                        className="join-item btn btn-sm btn-outline bg-base-100" 
                        disabled={page === 1}
                        onClick={() => setPage(page - 1)}
                    >
                        {t('common.previous')}
                    </button>
                    <button className="join-item btn btn-sm bg-base-100 no-animation">
                        {t('common.pagination.page_info', { current: page, total: totalPages, label: '' })}
                    </button>
                    <button 
                        className="join-item btn btn-sm btn-outline bg-base-100" 
                        disabled={page === totalPages}
                        onClick={() => setPage(page + 1)}
                    >
                        {t('common.next')}
                    </button>
                </div>
            </div>
        )}
      </div>

      {/* Confirmation Modal */}
      <PremiumModal
        isOpen={showConfirmAll}
        onClose={() => setShowConfirmAll(false)}
        title={t('stock.reappro.modal_confirm.title')}
        maxWidth="max-w-md"
        icon={<span className="text-2xl">🚚</span>}
      >
        <div className="p-6 text-center">
          <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4 text-2xl shadow-inner">
            📦
          </div>
          <h3 className="text-xl font-bold text-base-content mb-2">{t('stock.reappro.modal_confirm.question')}</h3>
          <p className="text-base-content/60 text-sm mb-6 leading-relaxed">
            {t('stock.reappro.modal_confirm.message', { count: toProcessAll.length })}
          </p>
          <div className="flex gap-3 justify-center">
            <button 
              className="btn btn-ghost px-6" 
              onClick={() => setShowConfirmAll(false)}
            >
              {t('stock.reappro.modal_confirm.cancel')}
            </button>
            <button 
              className="btn btn-primary px-8 shadow-lg shadow-primary/20" 
              onClick={handleExecuteAllTransfer}
            >
              {t('stock.reappro.modal_confirm.confirm')}
            </button>
          </div>
        </div>
      </PremiumModal>

      {/* Sudo Mode Validation */}
      <SudoValidationModal
        isOpen={sudoModalOpen}
        onClose={() => {
          setSudoModalOpen(false);
          setPendingTransfer(null);
        }}
        onValidate={handleSudoValidate}
        saving={sudoSaving}
        title={t('stock.reappro.modal_sudo.title')}
        message={t('stock.reappro.modal_sudo.message')}
      />
    </div>
  );
}
