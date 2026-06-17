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
                <div className="bg-purple-50 rounded-2xl p-4 border border-purple-100">
                    <p className="text-sm text-purple-700 font-medium flex items-center gap-2">
                        <AlertCircle className="size-4" />
                        {t('stock:organisation.smart_organizer.help_text')}
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">{t('stock:organisation.smart_organizer.from_label')}</label>
                        <input
                            type="text"
                            className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 focus:outline-none focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                            placeholder="Ex: AMIFER"
                            value={fromName}
                            onChange={e => setFromName(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">{t('stock:organisation.smart_organizer.to_label')}</label>
                        <input
                            type="text"
                            className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 focus:outline-none focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                            placeholder="Ex: DAFLON"
                            value={toName}
                            onChange={e => setToName(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">{t('stock:organisation.smart_organizer.contains_label')}</label>
                        <input
                            type="text"
                            className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 focus:outline-none focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                            placeholder="Ex: CPR"
                            value={contains}
                            onChange={e => setContains(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <input
                        type="checkbox"
                        id="case-sensitive"
                        className="size-4 rounded border-slate-300 accent-purple-600 cursor-pointer"
                        checked={caseSensitive}
                        onChange={e => setCaseSensitive(e.target.checked)}
                    />
                    <label htmlFor="case-sensitive" className="text-xs font-medium text-slate-500 cursor-pointer">{t('stock:organisation.smart_organizer.case_sensitive')}</label>
                </div>

                <div className="border-t border-slate-100"></div>

                <div className="bg-slate-50 rounded-2xl border border-slate-200 min-h-[150px] max-h-[250px] overflow-auto">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center p-12 text-slate-400 gap-2">
                            <span className="size-6 border-2 border-slate-200 border-t-purple-500 rounded-full animate-spin"></span>
                            <p className="text-xs">{t('stock:organisation.smart_organizer.loading_products')}</p>
                        </div>
                    ) : filteredProducts.length > 0 ? (
                        <div className="p-4">
                           <div className="flex justify-between items-center mb-4 sticky top-0 bg-slate-50 py-1">
                              <h4 className="font-bold text-slate-700 text-sm">
                                 {t('stock:organisation.smart_organizer.products_found', { count: filteredProducts.length })}
                              </h4>
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold">{t('stock:organisation.smart_organizer.preview')}</span>
                           </div>
                           <div className="space-y-2">
                              {filteredProducts.slice(0, 50).map(p => (
                                 <div key={p.id} className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-100 text-xs">
                                    <span className="font-medium text-slate-700">{p.name}</span>
                                    <span className="text-slate-400">{p.cip1}</span>
                                 </div>
                              ))}
                              {filteredProducts.length > 50 && (
                                 <p className="text-center text-[10px] text-slate-400 italic pt-2">
                                    {t('stock:organisation.smart_organizer.more_products', { count: filteredProducts.length - 50 })}
                                 </p>
                              )}
                           </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center p-12 text-slate-400 gap-2">
                            <Search className="size-8 text-slate-200" />
                            <p className="text-sm italic">{t('stock:organisation.smart_organizer.no_results')}</p>
                        </div>
                    )}
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                    <button
                        className="inline-flex items-center h-9 px-5 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-medium transition-colors"
                        onClick={onClose}
                        disabled={processing}
                    >
                        {t('common:cancel')}
                    </button>
                    <button
                        className="inline-flex items-center gap-2 h-9 px-8 bg-purple-600 text-white rounded-xl text-sm font-bold hover:bg-purple-700 transition-colors shadow-sm disabled:opacity-50"
                        onClick={handleApply}
                        disabled={filteredProducts.length === 0 || processing}
                    >
                        {processing ? (
                            <><span className="size-4 border-2 border-purple-400 border-t-white rounded-full animate-spin" />{t('stock:organisation.smart_organizer.processing')}</>
                        ) : (
                            <>{t('stock:organisation.smart_organizer.apply_btn', { name: targetCategory.name })}<ArrowRight className="size-4" /></>
                        )}
                    </button>
                </div>
            </div>
        </PremiumModal>
    );
}
