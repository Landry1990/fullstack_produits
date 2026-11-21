import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDebounce } from 'use-debounce';
import { X, Loader2, Search, Plus } from 'lucide-react';
import type { ClientCreditCreatePayload, ClientCreditTypeMotif } from '../../types';
import type { ProduitModel, Facture } from '../../types';
import { Button } from '../shadcn/button';
import { Input } from '../shadcn/input';
import { Select } from '../shadcn/select';
import { Textarea } from '../shadcn/textarea';
import api from '../../services/api';
import { useProductSearch } from '../../hooks/useProductSearch';
import { formatCurrency as formatCurrencyValue } from '../../utils/formatters';
import { EmptyState } from '../ui/EmptyState';
import { Skeleton } from '../shadcn/skeleton';
import { ProductResultRow, type SearchResult } from '../common/ProductSearch';
import { usePharmacySettings } from '../../hooks/usePharmacySettings';
import { isLotExpired } from '../../utils/expiry';
import { gooeyToast } from 'goey-toast';

interface FormLine {
    id: string;
    produit: number | null;
    produit_nom: string;
    quantity: number;
    prix_unitaire: string;
    remise: string;
    tva: string;
    lot: string;
    stock_lot: number | null;
    date_expiration: string | null;
    use_lot_management: boolean;
    lot_locked: boolean;
}

interface SelectedInvoice {
    id: number;
    numero_facture: string;
    client: number | null;
    client_name: string;
}

interface ClientCreditFormProps {
    onSubmit: (data: ClientCreditCreatePayload) => void;
    onCancel: () => void;
    isSubmitting: boolean;
}

