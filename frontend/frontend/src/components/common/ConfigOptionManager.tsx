import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { 
  Plus, Pencil, Trash2, 
  Settings, Search, Hash, 
  Type, CheckCircle2, XCircle
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import { useConfirm } from '../../hooks/useConfirm';
import PremiumModal from './PremiumModal';

interface ConfigOption {
  id: number;
  code: string;
  label: string;
  type: string;
  value?: string;
  is_active: boolean;
  order: number;
}

interface ConfigOptionManagerProps {
  type: string;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
}

export default function ConfigOptionManager({ 
  type, 
  title, 
  subtitle,
  icon = <Settings size={20} />
}: ConfigOptionManagerProps) {
  const { t } = useTranslation(['common', 'stock']);
  const confirm = useConfirm();
  const [options, setOptions] = useState<ConfigOption[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOption, setEditingOption] = useState<ConfigOption | null>(null);
  const [formData, setFormData] = useState({ 
    code: '', 
    label: '', 
    value: '', 
    order: 0,
    is_active: true 
  });
  const [searchTerm, setSearchTerm] = useState('');

  const fetchOptions = async () => {
    try {
      setLoading(true);
      const res = await api.get(`configuration-options/?type=${type}`);
      const data = res.data.results || res.data;
      setOptions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(`Error fetching config options:`, err);
      toast.error(t('common:messages.load_error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOptions();
  }, [type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...formData,
      type: type,
      code: formData.code.toUpperCase().replace(/\s+/g, '_')
    };

    try {
      if (editingOption) {
        const { data: updated } = await api.put(`configuration-options/${editingOption.id}/`, payload);
        setOptions(prev => prev.map(o => o.id === updated.id ? updated : o));
        toast.success(t('common:messages.success_save'));
      } else {
        const { data: created } = await api.post('configuration-options/', payload);
        setOptions(prev => [...prev, created].sort((a, b) => a.order - b.order || a.label.localeCompare(b.label)));
        toast.success(t('common:messages.success_save'));
      }
      setIsModalOpen(false);
    } catch (err: any) {
      const errorMsg = err.response?.data?.non_field_errors?.[0] || err.response?.data?.detail || t('common:messages.error_saving');
      toast.error(errorMsg);
    }
  };

  const handleDelete = async (id: number) => {
    const confirmed = await confirm({
      title: t('common:actions.delete'),
      message: t('common:messages.confirm_delete'),
      variant: 'danger'
    });
    if (!confirmed) return;

    try {
      await api.delete(`configuration-options/${id}/`);
      toast.success(t('common:messages.success_delete'));
      setOptions(prev => prev.filter(o => o.id !== id));
    } catch (err) {
      toast.error(t('common:messages.error_deleting'));
    }
  };

  const filteredOptions = options.filter(o => 
    o.label.toLowerCase().includes(searchTerm.toLowerCase()) || 
    o.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full gap-6 animate-in fade-in duration-500">
      
      {/* Header Controls */}
      <div className="bg-base-100 p-6 rounded-3xl shadow-xl border border-base-200">
         <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-4 w-full md:w-auto">
               <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-inner">
                  {icon}
               </div>
               <div>
                  <h2 className="text-2xl font-black tracking-tight">{title}</h2>
                  {subtitle && <p className="text-sm opacity-50 font-medium">{subtitle}</p>}
               </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
               <div className="relative flex-1 md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 opacity-30" />
                  <input 
                    type="text" 
                    placeholder={t('common:actions.search')}
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="input input-bordered w-full pl-10 h-11 bg-base-200/50 border-none rounded-xl focus:ring-2 focus:ring-primary/20 transition-all"
                  />
               </div>
               <button 
                 className="btn btn-primary h-11 rounded-xl shadow-lg shadow-primary/20 gap-2 px-6"
                 onClick={() => {
                   setEditingOption(null);
                   setFormData({ code: '', label: '', value: '', order: 0, is_active: true });
                   setIsModalOpen(true);
                 }}
               >
                 <Plus size={18} />
                 <span className="hidden sm:inline">{t('common:actions.add')}</span>
               </button>
            </div>
         </div>
      </div>

      {/* Grid View */}
      <div className="flex-1 overflow-y-auto">
         {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
               <span className="loading loading-spinner loading-lg text-primary"></span>
               <p className="text-sm font-bold opacity-50">{t('common:loading')}</p>
            </div>
         ) : filteredOptions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 bg-base-100 rounded-3xl border-2 border-dashed border-base-300 opacity-30">
               <Settings size={64} strokeWidth={1} className="mb-4" />
               <p className="text-xl font-black">{searchTerm ? t('common:no_results_found') : t('common:messages.no_data')}</p>
            </div>
         ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
               {filteredOptions.map(option => (
                  <div key={option.id} className={`group bg-base-100 p-5 rounded-3xl shadow-sm border border-base-200 hover:shadow-xl hover:border-primary/30 transition-all duration-300 relative overflow-hidden ${!option.is_active ? 'opacity-60' : ''}`}>
                     {/* Status Badge Background */}
                     <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full blur-3xl opacity-10 transition-colors ${option.is_active ? 'bg-success' : 'bg-error'}`}></div>
                     
                     <div className="flex justify-between items-start mb-4 relative z-10">
                        <div className="flex items-center gap-3">
                           <div className={`p-2 rounded-xl ${option.is_active ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
                              {option.is_active ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                           </div>
                           <div className="badge badge-ghost font-mono text-[10px] uppercase tracking-wider">{option.code}</div>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                           <button 
                             className="btn btn-ghost btn-xs btn-square hover:bg-primary/10 hover:text-primary"
                             onClick={() => {
                               setEditingOption(option);
                               setFormData({ 
                                 code: option.code, 
                                 label: option.label, 
                                 value: option.value || '', 
                                 order: option.order,
                                 is_active: option.is_active 
                               });
                               setIsModalOpen(true);
                             }}
                           >
                             <Pencil size={14} />
                           </button>
                           <button 
                             className="btn btn-ghost btn-xs btn-square hover:bg-error/10 hover:text-error"
                             onClick={() => handleDelete(option.id)}
                           >
                             <Trash2 size={14} />
                           </button>
                        </div>
                     </div>

                     <h3 className="text-lg font-bold mb-1 group-hover:text-primary transition-colors">{option.label}</h3>
                     
                     <div className="flex items-center gap-4 text-xs font-medium opacity-50">
                        <div className="flex items-center gap-1">
                           <Hash size={12} />
                           {t('stock:organisation.category_manager.order_label', { defaultValue: 'Ordre' })}: {option.order}
                        </div>
                        {option.value && (
                           <div className="flex items-center gap-1">
                              <Type size={12} />
                              {option.value}
                           </div>
                        )}
                     </div>
                  </div>
               ))}
            </div>
         )}
      </div>

      {/* MODAL: CREATE/EDIT */}
      <PremiumModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingOption ? t('common:actions.edit') : t('common:actions.add')}
        subtitle={title}
        icon={editingOption ? <Pencil className="size-5" /> : <Plus className="size-5" />}
      >
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
           <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                 <label className="block text-xs font-bold uppercase tracking-wider text-base-content/40 mb-2">{t('stock:organisation.config_option_manager.code_label')}</label>
                 <div className="relative">
                    <input 
                      type="text" 
                      className="input input-bordered w-full h-12 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-mono text-sm uppercase" 
                      value={formData.code}
                      onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})}
                      required
                      placeholder={t('stock:organisation.config_option_manager.code_placeholder')}
                      disabled={!!editingOption}
                    />
                 </div>
              </div>
              <div className="col-span-2 sm:col-span-1">
                 <label className="block text-xs font-bold uppercase tracking-wider text-base-content/40 mb-2">{t('stock:organisation.category_manager.order_label')}</label>
                 <input 
                   type="number" 
                   className="input input-bordered w-full h-12 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" 
                   value={formData.order}
                   onChange={e => setFormData({...formData, order: parseInt(e.target.value)})}
                   required
                 />
              </div>
           </div>

           <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-base-content/40 mb-2">{t('stock:organisation.config_option_manager.label_label')}</label>
              <input 
                type="text" 
                className="input input-bordered w-full h-12 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-medium" 
                value={formData.label}
                onChange={e => setFormData({...formData, label: e.target.value})}
                required
                placeholder={t('stock:organisation.config_option_manager.label_placeholder')}
              />
           </div>

           <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-base-content/40 mb-2">{t('stock:organisation.config_option_manager.value_label')}</label>
              <input 
                type="text" 
                className="input input-bordered w-full h-12 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" 
                value={formData.value}
                onChange={e => setFormData({...formData, value: e.target.value})}
                placeholder={t('stock:organisation.config_option_manager.value_placeholder')}
              />
           </div>

           <div className="form-control">
              <label className="label cursor-pointer justify-start gap-4 p-0">
                 <input 
                   type="checkbox" 
                   className="toggle toggle-primary toggle-sm"
                   checked={formData.is_active}
                   onChange={e => setFormData({...formData, is_active: e.target.checked})}
                 />
                 <span className="label-text font-bold text-base-content/60">{t('stock:organisation.config_option_manager.active_label')}</span>
              </label>
           </div>

           <div className="flex justify-end gap-3 pt-6 border-t border-base-200">
              <button type="button" className="btn btn-ghost rounded-xl px-6" onClick={() => setIsModalOpen(false)}>{t('common:actions.cancel')}</button>
              <button type="submit" className="btn btn-primary rounded-xl px-10 shadow-lg shadow-primary/20 font-bold">
                 {editingOption ? t('stock:organisation.config_option_manager.update_btn') : t('stock:organisation.config_option_manager.save_btn')}
              </button>
           </div>
        </form>
      </PremiumModal>
    </div>
  );
}
