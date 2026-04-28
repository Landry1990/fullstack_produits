import { useEffect, useState } from 'react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import { 
  UserPlus, 
  Users, 
  Settings, 
  Trash2, 
  Eye, 
  EyeOff, 
  Search, 
  Phone,
  MapPin,
  Mail,
  User,
  ShoppingBag,
  History as HistoryIcon,
  ShieldCheck,
  Edit,
  Activity,
  CreditCard
} from 'lucide-react';

import type { Client, AyantDroit } from '../types';
import ClientDepositModal from './clients/ClientDepositModal';
import clientService from '../services/clientService';
import { formatCurrency, normalizeNumberInput } from '../utils/formatters';
import { clientSchema } from '../schemas/clientSchema';

// Components
import LoyaltyConfigModal from './LoyaltyConfigModal';
import ClientFormModal from './clients/ClientFormModal';
import PurchaseHistoryDrawer from './clients/PurchaseHistoryDrawer';
import SelectionHeader from './ui/SelectionHeader';
import ActionIcon from './ui/ActionIcon';
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

  const fetchClients = async () => {
    setLoading(true);
    try {
      const data = await clientService.getAll({
        search: debouncedSearch,
        page: currentPage,
        // @ts-ignore - Backend supports include_inactive
        include_inactive: showInactive
      });
      
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
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
      const res = await axios.get(`${apiBaseUrl}/api/loyalty-settings/`);
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
  }, [location.state, clients]);

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
            const errorMsg = validation.error.errors
                .map(err => `${t(`clients:fields.${err.path[0]}`)}: ${err.message}`)
                .join('\n');
            toast.error(errorMsg, { duration: 5000 });
            setIsSubmitting(false);
            return;
        }

        const cleanData = validation.data;

        if (formMode === 'create') {
            await clientService.create(cleanData);
            toast.success(t('clients:messages.create_success'));
        } else if (formData.id) {
            await clientService.update(formData.id, cleanData);
            toast.success(t('clients:messages.update_success'));
        }
        setIsFormModalOpen(false);
        fetchClients();
    } catch (err: any) {
        toast.error(err.response?.data?.message || t('clients:messages.error_save'));
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedClient) return;
    if (window.confirm(t('clients:modals.delete_confirm', { name: selectedClient.name }))) {
        try {
            await clientService.delete(selectedClient.id);
            toast.success(t('clients:messages.delete_success'));
            setSelectedClient(null);
            fetchClients();
        } catch (err) {
            toast.error(t('clients:messages.error_delete'));
        }
    }
  };

  const handleToggleActive = async () => {
    if (!selectedClient) return;
    try {
        const res = await clientService.toggleActive(selectedClient.id);
        toast.success(res.is_active ? t('clients:messages.status_active') : t('clients:messages.status_inactive'));
        fetchClients();
        setSelectedClient({...selectedClient, is_active: res.is_active});
    } catch (err) {
        toast.error(t('clients:messages.error_status'));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (window.confirm(t('clients:modals.bulk_delete_confirm', { count: selectedIds.length }))) {
        try {
            await clientService.bulkDelete(selectedIds);
            toast.success(t('clients:messages.bulk_delete_success', { count: selectedIds.length }));
            setSelectedIds([]);
            fetchClients();
        } catch (err) {
            toast.error(t('clients:messages.error_bulk_delete'));
        }
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-full lg:h-[calc(100vh-64px)] bg-base-100">
      {/* LEFT PANEL */}
      <div className={`w-full lg:w-1/3 border-b lg:border-b-0 lg:border-r border-base-200 flex flex-col bg-base-100/50 ${selectedClient ? 'hidden lg:flex' : 'flex'} h-[calc(100vh-140px)] lg:h-full`}>
        <div className="p-4 border-b border-base-200 space-y-4">
           {selectedIds.length > 0 ? (
             <SelectionHeader 
                selectedCount={selectedIds.length}
                onClear={() => setSelectedIds([])}
                colSpan={1}
                actions={
                  <li>
                    <a onClick={handleBulkDelete} className="text-error hover:bg-error/10 font-bold">
                      <Trash2 className="w-4 h-4" />
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
                 <div className="p-2 bg-primary/10 text-primary rounded-lg">
                    <Users className="w-5 h-5" />
                 </div>
                 <h2 className="font-black text-lg tracking-tight">{t('clients:title')}</h2>
               </div>
               <div className="flex gap-1">
                 <ActionIcon 
                    icon={showInactive ? Eye : EyeOff}
                    onClick={() => setShowInactive(!showInactive)}
                    variant={showInactive ? "primary" : "ghost"}
                    title={showInactive ? t('clients:filters.hide_inactive') : t('clients:filters.show_inactive')}
                 />
                 <ActionIcon 
                    icon={Settings} 
                    onClick={() => setIsLoyaltyConfigOpen(true)}
                    variant="ghost"
                 />
                 <button className="btn btn-sm btn-primary gap-2 h-9 px-4 rounded-xl shadow-lg shadow-primary/20" onClick={handleOpenCreate}>
                   <UserPlus className="w-4 h-4" />
                   <span className="font-bold">{t('clients:actions.create')}</span>
                 </button>
               </div>
             </div>
           )}
           
           <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/30" />
              <input 
                className="input input-sm input-bordered w-full pl-10 h-10 rounded-xl bg-base-200/30 border-transparent focus:bg-base-100 transition-all font-bold"
                placeholder={t('clients:filters.search_placeholder')}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
           </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && clients.length === 0 ? (
            <div className="flex justify-center p-12"><span className="loading loading-spinner text-primary"></span></div>
          ) : (
            <ul className="p-2 space-y-1">
               {clients.map(client => (
                 <li key={client.id} className="group">
                    <div className={`flex items-center gap-2 p-1.5 rounded-2xl transition-all cursor-pointer ${selectedClient?.id === client.id ? 'bg-primary/5' : 'hover:bg-base-200/50'}`} onClick={() => handleSelectClient(client)}>
                       <input 
                         type="checkbox" 
                         className="checkbox checkbox-xs rounded-lg"
                         checked={selectedIds.includes(client.id)}
                         onChange={() => setSelectedIds(prev => prev.includes(client.id) ? prev.filter(id => id !== client.id) : [...prev, client.id])}
                         onClick={(e) => e.stopPropagation()}
                       />
                       <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center">
                             <p className={`font-black text-sm truncate ${selectedClient?.id === client.id ? 'text-primary' : ''}`}>{client.name}</p>
                             <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest ${client.client_type === 'PROFESSIONNEL' ? 'bg-secondary/10 text-secondary' : 'bg-base-200 text-base-content/40'}`}>
                                {client.client_type === 'PROFESSIONNEL' ? t('clients:types.pro_short') : t('clients:types.part_short')}
                             </span>
                          </div>
                          <div className="flex items-center justify-between gap-1.5 text-[10px] text-base-content/40 font-mono font-bold">
                             <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {client.phone || '--'}</span>
                             {client.client_type === 'PROFESSIONNEL' && (client as any).ayants_droit_count > 0 && (
                               <span className="flex items-center gap-0.5 bg-info/10 text-info px-1 rounded">
                                 <Users className="w-2.5 h-2.5" />
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
      <div className={`flex-1 bg-base-50/50 flex flex-col overflow-hidden max-w-full ${!selectedClient ? 'hidden lg:flex' : 'flex'} h-[calc(100vh-80px)] lg:h-full`}>
        {selectedClient ? (
          <>
            <div className="p-4 lg:p-6 border-b border-base-200 bg-base-100/30 backdrop-blur-md flex flex-col sm:flex-row justify-between items-start sm:items-center shrink-0 gap-4">
               <div className="flex items-center gap-4 w-full">
                  <button 
                    className="lg:hidden btn btn-ghost btn-circle btn-sm mr-1" 
                    onClick={() => setSelectedClient(null)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <div className="w-12 h-12 lg:w-14 lg:h-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center text-xl lg:text-2xl font-black italic shadow-inner shrink-0">
                    {selectedClient.name.charAt(0)}
                  </div>
                  <div>
                     <h2 className="text-2xl font-black tracking-tighter flex items-center gap-2">
                       {selectedClient.name}
                       {selectedClient.is_active === false && <span className="badge badge-warning text-[10px] font-black italic">{t('clients:status.inactive')}</span>}
                     </h2>
                     <p className="flex items-center gap-3 text-xs font-bold text-base-content/40 mt-0.5">
                        <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {selectedClient.phone || '--'}</span>
                        <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {selectedClient.email || '--'}</span>
                     </p>
                  </div>
               </div>
               <div className="flex items-center gap-2">
                  <button className="btn btn-sm btn-ghost gap-2 h-10 px-4 rounded-xl text-secondary font-black hover:bg-secondary/10" onClick={() => handleOpenEdit(selectedClient)}>
                    <Edit className="w-4 h-4" /> {t('common:edit')}
                  </button>
                  <button className="btn btn-sm btn-ghost gap-2 h-10 px-4 rounded-xl text-error font-black hover:bg-error/10" onClick={handleDelete}>
                    <Trash2 className="w-4 h-4" /> {t('common:delete')}
                  </button>
                  <ActionIcon 
                    icon={isHistoryOpen ? HistoryIcon : ShoppingBag}
                    onClick={() => setIsHistoryOpen(true)}
                    variant="primary"
                    title={t('clients:sections.purchase_history')}
                  />
                  {selectedClient.client_type === 'PARTICULIER' && selectedClient.is_deposit_enabled && (
                    <ActionIcon 
                      icon={CreditCard}
                      onClick={() => setIsDepositModalOpen(true)}
                      variant="ghost"
                      title={t('clients:finance.manage_deposit')}
                    />
                  )}
                  <ActionIcon 
                    icon={selectedClient.is_active ? EyeOff : Eye}
                    onClick={handleToggleActive}
                    variant="ghost"
                  />
               </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8">
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Info Card */}
                  <div className="card bg-base-100 border border-base-200 rounded-3xl shadow-sm overflow-hidden">
                     <div className="p-4 bg-base-50/50 border-b border-base-200 flex items-center gap-2">
                        <div className="p-1.5 bg-primary/10 text-primary rounded-lg"><User className="w-4 h-4" /></div>
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-base-content/40">{t('clients:sections.contact')}</h3>
                     </div>
                     <div className="p-6 space-y-6">
                        <div className="flex flex-col gap-1.5">
                           <span className="text-[10px] font-black uppercase tracking-widest text-base-content/20">{t('clients:fields.address')}</span>
                           <div className="flex items-start gap-2.5 text-sm font-black">
                              <MapPin className="w-4 h-4 text-primary mt-0.5" />
                              <span className="leading-snug">{selectedClient.address || t('common:no_address')}</span>
                           </div>
                        </div>
                        <div className="flex flex-col gap-1.5">
                           <span className="text-[10px] font-black uppercase tracking-widest text-base-content/20">{t('clients:fields.type')}</span>
                           <div className="text-sm font-black flex items-center gap-2">
                              <Activity className="w-4 h-4 text-secondary" />
                              {selectedClient.client_type === 'PROFESSIONNEL' ? t('clients:types.professional') : t('clients:types.individual')}
                           </div>
                        </div>
                     </div>
                  </div>

                  {/* Finance/Loyalty Card */}
                  <div className="card bg-base-100 border border-base-200 rounded-3xl shadow-sm overflow-hidden">
                     <div className="p-4 bg-base-50/50 border-b border-base-200 flex items-center gap-2">
                        <div className="p-1.5 bg-secondary/10 text-secondary rounded-lg"><ShieldCheck className="w-4 h-4" /></div>
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-base-content/40">{t('clients:sections.programs')}</h3>
                     </div>
                     <div className="p-6 grid grid-cols-2 gap-4">
                        {selectedClient.client_type === 'PARTICULIER' && (
                           <div className="p-4 bg-secondary/5 border border-secondary/10 rounded-2xl flex flex-col gap-1 relative group overflow-hidden">
                              <span className="text-[9px] font-black uppercase tracking-widest text-secondary/40">{t('clients:history.loyalty')}</span>
                              <div className="flex justify-between items-end">
                                 <div className="text-xl font-black text-secondary">
                                    {selectedClient.points_fidelite ?? 0} {t('clients:units.pts')}
                                 </div>
                                 {loyaltyThreshold > 0 && (
                                   <div className="radial-progress text-secondary/20 group-hover:text-secondary transition-colors" style={{ "--value": Math.min(100, ((selectedClient.points_fidelite ?? 0) / loyaltyThreshold) * 100), "--size": "2.5rem", "--thickness": "3px" } as any}>
                                      <span className="text-[10px] font-black text-secondary">
                                         {Math.min(100, Math.round(((selectedClient.points_fidelite ?? 0) / loyaltyThreshold) * 100))}%
                                      </span>
                                   </div>
                                 )}
                              </div>
                              {loyaltyThreshold > 0 && (selectedClient.points_fidelite ?? 0) >= loyaltyThreshold && (
                                <div className="absolute top-0 right-0 p-1">
                                  <div className="w-2 h-2 bg-accent rounded-full animate-ping"></div>
                                </div>
                              )}
                           </div>
                        )}
                        {selectedClient.client_type === 'PARTICULIER' && (
                          <>
                            {selectedClient.is_deposit_enabled ? (
                              <div className="p-4 bg-primary/5 border border-primary/10 rounded-2xl flex flex-col gap-1 cursor-pointer hover:bg-primary/10 transition-colors" onClick={() => setIsDepositModalOpen(true)}>
                                 <span className="text-[9px] font-black uppercase tracking-widest text-primary/40">{t('clients:finance.solde_depot')}</span>
                                 <div className="text-xl font-black text-primary">{formatCurrency(parseFloat(selectedClient.solde_depot || '0'))}</div>
                              </div>
                            ) : (
                              <div className="p-4 bg-base-100 border border-base-200 rounded-2xl flex flex-col gap-1 opacity-40 grayscale">
                                 <span className="text-[9px] font-black uppercase tracking-widest text-base-content/40">{t('clients:finance.solde_depot')}</span>
                                 <div className="text-xl font-black text-base-content">{formatCurrency(0)}</div>
                              </div>
                            )}
                            <div className="p-4 bg-base-100 border border-base-200 rounded-2xl flex flex-col gap-1">
                               <span className="text-[9px] font-black uppercase tracking-widest text-base-content/40">{t('clients:finance.auto_discount')}</span>
                               <div className="text-xl font-black text-base-content">{selectedClient.remise_automatique || 0}{t('clients:units.percent')}</div>
                            </div>
                          </>
                        )}
                        {selectedClient.client_type === 'PROFESSIONNEL' && (
                          <div className="col-span-2 p-4 bg-primary/5 border border-primary/10 rounded-2xl flex flex-col gap-1">
                             <span className="text-[9px] font-black uppercase tracking-widest text-primary/40">{t('clients:finance.auto_discount')}</span>
                             <div className="text-xl font-black text-primary">{selectedClient.remise_automatique || 0}{t('clients:units.percent')}</div>
                          </div>
                        )}
                        {selectedClient.client_type === 'PROFESSIONNEL' && (
                          <div className="col-span-2 p-4 bg-warning/5 border border-warning/10 rounded-2xl flex justify-between items-center">
                             <div>
                                <span className="text-[9px] font-black uppercase tracking-widest text-warning/40">{t('clients:finance.debt_usage')}</span>
                                <div className="text-lg font-black text-base-content">
                                  {formatCurrency(normalizeNumberInput(selectedClient.current_debt || '0'))} / {formatCurrency(normalizeNumberInput(selectedClient.plafond || '0'))}
                                </div>
                             </div>
                             <div className="radial-progress text-warning" style={{ "--value": Math.min(100, (normalizeNumberInput(selectedClient.current_debt || '0') / normalizeNumberInput(selectedClient.plafond || '1')) * 100), "--size": "3rem", "--thickness": "4px" } as any}>
                                <span className="text-[9px] font-black italic">{(normalizeNumberInput(selectedClient.current_debt || '0') / normalizeNumberInput(selectedClient.plafond || '1') * 100).toFixed(0)}%</span>
                             </div>
                          </div>
                        )}
                     </div>
                  </div>

                  {/* Beneficiaries Table */}
                  {selectedClient.client_type === 'PROFESSIONNEL' && (
                    <div className="lg:col-span-2 card bg-base-100 border border-base-200 rounded-3xl shadow-sm overflow-hidden">
                       <div className="p-4 bg-base-50/50 border-b border-base-200 flex items-center gap-2">
                          <Users className="w-4 h-4 text-info" />
                          <h3 className="text-[10px] font-black uppercase tracking-widest text-base-content/40">{t('clients:beneficiaries.title')}</h3>
                       </div>
                       <div className="overflow-x-auto">
                          <table className="table table-xs w-full">
                             <thead className="bg-base-50">
                                <tr>
                                   <th className="py-3 px-6 text-[9px] uppercase font-black tracking-widest">{t('clients:beneficiaries.col_name')}</th>
                                   <th className="py-3 px-6 text-[9px] uppercase font-black tracking-widest">{t('clients:beneficiaries.company') || 'Société'}</th>
                                   <th className="py-3 px-6 text-[9px] uppercase font-black tracking-widest text-right">{t('clients:beneficiaries.col_id')}</th>
                                </tr>
                             </thead>
                             <tbody>
                                {selectedClient.ayants_droit && selectedClient.ayants_droit.length > 0 ? (
                                  selectedClient.ayants_droit.map((ad: AyantDroit, idx: number) => (
                                    <tr key={idx} className="hover:bg-base-200/20 border-b border-base-200/50 last:border-0">
                                       <td className="py-4 px-6 text-sm font-black">{ad.nom}</td>
                                       <td className="py-4 px-6 text-sm font-bold opacity-60 italic">{ad.societe || '—'}</td>
                                       <td className="py-4 px-6 text-sm font-black text-right font-mono text-secondary">{ad.matricule}</td>
                                    </tr>
                                  ))
                                ) : (
                                  <tr><td colSpan={2} className="py-12 text-center text-xs font-black opacity-30 uppercase tracking-widest">{t('clients:beneficiaries.empty')}</td></tr>
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
          <div className="flex-1 flex flex-col items-center justify-center gap-6 opacity-30 grayscale p-12 text-center">
             <Users className="w-32 h-32 stroke-[1px]" />
             <div>
                <h3 className="text-2xl font-black italic tracking-tighter">{t('clients:modals.select_client_empty')}</h3>
                <p className="text-sm font-bold mt-2 max-w-sm mx-auto">{t('clients:modals.select_client_empty_desc')}</p>
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
    </div>
  );
}