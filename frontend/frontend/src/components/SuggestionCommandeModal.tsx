import { useState } from 'react'
import axios from 'axios'
import { toast } from 'react-hot-toast'
import type { Fournisseur, ProduitModel, CommandeProduit } from '../types'
import PremiumModal from './common/PremiumModal'
import { 
    Brain, 
    Calendar, 
    DollarSign, 
    Info,
    Package,
    Search,
    ChevronLeft,
    ShoppingCart,
    ArrowUpRight
} from 'lucide-react'

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
      mode: 'optimise', // 'simple' | 'optimise'
      budgetMax: '' // New field for budget limit
  });
  
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [totalHt, setTotalHt] = useState<number>(0); // New state for total amount
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
              fournisseur_id: suggestionParams.fournisseurId ? parseInt(suggestionParams.fournisseurId) : null,
              budget_max: suggestionParams.budgetMax ? Number(suggestionParams.budgetMax) : null
          };
          
          const response = await axios.post(`${apiBaseUrl ? apiBaseUrl.replace(/\/$/, '') : ''}/api/generer-suggestions/`, payload);
          setSuggestions(response.data.suggestions || []);
          setTotalHt(response.data.total_ht || 0); // Capture total HT
          
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
               // Fallback avec les données du backend
               productStub = {
                  id: item.produit_id,
                  name: item.produit_nom,
                  cip1: item.produit_ref,
                  stock: item.stock_actuel,
                  cost_price: String(item.prix_achat),
                  selling_price: String(item.prix_vente || item.prix_achat * 1.3),
                  tva: item.tva || '0',
                  taux_marge: item.taux_marge || '1.3'
              } as any;
           }

          return {
              id: Date.now() + index, // Temp ID
              produit: productStub,
              quantity: item.quantite_suggeree,
              unites_gratuites: 0,
              price: String(item.prix_achat || productStub.cost_price || 0),
              tva: item.tva || productStub.tva || '0',
              marge: item.taux_marge || productStub.taux_marge || '1.3',
              selling_price: String(item.prix_vente || productStub.selling_price || 0),
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

  const footer = (
    <div className="flex justify-between items-center w-full">
        {stepSuggestion === 2 ? (
            <button className="btn btn-ghost hover:bg-gray-100" onClick={() => setStepSuggestion(1)}>
                <ChevronLeft className="w-4 h-4 mr-2" />
                Retour aux paramètres
            </button>
        ) : (
            <button className="btn btn-ghost hover:bg-gray-100 text-gray-400" onClick={onClose}>
                Fermer
            </button>
        )}
        
        {stepSuggestion === 1 ? (
            <button 
                className="btn btn-primary px-8 shadow-lg shadow-primary/20"
                onClick={fetchSuggestions}
                disabled={loadingSuggestions}
            >
                {loadingSuggestions ? (
                    <span className="loading loading-spinner loading-xs"></span>
                ) : (
                    <>
                        <Search className="w-4 h-4 mr-2" />
                        Lancer l'analyse
                    </>
                )}
            </button>
        ) : (
            <div className="flex gap-3">
                <button 
                    className="btn btn-primary px-8 shadow-lg shadow-primary/20" 
                    onClick={handleApply}
                    disabled={selectedSuggestions.size === 0}
                >
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Créer la commande ({selectedSuggestions.size})
                </button>
            </div>
        )}
    </div>
  );

  return (
    <PremiumModal
        isOpen={true}
        onClose={onClose}
        title="Générateur de commande intelligent"
        subtitle={stepSuggestion === 1 ? "Configurez les paramètres de l'analyse IA" : `${suggestions.length} suggestions générées pour vous`}
        icon={<Brain className="w-6 h-6 text-primary" />}
        maxWidth="max-w-6xl"
        footer={footer}
    >
        <div className="p-6 bg-slate-50/50 min-h-[400px]">
            {stepSuggestion === 1 ? (
                <div className="max-w-3xl mx-auto space-y-6">
                    {/* Mode Selection */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <label 
                            className={`relative flex flex-col p-4 cursor-pointer rounded-2xl border-2 transition-all ${
                                suggestionParams.mode === 'simple' 
                                ? 'border-primary bg-primary/5 shadow-md' 
                                : 'border-gray-200 bg-white hover:border-primary/50'
                            }`}
                        >
                            <input 
                                type="radio" 
                                name="mode" 
                                className="hidden" 
                                checked={suggestionParams.mode === 'simple'}
                                onChange={() => setSuggestionParams(prev => ({ ...prev, mode: 'simple' }))}
                            />
                            <div className="flex items-center gap-3 mb-2">
                                <div className={`p-2 rounded-lg ${suggestionParams.mode === 'simple' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'}`}>
                                    <Package className="w-5 h-5" />
                                </div>
                                <span className="font-bold text-gray-800">Réassort Simple</span>
                            </div>
                            <p className="text-sm text-gray-500">
                                Analyse vos ventes récentes et suggère de commander exactement ce qui a été vendu.
                            </p>
                            {suggestionParams.mode === 'simple' && (
                                <div className="absolute top-4 right-4 text-primary">
                                    <div className="w-2 h-2 rounded-full bg-primary animate-ping absolute"></div>
                                    <div className="w-2 h-2 rounded-full bg-primary relative"></div>
                                </div>
                            )}
                        </label>

                        <label 
                            className={`relative flex flex-col p-4 cursor-pointer rounded-2xl border-2 transition-all ${
                                suggestionParams.mode === 'optimise' 
                                ? 'border-primary bg-primary/5 shadow-md' 
                                : 'border-gray-200 bg-white hover:border-primary/50'
                            }`}
                        >
                            <input 
                                type="radio" 
                                name="mode" 
                                className="hidden" 
                                checked={suggestionParams.mode === 'optimise'}
                                onChange={() => setSuggestionParams(prev => ({ ...prev, mode: 'optimise' }))}
                            />
                            <div className="flex items-center gap-3 mb-2">
                                <div className={`p-2 rounded-lg ${suggestionParams.mode === 'optimise' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'}`}>
                                    <Brain className="w-5 h-5" />
                                </div>
                                <span className="font-bold text-gray-800">Analyse Intelligente</span>
                            </div>
                            <p className="text-sm text-gray-500">
                                Algorithme de prédiction basé sur la rotation, la saisonnalité et le stock de sécurité.
                            </p>
                            {suggestionParams.mode === 'optimise' && (
                                <div className="absolute top-4 right-4 text-primary">
                                    <div className="w-2 h-2 rounded-full bg-primary animate-ping absolute"></div>
                                    <div className="w-2 h-2 rounded-full bg-primary relative"></div>
                                </div>
                            )}
                        </label>
                    </div>

                    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm space-y-6">
                        {/* Filters */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                    <Package className="w-3 h-3" />
                                    Fournisseur
                                </label>
                                <select 
                                    className="select select-bordered w-full bg-gray-50 border-gray-200 focus:border-primary rounded-xl"
                                    value={suggestionParams.fournisseurId}
                                    onChange={(e) => setSuggestionParams(prev => ({ ...prev, fournisseurId: e.target.value }))}
                                >
                                    <option value="">Tous les fournisseurs</option>
                                    {fournisseurs.map(f => (
                                        <option key={f.id} value={f.id}>{f.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                    <DollarSign className="w-3 h-3" />
                                    Budget Maximum (HT)
                                    <div className="tooltip" data-tip="Priorise les produits critiques si le budget est limité">
                                        <Info className="w-3 h-3 text-gray-300" />
                                    </div>
                                </label>
                                <div className="join w-full">
                                    <input 
                                        type="number" 
                                        placeholder="Ex: 500000"
                                        className="input input-bordered join-item w-full bg-gray-50 border-gray-200 focus:border-primary rounded-l-xl"
                                        value={suggestionParams.budgetMax}
                                        onChange={(e) => setSuggestionParams(prev => ({ ...prev, budgetMax: e.target.value }))}
                                    />
                                    <span className="join-item px-4 bg-gray-100 border border-gray-200 border-l-0 flex items-center font-bold text-gray-400 rounded-r-xl">F</span>
                                </div>
                            </div>
                        </div>

                        {/* Period Selection */}
                        <div className="space-y-3">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                <Calendar className="w-3 h-3" />
                                Période de couverture (jours)
                            </label>
                            
                            <div className="flex flex-wrap gap-2">
                                {[
                                    { label: 'Garde', value: 3 },
                                    { label: 'Semaine', value: 7 },
                                    { label: 'Décade', value: 10 },
                                    { label: '15 jours', value: 15 },
                                    { label: 'Mois', value: 30 }
                                ].map(p => (
                                    <button
                                        key={p.value}
                                        type="button"
                                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                                            suggestionParams.periode === p.value
                                            ? 'bg-primary text-white shadow-md'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                        onClick={() => setSuggestionParams(prev => ({ ...prev, periode: p.value }))}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                                <div className="flex items-center gap-2 px-3 py-1 bg-gray-50 border border-gray-200 rounded-full ml-auto">
                                   <input 
                                        type="number" 
                                        className="w-12 bg-transparent border-none focus:outline-none text-right font-bold text-primary"
                                        value={suggestionParams.periode}
                                        min={1}
                                        max={365}
                                        onChange={(e) => setSuggestionParams(prev => ({ ...prev, periode: parseInt(e.target.value) || 0 }))}
                                    />
                                    <span className="text-xs text-gray-400 pr-1">jours</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                /* STEP 2 : RÉSULTATS */
                <div className="flex flex-col h-full gap-4 max-h-[600px]">
                    <div className="flex items-center justify-between gap-4 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                <Info className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-800">Analyse terminée</h4>
                                <p className="text-sm text-gray-500">{suggestions.length} produits correspondent à vos critères.</p>
                            </div>
                        </div>
                        <div className="bg-slate-900 text-white rounded-xl px-4 py-2 text-right">
                            <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1 justify-end">
                                <DollarSign className="w-3 h-3" />
                                Total estimé HT
                            </div>
                            <div className="text-xl font-mono font-bold">{totalHt.toLocaleString()} <span className="text-xs">F</span></div>
                        </div>
                    </div>

                    {suggestions.length > 0 ? (
                        <div className="flex-1 overflow-auto rounded-2xl border border-gray-100 bg-white">
                            <table className="table table-pin-rows">
                                <thead className="bg-gray-50/80 backdrop-blur-md">
                                    <tr className="text-gray-400 uppercase text-[10px] tracking-widest border-b border-gray-100">
                                        <th className="bg-transparent">
                                            <input 
                                                type="checkbox" 
                                                className="checkbox checkbox-sm checkbox-primary rounded-md" 
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
                                        </th>
                                        <th className="bg-transparent">Désignation</th>
                                        <th className="text-center bg-transparent">Stock</th>
                                        <th className="text-center bg-transparent">Ventes</th>
                                        <th className="text-right bg-transparent">Quantité</th>
                                        <th className="text-right bg-transparent">Total HT</th>
                                        <th className="bg-transparent">Priorité</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {suggestions.map((item, index) => (
                                        <tr 
                                            key={index} 
                                            className={`hover:bg-primary/5 transition-colors cursor-pointer group ${selectedSuggestions.has(index) ? 'bg-primary/5' : ''}`}
                                            onClick={() => toggleSuggestionSelection(index)}
                                        >
                                            <td className="w-4">
                                                <input 
                                                    type="checkbox" 
                                                    className="checkbox checkbox-sm checkbox-primary rounded-md" 
                                                    checked={selectedSuggestions.has(index)}
                                                    onChange={(e) => {
                                                        e.stopPropagation();
                                                        toggleSuggestionSelection(index);
                                                    }}
                                                />
                                            </td>
                                            <td>
                                                <div className="flex flex-col">
                                                    <div className="font-bold text-gray-700 flex items-center gap-2">
                                                        {item.produit_nom}
                                                        {item.is_supplier_exclusive && (
                                                            <span className="badge badge-sm badge-success text-[8px] font-bold text-white">EXCLUSIF</span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-gray-400 font-mono tracking-tighter">REF: {item.produit_ref}</div>
                                                </div>
                                            </td>
                                            <td className="text-center">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${item.stock_actuel <= 0 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
                                                    {item.stock_actuel}
                                                </span>
                                            </td>
                                            <td className="text-center text-sm font-medium text-gray-500">
                                                {item.ventes_periode}
                                            </td>
                                            <td className="text-right">
                                                <div className="flex flex-col items-end">
                                                    <span className="text-lg font-bold text-primary">{item.quantite_suggeree}</span>
                                                    <span className="text-[10px] text-gray-400">{item.prix_achat.toLocaleString()} F / u</span>
                                                </div>
                                            </td>
                                            <td className="text-right font-mono font-bold text-gray-700">
                                                {(item.montant_ht || (item.prix_achat * item.quantite_suggeree)).toLocaleString()} F
                                            </td>
                                            <td>
                                                <div className="flex items-center gap-2">
                                                    {item.score_urgence > 50 ? (
                                                        <div className="badge badge-error badge-xs animate-pulse">CRITIQUE</div>
                                                    ) : (
                                                        <div className="badge badge-ghost badge-xs text-gray-400 uppercase font-bold text-[8px]">Standard</div>
                                                    )}
                                                    <div className="tooltip tooltip-left" data-tip={item.raison}>
                                                        <ArrowUpRight className="w-4 h-4 text-gray-300 group-hover:text-primary transition-colors" />
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-2xl border-2 border-dashed border-gray-100 p-12 text-center">
                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                                <Search className="w-8 h-8 text-gray-300" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-800">Aucun résultat</h3>
                            <p className="text-gray-500 max-w-sm mx-auto">
                                Nous n'avons trouvé aucun produit à commander avec ces paramètres. Essayez d'élargir la période ou changer de fournisseur.
                            </p>
                            <button className="btn btn-ghost btn-sm mt-4 text-primary" onClick={() => setStepSuggestion(1)}>
                                Modifier les paramètres
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    </PremiumModal>
  )
}
