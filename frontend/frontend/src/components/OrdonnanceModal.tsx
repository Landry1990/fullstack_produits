import React, { useState, useEffect } from 'react';
import type { Facture, ProduitModel } from '../types';
import { useTranslation } from 'react-i18next';
import PremiumModal from './common/PremiumModal';

// LigneFacture type for cart items (simplified for compatibility)
interface LigneFacture {
  produit: ProduitModel;
  quantite: number;
  prix_unitaire: string;
  remise_produit: string;
  total_ligne: number;
  lotId?: string | number | null;
  lotText?: string | null;
  lotExpiration?: string | null;
  isPromis?: boolean;
  promisQuantity?: number;
  promisPhone?: string;
}

interface OrdonnanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: OrdonnanceData) => Promise<void>;
  facture?: Facture | null;
  lignes?: LigneFacture[];
  loading?: boolean;
}

export interface OrdonnanceData {
  patient_nom: string;
  prescripteur_nom: string;
  numero_ordre?: string;
  date_prescription?: string;
  lignes: {
    produit_id: number;
    produit_nom: string;
    quantite: number;
    surveillance_category: string;
  }[];
}

const OrdonnanceModal: React.FC<OrdonnanceModalProps> = ({ isOpen, onClose, onSave, facture, lignes, loading }) => {
  const { t } = useTranslation(['prescriptions', 'common']);
  const [formData, setFormData] = useState<OrdonnanceData>({
    patient_nom: '',
    prescripteur_nom: '',
    numero_ordre: '',
    date_prescription: new Date().toISOString().split('T')[0],
    lignes: []
  });

  useEffect(() => {
    if (isOpen) {
      if (facture) {
        setFormData(prev => ({
          ...prev,
          patient_nom: facture.client_name || '',
          lignes: facture.produits
            .filter((p) => {
                const prod = typeof p.produit === 'object' ? p.produit : null;
                if (!prod) return false;
                return prod.requires_prescription || (prod.surveillance_category && prod.surveillance_category !== 'NONE');
            })
            .map((p) => {
              const prod = p.produit as ProduitModel;
              return {
                produit_id: prod.id,
                produit_nom: prod.name,
                quantite: p.quantity,
                surveillance_category: prod.surveillance_category || 'NONE'
              };
            })
        }));
      } else if (lignes) {
        setFormData(prev => ({
          ...prev,
          patient_nom: '',
          lignes: lignes
            .filter(l => l.produit.requires_prescription || (l.produit.surveillance_category && l.produit.surveillance_category !== 'NONE'))
            .map(l => ({
              produit_id: l.produit.id,
              produit_nom: l.produit.name,
              quantite: l.quantite,
              surveillance_category: l.produit.surveillance_category || 'NONE'
            }))
        }));
      }
    }
  }, [isOpen, facture, lignes]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await onSave(formData);
    } catch (err) {
      console.error('onSave threw an error:', err);
      throw err;
    }
  };

  const relevantProducts = formData.lignes;

  return (
    <PremiumModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('modal.title')}
      subtitle={t('modal.description')}
      icon={
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      }
      gradientFrom="primary/10"
      gradientVia="secondary/5"
      gradientTo="primary/10"
      maxWidth="max-w-2xl"
      disableClose={loading}
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-base-content/40 mb-2">{t('modal.patient_name')}</label>
            <input 
              type="text" 
              required
              className="input input-bordered w-full h-12 rounded-xl" 
              value={formData.patient_nom}
              onChange={e => setFormData({...formData, patient_nom: e.target.value})}
              placeholder={t('modal.patient_placeholder')}
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-base-content/40 mb-2">{t('modal.prescriber_name')}</label>
            <input 
              type="text" 
              required
              className="input input-bordered w-full h-12 rounded-xl" 
              value={formData.prescripteur_nom}
              onChange={e => setFormData({...formData, prescripteur_nom: e.target.value})}
              placeholder={t('modal.prescriber_placeholder')}
            />
          </div>

           <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-base-content/40 mb-2">{t('modal.order_number')}</label>
            <input 
              type="text" 
              className="input input-bordered w-full h-12 rounded-xl" 
              value={formData.numero_ordre || ''}
              onChange={e => setFormData({...formData, numero_ordre: e.target.value})}
              placeholder={t('modal.order_placeholder')}
            />
          </div>

           <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-base-content/40 mb-2">{t('modal.prescription_date')}</label>
            <input 
              type="date" 
              className="input input-bordered w-full h-12 rounded-xl" 
              value={formData.date_prescription}
              onChange={e => setFormData({...formData, date_prescription: e.target.value})}
            />
          </div>
        </div>

        <div className="divider text-xs uppercase tracking-wider">{t('modal.affected_products')}</div>

        <div className="bg-base-200 rounded-xl p-2 max-h-40 overflow-y-auto">
           <table className="table table-xs w-full">
              <thead>
                  <tr>
                      <th>{t('modal.product_col')}</th>
                      <th className="text-right">{t('modal.qty_col')}</th>
                      <th>{t('modal.surveillance_col')}</th>
                  </tr>
              </thead>
              <tbody>
                  {relevantProducts.map((ligne, idx) => (
                      <tr key={idx}>
                          <td className="font-medium">{ligne.produit_nom}</td>
                          <td className="text-right">{ligne.quantite}</td>
                          <td>
                              {ligne.surveillance_category === 'RENFORCEE' && <span className="badge badge-error badge-xs">{t('modal.surveillance_renforcee')}</span>}
                              {ligne.surveillance_category === 'STANDARD' && <span className="badge badge-warning badge-xs">{t('modal.surveillance_standard')}</span>}
                              {(!ligne.surveillance_category || ligne.surveillance_category === 'NONE') && <span className="badge badge-ghost badge-xs">{t('modal.surveillance_ordonnance')}</span>}
                          </td>
                      </tr>
                  ))}
              </tbody>
           </table>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn btn-ghost px-6 rounded-xl text-xs" onClick={onClose}>{t('modal.ignore_btn')}</button>
          <button type="submit" className="btn btn-primary px-8 rounded-xl shadow-lg shadow-primary/20" disabled={loading}>
            {loading ? <span className="loading loading-spinner"></span> : t('modal.save_btn')}
          </button>
        </div>
      </form>
    </PremiumModal>
  );
};

export default OrdonnanceModal;

