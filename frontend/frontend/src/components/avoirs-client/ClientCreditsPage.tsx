import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClientCreditsList } from './ClientCreditsList';
import { ClientCreditForm } from './ClientCreditForm';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '../shadcn/dialog';
import { Button } from '../shadcn/button';
import { Select } from '../shadcn/select';
import {
    useClientCredits,
    useCreateClientCredit,
    useValidateClientCredit,
    useExportClientCredits,
} from '../../hooks/useClientCredits';
import { usePharmacySettings } from '../../hooks/usePharmacySettings';
import { getCaissePaymentModes, getPaymentModeLabel } from '../../config/paymentModes';
import type { ClientCredit, ClientCreditFilters } from '../../types';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeInUp, tabContent } from '../../lib/motion';

const PAGE_SIZE = 25;

export const ClientCreditsPage: React.FC = () => {
    const { t } = useTranslation(['avoirs_client', 'common']);
    const locale = t('common:locale', { defaultValue: 'fr-FR' });
    const [showForm, setShowForm] = useState(false);
    const [selectedCredit, setSelectedCredit] = useState<ClientCredit | null>(null);
    const [refundCredit, setRefundCredit] = useState<ClientCredit | null>(null);
    const [refundMethod, setRefundMethod] = useState<string>('especes');
    const [validatingId, setValidatingId] = useState<number | null>(null);
    const [filters, setFilters] = useState<ClientCreditFilters>({ page_size: PAGE_SIZE, page: 1 });
    const { settings } = usePharmacySettings();

    const { data, isLoading } = useClientCredits(filters);
    const createMutation = useCreateClientCredit();
    const validateMutation = useValidateClientCredit();
    const exportMutation = useExportClientCredits();

    const credits = data?.results || [];
    const total = data?.count || 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const handleCreate = async (data: Parameters<typeof createMutation.mutateAsync>[0]) => {
        try {
            await createMutation.mutateAsync(data);
            setShowForm(false);
        } catch {
            // toast géré par le hook
        }
    };

    // Modes de remboursement = modes d'encaissement monétaires (hors dépôt)
    // + « crédit client » (dépôt, pas de sortie de caisse).
    const refundModes = [
        ...getCaissePaymentModes(settings?.disabled_payment_modes, settings?.custom_payment_modes)
            .filter(m => m.value !== 'depot')
            .map(m => ({ value: m.value, label: getPaymentModeLabel(m.value, t, settings?.custom_payment_modes) })),
        { value: 'credit', label: t('refund_methods.credit') },
    ];

    const handleValidate = (credit: ClientCredit) => {
        setRefundMethod(credit.suggested_refund_method || 'especes');
        setRefundCredit(credit);
    };

    const confirmValidate = async () => {
        if (!refundCredit) return;
        setValidatingId(refundCredit.id);
        try {
            await validateMutation.mutateAsync({ id: refundCredit.id, payload: { refund_method: refundMethod } });
            setRefundCredit(null);
        } catch {
            // toast géré par le hook
        } finally {
            setValidatingId(null);
        }
    };

    const handleExport = () => {
        exportMutation.mutate(filters);
    };

    const updateFilter = <K extends keyof ClientCreditFilters>(key: K, value: ClientCreditFilters[K]) => {
        setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
    };

    const setPage = (page: number) => {
        setFilters((prev) => ({ ...prev, page }));
    };

    return (
        <motion.div variants={fadeInUp} initial="hidden" animate="show" className="p-6 w-full h-full">
            <AnimatePresence mode="wait" initial={false}>
            <motion.div
                key={showForm ? 'form' : 'list'}
                variants={tabContent}
                initial="hidden"
                animate="show"
                exit="exit"
                className="h-full"
            >
            {showForm ? (
                <ClientCreditForm
                    onSubmit={handleCreate}
                    onCancel={() => setShowForm(false)}
                    isSubmitting={createMutation.isPending}
                />
            ) : (
                <ClientCreditsList
                    credits={credits}
                    total={total}
                    totalPages={totalPages}
                    page={filters.page || 1}
                    pageSize={PAGE_SIZE}
                    loading={isLoading}
                    isExporting={exportMutation.isPending}
                    validatingId={validatingId}
                    dateDebut={filters.date_debut || ''}
                    dateFin={filters.date_fin || ''}
                    onDateDebutChange={(value) => updateFilter('date_debut', value)}
                    onDateFinChange={(value) => updateFilter('date_fin', value)}
                    onPageChange={setPage}
                    onExport={handleExport}
                    onCreate={() => setShowForm(true)}
                    onView={setSelectedCredit}
                    onValidate={handleValidate}
                />
            )}
            </motion.div>
            </AnimatePresence>

            <Dialog open={!!selectedCredit} onOpenChange={(open) => !open && setSelectedCredit(null)}>
                {selectedCredit && (
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>{t('detail.title', { numero: selectedCredit.numero })}</DialogTitle>
                            <DialogDescription>
                                {t('detail.subtitle')}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 text-sm">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <div>
                                    <span className="text-slate-500 block">{t('detail.date')}</span>
                                    <span className="font-medium">{new Date(selectedCredit.date).toLocaleDateString(locale)}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block">{t('detail.client')}</span>
                                    <span className="font-medium">{selectedCredit.client_name || t('list.no_client')}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block">{t('detail.invoice')}</span>
                                    <span className="font-medium">{selectedCredit.facture_numero || '—'}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block">{t('detail.status')}</span>
                                    <span className="font-medium">{t(`statuts.${selectedCredit.statut.toLowerCase()}`)}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block">{t('detail.motif')}</span>
                                    <span className="font-medium">{t(`motifs.${selectedCredit.type_motif.toLowerCase()}`)}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block">{t('detail.amount')}</span>
                                    <span className="font-medium">{Number(selectedCredit.montant_total).toLocaleString(locale)} FCFA</span>
                                </div>
                            </div>

                            {selectedCredit.notes && (
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                    <span className="text-slate-500 block">{t('detail.notes')}</span>
                                    <span className="font-medium whitespace-pre-wrap">{selectedCredit.notes}</span>
                                </div>
                            )}

                            <div className="overflow-x-auto">
                                <h3 className="font-semibold text-slate-800 mb-2">{t('detail.lines')}</h3>
                                <table className="w-full text-left border-separate border-spacing-0">
                                    <thead className="bg-slate-100 text-slate-500 text-xs uppercase">
                                        <tr>
                                            <th className="px-3 py-2 rounded-tl-lg">{t('detail.product')}</th>
                                            <th className="px-3 py-2 text-center">{t('detail.quantity')}</th>
                                            <th className="px-3 py-2 text-right">{t('detail.unit_price')}</th>
                                            <th className="px-3 py-2 text-right rounded-tr-lg">{t('detail.total')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {selectedCredit.lignes?.map((line) => (
                                            <tr key={line.id} className="bg-white border-b border-slate-100 last:border-0">
                                                <td className="px-3 py-2">{line.produit_nom || (typeof line.produit === 'object' ? line.produit.name : `Produit ${line.produit}`)}</td>
                                                <td className="px-3 py-2 text-center">{line.quantity}</td>
                                                <td className="px-3 py-2 text-right">{Number(line.prix_unitaire).toLocaleString(locale)} FCFA</td>
                                                <td className="px-3 py-2 text-right">{(Number(line.prix_unitaire) * line.quantity).toLocaleString(locale)} FCFA</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </DialogContent>
                )}
            </Dialog>

            <Dialog open={!!refundCredit} onOpenChange={(open) => !open && setRefundCredit(null)}>
                {refundCredit && (
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>{t('validate_dialog.title', { numero: refundCredit.numero })}</DialogTitle>
                            <DialogDescription>{t('validate_dialog.subtitle')}</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label htmlFor="refund-method-select" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    {t('form.refund_method')}
                                </label>
                                <Select
                                    id="refund-method-select"
                                    value={refundMethod}
                                    onChange={(e) => setRefundMethod(e.target.value)}
                                    disabled={validatingId !== null}
                                >
                                    {refundModes.map(m => (
                                        <option key={m.value} value={m.value}>{m.label}</option>
                                    ))}
                                </Select>
                            </div>
                            {refundMethod === 'credit' && !refundCredit.client && (
                                <p className="text-xs text-red-600 font-medium">{t('messages.credit_requires_client')}</p>
                            )}
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setRefundCredit(null)} disabled={validatingId !== null}>
                                    {t('common:cancel')}
                                </Button>
                                <Button
                                    onClick={confirmValidate}
                                    disabled={validatingId !== null || (refundMethod === 'credit' && !refundCredit.client)}
                                >
                                    {t('list.validate')}
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                )}
            </Dialog>
        </motion.div>
    );
};

export default ClientCreditsPage;
