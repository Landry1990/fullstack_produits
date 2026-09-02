import React, { useMemo, useState } from 'react';
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
import {
    useClientCredits,
    useCreateClientCredit,
    useValidateClientCredit,
    useExportClientCredits,
} from '../../hooks/useClientCredits';
import type { ClientCredit, ClientCreditFilters } from '../../types';

const PAGE_SIZE = 25;

export const ClientCreditsPage: React.FC = () => {
    const { t } = useTranslation(['avoirs_client', 'common']);
    const locale = t('common:locale', { defaultValue: 'fr-FR' });
    const [showForm, setShowForm] = useState(false);
    const [selectedCredit, setSelectedCredit] = useState<ClientCredit | null>(null);
    const [validatingId, setValidatingId] = useState<number | null>(null);
    const [filters, setFilters] = useState<ClientCreditFilters>({ page_size: PAGE_SIZE, page: 1 });

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

    const handleValidate = async (credit: ClientCredit) => {
        const refundMethod = 'cash';
        if (refundMethod === 'credit' && !window.confirm(t('messages.confirm_credit_refund'))) {
            return;
        }
        setValidatingId(credit.id);
        try {
            await validateMutation.mutateAsync({ id: credit.id, payload: { refund_method: refundMethod } });
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

    const totalAmount = useMemo(() => {
        return selectedCredit?.lignes?.reduce((sum, line) => sum + (Number(line.prix_unitaire) * line.quantity), 0) || 0;
    }, [selectedCredit]);

    return (
        <div className="p-6 w-full h-full">
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
                            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
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

                            <div>
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
        </div>
    );
};

export default ClientCreditsPage;
