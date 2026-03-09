import { useEffect, useState } from 'react';
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
  Activity
} from 'lucide-react';

import type { Client, AyantDroit } from '../types';
import clientService from '../services/clientService';
import { formatCurrency, normalizeNumberInput } from '../utils/formatters';

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
  is_active: true
};

export default function Clients() {
  const { t } = useTranslation();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [showInactive, setShowInactive] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 50;

  // View/Navigation State
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [formData, setFormData] = useState<Partial<Client>>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [isLoyaltyConfigOpen, setIsLoyaltyConfigOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

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
      toast.error(t('clients.messages.error_fetch'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, [showInactive, currentPage, debouncedSearch]);

  const handleSelectClient = async (client: Client) => {
    setSelectedClient(client);
    setLoadingHistory(true);
    try {
      const history = await clientService.getPurchaseHistory(client.id);
      setPurchaseHistory(history);
    } catch (err) {
      console.error(err);
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
        if (formMode === 'create') {
            await clientService.create(formData);
            toast.success(t('clients.messages.create_success'));
        } else if (formData.id) {
            await clientService.update(formData.id, formData);
            toast.success(t('clients.messages.update_success'));
        }
        setIsFormModalOpen(false);
        fetchClients();
    } catch (err: any) {
        toast.error(err.response?.data?.message || t('clients.messages.error_save'));
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedClient) return;
    if (window.confirm(t('clients.modals.delete_confirm', { name: selectedClient.name }))) {
        try {
            await clientService.delete(selectedClient.id);
            toast.success(t('clients.messages.delete_success'));
            setSelectedClient(null);
            fetchClients();
        } catch (err) {
            toast.error(t('clients.messages.error_delete'));
        }
    }
  };

  const handleToggleActive = async () => {
    if (!selectedClient) return;
    try {
        const res = await clientService.toggleActive(selectedClient.id);
        toast.success(res.is_active ? 'Client réactivé' : 'Client masqué');
        fetchClients();
        setSelectedClient({...selectedClient, is_active: res.is_active});
    } catch (err) {
        toast.error('Erreur de statut');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (window.confirm(`Supprimer ${selectedIds.length} clients ?`)) {
        try {
            await clientService.bulkDelete(selectedIds);
            toast.success(`${selectedIds.length} clients supprimés`);
            setSelectedIds([]);
            fetchClients();
        } catch (err) {
            toast.error('Erreur lors de la suppression groupée');
        }
    }
  };

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-base-100">
      {/* LEFT PANEL */}
      <div className="w-1/3 border-r border-base-200 flex flex-col bg-base-100/50">
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
                      Supprimer {selectedIds.length} client(s)
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
                 <h2 className="font-black text-lg tracking-tight">{t('clients.title')}</h2>
               </div>
               <div className="flex gap-1">
                 <ActionIcon 
                    icon={showInactive ? Eye : EyeOff}
                    onClick={() => setShowInactive(!showInactive)}
                    variant={showInactive ? "primary" : "ghost"}
                    title={showInactive ? "Masquer inactifs" : "Afficher inactifs"}
                 />
                 <ActionIcon 
                    icon={Settings} 
                    onClick={() => setIsLoyaltyConfigOpen(true)}
                    variant="ghost"
                 />
                 <button className="btn btn-sm btn-primary gap-2 h-9 px-4 rounded-xl shadow-lg shadow-primary/20" onClick={handleOpenCreate}>
                   <UserPlus className="w-4 h-4" />
                   <span className="font-bold">{t('clients.actions.create')}</span>
                 </button>
               </div>
             </div>
           )}
           
           <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/30" />
              <input 
                className="input input-sm input-bordered w-full pl-10 h-10 rounded-xl bg-base-200/30 border-transparent focus:bg-base-100 transition-all font-bold"
                placeholder={t('clients.filters.search_placeholder')}
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
                                {client.client_type === 'PROFESSIONNEL' ? 'Pro' : 'Part'}
                             </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-base-content/40 font-mono font-bold">
                             <Phone className="w-3 h-3" /> {client.phone || '--'}
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
      <div className="flex-1 bg-base-50/50 flex flex-col overflow-hidden">
        {selectedClient ? (
          <>
            <div className="p-6 border-b border-base-200 bg-base-100/30 backdrop-blur-md flex justify-between items-center shrink-0">
               <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center text-2xl font-black italic shadow-inner">
                    {selectedClient.name.charAt(0)}
                  </div>
                  <div>
                     <h2 className="text-2xl font-black tracking-tighter flex items-center gap-2">
                       {selectedClient.name}
                       {selectedClient.is_active === false && <span className="badge badge-warning text-[10px] font-black italic">INACTIF</span>}
                     </h2>
                     <p className="flex items-center gap-3 text-xs font-bold text-base-content/40 mt-0.5">
                        <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {selectedClient.phone || '--'}</span>
                        <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {selectedClient.email || '--'}</span>
                     </p>
                  </div>
               </div>
               <div className="flex items-center gap-2">
                  <button className="btn btn-sm btn-ghost gap-2 h-10 px-4 rounded-xl text-secondary font-black hover:bg-secondary/10" onClick={() => handleOpenEdit(selectedClient)}>
                    <Edit className="w-4 h-4" /> {t('common.edit')}
                  </button>
                  <button className="btn btn-sm btn-ghost gap-2 h-10 px-4 rounded-xl text-error font-black hover:bg-error/10" onClick={handleDelete}>
                    <Trash2 className="w-4 h-4" /> {t('common.delete')}
                  </button>
                  <ActionIcon 
                    icon={isHistoryOpen ? HistoryIcon : ShoppingBag}
                    onClick={() => setIsHistoryOpen(true)}
                    variant="primary"
                    title="Historique d'achat"
                  />
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
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-base-content/40">{t('clients.sections.contact')}</h3>
                     </div>
                     <div className="p-6 space-y-6">
                        <div className="flex flex-col gap-1.5">
                           <span className="text-[10px] font-black uppercase tracking-widest text-base-content/20">{t('clients.fields.address')}</span>
                           <div className="flex items-start gap-2.5 text-sm font-black">
                              <MapPin className="w-4 h-4 text-primary mt-0.5" />
                              <span className="leading-snug">{selectedClient.address || t('common.no_address')}</span>
                           </div>
                        </div>
                        <div className="flex flex-col gap-1.5">
                           <span className="text-[10px] font-black uppercase tracking-widest text-base-content/20">{t('clients.fields.type')}</span>
                           <div className="text-sm font-black flex items-center gap-2">
                              <Activity className="w-4 h-4 text-secondary" />
                              {selectedClient.client_type}
                           </div>
                        </div>
                     </div>
                  </div>

                  {/* Finance/Loyalty Card */}
                  <div className="card bg-base-100 border border-base-200 rounded-3xl shadow-sm overflow-hidden">
                     <div className="p-4 bg-base-50/50 border-b border-base-200 flex items-center gap-2">
                        <div className="p-1.5 bg-secondary/10 text-secondary rounded-lg"><ShieldCheck className="w-4 h-4" /></div>
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-base-content/40">{t('clients.sections.programs')}</h3>
                     </div>
                     <div className="p-6 grid grid-cols-2 gap-4">
                        <div className="p-4 bg-secondary/5 border border-secondary/10 rounded-2xl flex flex-col gap-1">
                           <span className="text-[9px] font-black uppercase tracking-widest text-secondary/40">Fidélité</span>
                           <div className="text-xl font-black text-secondary">0 pts</div>
                        </div>
                        <div className="p-4 bg-primary/5 border border-primary/10 rounded-2xl flex flex-col gap-1">
                           <span className="text-[9px] font-black uppercase tracking-widest text-primary/40">Remise</span>
                           <div className="text-xl font-black text-primary">{selectedClient.remise_automatique || 0}%</div>
                        </div>
                        {selectedClient.client_type === 'PROFESSIONNEL' && (
                          <div className="col-span-2 p-4 bg-warning/5 border border-warning/10 rounded-2xl flex justify-between items-center">
                             <div>
                                <span className="text-[9px] font-black uppercase tracking-widest text-warning/40">Dette Actuelle / Plafond</span>
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
                          <h3 className="text-[10px] font-black uppercase tracking-widest text-base-content/40">Bénéficiaires (Ayants Droit)</h3>
                       </div>
                       <div className="overflow-x-auto">
                          <table className="table table-xs w-full">
                             <thead className="bg-base-50">
                                <tr>
                                   <th className="py-3 px-6 text-[9px] uppercase font-black tracking-widest">Nom Complet</th>
                                   <th className="py-3 px-6 text-[9px] uppercase font-black tracking-widest text-right">Matricule</th>
                                </tr>
                             </thead>
                             <tbody>
                                {selectedClient.ayants_droit && selectedClient.ayants_droit.length > 0 ? (
                                  selectedClient.ayants_droit.map((ad: AyantDroit, idx: number) => (
                                    <tr key={idx} className="hover:bg-base-200/20 border-b border-base-200/50 last:border-0">
                                       <td className="py-4 px-6 text-sm font-black">{ad.nom}</td>
                                       <td className="py-4 px-6 text-sm font-black text-right font-mono text-secondary">{ad.matricule}</td>
                                    </tr>
                                  ))
                                ) : (
                                  <tr><td colSpan={2} className="py-12 text-center text-xs font-black opacity-30 uppercase tracking-widest">{t('clients.beneficiaries.empty')}</td></tr>
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
                <h3 className="text-2xl font-black italic tracking-tighter">Sélectionnez un client</h3>
                <p className="text-sm font-bold mt-2 max-w-sm mx-auto">Consultez les détails financiers, l'historique d'achat et gérez les bénéficiaires en un clic.</p>
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
    </div>
  );
}