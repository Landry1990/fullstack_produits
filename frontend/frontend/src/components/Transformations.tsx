import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';

// Interfaces
interface Produit {
  id: number;
  name: string;
  stock: number;
  cip1: string;
}

interface RelationTransformation {
  id: number;
  produit_source: number;
  produit_source_nom: string;
  produit_destination: number;
  produit_destination_nom: string;
  ratio: number;
  actif: boolean;
}

interface HistoriqueTransformation {
  id: number;
  produit_source_nom: string;
  produit_destination_nom: string;
  quantite_source: number;
  quantite_destination: number;
  user_nom: string;
  date_transformation: string;
  notes: string;
}

const Transformations: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'relations' | 'historique'>('relations');
  const [relations, setRelations] = useState<RelationTransformation[]>([]);
  const [historique, setHistorique] = useState<HistoriqueTransformation[]>([]);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isRelationModalOpen, setIsRelationModalOpen] = useState(false);
  const [isTransformerModalOpen, setIsTransformerModalOpen] = useState(false);
  
  // Forms
  const [newRelation, setNewRelation] = useState({
    produit_source: '',
    produit_destination: '',
    ratio: ''
  });
  
  const [transformationData, setTransformationData] = useState({
    relation: null as RelationTransformation | null,
    quantite: 1,
    notes: ''
  });

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
    fetchProduits();
  }, []);

  // ... (existing code)

  const handleTransformer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transformationData.relation) return;
    
    setSubmitting(true);
    try {
      const res = await axios.post(`http://localhost:8000/api/relations-transformation/${transformationData.relation.id}/transformer/`, {
        quantite: transformationData.quantite,
        notes: transformationData.notes
      });
      
      if (res.data.success) {
        toast.success(res.data.message);
        setIsTransformerModalOpen(false);
        fetchData(); 
        // On NE remet PAS submitting à false ici pour éviter le re-clic pendant la fermeture
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Erreur lors de la transformation");
      setSubmitting(false); // On réactive seulement en cas d'erreur
    }
  };

  // ... (existing UI code)

              <div className="modal-action">
                <button type="button" className="btn" onClick={() => setIsTransformerModalOpen(false)} disabled={submitting}>Annuler</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? <span className="loading loading-spinner text-white"></span> : 'Confirmer Transformation'}
                </button>
              </div>

  const fetchData = async () => {
    try {
      const [relationsRes, historiqueRes] = await Promise.all([
        axios.get('http://localhost:8000/api/relations-transformation/'),
        axios.get('http://localhost:8000/api/historique-transformation/')
      ]);
      
      // Gestion de la pagination DRF (results) ou liste directe
      const relationsData = Array.isArray(relationsRes.data) ? relationsRes.data : (relationsRes.data.results || []);
      const historiqueData = Array.isArray(historiqueRes.data) ? historiqueRes.data : (historiqueRes.data.results || []);

      setRelations(relationsData);
      setHistorique(historiqueData);
      setLoading(false);
    } catch (error) {
      console.error("Erreur fetch:", error);
      toast.error("Erreur lors du chargement des données");
      setLoading(false);
    }
  };

  const fetchProduits = async () => {
    try {
      const res = await axios.get('http://localhost:8000/api/produits/');
      // Gestion pagination
      const produitsData = Array.isArray(res.data) ? res.data : (res.data.results || []);
      setProduits(produitsData);
    } catch (error) {
      console.error("Erreur chargement produits", error);
    }
  };

  const handleCreateRelation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:8000/api/relations-transformation/', {
        produit_source: parseInt(newRelation.produit_source),
        produit_destination: parseInt(newRelation.produit_destination),
        ratio: parseFloat(newRelation.ratio)
      });
      toast.success("Relation créée avec succès");
      setIsRelationModalOpen(false);
      setNewRelation({ produit_source: '', produit_destination: '', ratio: '' });
      fetchData();
    } catch (error: any) {
      console.error(error);
      const errorMsg = error.response?.data?.non_field_errors?.[0] 
        || error.response?.data?.error 
        || error.response?.data?.detail
        || "Erreur lors de la création de la relation";
      
      if (typeof error.response?.data === 'object') {
         // Handle field specific errors if any
         const firstError = Object.values(error.response.data)[0];
         if (Array.isArray(firstError)) {
             toast.error(`${Object.keys(error.response.data)[0]}: ${firstError[0]}`);
             return;
         }
      }
      
      toast.error(errorMsg);
    }
  };

  const handleDeleteRelation = async (id: number) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer cette relation ?")) return;
    try {
      await axios.delete(`http://localhost:8000/api/relations-transformation/${id}/`);
      toast.success("Relation supprimée");
      fetchData();
    } catch (error) {
      toast.error("Erreur lors de la suppression");
    }
  };

  const openTransformerModal = (relation: RelationTransformation) => {
    setSubmitting(false); // Reset pour réactiver le bouton
    setTransformationData({
      relation,
      quantite: 1,
      notes: ''
    });
    setIsTransformerModalOpen(true);
  };


  // Calculs dynamiques pour le modal
  const quantiteDestinationCalculee = transformationData.relation 
    ? Math.floor(transformationData.quantite * transformationData.relation.ratio) 
    : 0;

  const currentSourceStock = transformationData.relation 
    ? produits.find(p => p.id === transformationData.relation!.produit_source)?.stock ?? '?' 
    : '?';

  return (
    <div className="p-6 bg-base-100 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
          Transformations de Conditionnement
        </h1>
        <button 
          onClick={() => setIsRelationModalOpen(true)}
          className="btn btn-primary"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
          Nouvelle Relation
        </button>
      </div>

      <div className="tabs tabs-boxed mb-6">
        <a 
          className={`tab ${activeTab === 'relations' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('relations')}
        >
          Relations Configurées
        </a>
        <a 
          className={`tab ${activeTab === 'historique' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('historique')}
        >
          Historique
        </a>
      </div>

      {loading ? (
        <div className="flex justify-center p-10"><span className="loading loading-spinner loading-lg"></span></div>
      ) : (
        <>
          {activeTab === 'relations' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {relations.map(relation => (
                <div key={relation.id} className="card bg-base-200 shadow-xl">
                  <div className="card-body">
                    <h2 className="card-title text-sm">
                      {relation.produit_source_nom}
                      <span className="text-gray-400 mx-2">➔</span>
                      {relation.produit_destination_nom}
                    </h2>
                    <div className="badge badge-secondary badge-outline mb-2">Ratio: 1 : {relation.ratio}</div>
                    <div className="card-actions justify-end mt-4">
                      <button 
                        className="btn btn-sm btn-accent"
                        onClick={() => openTransformerModal(relation)}
                      >
                        Transformer
                      </button>
                      <button 
                        className="btn btn-sm btn-ghost text-error"
                        onClick={() => handleDeleteRelation(relation.id)}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {relations.length === 0 && (
                <div className="col-span-full text-center py-10 text-gray-500">
                  Aucune relation de transformation configurée.
                </div>
              )}
            </div>
          )}

          {activeTab === 'historique' && (
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Utilisateur</th>
                    <th>Transformation</th>
                    <th>Quantités</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {historique.map(hist => (
                    <tr key={hist.id}>
                      <td>{new Date(hist.date_transformation).toLocaleString()}</td>
                      <td>{hist.user_nom}</td>
                      <td>
                        {hist.produit_source_nom} 
                        <span className="text-gray-400 mx-2">➔</span>
                        {hist.produit_destination_nom}
                      </td>
                      <td>
                        <span className="text-error font-bold">-{hist.quantite_source}</span>
                        <span className="mx-2">/</span>
                        <span className="text-success font-bold">+{hist.quantite_destination}</span>
                      </td>
                      <td className="italic text-gray-500">{hist.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Modal Création Relation */}
      <dialog id="relation_modal" className={`modal ${isRelationModalOpen ? 'modal-open' : ''}`}>
        <div className="modal-box">
          <h3 className="font-bold text-lg mb-4">Nouvelle Relation de Transformation</h3>
          <form onSubmit={handleCreateRelation}>
            <div className="form-control w-full mb-3">
              <label className="label"><span className="label-text">Produit Source (à transformer)</span></label>
              <select 
                className="select select-bordered"
                value={newRelation.produit_source}
                onChange={e => setNewRelation({...newRelation, produit_source: e.target.value})}
                required
              >
                <option value="">Sélectionner un produit...</option>
                {produits.sort((a,b) => a.name.localeCompare(b.name)).map(p => (
                  <option key={p.id} value={p.id}>{p.name} (Stock: {p.stock})</option>
                ))}
              </select>
            </div>
            
            <div className="form-control w-full mb-3">
              <label className="label"><span className="label-text">Produit Destination (résultat)</span></label>
              <select 
                className="select select-bordered"
                value={newRelation.produit_destination}
                onChange={e => setNewRelation({...newRelation, produit_destination: e.target.value})}
                required
              >
                <option value="">Sélectionner un produit...</option>
                {produits.sort((a,b) => a.name.localeCompare(b.name)).map(p => (
                  <option key={p.id} value={p.id}>{p.name} (Stock: {p.stock})</option>
                ))}
              </select>
            </div>

            <div className="form-control w-full mb-6">
              <label className="label"><span className="label-text">Ratio (Combien d'unités Destination pour 1 unité Source ?)</span></label>
              <input 
                type="number" 
                step="0.01"
                className="input input-bordered" 
                placeholder="Ex: 20"
                value={newRelation.ratio}
                onChange={e => setNewRelation({...newRelation, ratio: e.target.value})}
                required
              />
              <label className="label">
                <span className="label-text-alt text-gray-500">Exemple: Si 1 Boîte donne 20 Détails, mettez 20.</span>
              </label>
            </div>

            <div className="modal-action">
              <button type="button" className="btn" onClick={() => setIsRelationModalOpen(false)}>Annuler</button>
              <button type="submit" className="btn btn-primary">Créer</button>
            </div>
          </form>
        </div>
      </dialog>

      {/* Modal Transformer */}
      <dialog id="transformer_modal" className={`modal ${isTransformerModalOpen ? 'modal-open' : ''}`}>
        <div className="modal-box">
          <h3 className="font-bold text-lg mb-4">Effectuer une transformation</h3>
          {transformationData.relation && (
            <form onSubmit={handleTransformer}>
              <div className="alert alert-info shadow-sm mb-4">
                <div>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  <span>Stock Source Actuel: <span className="font-bold">{currentSourceStock}</span></span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 mb-6">
                <div className="flex-1">
                  <label className="label"><span className="label-text font-bold">{transformationData.relation.produit_source_nom}</span></label>
                  <input 
                    type="number" 
                    className="input input-bordered w-full text-center text-lg"
                    min="1"
                    value={transformationData.quantite}
                    onChange={e => setTransformationData({...transformationData, quantite: parseInt(e.target.value) || 0})}
                    required
                  />
                  <div className="text-center text-xs mt-1">Quantité à transformer</div>
                </div>

                <div className="flex flex-col items-center justify-center pt-6 text-gray-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                  <span className="text-xs">x {transformationData.relation.ratio}</span>
                </div>

                <div className="flex-1">
                  <label className="label"><span className="label-text font-bold text-right">{transformationData.relation.produit_destination_nom}</span></label>
                  <div className="input input-bordered w-full flex items-center justify-center bg-base-200 font-bold text-lg text-success">
                    {quantiteDestinationCalculee}
                  </div>
                  <div className="text-center text-xs mt-1">Quantité obtenue</div>
                </div>
              </div>

              <div className="form-control w-full mb-6">
                <label className="label"><span className="label-text">Notes (Optionnel)</span></label>
                <textarea 
                  className="textarea textarea-bordered h-24" 
                  placeholder="Raison de la transformation..."
                  value={transformationData.notes}
                  onChange={e => setTransformationData({...transformationData, notes: e.target.value})}
                ></textarea>
              </div>

              <div className="modal-action">
                <button type="button" className="btn" onClick={() => setIsTransformerModalOpen(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary">Confirmer Transformation</button>
              </div>
            </form>
          )}
        </div>
      </dialog>

    </div>
  );
};

export default Transformations;
