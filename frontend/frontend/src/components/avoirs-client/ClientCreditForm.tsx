import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDebounce } from 'use-debounce';
import { X, Loader2, Search, Plus } from 'lucide-react';
import type { ClientCreditCreatePayload, ClientCreditTypeMotif, RefundMethod } from '../../types';
import type { ProduitModel, Facture } from '../../types';
import { Button } from '../shadcn/button';
import { Input } from '../shadcn/input';
import { Select } from '../shadcn/select';
import { Textarea } from '../shadcn/textarea';
import api from '../../services/api';
import { useProductSearch } from '../../hooks/useProductSearch';
import { cn } from '../../lib/utils';
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
    const locale = t('common:locale', { defaultValue: 'fr-FR' });

    const [invoiceSearch, setInvoiceSearch] = useState('');
    const [debouncedInvoiceSearch] = useDebounce(invoiceSearch, 300);
    const [invoiceResults, setInvoiceResults] = useState<SelectedInvoice[]>([]);
    const [invoicesLoading, setInvoicesLoading] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<SelectedInvoice | null>(null);

    const [lines, setLines] = useState<FormLine[]>([]);
    const [refundMethod, setRefundMethod] = useState<RefundMethod>('cash');
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
        } catch (err: unknown) {
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

    const total = useMemo(() => {
        return lines.reduce((sum, line) => {
            const qty = Number(line.quantity) || 0;
            const price = Number(line.prix_unitaire) || 0;
            const remise = Number(line.remise) || 0;
            const tva = Number(line.tva) || 0;
            const ht = qty * price - remise;
            const ttc = ht + (ht * tva) / 100;
            return sum + Math.max(0, ttc);
        }, 0);
    }, [lines]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (lines.length === 0) {
            gooeyToast.error(t('messages.no_lines'));
            return;
        }
        if (refundMethod === 'credit' && !selectedInvoice?.client) {
            gooeyToast.error(t('messages.credit_requires_client'));
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
        try {
            return new Intl.NumberFormat(locale, {
                style: 'decimal',
                minimumFractionDigits: 0,
            })
                .format(num) + ' FCFA';
        } catch {
            return `${num.toLocaleString(locale)} FCFA`;
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Invoice origin search */}
                <div className="space-y-2 relative">
                    <label htmlFor="invoice-search" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('form.invoice_origin')}</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
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
                            className="pl-9"
                            disabled={isSubmitting}
                        />
                        {invoicesLoading && (
                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin text-slate-400" />
                        )}
                    </div>
                    {invoiceResults.length > 0 && (
                        <ul className="absolute z-10 w-full bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-auto">
                            {invoiceResults.map((invoice) => (
                                <li
                                    key={invoice.id}
                                    className="px-3 py-2 hover:bg-slate-50 cursor-pointer text-sm text-slate-700"
                                    onClick={() => handleSelectInvoice(invoice)}
                                >
                                    {invoice.numero_facture} — {invoice.client_name}
                                </li>
                            ))}
                        </ul>
                    )}
                    {selectedInvoice && (
                        <p className="text-xs text-emerald-600 font-medium">
                            {t('form.selected_invoice')}: {selectedInvoice.numero_facture}
                        </p>
                    )}
                </div>

                {/* Client */}
                <div className="space-y-2">
                    <label htmlFor="client-display" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('form.client')}</label>
                    <Input
                        id="client-display"
                        value={selectedInvoice?.client_name || t('list.no_client')}
                        readOnly
                        disabled
                        className="bg-slate-50"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Refund method */}
                <div className="space-y-2">
                    <label htmlFor="refund-method" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('form.refund_method')}</label>
                    <Select
                        id="refund-method"
                        value={refundMethod}
                        onChange={(e) => setRefundMethod(e.target.value as RefundMethod)}
                        disabled={isSubmitting}
                    >
                        <option value="cash">{t('refund_methods.cash')}</option>
                        <option value="credit">{t('refund_methods.credit')}</option>
                    </Select>
                </div>

                {/* Motif */}
                <div className="space-y-2">
                    <label htmlFor="type-motif" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('form.type_motif')}</label>
                    <Select
                        id="type-motif"
                        value={typeMotif}
                        onChange={(e) => setTypeMotif(e.target.value as ClientCreditTypeMotif)}
                        disabled={isSubmitting}
                    >
                        <option value="ERREUR">{t('form.motifs.erreur')}</option>
                        <option value="RETOUR">{t('form.motifs.retour')}</option>
                        <option value="REMISE">{t('form.motifs.remise')}</option>
                        <option value="AUTRE">{t('form.motifs.autre')}</option>
                    </Select>
                </div>

                {/* Notes */}
                <div className="space-y-2 md:col-span-1">
                    <label htmlFor="notes" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('form.notes')}</label>
                    <Textarea
                        id="notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder={t('form.notes_placeholder')}
                        rows={3}
                        disabled={isSubmitting}
                    />
                </div>
            </div>

            {/* Lines */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-900">{t('form.lines_title')}</h3>
                    <Button type="button" variant="outline" size="sm" onClick={addLine} disabled={isSubmitting}>
                        <Plus className="size-4 mr-1" />
                        {t('form.add_line')}
                    </Button>
                </div>

                {lines.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 text-sm border border-dashed border-slate-200 rounded-xl">
                        {t('form.no_lines')}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {lines.map((line, index) => (
                            <div
                                key={line.id}
                                className="space-y-2 p-3 border border-slate-200 rounded-xl bg-white"
                            >
                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                                <div className="sm:col-span-4 space-y-1 relative">
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('form.product')}</label>
                                    {line.produit ? (
                                        <div className="flex items-center justify-between h-10 px-3 rounded-md border border-slate-200 bg-slate-50 text-sm">
                                            <span className="truncate">{line.produit_nom}</span>
                                            <button
                                                type="button"
                                                onClick={() => updateLine(line.id, { produit: null, produit_nom: '' })}
                                                className="text-slate-400 hover:text-red-500"
                                            >
                                                <X className="size-3.5" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="relative">
                                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
                                            <Input
                                                value={line.produit_nom}
                                                onChange={(e) => {
                                                    updateLine(line.id, { produit_nom: e.target.value });
                                                    setProductSearch(e.target.value);
                                                }}
                                                placeholder={t('form.product_placeholder')}
                                                className="pl-8 text-sm"
                                                disabled={isSubmitting}
                                            />
                                            {productSearch && !line.produit && (
                                                <ul className="absolute z-10 w-full bg-white border border-slate-200 rounded-md shadow-lg max-h-40 overflow-auto mt-1">
                                                    {productsLoading ? (
                                                        <li className="px-3 py-2 text-sm text-slate-500 flex items-center gap-2">
                                                            <Loader2 className="size-3.5 animate-spin" />
                                                            {t('common:loading')}
                                                        </li>
                                                    ) : produits.length === 0 ? (
                                                        <li className="px-3 py-2 text-sm text-slate-500">
                                                            {t('form.no_products')}
                                                        </li>
                                                    ) : (
                                                        produits.map((p) => (
                                                            <li
                                                                key={p.id}
                                                                className="px-3 py-2 hover:bg-slate-50 cursor-pointer text-sm text-slate-700 truncate"
                                                                onClick={() => handleSelectProduct(line.id, p)}
                                                            >
                                                                {p.name}
                                                            </li>
                                                        ))
                                                    )}
                                                </ul>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="sm:col-span-1 space-y-1">
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('form.quantity')}</label>
                                    <Input
                                        type="number"
                                        min={1}
                                        value={line.quantity}
                                        onChange={(e) => updateLine(line.id, { quantity: parseInt(e.target.value) || 0 })}
                                        disabled={isSubmitting}
                                    />
                                </div>
                                <div className="sm:col-span-2 space-y-1">
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('form.unit_price')}</label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        min={0}
                                        value={line.prix_unitaire}
                                        onChange={(e) => updateLine(line.id, { prix_unitaire: e.target.value })}
                                        disabled={isSubmitting}
                                    />
                                </div>
                                <div className="sm:col-span-2 space-y-1">
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('form.discount')}</label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        min={0}
                                        value={line.remise}
                                        onChange={(e) => updateLine(line.id, { remise: e.target.value })}
                                        disabled={isSubmitting}
                                    />
                                </div>
                                <div className="sm:col-span-2 space-y-1">
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('form.vat')}</label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        min={0}
                                        value={line.tva}
                                        onChange={(e) => updateLine(line.id, { tva: e.target.value })}
                                        disabled={isSubmitting}
                                    />
                                </div>
                                <div className="sm:col-span-1 flex justify-end">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeLine(line.id)}
                                        disabled={isSubmitting}
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    >
                                        <X className="size-4" />
                                    </Button>
                                </div>
                            </div>
                            {line.lot_locked && line.stock_lot && (
                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-medium">
                                        {t('form.lot')}: {line.lot}
                                    </span>
                                    {line.date_expiration && (
                                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border font-medium ${
                                            new Date(line.date_expiration) < new Date()
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

                <div className="flex justify-end">
                    <div className="text-lg font-bold text-slate-900">
                        {t('form.total')}: {formatCurrency(total)}
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
                    {t('common:cancel')}
                </Button>
                <Button type="submit" disabled={isSubmitting || lines.length === 0}>
                    {isSubmitting && <Loader2 className="size-4 mr-2 animate-spin" />}
                    {t('form.create')}
                </Button>
            </div>
        </form>
    );
};
