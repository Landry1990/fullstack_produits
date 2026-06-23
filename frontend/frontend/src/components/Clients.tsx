import { useEffect, useState } from 'react';
import api from '../services/api';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import {
  UserPlus, Users, Settings, Trash2, Eye, EyeOff, Search, Phone, MapPin, Mail,
  User, ShoppingBag, ShieldCheck, Edit, Activity, CreditCard, ArrowLeft
} from 'lucide-react';
import { Button } from './shadcn/button';
import { Badge } from './shadcn/badge';
import { cn } from '../lib/utils';

import type { Client, AyantDroit } from '../types';
import ClientDepositModal from './clients/ClientDepositModal';
import ClientDeleteWarningModal from './clients/ClientDeleteWarningModal';
import BulkDeleteWarningModal from './clients/BulkDeleteWarningModal';
import clientService from '../services/clientService';
import { formatCurrency, normalizeNumberInput } from '../utils/formatters';
import { clientSchema } from '../schemas/clientSchema';

// Components
import LoyaltyConfigModal from './LoyaltyConfigModal';
import ClientFormModal from './clients/ClientFormModal';
import PurchaseHistoryDrawer from './clients/PurchaseHistoryDrawer';
import SelectionHeader from './ui/SelectionHeader';
import Pagination from './ui/Pagination';

const emptyForm: Partial<Client> = {
  name: '',
  address: '',
  phone: '',
  email: '',
  client_type: 'PARTICULIER',
  plafond: '0',
  taux_couverture: '0',
  remise_automatique: '0',
  majoration_pro_pourcentage: '0',
  ayants_droit: [],
  is_active: true,
  is_deposit_enabled: false
};

