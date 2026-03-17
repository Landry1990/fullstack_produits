import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  X, 
  Plus, 
  Trash2,
  Save,
  User
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
  const [tempAyantDroit, setTempAyantDroit] = useState<AyantDroit>({ matricule: '', nom: '' });

  if (!isOpen) return null;

  const handleAddAyantDroit = () => {
    if (!tempAyantDroit.matricule || !tempAyantDroit.nom) return;
    setData({
      ...data,
      ayants_droit: [...(data.ayants_droit || []), { ...tempAyantDroit }]
    });
    setTempAyantDroit({ matricule: '', nom: '' });
  };

  const handleRemoveAyantDroit = (index: number) => {
    const updated = [...(data.ayants_droit || [])];
    updated.splice(index, 1);
    setData({ ...data, ayants_droit: updated });
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-4xl p-0 overflow-hidden rounded-3xl border border-base-200 shadow-2xl bg-base-100 flex flex-col h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-base-200 bg-base-50/50 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-primary/10 text-primary rounded-xl">
                <User className="w-6 h-6" />
             </div>
             <div>
               <h3 className="text-xl font-black tracking-tight">{isEdit ? t('clients:actions.edit') : t('clients:actions.create')}</h3>
               <p className="text-xs font-semibold text-base-content/40 uppercase tracking-widest">{t('clients:sections.general_info')}</p>
             </div>
          </div>
          <button onClick={onClose} className="btn btn-sm btn-circle btn-ghost"><X className="w-5 h-5"/></button>
        </div>

        {/* Form Body */}
        <form onSubmit={onSubmit} className="flex-1 overflow-y-auto p-8 space-y-8">
            {/* General Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="form-control">
                  <label className="label py-1"><span className="label-text text-[10px] uppercase font-black tracking-widest text-base-content/40">{t('common:name')}*</span></label>
                  <input 
                    className="input input-bordered input-md rounded-xl font-bold transition-all focus:ring-2 focus:ring-primary/20" 
                    value={data.name || ''} 
                    onChange={e => setData({...data, name: e.target.value})} 
                    required 
                  />
                </div>
                <div className="form-control">
                  <label className="label py-1"><span className="label-text text-[10px] uppercase font-black tracking-widest text-base-content/40">{t('common:phone')}</span></label>
                  <input 
                    className="input input-bordered input-md rounded-xl font-mono font-black" 
                    value={data.phone || ''} 
                    onChange={e => setData({...data, phone: e.target.value})} 
                  />
                </div>
                <div className="form-control">
                  <label className="label py-1"><span className="label-text text-[10px] uppercase font-black tracking-widest text-base-content/40">{t('common:email')}</span></label>
                  <input 
                    type="email" 
                    className="input input-bordered input-md rounded-xl font-bold" 
                    value={data.email || ''} 
                    onChange={e => setData({...data, email: e.target.value})} 
                  />
                </div>
                <div className="form-control">
                  <label className="label py-1"><span className="label-text text-[10px] uppercase font-black tracking-widest text-base-content/40">{t('clients:fields.type')}</span></label>
                  <select 
                    className="select select-bordered select-md rounded-xl font-black"
                    value={data.client_type || 'PARTICULIER'}
                    onChange={e => setData({...data, client_type: e.target.value as any})}
                  >
                    <option value="PARTICULIER">{t('clients:types.individual')}</option>
                    <option value="PROFESSIONNEL">{t('clients:types.professional')}</option>
                  </select>
                </div>
                <div className="form-control md:col-span-2">
                  <label className="label py-1"><span className="label-text text-[10px] uppercase font-black tracking-widest text-base-content/40">{t('clients:fields.address')}</span></label>
                  <textarea 
                    className="textarea textarea-bordered rounded-xl h-20 font-bold" 
                    value={data.address || ''} 
                    onChange={e => setData({...data, address: e.target.value})} 
                  />
                </div>
            </div>

            <div className="divider opacity-50"></div>

            {/* Financial Info (for Pros and Individuals with special discounts) */}
            <div className="space-y-6">
                <h4 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-base-content/40">
                   {t('clients:sections.finance')}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="form-control">
                      <label className="label py-1"><span className="label-text text-[10px] uppercase font-black tracking-widest text-base-content/40">{t('clients:finance.auto_discount')} {t('clients:units.percent')}</span></label>
                      <input 
                        type="number" 
                        className="input input-bordered input-md rounded-xl font-bold" 
                        value={data.remise_automatique || '0'} 
                        onChange={e => setData({...data, remise_automatique: e.target.value})} 
                      />
                    </div>
                    {data.client_type === 'PROFESSIONNEL' && (
                        <>
                            <div className="form-control">
                              <label className="label py-1"><span className="label-text text-[10px] uppercase font-black tracking-widest text-base-content/40">{t('clients:finance.credit_limit')}</span></label>
                              <input 
                                type="number" 
                                className="input input-bordered input-md rounded-xl font-black text-secondary" 
                                value={data.plafond || '0'} 
                                onChange={e => setData({...data, plafond: e.target.value})} 
                              />
                            </div>
                            <div className="form-control">
                              <label className="label py-1"><span className="label-text text-[10px] uppercase font-black tracking-widest text-base-content/40">{t('clients:finance.coverage')} {t('clients:units.percent')}</span></label>
                              <input 
                                type="number" 
                                className="input input-bordered input-md rounded-xl font-bold text-info" 
                                value={data.taux_couverture || '0'} 
                                onChange={e => setData({...data, taux_couverture: e.target.value})} 
                              />
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Ayants Droit Section (only for Professionals) */}
            {data.client_type === 'PROFESSIONNEL' && (
               <div className="space-y-6 pt-4 animate-in fade-in slide-in-from-top-4 duration-300">
                  <h4 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-base-content/40">
                    {t('clients:beneficiaries.title')}
                  </h4>
                  
                  <div className="bg-base-200/50 p-6 rounded-3xl border border-base-300/30 space-y-4">
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
                        <div className="lg:col-span-2">
                           <label className="label pt-0"><span className="label-text text-[10px] uppercase font-black tracking-widest text-base-content/40">{t('common:name')}</span></label>
                           <input 
                              className="input input-bordered input-sm w-full h-11 rounded-xl font-bold" 
                              placeholder={t('clients:beneficiaries.name_placeholder')}
                              value={tempAyantDroit.nom}
                              onChange={e => setTempAyantDroit({...tempAyantDroit, nom: e.target.value})}
                           />
                        </div>
                        <div className="lg:col-span-2">
                           <label className="label pt-0"><span className="label-text text-[10px] uppercase font-black tracking-widest text-base-content/40">{t('clients:beneficiaries.col_id')}</span></label>
                           <input 
                              className="input input-bordered input-sm w-full h-11 rounded-xl font-mono font-black" 
                              placeholder={t('clients:beneficiaries.id_placeholder')}
                              value={tempAyantDroit.matricule}
                              onChange={e => setTempAyantDroit({...tempAyantDroit, matricule: e.target.value})}
                           />
                        </div>
                        <button 
                           type="button" 
                           onClick={handleAddAyantDroit} 
                           className="btn btn-primary btn-sm h-11 rounded-xl gap-2 font-black"
                           disabled={!tempAyantDroit.nom || !tempAyantDroit.matricule}
                        >
                           <Plus className="w-4 h-4" />
                           {t('common:add')}
                        </button>
                     </div>

                     {data.ayants_droit && data.ayants_droit.length > 0 && (
                        <div className="mt-4 border border-base-200 rounded-2xl overflow-hidden bg-base-100 shadow-sm">
                           <table className="table table-xs w-full">
                              <thead className="bg-base-200/50">
                                 <tr>
                                    <th className="py-3 px-4 text-[9px] uppercase font-black tracking-widest">{t('common:name')}</th>
                                    <th className="py-3 px-4 text-[9px] uppercase font-black tracking-widest text-right">{t('clients:beneficiaries.col_id')}</th>
                                    <th className="py-3 px-4 w-10"></th>
                                 </tr>
                              </thead>
                              <tbody>
                                 {data.ayants_droit.map((ad: AyantDroit, idx: number) => (
                                    <tr key={idx} className="hover:bg-base-200/20 border-b border-base-100 last:border-0">
                                       <td className="py-3 px-4 font-black">{ad.nom}</td>
                                       <td className="py-3 px-4 text-right font-mono font-black text-secondary">{ad.matricule}</td>
                                       <td className="py-2 px-4 text-right">
                                          <button 
                                             type="button" 
                                             onClick={() => handleRemoveAyantDroit(idx)}
                                             className="btn btn-ghost btn-xs btn-square text-error/40 hover:text-error hover:bg-error/10"
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
               </div>
            )}
        </form>

        {/* Footer */}
        <div className="p-6 border-t border-base-200 bg-base-100 flex justify-end gap-3 shrink-0">
          <button type="button" onClick={onClose} className="btn btn-ghost rounded-xl px-6 font-bold">{t('common:cancel')}</button>
          <button 
            type="submit" 
            onClick={(e) => { e.preventDefault(); onSubmit(e as any); }}
            className="btn btn-primary rounded-xl px-10 gap-2 shadow-lg shadow-primary/20 font-black h-12"
            disabled={isSubmitting}
          >
            {isSubmitting ? <span className="loading loading-spinner loading-sm"></span> : <Save className="w-5 h-5" />}
            {isEdit ? t('common:save_changes') : t('common:add')}
          </button>
        </div>
      </div>
    </div>
  );
}

