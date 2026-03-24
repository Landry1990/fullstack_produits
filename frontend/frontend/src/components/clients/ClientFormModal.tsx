import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  X, 
  Plus, 
  Trash2,
  Save,
  User,
  Award,
  Activity,
  Mail,
  Phone,
  MapPin,
  ShieldCheck,
  CreditCard
} from 'lucide-react';
import type { Client, AyantDroit } from '../../types';

interface ClientFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  data: Partial<Client>;
  setData: (data: any) => void;
  isSubmitting: boolean;
  isEdit?: boolean;
}

export default function ClientFormModal({ 
  isOpen, 
  onClose, 
  onSubmit, 
  data, 
  setData, 
  isSubmitting, 
  isEdit = false 
}: ClientFormModalProps) {
  const { t } = useTranslation(['clients', 'common']);
  const [tempAyantDroit, setTempAyantDroit] = useState<AyantDroit>({ matricule: '', nom: '', societe: '' });

  if (!isOpen) return null;

  const handleAddAyantDroit = () => {
    if (!tempAyantDroit.matricule || !tempAyantDroit.nom) return;
    setData({
      ...data,
      ayants_droit: [...(data.ayants_droit || []), { ...tempAyantDroit }]
    });
    setTempAyantDroit({ matricule: '', nom: '', societe: '' });
  };

  const handleRemoveAyantDroit = (index: number) => {
    const updated = [...(data.ayants_droit || [])];
    updated.splice(index, 1);
    setData({ ...data, ayants_droit: updated });
  };

  return (
    <div className="modal modal-open bg-base-300/40 backdrop-blur-sm transition-all duration-300">
      <div className="modal-box max-w-5xl p-0 overflow-hidden rounded-[1.5rem] border border-white/10 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.2)] bg-base-100/95 backdrop-blur-xl flex flex-col h-auto max-h-[95vh] transition-all duration-500 scale-100 animate-in zoom-in-95">
        
        {/* Header - More compact */}
        <div className="px-6 py-4 border-b border-base-200/50 bg-gradient-to-r from-primary/5 via-transparent to-secondary/5 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
             <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-lg rounded-full"></div>
                <div className="relative p-2.5 bg-gradient-to-br from-primary to-primary-focus text-white rounded-xl shadow-lg shadow-primary/20 text-sm">
                    <User className="w-5 h-5" />
                </div>
             </div>
             <div>
               <h3 className="text-lg font-black tracking-tight leading-tight">
                 {isEdit ? t('clients:actions.edit') : t('clients:actions.create')}
               </h3>
               <div className="flex items-center gap-2 mt-0.5">
                 <span className="px-1.5 py-0.5 bg-base-200 text-[9px] font-black uppercase tracking-widest rounded text-base-content/40 border border-base-300/50">
                    ID: {data.id || 'NEW'}
                 </span>
                 <p className="text-[10px] font-bold text-primary/60 uppercase tracking-widest">{t('clients:sections.general_info')}</p>
               </div>
             </div>
          </div>
          <button 
            onClick={onClose} 
            className="btn btn-sm btn-circle btn-ghost hover:bg-error/10 hover:text-error transition-all"
          >
            <X className="w-5 h-5"/>
          </button>
        </div>

        {/* Form Body - More compact spacing */}
        <form 
          onSubmit={onSubmit} 
          className="flex-1 overflow-y-auto px-6 py-6 space-y-6 scrollbar-thin scrollbar-thumb-base-300 scrollbar-track-transparent"
        >
            {/* Main Info Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-base-200/20 p-5 rounded-[1.25rem] border border-base-200/50 relative overflow-hidden">
                <div className="form-control">
                    <label className="label py-1">
                    <span className="label-text text-[9px] uppercase font-black tracking-widest text-base-content/40 flex items-center gap-1.5">
                        <User className="w-3 h-3" /> {t('common:name')}*
                    </span>
                    </label>
                    <input 
                    className="input input-bordered input-md rounded-xl font-bold bg-base-100 border-base-300 focus:border-primary shadow-sm" 
                    value={data.name || ''} 
                    onChange={e => setData({...data, name: e.target.value})} 
                    required 
                    placeholder="Nom complet"
                    />
                </div>

                <div className="form-control text-sm">
                    <label className="label py-1">
                    <span className="label-text text-[9px] uppercase font-black tracking-widest text-base-content/40 flex items-center gap-1.5">
                        <Phone className="w-3 h-3" /> {t('common:phone')}
                    </span>
                    </label>
                    <input 
                    className="input input-bordered input-md rounded-xl font-mono font-black bg-base-100 border-base-300 focus:border-primary shadow-sm" 
                    value={data.phone || ''} 
                    onChange={e => setData({...data, phone: e.target.value})} 
                    placeholder="+225..."
                    />
                </div>

                <div className="form-control">
                    <label className="label py-1">
                    <span className="label-text text-[9px] uppercase font-black tracking-widest text-base-content/40 flex items-center gap-1.5">
                        <Mail className="w-3 h-3" /> {t('common:email')}
                    </span>
                    </label>
                    <input 
                    type="email" 
                    className="input input-bordered input-md rounded-xl font-bold bg-base-100 border-base-300 focus:border-primary shadow-sm" 
                    value={data.email || ''} 
                    onChange={e => setData({...data, email: e.target.value})} 
                    placeholder="email@exemple.com"
                    />
                </div>

                <div className="form-control">
                    <label className="label py-1">
                    <span className="label-text text-[9px] uppercase font-black tracking-widest text-base-content/40 flex items-center gap-1.5">
                        <ShieldCheck className="w-3 h-3" /> {t('clients:fields.type')}
                    </span>
                    </label>
                    <select 
                    className="select select-bordered select-md rounded-xl font-black bg-base-100 border-base-300 focus:border-primary shadow-sm"
                    value={data.client_type || 'PARTICULIER'}
                    onChange={e => setData({...data, client_type: e.target.value as any})}
                    >
                    <option value="PARTICULIER">👤 {t('clients:types.individual')}</option>
                    <option value="PROFESSIONNEL">🏢 {t('clients:types.professional')}</option>
                    </select>
                </div>

                <div className="form-control md:col-span-2">
                    <label className="label py-1">
                    <span className="label-text text-[9px] uppercase font-black tracking-widest text-base-content/40 flex items-center gap-1.5">
                        <MapPin className="w-3 h-3" /> {t('clients:fields.address')}
                    </span>
                    </label>
                    <input 
                    className="input input-bordered input-md rounded-xl font-bold bg-base-100 border-base-300 focus:border-primary shadow-sm" 
                    value={data.address || ''} 
                    onChange={e => setData({...data, address: e.target.value})} 
                    placeholder="Quartier, Rue, Porte..."
                    />
                </div>
            </div>

            {/* Status & Fidelity Grid - Compact Switches */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="group bg-base-200/30 p-4 rounded-[1.25rem] border border-base-200/60 hover:border-primary/30 transition-all flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl transition-all ${data.is_active !== false ? 'bg-success/10 text-success' : 'bg-base-300 text-base-content/30'}`}>
                           <Activity className="w-5 h-5" />
                        </div>
                        <div>
                            <span className="block font-black text-xs">{t('common:is_active')}</span>
                            <p className="text-[9px] text-base-content/40 font-bold uppercase">{t('clients:hints.is_active')}</p>
                        </div>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={data.is_active ?? true} 
                      onChange={e => setData({...data, is_active: e.target.checked})}
                      className="toggle toggle-success toggle-sm" 
                    />
               </div>

               <div className="group bg-base-200/30 p-4 rounded-[1.25rem] border border-base-200/60 hover:border-secondary/30 transition-all flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl transition-all ${data.is_loyalty_member ?? true ? 'bg-secondary/10 text-secondary' : 'bg-base-300 text-base-content/30'}`}>
                           <Award className="w-5 h-5" />
                        </div>
                        <div>
                            <span className="block font-black text-xs">{t('clients:fields.loyalty_member')}</span>
                            <p className="text-[9px] text-base-content/40 font-bold uppercase">{t('clients:hints.loyalty_member')}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        {data.is_loyalty_member !== false && (
                            <div className="flex items-center gap-2 px-4 py-2 bg-secondary/15 text-secondary rounded-2xl border border-secondary/30 shadow-sm animate-in fade-in zoom-in duration-300">
                                <Award className="w-5 h-5" />
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black uppercase leading-none opacity-70">Points</span>
                                    <span className="text-lg font-black leading-tight">
                                        {data.points_fidelite || 0}
                                    </span>
                                </div>
                            </div>
                        )}
                        <input 
                          type="checkbox" 
                          checked={data.is_loyalty_member ?? true} 
                          onChange={e => setData({...data, is_loyalty_member: e.target.checked})}
                          className="toggle toggle-secondary toggle-md" 
                        />
                    </div>
               </div>

               {data.client_type === 'PARTICULIER' && (
                 <div className="group bg-base-200/30 p-4 rounded-[1.25rem] border border-base-200/60 hover:border-primary/30 transition-all flex items-center justify-between">
                      <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-xl transition-all ${data.is_deposit_enabled ? 'bg-primary/10 text-primary' : 'bg-base-300 text-base-content/30'}`}>
                             <CreditCard className="w-5 h-5" />
                          </div>
                          <div>
                              <span className="block font-black text-xs">{t('clients:fields.is_deposit_enabled')}</span>
                              <p className="text-[9px] text-base-content/40 font-bold uppercase">{t('clients:hints.is_deposit_enabled')}</p>
                          </div>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={data.is_deposit_enabled ?? false} 
                        onChange={e => setData({...data, is_deposit_enabled: e.target.checked})}
                        className="toggle toggle-primary toggle-md" 
                      />
                 </div>
               )}
            </div>

            {/* Financial Conditions Section - More compact */}
            <div className="p-5 bg-base-200/20 rounded-[1.25rem] border border-base-200/50 space-y-4">
                <div className="flex items-center gap-3">
                   <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-base-content/30 flex items-center gap-2">
                     <span className="w-2 h-2 rounded-full bg-primary/30"></span>
                     {t('clients:sections.finance')}
                   </h4>
                   <div className="h-px flex-1 bg-base-300/50"></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="form-control">
                      <label className="label py-1"><span className="label-text text-[9px] font-black text-base-content/40 uppercase">{t('clients:finance.auto_discount')} (%)</span></label>
                      <input 
                        type="number" 
                        className="input input-bordered input-md rounded-xl font-black bg-base-100 h-10" 
                        value={data.remise_automatique || '0'} 
                        onChange={e => setData({...data, remise_automatique: e.target.value})} 
                      />
                    </div>

                    {data.client_type === 'PROFESSIONNEL' && (
                        <>
                            <div className="form-control">
                              <label className="label py-1"><span className="label-text text-[9px] font-black text-base-content/40 uppercase">{t('clients:finance.credit_limit')}</span></label>
                              <input 
                                type="number" 
                                className="input input-bordered input-md rounded-xl font-black text-secondary bg-base-100 h-10" 
                                value={data.plafond || '0'} 
                                onChange={e => setData({...data, plafond: e.target.value})} 
                              />
                            </div>
                            <div className="form-control">
                              <label className="label py-1"><span className="label-text text-[9px] font-black text-base-content/40 uppercase">{t('clients:finance.coverage')} (%)</span></label>
                              <input 
                                type="number" 
                                className="input input-bordered input-md rounded-xl font-black text-info bg-base-100 h-10" 
                                value={data.taux_couverture || '0'} 
                                onChange={e => setData({...data, taux_couverture: e.target.value})} 
                              />
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Ayants Droit Section - Data grid style but compact */}
            {data.client_type === 'PROFESSIONNEL' && (
               <div className="p-5 bg-base-200/20 rounded-[1.25rem] border border-base-200/50 space-y-4">
                  <div className="flex items-center gap-3">
                     <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-base-content/30 flex items-center gap-2">
                       <span className="w-2 h-2 rounded-full bg-secondary/30"></span>
                       {t('clients:beneficiaries.title')}
                     </h4>
                     <div className="h-px flex-1 bg-base-300/50"></div>
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-10 gap-3 items-end">
                    <div className="lg:col-span-3 form-control">
                        <input 
                            className="input input-bordered input-sm rounded-lg font-bold bg-base-100 focus:border-primary h-9" 
                            placeholder={t('clients:beneficiaries.name_placeholder')}
                            value={tempAyantDroit.nom}
                            onChange={e => setTempAyantDroit({...tempAyantDroit, nom: e.target.value})}
                        />
                    </div>
                    <div className="lg:col-span-3 form-control">
                        <input 
                            className="input input-bordered input-sm rounded-lg font-mono font-black bg-base-100 focus:border-primary h-9" 
                            placeholder={t('clients:beneficiaries.id_placeholder')}
                            value={tempAyantDroit.matricule}
                            onChange={e => setTempAyantDroit({...tempAyantDroit, matricule: e.target.value})}
                        />
                    </div>
                    <div className="lg:col-span-3 form-control">
                        <input 
                            className="input input-bordered input-sm rounded-lg font-bold bg-base-100 focus:border-primary h-9" 
                            placeholder="Société"
                            value={tempAyantDroit.societe || ''}
                            onChange={e => setTempAyantDroit({...tempAyantDroit, societe: e.target.value})}
                        />
                    </div>
                    <button 
                        type="button" 
                        onClick={handleAddAyantDroit} 
                        className="btn btn-primary btn-sm lg:col-span-1 rounded-lg h-9"
                        disabled={!tempAyantDroit.nom || !tempAyantDroit.matricule}
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {data.ayants_droit && data.ayants_droit.length > 0 && (
                    <div className="rounded-xl overflow-hidden border border-base-300/50 bg-base-100/50 backdrop-blur-sm mt-3">
                        <table className="table table-xs w-full">
                            <thead className="bg-base-200/50">
                                <tr>
                                    <th className="py-2 px-4 text-[8px] font-black text-base-content/40 uppercase">{t('common:name')}</th>
                                    <th className="py-2 px-4 text-[8px] font-black text-base-content/40 uppercase">{t('clients:beneficiaries.col_id')}</th>
                                    <th className="py-2 px-4 text-[8px] font-black text-base-content/40 uppercase">{t('clients:beneficiaries.company')}</th>
                                    <th className="py-2 w-8"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-base-200/30">
                                {data.ayants_droit.map((ad: AyantDroit, idx: number) => (
                                <tr key={idx} className="hover:bg-primary/5 transition-colors group/row">
                                    <td className="py-2 px-4 font-black text-xs">{ad.nom}</td>
                                    <td className="py-2 px-4 font-mono font-black text-xs opacity-60 group-hover/row:opacity-100">{ad.matricule}</td>
                                    <td className="py-2 px-4 font-bold text-xs text-base-content/60">{ad.societe || '—'}</td>
                                    <td className="py-2 text-right">
                                        <button 
                                            type="button" 
                                            onClick={() => handleRemoveAyantDroit(idx)}
                                            className="p-1.5 text-error/30 hover:text-error hover:bg-error/10 rounded-lg transition-all"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </td>
                                </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                  )}
               </div>
            )}
        </form>

        {/* Footer - Consistent with compact style */}
        <div className="px-6 py-4 border-t border-base-200/50 bg-base-50/50 flex justify-end items-center gap-4 shrink-0">
          <button 
            type="button" 
            onClick={onClose} 
            className="btn btn-ghost btn-md rounded-xl px-6 font-black uppercase text-[10px] tracking-widest"
          >
            {t('common:cancel')}
          </button>
          
          <button 
            type="submit" 
            onClick={(e) => { e.preventDefault(); onSubmit(e as any); }}
            className={`btn btn-primary btn-md rounded-xl px-8 gap-2 shadow-lg shadow-primary/20 font-black tracking-widest text-[10px] uppercase ${isSubmitting ? 'loading' : ''}`}
            disabled={isSubmitting}
          >
            {!isSubmitting && <Save className="w-4 h-4" />}
            {isEdit ? t('common:save_changes') : t('common:add')}
          </button>
        </div>
      </div>
    </div>
  );
}

