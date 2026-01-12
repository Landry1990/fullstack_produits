import { useState } from 'react'
import axios from 'axios'
import { toast } from 'react-hot-toast'
import type { Fournisseur, ProduitModel, CommandeProduit } from '../types'

interface SuggestionCommandeModalProps {
  onClose: () => void
  onApply: (products: CommandeProduit[], fournisseurId: string) => void
  fournisseurs: Fournisseur[]
  produitsList: ProduitModel[] // Needed to resolve full product details
}

export default function SuggestionCommandeModal({ 
  onClose, 
  onApply, 
  fournisseurs,
  produitsList 
}: SuggestionCommandeModalProps) {
  
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? ''
  
  // Internal State
  const [suggestionParams, setSuggestionParams] = useState({
      periode: 30,
      fournisseurId: '',
      mode: 'optimise' // 'simple' | 'optimise'
  });
  
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [stepSuggestion, setStepSuggestion] = useState<1 | 2>(1); // 1 = Config, 2 = Résultats
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());

  // Logic
  async function fetchSuggestions() {
      setLoadingSuggestions(true);
      try {
          const payload = {
              mode: suggestionParams.mode,
              periode: Number(suggestionParams.periode),
              fournisseur_id: suggestionParams.fournisseurId ? parseInt(suggestionParams.fournisseurId) : null
          };
          
          const response = await axios.post(`${apiBaseUrl ? apiBaseUrl.replace(/\/$/, '') : ''}/api/generer-suggestions/`, payload);
          setSuggestions(response.data.suggestions || []);
          
          // Select all by default
          const allIndices = new Set(response.data.suggestions.map((_: any, i: number) => i));
          setSelectedSuggestions(allIndices as Set<number>);
          
          setStepSuggestion(2);
      } catch (err: any) {
          const msg = err.response?.data?.message || err.message || "Erreur lors de la génération des suggestions";
          toast.error(msg);
      } finally {
          setLoadingSuggestions(false);
      }
  }

  function handleApply() {
      // 1. Filter selected suggestions
      const selectedItems = suggestions.filter((_, i) => selectedSuggestions.has(i));
      
      if (selectedItems.length === 0) {
          toast('Aucun produit sélectionné.', { icon: '⚠️' });
          return;
      }

      // 2. Convert to command lines
      const newLines: CommandeProduit[] = selectedItems.map((item: any, index) => {
           const realProduct = produitsList.find(p => p.id === item.produit_id);
           
           let productStub: ProduitModel;
           
           if (realProduct) {
               productStub = realProduct;
           } else {
               productStub = {
                  id: item.produit_id,
                  name: item.produit_nom,
                  cip1: item.produit_ref,
                  stock: item.stock_actuel,
                  cost_price: String(item.prix_achat),
                  selling_price: String(item.prix_achat * 1.3),
                  tva: '18',
                  taux_marge: '1.3'
              } as any;
           }

          return {
              id: Date.now() + index, // Temp ID
              produit: productStub,
              quantity: item.quantite_suggeree,
              unites_gratuites: 0,
              price: String(item.prix_achat || productStub.cost_price || 0),
              tva: productStub.tva || '18',
              marge: productStub.taux_marge || '1.3',
              selling_price: productStub.selling_price || String((item.prix_achat || 0) * 1.3),
              lot: '',
              date_expiration: ''
          };
      });

      // Determined supplier ID
      let supplierId = '';
      if (suggestionParams.fournisseurId) {
          supplierId = suggestionParams.fournisseurId;
      } else if (selectedItems.length > 0 && selectedItems[0].fournisseur_id) {
          supplierId = String(selectedItems[0].fournisseur_id);
      }

      onApply(newLines, supplierId);
  }

  function toggleSuggestionSelection(index: number) {
      setSelectedSuggestions(prev => {
          const next = new Set(prev);
          if (next.has(index)) next.delete(index);
          else next.add(index);
          return next;
      });
  }

  // Render
  return (
      <div className="modal modal-open">
          <div className="modal-box w-11/12 max-w-5xl h-[80vh] flex flex-col p-0 overflow-hidden">
              <div className="p-4 border-b bg-base-100 shrink-0 flex justify-between items-center">
                  <h3 className="font-bold text-lg">Générateur de commande intelligent</h3>
                  <button className="btn btn-sm btn-circle btn-ghost" onClick={onClose}>✕</button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 bg-base-200/50">
                  {stepSuggestion === 1 ? (
                      <div className="card bg-base-100 shadow-sm max-w-2xl mx-auto">
                          <div className="card-body">
                              <h4 className="card-title text-base mb-4">Paramètres de l'analyse</h4>
                              
                              <div className="form-control mb-4">
                                  <label className="label font-medium">Fournisseur</label>
                                  <select 
                                      className="select select-bordered w-full"
                                      value={suggestionParams.fournisseurId}
                                      onChange={(e) => setSuggestionParams(prev => ({ ...prev, fournisseurId: e.target.value }))}
                                  >
                                      <option value="">Tous les fournisseurs</option>
                                      {fournisseurs.map(f => (
                                          <option key={f.id} value={f.id}>{f.name}</option>
                                      ))}
                                  </select>
                                  <label className="label text-xs text-base-content/60">
                                      Si sélectionné, seuls les produits de ce fournisseur seront analysés.
                                  </label>
                              </div>

                              <div className="form-control mb-4">
                                  <label className="label font-medium">Période d'analyse (jours)</label>
                                  <input 
                                      type="number" 
                                      className="input input-bordered w-full"
                                      value={suggestionParams.periode}
                                      onChange={(e) => setSuggestionParams(prev => ({ ...prev, periode: parseInt(e.target.value) || 30 }))}
                                  />
                                  <label className="label text-xs text-base-content/60">
                                      Base de calcul pour la moyenne des ventes (ex: 30 derniers jours).
                                  </label>
                              </div>

                              <div className="form-control mb-6">
                                  <label className="label font-medium">Mode de calcul</label>
                                  <div className="flex gap-4">
                                      <label className="label cursor-pointer justify-start gap-3 border p-3 rounded-lg flex-1 bg-base-50 hover:bg-base-100 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                                          <input 
                                              type="radio" 
                                              name="mode" 
                                              className="radio radio-primary" 
                                              checked={suggestionParams.mode === 'simple'}
                                              onChange={() => setSuggestionParams(prev => ({ ...prev, mode: 'simple' }))}
                                          />
                                          <div>
                                              <span className="font-semibold block">Réassort Simple</span>
                                              <span className="text-xs opacity-75">Commande ce qui a été vendu (Ventes - Stock)</span>
                                          </div>
                                      </label>
                                      <label className="label cursor-pointer justify-start gap-3 border p-3 rounded-lg flex-1 bg-base-50 hover:bg-base-100 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                                          <input 
                                              type="radio" 
                                              name="mode" 
                                              className="radio radio-primary" 
                                              checked={suggestionParams.mode === 'optimise'}
                                              onChange={() => setSuggestionParams(prev => ({ ...prev, mode: 'optimise' }))}
                                          />
                                          <div>
                                              <span className="font-semibold block">Analyse Intelligente</span>
                                              <span className="text-xs opacity-75">Basé sur rotation, couverture et stock de sécurité.</span>
                                          </div>
                                      </label>
                                  </div>
                              </div>

                              <div className="card-actions justify-end mt-4">
                                  <button 
                                      className="btn btn-primary w-full md:w-auto"
                                      onClick={fetchSuggestions}
                                      disabled={loadingSuggestions}
                                  >
                                      {loadingSuggestions ? <span className="loading loading-spinner"></span> : '🔍 Lancer l\'analyse'}
                                  </button>
                              </div>
                          </div>
                      </div>
                  ) : (
                      /* STEP 2 : RÉSULTATS */
                      <div className="flex flex-col h-full gap-4">
                          <div className="alert alert-info shadow-sm text-sm py-2">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                              <div>
                                  <span className="font-bold">{suggestions.length} produits suggérés.</span> 
                                  {suggestions.length === 0 ? " Aucun produit à commander selon les critères." : " Vérifiez les quantités avant de valider."}
                              </div>
                          </div>

                          {suggestions.length > 0 && (
                              <div className="flex-1 overflow-auto border rounded-box bg-base-100">
                                  <table className="table table-pin-rows">
                                      <thead>
                                          <tr>
                                              <th>
                                                  <label>
                                                      <input 
                                                          type="checkbox" 
                                                          className="checkbox" 
                                                          checked={selectedSuggestions.size === suggestions.length && suggestions.length > 0}
                                                          onChange={() => {
                                                              if (selectedSuggestions.size === suggestions.length) {
                                                                  setSelectedSuggestions(new Set());
                                                              } else {
                                                                  const all = new Set(suggestions.map((_, i) => i));
                                                                  setSelectedSuggestions(all as Set<number>);
                                                              }
                                                          }}
                                                      />
                                                  </label>
                                              </th>
                                              <th>Produit</th>
                                              <th className="text-center">Stock</th>
                                              <th className="text-center">Ventes (Période)</th>
                                              {suggestionParams.mode === 'optimise' && <th className="text-center">Note</th>}
                                              <th className="text-right">Proposition</th>
                                              <th className="text-right">Prix Achat</th>
                                              <th>Raison</th>
                                          </tr>
                                      </thead>
                                      <tbody>
                                          {suggestions.map((item, index) => (
                                              <tr key={index} className="hover:bg-base-50" onClick={() => toggleSuggestionSelection(index)}>
                                                  <td>
                                                      <label>
                                                          <input 
                                                              type="checkbox" 
                                                              className="checkbox" 
                                                              checked={selectedSuggestions.has(index)}
                                                              onChange={() => toggleSuggestionSelection(index)}
                                                          />
                                                      </label>
                                                  </td>
                                                  <td>
                                                      <div className="font-bold">{item.produit_nom}</div>
                                                      <div className="text-xs opacity-50">{item.produit_ref}</div>
                                                  </td>
                                                  <td className="text-center font-mono">{item.stock_actuel}</td>
                                                  <td className="text-center font-mono">{item.ventes_periode}</td>
                                                  {suggestionParams.mode === 'optimise' && (
                                                      <td className="text-center">
                                                          {item.score_urgence > 50 && <span className="badge badge-error badge-xs">Critique</span>}
                                                      </td>
                                                  )}
                                                  <td className="text-right font-bold text-primary text-lg">
                                                      {item.quantite_suggeree}
                                                  </td>
                                                  <td className="text-right opacity-70">
                                                      {item.prix_achat} F
                                                  </td>
                                                  <td className="text-xs max-w-xs truncate" title={item.raison}>
                                                      {item.raison}
                                                  </td>
                                              </tr>
                                          ))}
                                      </tbody>
                                  </table>
                              </div>
                          )}
                      </div>
                  )}
              </div>

              <div className="p-4 border-t bg-base-100 shrink-0 flex justify-between">
                  {stepSuggestion === 2 ? (
                      <button className="btn btn-ghost" onClick={() => setStepSuggestion(1)}>⬅️ Paramètres</button>
                  ) : (
                     <div></div>
                  )}
                  
                  {stepSuggestion === 2 && (
                      <div className="flex gap-2">
                          <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
                          <button 
                              className="btn btn-primary" 
                              onClick={handleApply}
                              disabled={selectedSuggestions.size === 0}
                          >
                              Créer Commande ({selectedSuggestions.size})
                          </button>
                      </div>
                  )}
              </div>
          </div>
      </div>
  )
}
