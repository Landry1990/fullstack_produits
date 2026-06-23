import { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import { toast } from 'react-hot-toast';
import { Search, Sparkles, AlertCircle, ArrowRight, X } from 'lucide-react';
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
    const [excludedIds, setExcludedIds] = useState<Set<number>>(new Set());

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

    // Reset exclusions quand les filtres changent
    useEffect(() => {
        setExcludedIds(new Set());
    }, [fromName, toName, contains, caseSensitive]);

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

    const finalProducts = useMemo(
        () => filteredProducts.filter(p => !excludedIds.has(p.id)),
        [filteredProducts, excludedIds]
    );

    const handleExclude = (id: number) => {
        setExcludedIds(prev => new Set([...prev, id]));
    };

    const handleRestoreAll = () => {
        setExcludedIds(new Set());
    };

    const handleApply = async () => {
        if (finalProducts.length === 0) return;
        
        setProcessing(true);
        try {
            const res = await api.post('produits/bulk-categorize/', {
                ids: finalProducts.map(p => p.id),
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

                <div className="bg-slate-50 rounded-2xl border border-slate-200 min-h-[150px] max-h-[300px] overflow-auto">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center p-12 text-slate-400 gap-2">
                            <span className="size-6 border-2 border-slate-200 border-t-purple-500 rounded-full animate-spin"></span>
                            <p className="text-xs">{t('stock:organisation.smart_organizer.loading_products')}</p>
                        </div>
                    ) : filteredProducts.length > 0 ? (
                        <div className="p-4">
                            <div className="flex justify-between items-center mb-3 sticky top-0 bg-slate-50 pb-2 border-b border-slate-100 z-10">
                                <div className="flex items-center gap-2">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                                        {finalProducts.length} sélectionné{finalProducts.length > 1 ? 's' : ''}
                                    </span>
                                    {excludedIds.size > 0 && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-[10px] font-bold">
                                            {excludedIds.size} exclu{excludedIds.size > 1 ? 's' : ''}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    {excludedIds.size > 0 && (
                                        <button
                                            onClick={handleRestoreAll}
                                            className="text-[10px] text-purple-600 hover:text-purple-800 font-medium underline underline-offset-2 transition-colors"
                                        >
                                            Tout restaurer
                                        </button>
                                    )}
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold">
                                        Aperçu — cliquer ✕ pour exclure
                                    </span>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                {filteredProducts.map(p => {
                                    const excluded = excludedIds.has(p.id);
                                    return (
                                        <div
                                            key={p.id}
                                            className={`flex items-center justify-between p-2 rounded-lg border text-xs transition-all ${
                                                excluded
                                                    ? 'bg-red-50 border-red-100 opacity-50'
                                                    : 'bg-white border-slate-100'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                {excluded && <span className="shrink-0 text-[9px] font-bold text-red-400 uppercase tracking-wider">exclu</span>}
                                                <span className={`font-medium truncate ${excluded ? 'text-red-400 line-through' : 'text-slate-700'}`}>
                                                    {p.name}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0 ml-2">
                                                <span className="text-slate-400">{p.cip1}</span>
                                                <button
                                                    onClick={() => excluded ? setExcludedIds(prev => { const s = new Set(prev); s.delete(p.id); return s; }) : handleExclude(p.id)}
                                                    className={`size-5 rounded-full flex items-center justify-center transition-colors ${
                                                        excluded
                                                            ? 'bg-slate-200 text-slate-400 hover:bg-emerald-100 hover:text-emerald-600'
                                                            : 'bg-red-100 text-red-400 hover:bg-red-200 hover:text-red-600'
                                                    }`}
                                                    title={excluded ? 'Réinclure' : 'Exclure ce produit'}
                                                >
                                                    <X className="size-2.5" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
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
                        disabled={finalProducts.length === 0 || processing}
                    >
                        {processing ? (
                            <><span className="size-4 border-2 border-purple-400 border-t-white rounded-full animate-spin" />{t('stock:organisation.smart_organizer.processing')}</>
                        ) : (
                            <>{t('stock:organisation.smart_organizer.apply_btn', { name: targetCategory.name })} ({finalProducts.length})<ArrowRight className="size-4" /></>
                        )}
                    </button>
                </div>
            </div>
        </PremiumModal>
    );
}
