import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { Plus, Trash2 } from 'lucide-react';
import { gooeyToast } from 'goey-toast';
import api from '../../services/api';
import type { Compte } from '../../hooks/useAccounting';
import { formatCurrency } from '../../utils/formatters';
import { Button } from '../shadcn/button';
import { Input } from '../shadcn/input';
import { Select } from '../shadcn/select';
import { Card, CardContent, CardHeader, CardTitle } from '../shadcn/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../shadcn/table';

interface Regularisation {
    id: number;
    type: 'CCA' | 'PCA' | 'CAP' | 'PAR';
    type_display: string;
    compte: number;
    compte_numero: string;
    compte_libelle: string;
    montant: string | number;
    date: string;
    description: string;
    ecriture: number | null;
    extourne_faite: boolean;
}

const TYPES: Record<Regularisation['type'], 'CHARGE' | 'PRODUIT'> = {
    CCA: 'CHARGE', CAP: 'CHARGE', PCA: 'PRODUIT', PAR: 'PRODUIT',
};

const emptyForm = { type: 'CCA' as Regularisation['type'], compte: '', montant: '', date: '', description: '' };

export default function RegularisationsTab({ comptes }: { comptes: Compte[] }) {
    const { t, i18n } = useTranslation('accounting');
    const queryClient = useQueryClient();
    const [form, setForm] = useState({ ...emptyForm, date: format(new Date(), 'yyyy-MM-dd') });
    const [error, setError] = useState('');

    const { data, isPending } = useQuery<{ results?: Regularisation[] } | Regularisation[]>({
        queryKey: ['accounting', 'regularisations'],
        queryFn: async () => (await api.get('compta/regularisations/')).data,
    });
    const rows: Regularisation[] = Array.isArray(data) ? data : (data?.results ?? []);

    const comptesEligibles = comptes.filter(c => c.is_active && c.type === TYPES[form.type]);

    const mutation = useMutation({
        mutationFn: async () => (await api.post('compta/regularisations/', {
            ...form, compte: Number(form.compte), montant: form.montant,
        })).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['accounting'] });
            setForm({ ...emptyForm, date: form.date });
            setError('');
            gooeyToast.success(t('regs.saved'));
        },
        onError: (e: unknown) => {
            const data = (e as { response?: { data?: Record<string, unknown> | string } })?.response?.data;
            setError(typeof data === 'string' ? data : Object.values(data || {}).flat().filter((v): v is string => typeof v === 'string').join(' '));
        },
    });

    const remove = useMutation({
        mutationFn: async (id: number) => api.delete(`compta/regularisations/${id}/`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['accounting'] });
            gooeyToast.success(t('regs.deleted'));
        },
        onError: () => gooeyToast.error(t('regs.delete_error')),
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        if (!form.compte || !form.montant || !form.description.trim()) {
            setError(t('regs.required'));
            return;
        }
        mutation.mutate();
    };

    const money = (value: string | number) => formatCurrency(Number(value), i18n.language.startsWith('en') ? 'en-GB' : 'fr-FR');
    const set = (field: keyof typeof form, value: string) => setForm(old => ({ ...old, [field]: value }));

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>{t('regs.new_title')}</CardTitle>
                    <p className="text-sm text-slate-600">{t('regs.hint')}</p>
                </CardHeader>
                <CardContent>
                    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="space-y-1.5">
                            <label htmlFor="reg-type" className="text-sm font-medium text-slate-700">{t('regs.type')}</label>
                            <Select id="reg-type" value={form.type} onChange={e => set('type', e.target.value)}>
                                <option value="CCA">{t('regs.types.CCA')}</option>
                                <option value="CAP">{t('regs.types.CAP')}</option>
                                <option value="PCA">{t('regs.types.PCA')}</option>
                                <option value="PAR">{t('regs.types.PAR')}</option>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <label htmlFor="reg-compte" className="text-sm font-medium text-slate-700">{t('regs.account')}</label>
                            <Select id="reg-compte" value={form.compte} onChange={e => set('compte', e.target.value)}>
                                <option value="">{t('regs.account_placeholder')}</option>
                                {comptesEligibles.map(c => (
                                    <option key={c.id} value={c.id}>{c.numero} — {c.libelle}</option>
                                ))}
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <label htmlFor="reg-montant" className="text-sm font-medium text-slate-700">{t('regs.amount')}</label>
                            <Input id="reg-montant" type="number" min="1" step="0.01" required
                                value={form.montant} onChange={e => set('montant', e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                            <label htmlFor="reg-date" className="text-sm font-medium text-slate-700">{t('regs.date')}</label>
                            <Input id="reg-date" type="date" required value={form.date} onChange={e => set('date', e.target.value)} />
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                            <label htmlFor="reg-desc" className="text-sm font-medium text-slate-700">{t('regs.description')}</label>
                            <Input id="reg-desc" required value={form.description} onChange={e => set('description', e.target.value)}
                                placeholder={t('regs.description_placeholder')} />
                        </div>
                        <div className="flex items-end">
                            <Button type="submit" disabled={mutation.isPending}>
                                <Plus className="size-4" /> {t('regs.create')}
                            </Button>
                        </div>
                    </form>
                    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle>{t('regs.list_title')}</CardTitle></CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>{t('regs.type')}</TableHead>
                                <TableHead>{t('regs.account')}</TableHead>
                                <TableHead>{t('regs.description')}</TableHead>
                                <TableHead>{t('regs.date')}</TableHead>
                                <TableHead className="text-right">{t('regs.amount')}</TableHead>
                                <TableHead>{t('regs.extourne')}</TableHead>
                                <TableHead />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isPending && <TableRow><TableCell colSpan={7}>{t('loading_msg')}</TableCell></TableRow>}
                            {!isPending && rows.length === 0 && (
                                <TableRow><TableCell colSpan={7} className="text-center text-slate-400 py-8">{t('regs.empty')}</TableCell></TableRow>
                            )}
                            {rows.map(reg => (
                                <TableRow key={reg.id}>
                                    <TableCell className="font-medium">{reg.type}</TableCell>
                                    <TableCell>{reg.compte_numero} — {reg.compte_libelle}</TableCell>
                                    <TableCell>{reg.description}</TableCell>
                                    <TableCell>{reg.date}</TableCell>
                                    <TableCell className="text-right tabular-nums">{money(reg.montant)}</TableCell>
                                    <TableCell>{reg.extourne_faite ? t('regs.extourned') : t('regs.pending')}</TableCell>
                                    <TableCell>
                                        {!reg.extourne_faite && (
                                            <Button type="button" variant="outline" size="sm"
                                                onClick={() => remove.mutate(reg.id)} disabled={remove.isPending}>
                                                <Trash2 className="size-4" />
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
