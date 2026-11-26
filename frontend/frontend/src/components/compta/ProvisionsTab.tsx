import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { gooeyToast } from 'goey-toast';
import api from '../../services/api';
import clientService from '../../services/clientService';
import { formatCurrency } from '../../utils/formatters';
import type { Client } from '../../types';
import { Button } from '../shadcn/button';
import { Input } from '../shadcn/input';
import { Select } from '../shadcn/select';
import { Card, CardContent, CardHeader, CardTitle } from '../shadcn/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../shadcn/table';

interface Creance {
    id: number;
    client: number;
    client_nom: string;
    dette_client: string;
    montant: string | number;
    statut: 'douteuse' | 'recouvree' | 'irrecouvrable';
    commentaire: string;
    created_at: string;
}

interface Depreciation {
    id: number;
    libelle: string;
    montant: string | number;
    statut: 'dotee' | 'reprise';
    created_at: string;
}

function errMsg(error: unknown, fallback: string) {
    const data = (error as { response?: { data?: Record<string, unknown> | string } })?.response?.data;
    if (typeof data === 'string') return data || fallback;
    return Object.values(data || {}).flat().filter((v): v is string => typeof v === 'string').join(' ') || fallback;
}

export default function ProvisionsTab() {
    const { t, i18n } = useTranslation('accounting');
    const queryClient = useQueryClient();
    const [creanceForm, setCreanceForm] = useState({ client: '', montant: '', commentaire: '' });
    const [depForm, setDepForm] = useState({ libelle: '', montant: '' });
    const [error, setError] = useState('');

    const locale = i18n.language.startsWith('en') ? 'en-GB' : 'fr-FR';
    const money = (value: string | number) => formatCurrency(Number(value), locale);

    const creances = useQuery<{ results?: Creance[] } | Creance[]>({
        queryKey: ['accounting', 'creances-douteuses'],
        queryFn: async () => (await api.get('compta/creances-douteuses/')).data,
    });
    const rows: Creance[] = Array.isArray(creances.data) ? creances.data : (creances.data?.results ?? []);

    const deps = useQuery<{ results?: Depreciation[] } | Depreciation[]>({
        queryKey: ['accounting', 'depreciations-stock'],
        queryFn: async () => (await api.get('compta/depreciations-stock/')).data,
    });
    const depRows: Depreciation[] = Array.isArray(deps.data) ? deps.data : (deps.data?.results ?? []);

    const estimation = useQuery<{ montant: string }>({
        queryKey: ['accounting', 'depreciations-estimation'],
        queryFn: async () => (await api.get('compta/depreciations-stock/estimation/')).data,
        staleTime: 0,
    });

    const clients = useQuery<{ results?: Client[] } | Client[]>({
        queryKey: ['accounting', 'clients-creanciers'],
        queryFn: async () => clientService.getAll({ page_size: 200 }) as Promise<{ results?: Client[] } | Client[]>,
    });
    const clientRows: Client[] = Array.isArray(clients.data) ? clients.data : (clients.data?.results ?? []);

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ['accounting'] });

    const createCreance = useMutation({
        mutationFn: async () => (await api.post('compta/creances-douteuses/', {
            client: Number(creanceForm.client), montant: creanceForm.montant,
            commentaire: creanceForm.commentaire,
        })).data,
        onSuccess: () => {
            invalidate();
            setCreanceForm({ client: '', montant: '', commentaire: '' });
            setError('');
            gooeyToast.success(t('provisions.creance_marked'));
        },
        onError: (e: unknown) => setError(errMsg(e, t('provisions.error'))),
    });

    const createDep = useMutation({
        mutationFn: async () => (await api.post('compta/depreciations-stock/', depForm)).data,
        onSuccess: () => {
            invalidate();
            setDepForm({ libelle: '', montant: '' });
            setError('');
            gooeyToast.success(t('provisions.dep_saved'));
        },
        onError: (e: unknown) => setError(errMsg(e, t('provisions.error'))),
    });

    const action = useMutation({
        mutationFn: async ({ path }: { path: string }) => (await api.post(path)).data,
        onSuccess: () => { invalidate(); gooeyToast.success(t('provisions.action_done')); },
        onError: (e: unknown) => gooeyToast.error(errMsg(e, t('provisions.error'))),
    });

    const submitCreance = (event: FormEvent) => {
        event.preventDefault();
        if (!creanceForm.client || !creanceForm.montant) { setError(t('regs.required')); return; }
        createCreance.mutate();
    };

    const submitDep = (event: FormEvent) => {
        event.preventDefault();
        if (!depForm.libelle.trim() || !depForm.montant) { setError(t('regs.required')); return; }
        createDep.mutate();
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>{t('provisions.creances_title')}</CardTitle>
                    <p className="text-sm text-slate-600">{t('provisions.creances_hint')}</p>
                </CardHeader>
                <CardContent>
                    <form onSubmit={submitCreance} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="space-y-1.5 sm:col-span-2">
                            <label htmlFor="cre-client" className="text-sm font-medium text-slate-700">{t('provisions.client')}</label>
                            <Select id="cre-client" value={creanceForm.client}
                                onChange={e => setCreanceForm(old => ({ ...old, client: e.target.value }))}>
                                <option value="">{t('provisions.client_placeholder')}</option>
                                {clientRows.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <label htmlFor="cre-montant" className="text-sm font-medium text-slate-700">{t('provisions.amount')}</label>
                            <Input id="cre-montant" type="number" min="1" step="0.01" required
                                value={creanceForm.montant}
                                onChange={e => setCreanceForm(old => ({ ...old, montant: e.target.value }))} />
                        </div>
                        <div className="space-y-1.5">
                            <label htmlFor="cre-comment" className="text-sm font-medium text-slate-700">{t('provisions.comment')}</label>
                            <Input id="cre-comment" value={creanceForm.commentaire}
                                onChange={e => setCreanceForm(old => ({ ...old, commentaire: e.target.value }))} />
                        </div>
                        <div className="flex items-end">
                            <Button type="submit" disabled={createCreance.isPending}>{t('provisions.mark_doubtful')}</Button>
                        </div>
                    </form>
                    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}

                    <Table className="mt-6">
                        <TableHeader>
                            <TableRow>
                                <TableHead>{t('provisions.client')}</TableHead>
                                <TableHead>{t('provisions.comment')}</TableHead>
                                <TableHead className="text-right">{t('provisions.amount')}</TableHead>
                                <TableHead className="text-right">{t('provisions.debt')}</TableHead>
                                <TableHead>{t('provisions.status')}</TableHead>
                                <TableHead />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.length === 0 && (
                                <TableRow><TableCell colSpan={6} className="text-center text-slate-400 py-8">{t('provisions.empty_creances')}</TableCell></TableRow>
                            )}
                            {rows.map(creance => (
                                <TableRow key={creance.id}>
                                    <TableCell className="font-medium">{creance.client_nom}</TableCell>
                                    <TableCell>{creance.commentaire}</TableCell>
                                    <TableCell className="text-right tabular-nums">{money(creance.montant)}</TableCell>
                                    <TableCell className="text-right tabular-nums">{money(creance.dette_client)}</TableCell>
                                    <TableCell>{t(`provisions.statuts.${creance.statut}`)}</TableCell>
                                    <TableCell>
                                        {creance.statut === 'douteuse' && (
                                            <div className="flex gap-2">
                                                <Button type="button" variant="outline" size="sm"
                                                    onClick={() => action.mutate({ path: `compta/creances-douteuses/${creance.id}/recouvrer/` })}>
                                                    {t('provisions.recover')}
                                                </Button>
                                                <Button type="button" variant="outline" size="sm"
                                                    onClick={() => action.mutate({ path: `compta/creances-douteuses/${creance.id}/perte/` })}>
                                                    {t('provisions.write_off')}
                                                </Button>
                                            </div>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>{t('provisions.stock_title')}</CardTitle>
                    <p className="text-sm text-slate-600">
                        {t('provisions.stock_hint', { amount: estimation.data ? money(estimation.data.montant) : '…' })}
                    </p>
                </CardHeader>
                <CardContent>
                    <form onSubmit={submitDep} className="grid gap-4 sm:grid-cols-3">
                        <div className="space-y-1.5 sm:col-span-2">
                            <label htmlFor="dep-libelle" className="text-sm font-medium text-slate-700">{t('provisions.label')}</label>
                            <Input id="dep-libelle" required value={depForm.libelle}
                                onChange={e => setDepForm(old => ({ ...old, libelle: e.target.value }))}
                                placeholder={t('provisions.label_placeholder')} />
                        </div>
                        <div className="space-y-1.5">
                            <label htmlFor="dep-montant" className="text-sm font-medium text-slate-700">{t('provisions.amount')}</label>
                            <Input id="dep-montant" type="number" min="1" step="0.01" required
                                value={depForm.montant}
                                onChange={e => setDepForm(old => ({ ...old, montant: e.target.value }))} />
                        </div>
                        <div className="flex items-end">
                            <Button type="submit" disabled={createDep.isPending}>{t('provisions.dep_create')}</Button>
                        </div>
                    </form>

                    <Table className="mt-6">
                        <TableHeader>
                            <TableRow>
                                <TableHead>{t('provisions.label')}</TableHead>
                                <TableHead className="text-right">{t('provisions.amount')}</TableHead>
                                <TableHead>{t('provisions.status')}</TableHead>
                                <TableHead />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {depRows.length === 0 && (
                                <TableRow><TableCell colSpan={4} className="text-center text-slate-400 py-8">{t('provisions.empty_stock')}</TableCell></TableRow>
                            )}
                            {depRows.map(dep => (
                                <TableRow key={dep.id}>
                                    <TableCell className="font-medium">{dep.libelle}</TableCell>
                                    <TableCell className="text-right tabular-nums">{money(dep.montant)}</TableCell>
                                    <TableCell>{t(`provisions.statuts.${dep.statut}`)}</TableCell>
                                    <TableCell>
                                        {dep.statut === 'dotee' && (
                                            <Button type="button" variant="outline" size="sm"
                                                onClick={() => action.mutate({ path: `compta/depreciations-stock/${dep.id}/reprendre/` })}>
                                                {t('provisions.reverse')}
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