export const ClientCreditForm: React.FC<ClientCreditFormProps> = ({
    onSubmit,
    onCancel,
    isSubmitting,
}) => {
    const { t } = useTranslation(['avoirs_client', 'common']);
    const locale = t('common:locale');
    const { settings } = usePharmacySettings();

    const [invoiceSearch, setInvoiceSearch] = useState('');
    const [debouncedInvoiceSearch] = useDebounce(invoiceSearch, 300);
    const [invoiceResults, setInvoiceResults] = useState<SelectedInvoice[]>([]);
    const [invoicesLoading, setInvoicesLoading] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<SelectedInvoice | null>(null);

    const [lines, setLines] = useState<FormLine[]>([]);
    const [typeMotif, setTypeMotif] = useState<ClientCreditTypeMotif>('AUTRE');
    const [notes, setNotes] = useState('');

    const {
        produits,
        searchQuery: productSearch,
        setSearchQuery: setProductSearch,
        loading: productsLoading,
    } = useProductSearch({ minSearchLength: 2, pageSize: 10 });

    useEffect(() => {
        if (!debouncedInvoiceSearch || debouncedInvoiceSearch.length < 2) {
            setInvoiceResults([]);
            return;
        }
        const search = async () => {
            setInvoicesLoading(true);
            try {
                const response = await api.get('factures/', {
                    params: { search: debouncedInvoiceSearch, page_size: 10 },
                });
                const data = response.data;
                const results = Array.isArray(data) ? data : data.results || [];
                setInvoiceResults(
                    results.map((f: Facture) => ({
                        id: f.id,
                        numero_facture: f.numero_facture || String(f.id),
                        client: f.client,
                        client_name: f.client_name || f.client_name_override || t('list.no_client'),
                    }))
                );
            } catch {
                setInvoiceResults([]);
            } finally {
                setInvoicesLoading(false);
            }
        };
        search();
    }, [debouncedInvoiceSearch, t]);

    const handleSelectInvoice = async (invoice: SelectedInvoice) => {
        setSelectedInvoice(invoice);
        setInvoiceSearch(invoice.numero_facture);
        setInvoiceResults([]);
        try {
            const response = await api.get('avoirs-clients/from_invoice/', {
                params: { facture_id: invoice.id },
            });
            const data = response.data;
            if (data.lignes && data.lignes.length > 0) {
                setLines(
                    data.lignes.map((ligne: {
                        produit: number;
                        produit_nom: string;
                        quantity: number;
                        prix_unitaire: string;
                        remise: string;
                        tva: string;
                        lot: string;
                        stock_lot: number | null;
                        date_expiration?: string | null;
                        use_lot_management?: boolean;
                    }) => ({
                        id: `${ligne.produit}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                        produit: ligne.produit,
                        produit_nom: ligne.produit_nom,
                        quantity: ligne.quantity,
                        prix_unitaire: ligne.prix_unitaire,
                        remise: ligne.remise || '0',
                        tva: ligne.tva || '0',
                        lot: ligne.lot || '',
                        stock_lot: ligne.stock_lot,
                        date_expiration: ligne.date_expiration || null,
                        use_lot_management: ligne.use_lot_management || false,
                        lot_locked: !!ligne.stock_lot,
                    }))
                );
            }
        } catch {
            gooeyToast.error(t('messages.invoice_load_error'));
        }
    };

    const addLine = () => {
        setLines((prev) => [
            ...prev,
            {
                id: `new-${Date.now()}`,
                produit: null,
                produit_nom: '',
                quantity: 1,
                prix_unitaire: '0',
                remise: '0',
                tva: '0',
                lot: '',
                stock_lot: null,
                date_expiration: null,
                use_lot_management: false,
                lot_locked: false,
            },
        ]);
    };

    const removeLine = (lineId: string) => {
        setLines((prev) => prev.filter((l) => l.id !== lineId));
    };

    const updateLine = (lineId: string, updates: Partial<FormLine>) => {
        setLines((prev) => prev.map((l) => (l.id === lineId ? { ...l, ...updates } : l)));
    };

    const handleSelectProduct = (lineId: string, product: ProduitModel) => {
        updateLine(lineId, {
            produit: product.id,
            produit_nom: product.name,
            prix_unitaire: String(product.selling_price || 0),
        });
        setProductSearch('');
    };

    const getLineTotal = (line: FormLine) => {
        const qty = Number(line.quantity) || 0;
        const price = Number(line.prix_unitaire) || 0;
        const remise = Number(line.remise) || 0;
        const tva = Number(line.tva) || 0;
        const ht = qty * price - remise;
        return Math.max(0, ht + (ht * tva) / 100);
    };

    const total = useMemo(() => {
        return lines.reduce((sum, line) => sum + getLineTotal(line), 0);
    }, [lines]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (lines.length === 0) {
            gooeyToast.error(t('messages.no_lines'));
            return;
        }
        const missingLot = lines.find((l) => l.use_lot_management && !l.stock_lot);
        if (missingLot) {
            gooeyToast.error(t('form.lot_required'));
            return;
        }
        const payload: ClientCreditCreatePayload = {
            facture_origine: selectedInvoice?.id || null,
            client: selectedInvoice?.client || null,
            montant_total: total.toFixed(2),
            type_motif: typeMotif,
            notes,
            lignes: lines.map((line) => ({
                produit: line.produit!,
                quantity: Number(line.quantity),
                prix_unitaire: line.prix_unitaire,
                remise: line.remise || '0',
                tva: line.tva || '0',
                lot: line.lot,
                stock_lot: line.stock_lot,
            })),
        };
        onSubmit(payload);
    };

    const formatCurrency = (value: number) => {
        const num = isNaN(value) ? 0 : value;
        return formatCurrencyValue(num, locale, 'FCFA');
    };

    return (
        <form onSubmit={handleSubmit} className="mx-auto w-full max-w-7xl space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                    {/* Invoice origin search */}
                    <div className="relative space-y-2">
                        <label htmlFor="invoice-search" className="block text-xs font-bold uppercase tracking-wider text-slate-600">{t('form.invoice_origin')}</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                            <Input
                                id="invoice-search"
                                value={invoiceSearch}
                                onChange={(e) => {
                                    setInvoiceSearch(e.target.value);
                                    if (selectedInvoice && e.target.value !== selectedInvoice.numero_facture) {
                                        setSelectedInvoice(null);
                                    }
                                }}
                                placeholder={t('form.invoice_search_placeholder')}
                                className="h-11 pl-9"
                                disabled={isSubmitting}
                            />
                            {invoicesLoading && (
                                <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-slate-400" />
                            )}
                        </div>
                        {invoiceResults.length > 0 && (
                            <ul role="listbox" className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                                {invoiceResults.map((invoice) => (
                                    <li
                                        key={invoice.id}
                                        role="option"
                                        aria-selected={false}
                                        tabIndex={0}
                                        className="cursor-pointer px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                        onClick={() => handleSelectInvoice(invoice)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                handleSelectInvoice(invoice);
                                            }
                                        }}
                                    >
                                        {invoice.numero_facture} — {invoice.client_name}
                                    </li>
                                ))}
                            </ul>
                        )}
                        {selectedInvoice && (
                            <p className="text-xs font-semibold text-emerald-600">
                                {t('form.selected_invoice')}: {selectedInvoice.numero_facture}
                            </p>
                        )}
                    </div>

                    {/* Client */}
                    <div className="space-y-2">
                        <label htmlFor="client-display" className="block text-xs font-bold uppercase tracking-wider text-slate-600">{t('form.client')}</label>
                        <Input
                            id="client-display"
                            value={selectedInvoice?.client_name || t('list.no_client')}
                            readOnly
                            disabled
                            className="h-11 bg-slate-50 font-medium"
                        />
                    </div>

                    {/* Motif */}
                    <div className="space-y-2">
                        <label htmlFor="type-motif" className="block text-xs font-bold uppercase tracking-wider text-slate-600">{t('form.type_motif')}</label>
                        <Select
                            id="type-motif"
                            value={typeMotif}
                            onChange={(e) => setTypeMotif(e.target.value as ClientCreditTypeMotif)}
                            disabled={isSubmitting}
                            className="h-11"
                        >
                            <option value="ERREUR">{t('motifs.erreur')}</option>
                            <option value="RETOUR">{t('motifs.retour')}</option>
                            <option value="REMISE">{t('motifs.remise')}</option>
                            <option value="AUTRE">{t('motifs.autre')}</option>
                        </Select>
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                        <label htmlFor="notes" className="block text-xs font-bold uppercase tracking-wider text-slate-600">{t('form.notes')}</label>
                        <Textarea
                            id="notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder={t('form.notes_placeholder')}
                            rows={3}
                            disabled={isSubmitting}
                            className="min-h-[88px]"
                        />
                    </div>
                </div>
            </div>

            {/* Lines */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4">
                    <div className="flex items-center gap-3">
                        <h3 className="text-sm font-bold uppercase tracking-tight text-slate-800">{t('form.lines_title')}</h3>
                        {lines.length > 0 && (
                            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">
                                {lines.length}
                            </span>
                        )}
                    </div>
                    <Button type="button" variant="outline" onClick={addLine} disabled={isSubmitting}>
                        <Plus className="size-4" />
                        {t('form.add_line')}
                    </Button>
                </div>

                {lines.length === 0 ? (
                    <div className="p-4">
                        <EmptyState
                            compact
                            title={t('form.no_lines')}
                            className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 py-10"
                            action={(
                                <Button type="button" onClick={addLine} disabled={isSubmitting}>
                                    <Plus className="size-4" />
                                    {t('form.add_line')}
                                </Button>
                            )}
                        />
                    </div>
                ) : (
                    <div className="space-y-4 p-4">
                        {lines.map((line) => (
                            <div
                                key={line.id}
                                className="relative space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 pr-14"
                            >
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeLine(line.id)}
                                disabled={isSubmitting}
                                className="absolute right-2 top-2 size-8 text-slate-400 hover:bg-red-50 hover:text-red-600"
                                aria-label={t('common:remove')}
                            >
                                <X className="size-4" />
                            </Button>
                            <div className="grid grid-cols-1 gap-4 xl:grid-cols-12 xl:items-end">
                                <div className="relative space-y-1.5 xl:col-span-5">
                                    <label htmlFor={`credit-product-${line.id}`} className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('form.product')}</label>
                                    {line.produit ? (
                                        <div className="flex h-11 items-center justify-between rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium">
                                            <span className="truncate">{line.produit_nom}</span>
                                            <button
                                                type="button"
                                                onClick={() => updateLine(line.id, { produit: null, produit_nom: '' })}
                                                className="text-slate-400 hover:text-red-500"
                                                aria-label={t('common:remove')}
                                            >
                                                <X className="size-3.5" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="relative">
                                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
                                            <Input
                                                id={`credit-product-${line.id}`}
                                                value={line.produit_nom}
                                                onChange={(e) => {
                                                    updateLine(line.id, { produit_nom: e.target.value });
                                                    setProductSearch(e.target.value);
                                                }}
                                                placeholder={t('form.product_placeholder')}
                                                className="h-11 pl-8 text-sm"
                                                disabled={isSubmitting}
                                            />
                                            {productSearch && !line.produit && (
                                                <div role="listbox" className="absolute z-10 w-full bg-white border border-slate-200 rounded-md shadow-lg max-h-56 overflow-auto mt-1 p-1 space-y-0.5">
                                                    {productsLoading ? (
                                                        <div className="px-3 py-2 space-y-2">
                                                            <Skeleton className="h-4 w-3/4" />
                                                            <Skeleton className="h-4 w-1/2" />
                                                        </div>
                                                    ) : produits.length === 0 ? (
                                                        <div className="px-3 py-2 text-sm text-slate-500">
                                                            {t('form.no_products')}
                                                        </div>
                                                    ) : (
                                                        produits.map((p) => (
                                                            <ProductResultRow
                                                                key={p.id}
                                                                product={p as unknown as SearchResult}
                                                                role="option"
                                                                aria-selected={false}
                                                                tabIndex={0}
                                                                onClick={() => handleSelectProduct(line.id, p)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                                        e.preventDefault();
                                                                        handleSelectProduct(line.id, p);
                                                                    }
                                                                }}
                                                            />
                                                        ))
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-1.5 xl:col-span-1">
                                    <label htmlFor={`credit-qty-${line.id}`} className="block text-xs font-bold uppercase tracking-wider text-slate-500">{t('form.quantity')}</label>
                                    <Input
                                        id={`credit-qty-${line.id}`}
                                        type="number"
                                        min={1}
                                        value={line.quantity}
                                        onChange={(e) => updateLine(line.id, { quantity: parseInt(e.target.value) || 0 })}
                                        disabled={isSubmitting}
                                        className="h-11"
                                    />
                                </div>
                                <div className="space-y-1.5 xl:col-span-2">
                                    <label htmlFor={`credit-price-${line.id}`} className="block text-xs font-bold uppercase tracking-wider text-slate-500">{t('form.unit_price')}</label>
                                    <Input
                                        id={`credit-price-${line.id}`}
                                        type="number"
                                        step="0.01"
                                        min={0}
                                        value={line.prix_unitaire}
                                        onChange={(e) => updateLine(line.id, { prix_unitaire: e.target.value })}
                                        disabled={isSubmitting}
                                        className="h-11"
                                    />
                                </div>
                                <div className="space-y-1.5 xl:col-span-2">
                                    <label htmlFor={`credit-discount-${line.id}`} className="block text-xs font-bold uppercase tracking-wider text-slate-500">{t('form.discount')}</label>
                                    <Input
                                        id={`credit-discount-${line.id}`}
                                        type="number"
                                        step="0.01"
                                        min={0}
                                        value={line.remise}
                                        onChange={(e) => updateLine(line.id, { remise: e.target.value })}
                                        disabled={isSubmitting}
                                        className="h-11"
                                    />
                                </div>
                                <div className="space-y-1.5 xl:col-span-1">
                                    <label htmlFor={`credit-vat-${line.id}`} className="block text-xs font-bold uppercase tracking-wider text-slate-500">{t('form.vat')}</label>
                                    <Input
                                        id={`credit-vat-${line.id}`}
                                        type="number"
                                        step="0.01"
                                        min={0}
                                        value={line.tva}
                                        onChange={(e) => updateLine(line.id, { tva: e.target.value })}
                                        disabled={isSubmitting}
                                        className="h-11"
                                    />
                                </div>
                                <div className="space-y-1.5 xl:col-span-1">
                                    <span className="block text-xs font-bold uppercase tracking-wider text-slate-500">{t('form.total')}</span>
                                    <div className="flex h-11 items-center justify-end whitespace-nowrap font-black text-red-600">
                                        -{formatCurrency(getLineTotal(line))}
                                    </div>
                                </div>
                            </div>
                            {line.lot_locked && line.stock_lot && (
                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-medium">
                                        {t('form.lot')}: {line.lot}
                                    </span>
                                    {line.date_expiration && (
                                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border font-medium ${
                                            isLotExpired(line.date_expiration, settings.expiry_cutoff)
                                                ? 'bg-red-50 text-red-700 border-red-200'
                                                : 'bg-amber-50 text-amber-700 border-amber-200'
                                        }`}>
                                            {t('form.expires')}: {new Date(line.date_expiration).toLocaleDateString()}
                                        </span>
                                    )}
                                    <span className="text-slate-400">{t('form.lot_from_invoice')}</span>
                                </div>
                            )}
                            {line.use_lot_management && !line.stock_lot && (
                                <div className="text-xs text-red-600 font-medium">
                                    {t('form.lot_required')}
                                </div>
                            )}
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{t('form.total')}</span>
                    <span className="text-xl font-black text-red-600">-{formatCurrency(total)}</span>
                </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <Button type="button" variant="outline" size="lg" onClick={onCancel} disabled={isSubmitting}>
                    {t('common:cancel')}
                </Button>
                <Button type="submit" size="lg" disabled={isSubmitting || lines.length === 0}>
                    {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                    {t('form.create')}
                </Button>
            </div>
        </form>
    );
};
