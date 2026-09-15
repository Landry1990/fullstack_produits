import { useState, useEffect, useMemo, useId } from 'react';
import { useDebounce } from 'use-debounce';
import { FixedSizeList } from 'react-window';
import type { ListChildComponentProps } from 'react-window';
import api from '../../services/api';
import { gooeyToast } from 'goey-toast';
import { Search, Sparkles, AlertCircle, ArrowRight, X, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import PremiumModal from './PremiumModal';
import { Switch } from '../ui/Switch';
import { Skeleton } from '../ui/Skeleton';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '../ui/Dialog';
import { cn } from '../../lib/utils';
import { logger } from '../../utils/logger';

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

interface IndexedProduct {
    product: MiniProduct;
    rawName: string;
    lowerName: string;
}

interface ProductListData {
    products: MiniProduct[];
    excludedIds: Set<number>;
    setExcludedIds: React.Dispatch<React.SetStateAction<Set<number>>>;
    excludedLabel: string;
    reincludeTitle: string;
    excludeTitle: string;
}

function getSuggestions(
    source: IndexedProduct[],
    term: string,
    mode: 'range' | 'contains',
    caseSensitive: boolean,
    max = 10
): string[] {
    const key = caseSensitive ? term : term.toLowerCase();
    if (!key) return [];

    const getKey = (item: IndexedProduct) => (caseSensitive ? item.rawName : item.lowerName);
    const result: string[] = [];

    if (mode === 'range') {
        let l = 0;
        let r = source.length;
        while (l < r) {
            const m = Math.floor((l + r) / 2);
            if (getKey(source[m]) < key) {
                l = m + 1;
            } else {
                r = m;
            }
        }
        for (let i = l; i < source.length && result.length < max; i++) {
            const name = source[i].product.name?.trim() || '';
            if (!result.includes(name)) result.push(name);
        }
    } else {
        for (const item of source) {
            if (result.length >= max) break;
            if (getKey(item).includes(key)) {
                const name = item.product.name?.trim() || '';
                if (!result.includes(name)) result.push(name);
            }
        }
    }

    return result;
}

interface SuggestionFieldProps {
    id: string;
    label: React.ReactNode;
    placeholder: string;
    value: string;
    onChange: (value: string) => void;
    suggestions: string[];
    clearTitle: string;
}

function SuggestionField({ id, label, placeholder, value, onChange, suggestions, clearTitle }: SuggestionFieldProps) {
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);

    useEffect(() => {
        setActiveIndex(-1);
    }, [suggestions]);

    const handleSelect = (suggestion: string) => {
        onChange(suggestion);
        setOpen(false);
    };

    return (
        <div className="relative">
            <label htmlFor={id} className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                {label}
            </label>
            <div className="relative">
                <input
                    id={id}
                    type="text"
                    className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 focus:outline-none focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                    placeholder={placeholder}
                    value={value}
                    onChange={e => { onChange(e.target.value); setOpen(true); }}
                    onFocus={() => value && suggestions.length > 0 && setOpen(true)}
                    onBlur={() => setTimeout(() => setOpen(false), 150)}
                    onKeyDown={e => {
                        if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            if (!open && suggestions.length > 0) setOpen(true);
                            setActiveIndex(i => Math.min(i + 1, suggestions.length - 1));
                        } else if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            setActiveIndex(i => Math.max(i - 1, -1));
                        } else if (e.key === 'Enter') {
                            e.preventDefault();
                            const target = activeIndex >= 0 ? suggestions[activeIndex] : suggestions[0];
                            if (target) handleSelect(target);
                        } else if (e.key === 'Escape') {
                            setOpen(false);
                        }
                    }}
                />
                {value && (
                    <button
                        type="button"
                        onClick={() => onChange('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors"
                        title={clearTitle}
                        aria-label={clearTitle}
                    >
                        <X className="size-4" />
                    </button>
                )}
            </div>
            {open && suggestions.length > 0 && (
                <ul
                    className="absolute z-50 mt-1 w-full max-h-48 overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg py-1"
                    role="listbox"
                >
                    {suggestions.map((suggestion, idx) => (
                        <li
                            key={suggestion}
                            role="option"
                            aria-selected={idx === activeIndex}
                            className={cn(
                                "px-3 py-2 text-sm cursor-pointer truncate transition-colors",
                                idx === activeIndex ? "bg-purple-50 text-purple-700" : "text-slate-700 hover:bg-slate-50"
                            )}
                            onMouseDown={() => handleSelect(suggestion)}
                        >
                            {suggestion}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

const ProductRow = ({ index, style, data }: ListChildComponentProps<ProductListData>) => {
    const { products, excludedIds, setExcludedIds, excludedLabel, reincludeTitle, excludeTitle } = data;
    const p = products[index];
    const excluded = excludedIds.has(p.id);

    return (
        <div style={style} className="px-4">
            <div
                className={`flex items-center justify-between p-2 rounded-lg border text-xs transition-all ${
                    excluded
                        ? 'bg-red-50 border-red-100 opacity-50'
                        : 'bg-white border-slate-100'
                }`}
            >
                <div className="flex items-center gap-2 min-w-0">
                    {excluded && <span className="shrink-0 text-[9px] font-bold text-red-400 uppercase tracking-wider">{excludedLabel}</span>}
                    <span className={`font-medium truncate ${excluded ? 'text-red-400 line-through' : 'text-slate-700'}`}>
                        {p.name}
                    </span>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-slate-400">{p.cip1}</span>
                    <button
                        onClick={() =>
                            excluded
                                ? setExcludedIds(prev => { const s = new Set(prev); s.delete(p.id); return s; })
                                : setExcludedIds(prev => new Set([...prev, p.id]))
                        }
                        className={`size-5 rounded-full flex items-center justify-center transition-colors ${
                            excluded
                                ? 'bg-slate-200 text-slate-400 hover:bg-emerald-100 hover:text-emerald-600'
                                : 'bg-red-100 text-red-400 hover:bg-red-200 hover:text-red-600'
                        }`}
                        title={excluded ? reincludeTitle : excludeTitle}
                        aria-label={excluded ? reincludeTitle : excludeTitle}
                    >
                        <X className="size-2.5" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default function SmartOrganizerModal({ isOpen, onClose, targetCategory, onSuccess }: SmartOrganizerModalProps) {
    const { t } = useTranslation(['stock', 'common', 'products']);
    const [allProducts, setAllProducts] = useState<MiniProduct[]>([]);
    const [loading, setLoading] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [excludedIds, setExcludedIds] = useState<Set<number>>(new Set());
    const [confirmOpen, setConfirmOpen] = useState(false);

    const fromId = useId();
    const toId = useId();
    const containsId = useId();
    const caseId = useId();

    // Filters
    const [fromName, setFromName] = useState('');
    const [toName, setToName] = useState('');
    const [contains, setContains] = useState('');
    const [caseSensitive, setCaseSensitive] = useState(false);

    const [debouncedFromName] = useDebounce(fromName, 300);
    const [debouncedToName] = useDebounce(toName, 300);
    const [debouncedContains] = useDebounce(contains, 300);

    const [suggestFrom] = useDebounce(fromName, 150);
    const [suggestTo] = useDebounce(toName, 150);
    const [suggestContains] = useDebounce(contains, 150);

    useEffect(() => {
        if (isOpen) {
            fetchAllProducts();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) {
            setFromName('');
            setToName('');
            setContains('');
            setExcludedIds(new Set());
            setConfirmOpen(false);
        }
    }, [isOpen]);

    // Reset exclusions quand les filtres changent
    useEffect(() => {
        setExcludedIds(new Set());
    }, [debouncedFromName, debouncedToName, debouncedContains, caseSensitive]);

    const fetchAllProducts = async () => {
        setLoading(true);
        try {
            const res = await api.get('produits/for_import/');
            setAllProducts(res.data);
        } catch (err) {
            logger.error("Error fetching products for organizer:", err);
            gooeyToast.error(t('stock:organisation.smart_organizer.load_error'));
        } finally {
            setLoading(false);
        }
    };

    const productIndexes = useMemo(() => {
        const items = allProducts.map(p => {
            const rawName = p.name?.trim() || '';
            return { product: p, rawName, lowerName: rawName.toLowerCase() } as IndexedProduct;
        });
        return {
            raw: [...items].sort((a, b) => a.rawName.localeCompare(b.rawName)),
            lower: [...items].sort((a, b) => a.lowerName.localeCompare(b.lowerName)),
        };
    }, [allProducts]);

    const source = caseSensitive ? productIndexes.raw : productIndexes.lower;

    const fromSuggestions = useMemo(
        () => getSuggestions(source, suggestFrom, 'range', caseSensitive),
        [source, suggestFrom, caseSensitive]
    );
    const toSuggestions = useMemo(
        () => getSuggestions(source, suggestTo, 'range', caseSensitive),
        [source, suggestTo, caseSensitive]
    );
    const containsSuggestions = useMemo(
        () => getSuggestions(source, suggestContains, 'contains', caseSensitive),
        [source, suggestContains, caseSensitive]
    );

    const filteredProducts = useMemo(() => {
        const rawFrom = debouncedFromName.trim();
        const rawTo = debouncedToName.trim();
        const rawContains = debouncedContains.trim();

        // Ne rien filtrer si tous les champs sont vides
        if (!rawFrom && !rawTo && !rawContains) return [];

        const fName = caseSensitive ? rawFrom : rawFrom.toLowerCase();
        const tName = caseSensitive ? rawTo : rawTo.toLowerCase();
        const cTerm = caseSensitive ? rawContains : rawContains.toLowerCase();

        const getKey = (item: IndexedProduct) => (caseSensitive ? item.rawName : item.lowerName);

        const lowerBound = (key: string) => {
            let l = 0;
            let r = source.length;
            while (l < r) {
                const m = Math.floor((l + r) / 2);
                if (getKey(source[m]) < key) {
                    l = m + 1;
                } else {
                    r = m;
                }
            }
            return l;
        };

        const upperBound = (key: string) => {
            let l = 0;
            let r = source.length;
            while (l < r) {
                const m = Math.floor((l + r) / 2);
                if (getKey(source[m]) <= key) {
                    l = m + 1;
                } else {
                    r = m;
                }
            }
            return l;
        };

        const start = fName ? lowerBound(fName) : 0;

        // Pour que la borne supérieure soit inclusive du mot complet (ex: 'daflon')
        // mais exclue ce qui vient juste après (ex: 'demobac'),
        // on ajoute un caractère unicode très élevé en fin de chaîne.
        const end = tName ? upperBound(tName + '\uffff') : source.length;
        const candidates = source.slice(start, end);

        if (cTerm) {
            return candidates
                .filter(item => (caseSensitive ? item.rawName : item.lowerName).includes(cTerm))
                .map(item => item.product);
        }

        return candidates.map(item => item.product);
    }, [source, caseSensitive, debouncedFromName, debouncedToName, debouncedContains]);

    const finalProducts = useMemo(
        () => filteredProducts.filter(p => !excludedIds.has(p.id)),
        [filteredProducts, excludedIds]
    );

    const hasActiveFilters = debouncedFromName.trim() || debouncedToName.trim() || debouncedContains.trim();

    const handleExcludeAll = () => {
        setExcludedIds(prev => {
            const next = new Set(prev);
            for (const p of filteredProducts) {
                next.add(p.id);
            }
            return next;
        });
    };

    const handleIncludeAll = () => {
        setExcludedIds(prev => {
            const next = new Set(prev);
            for (const p of filteredProducts) {
                next.delete(p.id);
            }
            return next;
        });
    };

    const handleInvert = () => {
        setExcludedIds(prev => {
            const next = new Set<number>();
            for (const p of filteredProducts) {
                if (!prev.has(p.id)) next.add(p.id);
            }
            for (const id of prev) {
                if (!filteredProducts.some(p => p.id === id)) next.add(id);
            }
            return next;
        });
    };

    const executeApply = async () => {
        if (finalProducts.length === 0) return;

        setConfirmOpen(false);
        setProcessing(true);
        try {
            const res = await api.post('produits/bulk-categorize/', {
                ids: finalProducts.map(p => p.id),
                category_type: targetCategory.type,
                category_id: targetCategory.id
            });

            gooeyToast.success(t('stock:organisation.smart_organizer.success_message', { count: res.data.updated_count, name: targetCategory.name }));
            onSuccess();
            onClose();
        } catch (err: unknown) {
            logger.error("Error bulk categorizing:", err);
            gooeyToast.error((err as { response?: { data?: { detail?: string } } }).response?.data?.detail || t('stock:organisation.smart_organizer.bulk_error'));
        } finally {
            setProcessing(false);
        }
    };

    const isComputing =
        loading ||
        fromName !== debouncedFromName ||
        toName !== debouncedToName ||
        contains !== debouncedContains;

    const listData = useMemo<ProductListData>(
        () => ({
            products: filteredProducts,
            excludedIds,
            setExcludedIds,
            excludedLabel: t('stock:organisation.smart_organizer.excluded'),
            reincludeTitle: t('stock:organisation.smart_organizer.reinclude'),
            excludeTitle: t('stock:organisation.smart_organizer.exclude_item'),
        }),
        [filteredProducts, excludedIds, t]
    );

    const itemSize = 48;
    const listHeight = Math.min(240, filteredProducts.length * itemSize);

    return (
        <>
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
                        <SuggestionField
                            id={fromId}
                            label={t('stock:organisation.smart_organizer.from_label')}
                            placeholder={t('products:smart_organizer.example_name')}
                            value={fromName}
                            onChange={setFromName}
                            suggestions={fromSuggestions}
                            clearTitle={t('stock:organisation.smart_organizer.clear_field')}
                        />
                        <SuggestionField
                            id={toId}
                            label={t('stock:organisation.smart_organizer.to_label')}
                            placeholder={t('products:smart_organizer.example_name_to')}
                            value={toName}
                            onChange={setToName}
                            suggestions={toSuggestions}
                            clearTitle={t('stock:organisation.smart_organizer.clear_field')}
                        />
                        <SuggestionField
                            id={containsId}
                            label={t('stock:organisation.smart_organizer.contains_label')}
                            placeholder={t('products:smart_organizer.example_form')}
                            value={contains}
                            onChange={setContains}
                            suggestions={containsSuggestions}
                            clearTitle={t('stock:organisation.smart_organizer.clear_field')}
                        />
                    </div>

                    <div className="flex items-center gap-3">
                        <Switch
                            id={caseId}
                            checked={caseSensitive}
                            onCheckedChange={setCaseSensitive}
                            aria-label={t('stock:organisation.smart_organizer.case_sensitive')}
                        />
                        <label htmlFor={caseId} className="text-xs font-medium text-slate-500 cursor-pointer">
                            {t('stock:organisation.smart_organizer.case_sensitive')}
                        </label>
                    </div>

                    <div className="border-t border-slate-100"></div>

                    <div
                        className="bg-slate-50 rounded-2xl border border-slate-200 min-h-[150px] max-h-[300px] overflow-hidden flex flex-col"
                        aria-busy={isComputing}
                    >
                        {loading ? (
                            <div className="flex flex-col p-6 space-y-4 text-slate-400">
                                <Skeleton className="h-9 w-full" />
                                <Skeleton className="h-9 w-full" />
                                <Skeleton className="h-9 w-2/3" />
                                <p className="text-xs text-center">{t('stock:organisation.smart_organizer.loading_products')}</p>
                            </div>
                        ) : filteredProducts.length > 0 ? (
                            <div className="flex flex-col min-h-0 flex-1">
                                <div className="flex justify-between items-center p-4 pb-2 border-b border-slate-100 shrink-0 gap-2 flex-wrap">
                                    <div className="flex items-center gap-2" aria-live="polite" aria-atomic="true">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                                            {t('stock:organisation.smart_organizer.products_found', { count: finalProducts.length })}
                                        </span>
                                        {excludedIds.size > 0 && (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-[10px] font-bold">
                                                {excludedIds.size} {t('stock:organisation.smart_organizer.excluded')}
                                            </span>
                                        )}
                                        {isComputing && (
                                            <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                                                <Loader2 className="size-3 animate-spin" />
                                                {t('stock:organisation.smart_organizer.computing_preview')}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {filteredProducts.length > 0 && (
                                            <>
                                                <button
                                                    onClick={handleExcludeAll}
                                                    disabled={finalProducts.length === 0}
                                                    className="text-[10px] text-red-600 hover:text-red-800 font-medium underline underline-offset-2 transition-colors disabled:opacity-40"
                                                    aria-label={t('stock:organisation.smart_organizer.exclude_all')}
                                                >
                                                    {t('stock:organisation.smart_organizer.exclude_all')}
                                                </button>
                                                <button
                                                    onClick={handleIncludeAll}
                                                    disabled={excludedIds.size === 0}
                                                    className="text-[10px] text-emerald-600 hover:text-emerald-800 font-medium underline underline-offset-2 transition-colors disabled:opacity-40"
                                                    aria-label={t('stock:organisation.smart_organizer.include_all')}
                                                >
                                                    {t('stock:organisation.smart_organizer.include_all')}
                                                </button>
                                                <button
                                                    onClick={handleInvert}
                                                    disabled={filteredProducts.length === 0}
                                                    className="text-[10px] text-purple-600 hover:text-purple-800 font-medium underline underline-offset-2 transition-colors disabled:opacity-40"
                                                    aria-label={t('stock:organisation.smart_organizer.invert_selection')}
                                                >
                                                    {t('stock:organisation.smart_organizer.invert_selection')}
                                                </button>
                                            </>
                                        )}
                                        <span
                                            className="inline-flex items-center px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold"
                                            title={t('stock:organisation.smart_organizer.preview_hint')}
                                        >
                                            {t('stock:organisation.smart_organizer.preview')}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex-1 min-h-0">
                                    <FixedSizeList
                                        height={listHeight}
                                        width="100%"
                                        itemSize={itemSize}
                                        itemCount={filteredProducts.length}
                                        itemData={listData}
                                    >
                                        {ProductRow}
                                    </FixedSizeList>
                                </div>
                            </div>
                        ) : hasActiveFilters ? (
                            <div className="flex flex-col items-center justify-center p-12 text-slate-400 gap-2">
                                <Search className="size-8 text-slate-200" />
                                <p className="text-sm italic">{t('stock:organisation.smart_organizer.no_results')}</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center p-12 text-slate-400 gap-2">
                                <Sparkles className="size-8 text-slate-200" />
                                <p className="text-sm italic text-center">{t('stock:organisation.smart_organizer.start_typing')}</p>
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
                            onClick={() => setConfirmOpen(true)}
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

            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{t('stock:organisation.smart_organizer.confirm_title')}</DialogTitle>
                        <DialogDescription>
                            {t('stock:organisation.smart_organizer.confirm_description', { count: finalProducts.length, name: targetCategory.name })}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-2 text-sm text-slate-700">
                        <p>
                            <span className="font-semibold">{t('stock:organisation.smart_organizer.from_label')} :</span> {fromName || '-'}
                        </p>
                        <p>
                            <span className="font-semibold">{t('stock:organisation.smart_organizer.to_label')} :</span> {toName || '-'}
                        </p>
                        <p>
                            <span className="font-semibold">{t('stock:organisation.smart_organizer.contains_label')} :</span> {contains || '-'}
                        </p>
                        <p>
                            <span className="font-semibold">{t('stock:organisation.smart_organizer.products_found', { count: finalProducts.length })}</span>
                        </p>
                    </div>
                    <DialogFooter className="gap-2">
                        <button
                            onClick={() => setConfirmOpen(false)}
                            className="inline-flex items-center h-9 px-5 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-medium transition-colors"
                            disabled={processing}
                        >
                            {t('common:cancel')}
                        </button>
                        <button
                            onClick={executeApply}
                            disabled={finalProducts.length === 0 || processing}
                            className="inline-flex items-center gap-2 h-9 px-6 bg-purple-600 text-white rounded-xl text-sm font-bold hover:bg-purple-700 transition-colors shadow-sm disabled:opacity-50"
                        >
                            {processing ? (
                                <><span className="size-4 border-2 border-purple-400 border-t-white rounded-full animate-spin" />{t('stock:organisation.smart_organizer.processing')}</>
                            ) : (
                                <>{t('stock:organisation.smart_organizer.confirm_confirm')}<ArrowRight className="size-4" /></>
                            )}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
