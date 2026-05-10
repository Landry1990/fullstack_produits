import { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import { toast } from 'react-hot-toast';
import { Search, Sparkles, AlertCircle, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import PremiumModal from './PremiumModal';

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
    const { t } = useTranslation(['stock', 'common']);
    const [allProducts, setAllProducts] = useState<MiniProduct[]>([]);
    const [loading, setLoading] = useState(false);
    const [processing, setProcessing] = useState(false);
    
    // Filters
    const [fromName, setFromName] = useState('');
    const [toName, setToName] = useState('');
    const [contains, setContains] = useState('');
    const [caseSensitive, setCaseSensitive] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchAllProducts();
        }
    }, [isOpen]);

    const fetchAllProducts = async () => {
        setLoading(true);
        try {
            const res = await api.get('produits/for_import/');
            setAllProducts(res.data);
        } catch (err) {
            console.error("Error fetching products for organizer:", err);
            toast.error(t('stock:organisation.smart_organizer.load_error'));
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
            const res = await api.post('produits/bulk-categorize/', {
                ids: filteredProducts.map(p => p.id),
                category_type: targetCategory.type,
                category_id: targetCategory.id
            });

            toast.success(t('stock:organisation.smart_organizer.success_message', { count: res.data.updated_count, name: targetCategory.name }));
            onSuccess();
            onClose();
        } catch (err: any) {
            console.error("Error bulk categorizing:", err);
            toast.error(err.response?.data?.detail || t('stock:organisation.smart_organizer.bulk_error'));
        } finally {
            setProcessing(false);
        }
    };

    return (
        <PremiumModal
            isOpen={isOpen}
            onClose={onClose}
            title={t('stock:organisation.smart_organizer.title')}
            subtitle={t('stock:organisation.smart_organizer.subtitle', { name: targetCategory.name })}
            icon={<Sparkles className="size-6 text-primary" />}
            maxWidth="max-w-2xl"
        >
            <div className="p-6 space-y-6">
                <div className="bg-primary/5 rounded-2xl p-4 border border-primary/10">
                    <p className="text-sm text-primary font-medium flex items-center gap-2">
                        <AlertCircle className="size-4" />
                        {t('stock:organisation.smart_organizer.help_text')}
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="form-control">
                        <label className="label text-xs font-bold uppercase tracking-wider text-base-content/40">{t('stock:organisation.smart_organizer.from_label')}</label>
                        <input 
                            type="text" 
                            className="input input-bordered rounded-xl" 
                            placeholder="Ex: AMIFER"
                            value={fromName}
                            onChange={e => setFromName(e.target.value)}
                        />
                    </div>
                    <div className="form-control">
                        <label className="label text-xs font-bold uppercase tracking-wider text-base-content/40">{t('stock:organisation.smart_organizer.to_label')}</label>
                        <input 
                            type="text" 
                            className="input input-bordered rounded-xl" 
                            placeholder="Ex: DAFLON"
                            value={toName}
                            onChange={e => setToName(e.target.value)}
                        />
                    </div>
                    <div className="form-control">
                        <label className="label text-xs font-bold uppercase tracking-wider text-base-content/40">{t('stock:organisation.smart_organizer.contains_label')}</label>
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
                        <span className="label-text text-xs font-medium">{t('stock:organisation.smart_organizer.case_sensitive')}</span>
                    </label>
                </div>

                <div className="divider opacity-10"></div>

                <div className="bg-base-200/50 rounded-2xl border border-slate-100 min-h-[150px] max-h-[250px] overflow-auto">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center p-12 text-base-content/40 gap-2">
                            <span className="loading loading-spinner"></span>
                            <p className="text-xs">{t('stock:organisation.smart_organizer.loading_products')}</p>
                        </div>
                    ) : filteredProducts.length > 0 ? (
                        <div className="p-4">
                           <div className="flex justify-between items-center mb-4 sticky top-0 bg-base-200/50 py-1">
                              <h4 className="font-bold text-base-content/90 text-sm">
                                 {t('stock:organisation.smart_organizer.products_found', { count: filteredProducts.length })}
                              </h4>
                              <div className="badge badge-primary badge-sm">{t('stock:organisation.smart_organizer.preview')}</div>
                           </div>
                           <div className="space-y-2">
                              {filteredProducts.slice(0, 50).map(p => (
                                 <div key={p.id} className="flex items-center justify-between bg-base-100 p-2 rounded-lg border border-base-200 text-xs">
                                    <span className="font-medium">{p.name}</span>
                                    <span className="opacity-40">{p.cip1}</span>
                                 </div>
                              ))}
                              {filteredProducts.length > 50 && (
                                 <p className="text-center text-[10px] text-base-content/40 italic pt-2">
                                    {t('stock:organisation.smart_organizer.more_products', { count: filteredProducts.length - 50 })}
                                 </p>
                              )}
                           </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center p-12 text-base-content/40 gap-2">
                            <Search className="size-8 opacity-20" />
                            <p className="text-sm italic">{t('stock:organisation.smart_organizer.no_results')}</p>
                        </div>
                    )}
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                    <button className="btn btn-ghost px-6 rounded-xl" onClick={onClose} disabled={processing}>
                        {t('common:cancel')}
                    </button>
                    <button 
                        className={`btn btn-primary px-10 rounded-xl shadow-lg shadow-primary/20 gap-2 ${processing ? 'loading' : ''}`}
                        onClick={handleApply}
                        disabled={filteredProducts.length === 0 || processing}
                    >
                        {processing ? t('stock:organisation.smart_organizer.processing') : (
                            <>
                                {t('stock:organisation.smart_organizer.apply_btn', { name: targetCategory.name })}
                                <ArrowRight className="size-4 ml-1" />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </PremiumModal>
    );
}
