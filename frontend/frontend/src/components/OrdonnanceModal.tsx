import React, { useState, useEffect } from 'react';
import type { Facture, ProduitModel } from '../types';

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
  facture?: Facture | null; // Made optional
  lignes?: LigneFacture[]; // Added for cart data
  loading?: boolean;
}

export interface OrdonnanceData {
  patient_nom: string;
  prescripteur_nom: string;
  numero_ordre?: string; // Pour référence externe si besoin
  date_prescription?: string;
  lignes: {
    produit_id: number;
    produit_nom: string;
    quantite: number;
    surveillance_category: string;
  }[];
}

const OrdonnanceModal: React.FC<OrdonnanceModalProps> = ({ isOpen, onClose, onSave, facture, lignes, loading }) => {
  const [formData, setFormData] = useState<OrdonnanceData>({
    patient_nom: '',
    prescripteur_nom: '',
    numero_ordre: '',
    date_prescription: new Date().toISOString().split('T')[0],
    lignes: []
  });

  useEffect(() => {
    if (isOpen) {
      // Use facture data if available, otherwise use lignes from cart
      if (facture) {
        setFormData(prev => ({
          ...prev,
          patient_nom: facture.client_name || '',
          lignes: facture.produits
            .filter((p: any) => {
                const prod = p.produit as ProduitModel;
                return prod.requires_prescription || (prod.surveillance_category && prod.surveillance_category !== 'NONE');
            })
            .map((p: any) => ({
              produit_id: p.produit.id,
              produit_nom: p.produit.name,
              quantite: p.quantity,
              surveillance_category: p.produit.surveillance_category || 'NONE'
            }))
        }));
      } else if (lignes) {
        // Use cart data (lignes)
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

  if (!isOpen) return null;

  const relevantProducts = formData.lignes;

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-2xl">
        <h3 className="font-bold text-lg text-primary flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Saisie Ordonnancier
        </h3>
        
        <p className="py-2 text-sm text-base-content/70">
          Cette vente contient des produits nécessitant une ordonnance ou sous surveillance.
          Veuillez renseigner les informations ci-dessous.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Nom du Patient *</span>
              </label>
              <input 
                type="text" 
                required
                className="input input-bordered w-full" 
                value={formData.patient_nom}
                onChange={e => setFormData({...formData, patient_nom: e.target.value})}
                placeholder="Nom complet du patient"
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Prescripteur (Médecin) *</span>
              </label>
              <input 
                type="text" 
                required
                className="input input-bordered w-full" 
                value={formData.prescripteur_nom}
                onChange={e => setFormData({...formData, prescripteur_nom: e.target.value})}
                placeholder="Dr. Nom du médecin"
              />
            </div>

             <div className="form-control">
              <label className="label">
                <span className="label-text">Numéro d'Ordonnance (facultatif)</span>
              </label>
              <input 
                type="text" 
                className="input input-bordered w-full" 
                value={formData.numero_ordre || ''}
                onChange={e => setFormData({...formData, numero_ordre: e.target.value})}
                placeholder="Ex: ORD-2024-001"
              />
            </div>

             <div className="form-control">
              <label className="label">
                <span className="label-text">Date Prescription</span>
              </label>
              <input 
                type="date" 
                className="input input-bordered w-full" 
                value={formData.date_prescription}
                onChange={e => setFormData({...formData, date_prescription: e.target.value})}
              />
            </div>
          </div>

          <div className="divider text-xs">Produits Concernés</div>

          <div className="bg-base-200 rounded-lg p-2 max-h-40 overflow-y-auto">
             <table className="table table-xs w-full">
                <thead>
                    <tr>
                        <th>Produit</th>
                        <th className="text-right">Qté</th>
                        <th>Surveillance</th>
                    </tr>
                </thead>
                <tbody>
                    {relevantProducts.map((ligne, idx) => (
                        <tr key={idx}>
                            <td className="font-medium">{ligne.produit_nom}</td>
                            <td className="text-right">{ligne.quantite}</td>
                            <td>
                                {ligne.surveillance_category === 'RENFORCEE' && <span className="badge badge-error badge-xs">Renforcée</span>}
                                {ligne.surveillance_category === 'STANDARD' && <span className="badge badge-warning badge-xs">Standard</span>}
                                {(!ligne.surveillance_category || ligne.surveillance_category === 'NONE') && <span className="badge badge-ghost badge-xs">Ordonnance</span>}
                            </td>
                        </tr>
                    ))}
                </tbody>
             </table>
          </div>

          <div className="modal-action">
            {/* On ne permet pas d'annuler facilement car c'est obligatoire légalement, mais on met un bouton 'Plus tard' si besoin de débloquer la caisse */}
            <button type="button" className="btn btn-ghost text-xs" onClick={onClose}>Ignorer (Déconseillé)</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="loading loading-spinner"></span> : 'Enregistrer Ordonnancier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OrdonnanceModal;
