import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { Search, Sparkles, AlertCircle, ArrowRight } from 'lucide-react';
import PremiumModal from './PremiumModal';
import { safeStorage } from '../../utils/storage';

interface SmartOrganizerModalProps {
    isOpen: boolean;
    onClose: () => void;
    targetCategory: {
        type: 'rayon' | 'forme' | 'groupe';
        id: number;
        name: string;
    };
    onSuccess: () => void;
}

interface MiniProduct {
    id: number;
    name: string;
    cip1?: string;
}

export default function SmartOrganizerModal({ isOpen, onClose, targetCategory, onSuccess }: SmartOrganizerModalProps) {
    const [allProducts, setAllProducts] = useState<MiniProduct[]>([]);
    const [loading, setLoading] = useState(false);
    const [processing, setProcessing] = useState(false);
    
    // Filters
    const [fromName, setFromName] = useState('');
    const [toName, setToName] = useState('');
    const [contains, setContains] = useState('');
    const [caseSensitive, setCaseSensitive] = useState(false);

    const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

    useEffect(() => {
        if (isOpen) {
            fetchAllProducts();
        }
    }, [isOpen]);

    const fetchAllProducts = async () => {
        setLoading(true);
        try {
            const token = safeStorage.getItem('authToken');
            const res = await axios.get(`${apiBaseUrl}/api/produits/for_import/`, {
                headers: { Authorization: `Token ${token}` }
            });
            setAllProducts(res.data);
        } catch (err) {
            console.error("Error fetching products for organizer:", err);
            toast.error("Erreur lors de la récupération de la liste des produits");
        } finally {
            setLoading(false);
        }
    };

    const filteredProducts = useMemo(() => {
        const fName = fromName.trim().toLowerCase();
        const tName = toName.trim().toLowerCase();
        const cTerm = contains.trim().toLowerCase();

        // Ne rien filtrer si tous les champs sont vides
        if (!fName && !tName && !cTerm) return [];

        // Pour que la borne supérieure soit inclusive du mot complet (ex: 'daflon')
        // mais exclue ce qui vient juste après (ex: 'demobac'),
        // on ajoute un caractère unicode très élevé en fin de chaîne.
        const tNameInclusive = tName ? tName + '\uffff' : '';

        return allProducts.filter(p => {
            const name = p.name.trim().toLowerCase();
            
            // Plage alphabétique
            const matchFrom = fName ? name >= fName : true;
            const matchTo = tNameInclusive ? name <= tNameInclusive : true;
            
            // Filtre contient
            const matchContains = cTerm ? name.includes(cTerm) : true;

            return matchFrom && matchTo && matchContains;
        }).sort((a, b) => a.name.localeCompare(b.name));
    }, [allProducts, fromName, toName, contains]);

    const handleApply = async () => {
        if (filteredProducts.length === 0) return;
        
        setProcessing(true);
        try {
            const token = safeStorage.getItem('authToken');
            const res = await axios.post(`${apiBaseUrl}/api/produits/bulk-categorize/`, {
                ids: filteredProducts.map(p => p.id),
                category_type: targetCategory.type,
                category_id: targetCategory.id
            }, {
                headers: { Authorization: `Token ${token}` }
            });

            toast.success(`${res.data.updated_count} produits ont été rangés dans "${targetCategory.name}"`);
            onSuccess();
            onClose();
        } catch (err: any) {
            console.error("Error bulk categorizing:", err);
            toast.error(err.response?.data?.detail || "Erreur lors du rangement massif");
        } finally {
            setProcessing(false);
        }
    };

    return (
        <PremiumModal
            isOpen={isOpen}
            onClose={onClose}
            title="Rangement Intelligent"
            subtitle={`Classer des produits dans : ${targetCategory.name}`}
            icon={<Sparkles className="w-6 h-6 text-primary" />}
            maxWidth="max-w-2xl"
        >
            <div className="p-6 space-y-6">
                <div className="bg-primary/5 rounded-2xl p-4 border border-primary/10">
                    <p className="text-sm text-primary font-medium flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        Définissez une plage alphabétique pour identifier les produits à déplacer.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="form-control">
                        <label className="label text-xs font-bold uppercase tracking-wider text-gray-400">De (Inclus)</label>
                        <input 
                            type="text" 
                            className="input input-bordered rounded-xl" 
                            placeholder="Ex: AMIFER"
                            value={fromName}
                            onChange={e => setFromName(e.target.value)}
                        />
                    </div>
                    <div className="form-control">
                        <label className="label text-xs font-bold uppercase tracking-wider text-gray-400">À (Inclus)</label>
                        <input 
                            type="text" 
                            className="input input-bordered rounded-xl" 
                            placeholder="Ex: DAFLON"
                            value={toName}
                            onChange={e => setToName(e.target.value)}
                        />
                    </div>
                    <div className="form-control">
                        <label className="label text-xs font-bold uppercase tracking-wider text-gray-400">Contient (Optionnel)</label>
                        <input 
                            type="text" 
                            className="input input-bordered rounded-xl" 
                            placeholder="Ex: CPR"
                            value={contains}
                            onChange={e => setContains(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <label className="label cursor-pointer justify-start gap-2">
                        <input 
                            type="checkbox" 
                            className="checkbox checkbox-primary checkbox-sm" 
                            checked={caseSensitive}
                            onChange={e => setCaseSensitive(e.target.checked)}
                        />
                        <span className="label-text text-xs font-medium">Respecter la casse</span>
                    </label>
                </div>

                <div className="divider opacity-10"></div>

                <div className="bg-slate-50 rounded-2xl border border-slate-100 min-h-[150px] max-h-[250px] overflow-auto">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center p-12 text-slate-400 gap-2">
                            <span className="loading loading-spinner"></span>
                            <p className="text-xs">Chargement de la base produit...</p>
                        </div>
                    ) : filteredProducts.length > 0 ? (
                        <div className="p-4">
                           <div className="flex justify-between items-center mb-4 sticky top-0 bg-slate-50 py-1">
                              <h4 className="font-bold text-slate-700 text-sm">
                                 {filteredProducts.length} produit{filteredProducts.length > 1 ? 's' : ''} trouvé{filteredProducts.length > 1 ? 's' : ''}
                              </h4>
                              <div className="badge badge-primary badge-sm">Aperçu</div>
                           </div>
                           <div className="space-y-2">
                              {filteredProducts.slice(0, 50).map(p => (
                                 <div key={p.id} className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-200 text-xs">
                                    <span className="font-medium">{p.name}</span>
                                    <span className="opacity-40">{p.cip1}</span>
                                 </div>
                              ))}
                              {filteredProducts.length > 50 && (
                                 <p className="text-center text-[10px] text-slate-400 italic pt-2">
                                    + {filteredProducts.length - 50} autres produits...
                                 </p>
                              )}
                           </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center p-12 text-slate-400 gap-2">
                            <Search className="w-8 h-8 opacity-20" />
                            <p className="text-sm italic">Aucun produit ne correspond aux critères</p>
                        </div>
                    )}
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                    <button className="btn btn-ghost px-6 rounded-xl" onClick={onClose} disabled={processing}>
                        Annuler
                    </button>
                    <button 
                        className={`btn btn-primary px-10 rounded-xl shadow-lg shadow-primary/20 gap-2 ${processing ? 'loading' : ''}`}
                        onClick={handleApply}
                        disabled={filteredProducts.length === 0 || processing}
                    >
                        {processing ? 'Rangement...' : (
                            <>
                                Ranger dans <strong>{targetCategory.name}</strong>
                                <ArrowRight className="w-4 h-4 ml-1" />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </PremiumModal>
    );
}