export default function Clients() {
  const { t } = useTranslation(['clients', 'common']);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [showInactive, setShowInactive] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 50;
  const location = useLocation();
  const navigate = useNavigate();

  // View/Navigation State
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [formData, setFormData] = useState<Partial<Client>>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [isLoyaltyConfigOpen, setIsLoyaltyConfigOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [isDeleteWarningOpen, setIsDeleteWarningOpen] = useState(false);
  const [deleteWarningData, setDeleteWarningData] = useState<{
    clientName: string;
    invoiceCount: number;
    totalDue: number;
    invoices: Array<{
      id: number;
      numero: string;
      date: string;
      total_ttc: number;
      paid: number;
      remainder: number;
    }>;
  } | null>(null);
  const [isBulkDeleteWarningOpen, setIsBulkDeleteWarningOpen] = useState(false);
  const [bulkDeleteWarningData, setBulkDeleteWarningData] = useState<{
    clientCount: number;
    clientsWithUnpaid: Array<{
      id: number;
      name: string;
      invoice_count: number;
      total_due: number;
    }>;
    totalDue: number;
  } | null>(null);
  const [loyaltyThreshold, setLoyaltyThreshold] = useState<number>(0);

  // Purchase History State
  const [purchaseHistory, setPurchaseHistory] = useState<any | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchClients = async (skipCache: boolean = false) => {
    setLoading(true);
    try {
      const data = await clientService.getAll({
        search: debouncedSearch,
        page: currentPage,
        page_size: itemsPerPage,
        // @ts-ignore - Backend supports include_inactive
        include_inactive: showInactive
      }, skipCache);
      
      if (data && 'results' in data) {
        setClients(data.results);
        setTotalCount(data.count);
      } else {
        setClients(data);
        setTotalCount(data.length);
      }
    } catch (err) {
      toast.error(t('clients:messages.error_fetch'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
    fetchLoyaltyThreshold();
  }, [showInactive, currentPage, debouncedSearch]);

  const fetchLoyaltyThreshold = async () => {
    try {
      const res = await api.get('loyalty-settings/');
      let data = res.data;
      if (data && data.results) data = data.results[0];
      else if (Array.isArray(data)) data = data[0];
      
      if (data && data.auto_reward_threshold) {
        setLoyaltyThreshold(data.auto_reward_threshold);
      }
    } catch (err) {
      console.error("Error fetching loyalty threshold", err);
    }
  };

  // Handle incoming redirect from Omnisearch
  useEffect(() => {
    if (location.state?.action === 'NEW_CLIENT') {
      handleOpenCreate();
      navigate(location.pathname, { replace: true, state: {} });
    }
    if (location.state?.selectedClientId && clients.length > 0) {
      const cid = location.state.selectedClientId;
      const found = clients.find((c: Client) => c.id === cid);
      if (found) {
        handleSelectClient(found);
        // Clear state to avoid re-triggering
        navigate(location.pathname, { replace: true, state: {} });
      } else {
        if (searchTerm !== String(cid)) {
          setSearchTerm(String(cid));
        }
      }
    }
  }, [clients]);

  const handleSelectClient = async (client: Client) => {
    setLoadingHistory(true);
    try {
      // Fetch full details or at least beneficiaries to ensure the right panel is complete
      const [history, ayantsDroit] = await Promise.all([
        clientService.getPurchaseHistory(client.id),
        clientService.getAyantsDroit(client.id)
      ]);
      
      setPurchaseHistory(history);
      setSelectedClient({
        ...client,
        ayants_droit: ayantsDroit
      });
    } catch (err) {
      console.error(err);
      setSelectedClient(client);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleOpenCreate = () => {
    setFormMode('create');
    setFormData(emptyForm);
    setIsFormModalOpen(true);
  };

  const handleOpenEdit = (client: Client) => {
    setFormMode('edit');
    setFormData({...client});
    setIsFormModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
        // Validation avec Zod
        const validation = clientSchema.safeParse(formData);
        if (!validation.success) {
            const errorMsg = (validation.error as any).errors
                .map((err: any) => `${t(`clients:fields.${err.path[0]}`)}: ${err.message}`)
                .join('\n');
            toast.error(errorMsg, { duration: 5000 });
            setIsSubmitting(false);
            return;
        }

        const cleanData = validation.data as any;

        if (formMode === 'create') {
            const created = await clientService.create(cleanData);
            setClients(prev => [created, ...prev]);
            toast.success(t('clients:messages.create_success'));
        } else if (formData.id) {
            const updated = await clientService.update(formData.id, cleanData);
            setClients(prev => prev.map(c => c.id === updated.id ? updated : c));
            if (selectedClient?.id === updated.id) {
                setSelectedClient(updated);
            }
            toast.success(t('clients:messages.update_success'));
        }
        setIsFormModalOpen(false);
    } catch (err: any) {
        toast.error(err.response?.data?.message || t('clients:messages.error_save'));
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedClient) return;

    // Vérifier d'abord si le client a des factures impayées
    try {
      const checkResult = await clientService.checkUnpaidInvoices(selectedClient.id);

      if (checkResult.has_unpaid) {
        // Afficher le modal d'avertissement et empêcher la suppression
        setDeleteWarningData({
          clientName: selectedClient.name,
          invoiceCount: checkResult.count,
          totalDue: checkResult.total_due,
          invoices: checkResult.invoices
        });
        setIsDeleteWarningOpen(true);
        return;
      }
    } catch (err) {
      console.error('[Clients] Erreur lors de la vérification des factures:', err);
      // En cas d'erreur, on continue avec la confirmation standard
    }

    // Si pas de factures impayées, procéder à la confirmation
    if (window.confirm(t('clients:modals.delete_confirm', { name: selectedClient.name }))) {
        const deletedId = selectedClient.id;

        try {
            setClients(prev => prev.filter(c => c.id !== deletedId));
            setTotalCount(prev => prev - 1);
            setSelectedClient(null);
            await clientService.delete(deletedId);
            toast.success(t('clients:messages.delete_success'));
            setTimeout(() => fetchClients(true), 500);
        } catch (err: any) {
            console.error('[Clients] Delete error:', err);
            toast.error(err.response?.data?.detail || t('clients:messages.error_delete'));
            fetchClients(true);
        }
    }
  };

  const handleToggleActive = async () => {
    if (!selectedClient) return;
    try {
        const res = await clientService.toggleActive(selectedClient.id);
        toast.success(res.is_active ? t('clients:messages.status_active') : t('clients:messages.status_inactive'));
        setSelectedClient({...selectedClient, is_active: res.is_active});
        setTimeout(() => fetchClients(true), 500);
    } catch (err) {
        toast.error(t('clients:messages.error_status'));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;

    // Vérifier d'abord si des clients ont des factures impayées
    try {
      const checkResult = await clientService.bulkCheckUnpaid(selectedIds);

      if (checkResult.has_unpaid) {
        // Afficher le modal d'avertissement et empêcher la suppression
        setBulkDeleteWarningData({
          clientCount: selectedIds.length,
          clientsWithUnpaid: checkResult.clients,
          totalDue: checkResult.total_due
        });
        setIsBulkDeleteWarningOpen(true);
        return;
      }
    } catch (err) {
      console.error('[Clients] Erreur lors de la vérification bulk des factures:', err);
      // En cas d'erreur, on continue avec la confirmation standard
    }

    const confirmed = window.confirm(t('clients:modals.bulk_delete_confirm', { count: selectedIds.length }));

    if (confirmed) {
        setClients(prev => prev.filter(c => !selectedIds.includes(c.id)));
        setTotalCount(prev => prev - selectedIds.length);

        try {
            await clientService.bulkDelete(selectedIds);
            toast.success(t('clients:messages.bulk_delete_success', { count: selectedIds.length }));
            setSelectedIds([]);
            setTimeout(() => fetchClients(true), 500);
        } catch (err: any) {
            console.error('[Clients] Bulk delete error:', err);
            toast.error(err.response?.data?.detail || t('clients:messages.error_bulk_delete'));
            fetchClients(true);
        }
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-full lg:h-[calc(100vh-64px)] bg-slate-50">
      {/* LEFT PANEL */}
      <div className={cn("w-full lg:w-1/3 border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col bg-white h-[calc(100vh-140px)] lg:h-full", selectedClient ? 'hidden lg:flex' : 'flex')}>
        <div className="p-4 border-b border-slate-200 space-y-4">
           {selectedIds.length > 0 ? (
             <SelectionHeader
                selectedCount={selectedIds.length}
                onClear={() => setSelectedIds([])}
                colSpan={1}
                actions={
                  <li>
                    <a onClick={handleBulkDelete} className="text-error hover:bg-error/10 font-medium">
                      <Trash2 className="size-4" />
                      {t('clients:actions.bulk_delete', { count: selectedIds.length })}
                    </a>
                  </li>
                }
             >
                <></>
             </SelectionHeader>
           ) : (
             <div className="flex justify-between items-center h-10">
               <div className="flex items-center gap-2">
                 <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                    <Users className="size-5" />
                 </div>
                 <h2 className="font-bold text-lg text-slate-800">{t('clients:title')}</h2>
                 <Badge variant="secondary" className="text-xs">{totalCount}</Badge>
               </div>
               <div className="flex gap-1 items-center">
                 <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowInactive(!showInactive)}
                    className={cn("size-9", showInactive ? 'bg-emerald-50 text-emerald-600' : 'text-slate-500')}
                    title={showInactive ? t('clients:filters.hide_inactive') : t('clients:filters.show_inactive')}
                 >
                    {showInactive ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                 </Button>
                 <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsLoyaltyConfigOpen(true)}
                    className="size-9 text-slate-500"
                 >
                    <Settings className="size-4" />
                 </Button>
                 <Button size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={handleOpenCreate}>
                   <UserPlus className="size-4" />
                   {t('clients:actions.create')}
                 </Button>
               </div>
             </div>
           )}

           <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <input
                className="w-full pl-10 h-10 rounded-lg bg-slate-100 border border-slate-200 text-sm text-slate-700 focus:outline-none focus:bg-white focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 transition-all"
                placeholder={t('clients:filters.search_placeholder')}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
           </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && clients.length === 0 ? (
            <div className="flex justify-center p-12">
              <div className="animate-spin rounded-full size-8 border-b-2 border-emerald-600"></div>
            </div>
          ) : (
            <ul className="p-2 space-y-0.5">
               {clients.map(client => (
                 <li key={client.id}>
                    <div className={cn("flex items-center gap-2 p-2 rounded-lg transition-all cursor-pointer", selectedClient?.id === client.id ? 'bg-emerald-50' : 'hover:bg-slate-100')} onClick={() => handleSelectClient(client)}>
                       <input
                         type="checkbox"
                         className="size-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                         checked={selectedIds.includes(client.id)}
                         onChange={() => setSelectedIds(prev => prev.includes(client.id) ? prev.filter(id => id !== client.id) : [...prev, client.id])}
                         onClick={(e) => e.stopPropagation()}
                       />
                       <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center">
                             <p className={cn("text-sm font-semibold truncate", selectedClient?.id === client.id ? 'text-emerald-700' : 'text-slate-800')}>{client.name}</p>
                             <Badge variant="outline" className={cn("text-[10px] font-semibold uppercase tracking-wide", client.client_type === 'PROFESSIONNEL' ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-slate-100 text-slate-500 border-slate-200')}>
                                {client.client_type === 'PROFESSIONNEL' ? t('clients:types.pro_short') : t('clients:types.part_short')}
                             </Badge>
                          </div>
                          <div className="flex items-center justify-between gap-1.5 text-xs text-slate-500">
                             <span className="flex items-center gap-1"><Phone className="size-3" /> {client.phone || '—'}</span>
                             {client.client_type === 'PROFESSIONNEL' && (client as any).ayants_droit_count > 0 && (
                               <span className="flex items-center gap-0.5 text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px] font-medium">
                                 <Users className="size-3" />
                                 {(client as any).ayants_droit_count}
                               </span>
                             )}
                          </div>
                       </div>
                    </div>
                 </li>
               ))}
            </ul>
          )}
        </div>

        <Pagination
          currentPage={currentPage}
          totalPages={Math.ceil(totalCount / itemsPerPage)}
          totalItems={totalCount}
          onPrev={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
          onNext={() => setCurrentPage(prev => prev + 1)}
          hasNext={currentPage < Math.ceil(totalCount / itemsPerPage)}
        />
      </div>

      {/* RIGHT PANEL */}
      <div className={cn("flex-1 bg-slate-50 flex flex-col overflow-hidden max-w-full h-[calc(100vh-80px)] lg:h-full", !selectedClient ? 'hidden lg:flex' : 'flex')}>
        {selectedClient ? (
          <>
            <div className="p-4 lg:p-6 border-b border-slate-200 bg-white flex flex-col sm:flex-row justify-between items-start sm:items-center shrink-0 gap-4">
               <div className="flex items-center gap-4 w-full">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="lg:hidden mr-1"
                    onClick={() => setSelectedClient(null)}
                  >
                    <ArrowLeft className="size-5 text-slate-500" />
                  </Button>
                  <div className="size-12 lg:w-14 lg:h-14 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center text-xl lg:text-2xl font-bold shrink-0">
                    {selectedClient.name.charAt(0)}
                  </div>
                  <div>
                     <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                       {selectedClient.name}
                       {selectedClient.is_active === false && <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 text-[10px]">{t('clients:status.inactive')}</Badge>}
                     </h2>
                     <p className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                        <span className="flex items-center gap-1"><Phone className="size-3" /> {selectedClient.phone || '—'}</span>
                        <span className="flex items-center gap-1"><Mail className="size-3" /> {selectedClient.email || '—'}</span>
                     </p>
                  </div>
               </div>
               <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => handleOpenEdit(selectedClient)}>
                    <Edit className="size-4" /> {t('common:edit')}
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2 border-red-200 text-red-600 hover:bg-red-50" onClick={handleDelete}>
                    <Trash2 className="size-4" /> {t('common:delete')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsHistoryOpen(true)}
                    className="text-emerald-600 bg-emerald-50 hover:bg-emerald-100"
                    title={t('clients:sections.purchase_history')}
                  >
                    <ShoppingBag className="size-4" />
                  </Button>
                  {selectedClient.client_type === 'PARTICULIER' && selectedClient.is_deposit_enabled && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsDepositModalOpen(true)}
                      className="text-slate-500"
                      title={t('clients:finance.manage_deposit')}
                    >
                      <CreditCard className="size-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleToggleActive}
                    className="text-slate-500"
                  >
                    {selectedClient.is_active ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </Button>
               </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl">
                  {/* Info Card */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                     <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
                        <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-md"><User className="size-4" /></div>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t('clients:sections.contact')}</h3>
                     </div>
                     <div className="p-5 space-y-4">
                        <div className="space-y-1">
                           <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{t('clients:fields.address')}</span>
                           <div className="flex items-start gap-2 text-sm text-slate-700">
                              <MapPin className="size-4 text-emerald-500 mt-0.5 shrink-0" />
                              <span>{selectedClient.address || t('common:no_address')}</span>
                           </div>
                        </div>
                        <div className="space-y-1">
                           <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{t('clients:fields.type')}</span>
                           <div className="text-sm font-medium text-slate-700 flex items-center gap-2">
                              <Activity className="size-4 text-slate-500" />
                              {selectedClient.client_type === 'PROFESSIONNEL' ? t('clients:types.professional') : t('clients:types.individual')}
                           </div>
                        </div>
                     </div>
                  </div>

                  {/* Finance/Loyalty Card */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                     <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
                        <div className="p-1.5 bg-amber-100 text-amber-600 rounded-md"><ShieldCheck className="size-4" /></div>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t('clients:sections.programs')}</h3>
                     </div>
                     <div className="p-5 grid grid-cols-2 gap-3">
                        {selectedClient.client_type === 'PARTICULIER' && (
                           <div className="p-3 bg-warning/10 border border-amber-100 rounded-lg flex flex-col gap-1 relative">
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-warning/70">{t('clients:history.loyalty')}</span>
                              <div className="flex justify-between items-end">
                                 <div className="text-lg font-bold text-warning">
                                    {selectedClient.points_fidelite ?? 0} {t('clients:units.pts')}
                                 </div>
                                 {loyaltyThreshold > 0 && (
                                   <div className="radial-progress text-amber-300" style={{ "--value": Math.min(100, ((selectedClient.points_fidelite ?? 0) / loyaltyThreshold) * 100), "--size": "2.5rem", "--thickness": "3px" } as any}>
                                      <span className="text-[10px] font-bold text-warning">
                                         {Math.min(100, Math.round(((selectedClient.points_fidelite ?? 0) / loyaltyThreshold) * 100))}%
                                      </span>
                                   </div>
                                 )}
                              </div>
                              {loyaltyThreshold > 0 && (selectedClient.points_fidelite ?? 0) >= loyaltyThreshold && (
                                <div className="absolute top-2 right-2">
                                  <div className="size-2 bg-emerald-500 rounded-full animate-ping"></div>
                                </div>
                              )}
                           </div>
                        )}
                        {selectedClient.client_type === 'PARTICULIER' && (
                          <>
                            {selectedClient.is_deposit_enabled ? (
                              <div className="p-3 bg-primary/10 border border-indigo-100 rounded-lg flex flex-col gap-1 cursor-pointer hover:bg-primary/20 transition-colors" onClick={() => setIsDepositModalOpen(true)}>
                                 <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-500/70">{t('clients:finance.solde_depot')}</span>
                                 <div className="text-lg font-bold text-primary">{formatCurrency(parseFloat(selectedClient.solde_depot || '0'))}</div>
                              </div>
                            ) : (
                              <div className="p-3 bg-base-200 border border-base-200 rounded-lg flex flex-col gap-1 text-base-content/50">
                                 <span className="text-[10px] font-semibold uppercase tracking-wider text-base-content/50">{t('clients:finance.solde_depot')}</span>
                                 <div className="text-lg font-bold text-base-content/60">{formatCurrency(0)}</div>
                              </div>
                            )}
                            <div className="p-3 bg-base-200 border border-base-200 rounded-lg flex flex-col gap-1">
                               <span className="text-[10px] font-semibold uppercase tracking-wider text-base-content/50">{t('clients:finance.auto_discount')}</span>
                               <div className="text-lg font-bold text-base-content">{selectedClient.remise_automatique || 0}{t('clients:units.percent')}</div>
                            </div>
                          </>
                        )}
                        {selectedClient.client_type === 'PROFESSIONNEL' && (
                          <div className="col-span-2 p-3 bg-primary/10 border border-indigo-100 rounded-lg flex flex-col gap-1">
                             <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-500/70">{t('clients:finance.auto_discount')}</span>
                             <div className="text-lg font-bold text-primary">{selectedClient.remise_automatique || 0}{t('clients:units.percent')}</div>
                          </div>
                        )}
                        {selectedClient.client_type === 'PROFESSIONNEL' && (
                          <div className="col-span-2 p-3 bg-warning/10 border border-orange-100 rounded-lg flex justify-between items-center">
                             <div>
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-orange-500/70">{t('clients:finance.debt_usage')}</span>
                                <div className="text-base font-bold text-base-content">
                                  {formatCurrency(normalizeNumberInput(selectedClient.current_debt || '0'))} <span className="text-base-content/50 font-normal">/ {formatCurrency(normalizeNumberInput(selectedClient.plafond || '0'))}</span>
                                </div>
                             </div>
                             <div className="radial-progress text-orange-300" style={{ "--value": Math.min(100, (normalizeNumberInput(selectedClient.current_debt || '0') / normalizeNumberInput(selectedClient.plafond || '1')) * 100), "--size": "3rem", "--thickness": "4px" } as any}>
                                <span className="text-[10px] font-bold text-warning">{(normalizeNumberInput(selectedClient.current_debt || '0') / normalizeNumberInput(selectedClient.plafond || '1') * 100).toFixed(0)}%</span>
                             </div>
                          </div>
                        )}
                        {selectedClient.client_type === 'PROFESSIONNEL' && selectedClient.majoration_pro_pourcentage && parseFloat(selectedClient.majoration_pro_pourcentage) > 0 && (
                           <div className="col-span-2 p-3 bg-error/10 border border-red-100 rounded-lg flex flex-col gap-1">
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-red-500/70">{t('clients:finance.majoration_pro')}</span>
                              <div className="text-lg font-bold text-error">+{selectedClient.majoration_pro_pourcentage}{t('clients:units.percent')}</div>
                           </div>
                        )}
                     </div>
                  </div>

                  {/* Beneficiaries Table */}
                  {selectedClient.client_type === 'PROFESSIONNEL' && (
                    <div className="lg:col-span-2 bg-base-100 rounded-xl border border-base-200 shadow-sm overflow-hidden">
                       <div className="px-5 py-3 border-b border-base-200 bg-base-200/50 flex items-center gap-2">
                          <Users className="size-4 text-indigo-500" />
                          <h3 className="text-xs font-semibold uppercase tracking-wider text-base-content/50">{t('clients:beneficiaries.title')}</h3>
                       </div>
                       <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-base-200">
                             <thead className="bg-base-200">
                                <tr>
                                   <th className="px-6 py-3 text-left text-[10px] font-semibold text-base-content/60 uppercase tracking-wider">{t('clients:beneficiaries.col_name')}</th>
                                   <th className="px-6 py-3 text-left text-[10px] font-semibold text-base-content/60 uppercase tracking-wider">{t('clients:beneficiaries.company') || 'Société'}</th>
                                   <th className="px-6 py-3 text-right text-[10px] font-semibold text-base-content/60 uppercase tracking-wider">{t('clients:beneficiaries.col_id')}</th>
                                </tr>
                             </thead>
                             <tbody className="bg-base-100 divide-y divide-base-200">
                                {selectedClient.ayants_droit && selectedClient.ayants_droit.length > 0 ? (
                                  selectedClient.ayants_droit.map((ad: AyantDroit, idx: number) => (
                                    <tr key={idx} className="hover:bg-base-200 transition-colors">
                                       <td className="px-6 py-3 text-sm font-medium text-base-content">{ad.nom}</td>
                                       <td className="px-6 py-3 text-sm text-base-content/60">{ad.societe || '—'}</td>
                                       <td className="px-6 py-3 text-sm font-mono text-base-content/60 text-right">{ad.matricule}</td>
                                    </tr>
                                  ))
                                ) : (
                                  <tr><td colSpan={3} className="py-12 text-center text-sm text-base-content/50">{t('clients:beneficiaries.empty')}</td></tr>
                                )}
                             </tbody>
                          </table>
                       </div>
                    </div>
                  )}
               </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 text-base-content/20 p-12 text-center">
             <Users className="size-24 text-base-content/50" />
             <div>
                <h3 className="text-xl font-bold text-base-content/50">{t('clients:modals.select_client_empty')}</h3>
                <p className="text-sm text-base-content/50 mt-2 max-w-sm mx-auto">{t('clients:modals.select_client_empty_desc')}</p>
             </div>
          </div>
        )}
      </div>

      {/* MODALS */}
      <ClientFormModal 
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSubmit={handleFormSubmit}
        data={formData}
        setData={setFormData}
        isSubmitting={isSubmitting}
        isEdit={formMode === 'edit'}
      />

      <PurchaseHistoryDrawer 
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        data={purchaseHistory}
        loading={loadingHistory}
      />

      <LoyaltyConfigModal 
        isOpen={isLoyaltyConfigOpen}
        onClose={() => setIsLoyaltyConfigOpen(false)}
      />

      {selectedClient && (
        <ClientDepositModal
          isOpen={isDepositModalOpen}
          onClose={() => setIsDepositModalOpen(false)}
          client={selectedClient}
          onSuccess={fetchClients}
        />
      )}

      <ClientDeleteWarningModal
        isOpen={isDeleteWarningOpen}
        onClose={() => setIsDeleteWarningOpen(false)}
        clientName={deleteWarningData?.clientName || ''}
        invoiceCount={deleteWarningData?.invoiceCount || 0}
        totalDue={deleteWarningData?.totalDue || 0}
        invoices={deleteWarningData?.invoices || []}
      />

      <BulkDeleteWarningModal
        isOpen={isBulkDeleteWarningOpen}
        onClose={() => setIsBulkDeleteWarningOpen(false)}
        clientCount={bulkDeleteWarningData?.clientCount || 0}
        clientsWithUnpaid={bulkDeleteWarningData?.clientsWithUnpaid || []}
        totalDue={bulkDeleteWarningData?.totalDue || 0}
      />
    </div>
  );
}
