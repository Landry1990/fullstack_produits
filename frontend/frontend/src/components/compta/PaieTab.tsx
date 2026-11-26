import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { CheckCircle2, Plus, Trash2 } from 'lucide-react';
import { gooeyToast } from 'goey-toast';
import api from '../../services/api';
import { formatCurrency } from '../../utils/formatters';
import { Button } from '../shadcn/button';
import { Input } from '../shadcn/input';
import { Select } from '../shadcn/select';
import { Card, CardContent, CardHeader, CardTitle } from '../shadcn/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../shadcn/table';

interface Employe {
    id: number;
    nom: string;
    poste: string;
    salaire_brut: string | number;
    is_active: boolean;
}

interface Paie {
    id: number;
    employe: number;
    employe_nom: string;
    mois: string;
    brut: string | number;
    cotisations_salariales: string | number;
    irpp: string | number;
    charges_patronales: string | number;
    net_a_payer: string | number;
    statut: 'brouillon' | 'comptabilisee';
    ecriture: number | null;
}

function errMsg(error: unknown, fallback: string) {
    const data = (error as { response?: { data?: Record<string, unknown> | string } })?.response?.data;
    if (typeof data === 'string') return data || fallback;
    return Object.values(data || {}).flat().filter((v): v is string => typeof v === 'string').join(' ') || fallback;
}

export default function PaieTab() {
    const { t, i18n } = useTranslation('accounting');
    const queryClient = useQueryClient();
    const locale = i18n.language.startsWith('en') ? 'en-GB' : 'fr-FR';
    const money = (value: string | number) => formatCurrency(Number(value), locale);

    const [empForm, setEmpForm] = useState({ nom: '', poste: '', salaire_brut: '' });
    const [paieForm, setPaieForm] = useState({
        employe: '', mois: format(new Date(), 'yyyy-MM'), brut: '',
        cotisations_salariales: '0', irpp: '0', charges_patronales: '0',
    });
    const [error, setError] = useState('');

    const employes = useQuery<{ results?: Employe[] } | Employe[]>({
        queryKey: ['accounting', 'employes'],
        queryFn: async () => (await api.get('compta/employes/')).data,
    });
    const empRows: Employe[] = (Array.isArray(employes.data) ? employes.data : (employes.data?.results ?? [])).filter(e => e.is_active);

    const paies = useQuery<{ results?: Paie[] } | Paie[]>({
        queryKey: ['accounting', 'paies'],
        queryFn: async () => (await api.get('compta/paies/')).data,
    });
    const paieRows: Paie[] = Array.isArray(paies.data) ? paies.data : (paies.data?.results ?? []);

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ['accounting'] });
    const onError = (e: unknown) => setError(errMsg(e, t('paie.error')));

    const createEmploye = useMutation({
        mutationFn: async () => (await api.post('compta/employes/', {
            ...empForm, salaire_brut: empForm.salaire_brut || '0',
        })).data,
        onSuccess: () => {
            invalidate();
            setEmpForm({ nom: '', poste: '', salaire_brut: '' });
            gooeyToast.success(t('paie.employe_saved'));
        },
        onError,
    });

    const createPaie = useMutation({
        mutationFn: async () => (await api.post('compta/paies/', {
            employe: Number(paieForm.employe),
            mois: `${paieForm.mois}-01`,
            brut: paieForm.brut || '0',
            cotisations_salariales: paieForm.cotisations_salariales || '0',
            irpp: paieForm.irpp || '0',
            charges_patronales: paieForm.charges_patronales || '0',
        })).data,
        onSuccess: () => {
            invalidate();
            setError('');
            gooeyToast.success(t('paie.saved'));
        },
        onError,
    });

    const comptabiliser = useMutation({
        mutationFn: async (id: number) => (await api.post(`compta/paies/${id}/comptabiliser/`)).data,
        onSuccess: () => { invalidate(); gooeyToast.success(t('paie.posted')); },
        onError: (e: unknown) => gooeyToast.error(errMsg(e, t('paie.error'))),
    });

    const removePaie = useMutation({
        mutationFn: async (id: number) => api.delete(`compta/paies/${id}/`),
        onSuccess: () => { invalidate(); gooeyToast.success(t('paie.deleted')); },
        onError: (e: unknown) => gooeyToast.error(errMsg(e, t('paie.error'))),
    });

    const submitEmploye = (event: FormEvent) => {
        event.preventDefault();
        if (!empForm.nom.trim()) { setError(t('regs.required')); return; }
        createEmploye.mutate();
    };

    const submitPaie = (event: FormEvent) => {
        event.preventDefault();
        if (!paieForm.employe || !paieForm.mois) { setError(t('regs.required')); return; }
        createPaie.mutate();
    };

    const net = (Number(paieForm.brut) || 0) - (Number(paieForm.cotisations_salariales) || 0) - (Number(paieForm.irpp) || 0);

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader><CardTitle>{t('paie.employes_title')}</CardTitle></CardHeader>
                <CardContent>
                    <form onSubmit={submitEmploye} className="grid gap-4 sm:grid-cols-4">
                        <div className="space-y-1.5 sm:col-span-2">
                            <label htmlFor="emp-nom" className="text-sm font-medium text-slate-700">{t('paie.name')}</label>
                            <Input id="emp-nom" required value={empForm.nom}
                                onChange={e => setEmpForm(old => ({ ...old, nom: e.target.value }))} />
                        </div>
                        <div className="space-y-1.5">
                            <label htmlFor="emp-poste" className="text-sm font-medium text-slate-700">{t('paie.role')}</label>
                            <Input id="emp-poste" value={empForm.poste}
                                onChange={e => setEmpForm(old => ({ ...old, poste: e.target.value }))} />
                        </div>
                        <div className="space-y-1.5">
                            <label htmlFor="emp-brut" className="text-sm font-medium text-slate-700">{t('paie.base_gross')}</label>
                            <Input id="emp-brut" type="number" min="0" step="0.01" value={empForm.salaire_brut}
                                onChange={e => setEmpForm(old => ({ ...old, salaire_brut: e.target.value }))} />
                        </div>
                        <div className="flex items-end">
                            <Button type="submit" disabled={createEmploye.isPending}>
                                <Plus className="size-4" /> {t('paie.employe_add')}
                            </Button>
                        </div>
                    </form>
                    {empRows.length > 0 && (
                        <p className="mt-3 text-sm text-slate-600">
                            {empRows.map(e => `${e.nom}${e.poste ? ` (${e.poste})` : ''}`).join(' · ')}
                        </p>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>{t('paie.new_title')}</CardTitle>
                    <p className="text-sm text-slate-600">{t('paie.hint')}</p>
                </CardHeader>
                <CardContent>
                    <form onSubmit={submitPaie} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="space-y-1.5">
                            <label htmlFor="paie-emp" className="text-sm font-medium text-slate-700">{t('paie.employee')}</label>
                            <Select id="paie-emp" value={paieForm.employe} onChange={e => {
                                const emp = empRows.find(x => x.id === Number(e.target.value));
                                setPaieForm(old => ({
                                    ...old, employe: e.target.value,
                                    brut: emp ? String(emp.salaire_brut) : old.brut,
                                }));
                            }}>
                                <option value="">{t('paie.employee_placeholder')}</option>
                                {empRows.map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <label htmlFor="paie-mois" className="text-sm font-medium text-slate-700">{t('paie.month')}</label>
                            <Input id="paie-mois" type="month" required value={paieForm.mois}
                                onChange={e => setPaieForm(old => ({ ...old, mois: e.target.value }))} />
                        </div>
                        <div className="space-y-1.5">
                            <label htmlFor="paie-brut" className="text-sm font-medium text-slate-700">{t('paie.gross')}</label>
                            <Input id="paie-brut" type="number" min="0" step="0.01" required
                                value={paieForm.brut} onChange={e => setPaieForm(old => ({ ...old, brut: e.target.value }))} />
                        </div>
                        <div className="space-y-1.5">
                            <label htmlFor="paie-cotis" className="text-sm font-medium text-slate-700">{t('paie.employee_contrib')}</label>
                            <Input id="paie-cotis" type="number" min="0" step="0.01"
                                value={paieForm.cotisations_salariales}
                                onChange={e => setPaieForm(old => ({ ...old, cotisations_salariales: e.target.value }))} />
                        </div>
                        <div className="space-y-1.5">
                            <label htmlFor="paie-irpp" className="text-sm font-medium text-slate-700">{t('paie.irpp')}</label>
                            <Input id="paie-irpp" type="number" min="0" step="0.01"
                                value={paieForm.irpp} onChange={e => setPaieForm(old => ({ ...old, irpp: e.target.value }))} />
                        </div>
                        <div className="space-y-1.5">
                            <label htmlFor="paie-patronales" className="text-sm font-medium text-slate-700">{t('paie.employer_contrib')}</label>
                            <Input id="paie-patronales" type="number" min="0" step="0.01"
                                value={paieForm.charges_patronales}
                                onChange={e => setPaieForm(old => ({ ...old, charges_patronales: e.target.value }))} />
                        </div>
                        <div className="sm:col-span-2 lg:col-span-3 flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                            <span className="text-sm font-semibold text-slate-700">
                                {t('paie.net_preview')} : <span className="tabular-nums">{money(Math.max(0, net))}</span>
                            </span>
                            <Button type="submit" disabled={createPaie.isPending}>{t('paie.create_draft')}</Button>
                        </div>
                    </form>
                    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}

                    <Table className="mt-6">
                        <TableHeader>
                            <TableRow>
                                <TableHead>{t('paie.employee')}</TableHead>
                                <TableHead>{t('paie.month')}</TableHead>
                                <TableHead className="text-right">{t('paie.gross')}</TableHead>
                                <TableHead className="text-right">{t('paie.net')}</TableHead>
                                <TableHead>{t('provisions.status')}</TableHead>
                                <TableHead />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paieRows.length === 0 && (
                                <TableRow><TableCell colSpan={6} className="text-center text-slate-400 py-8">{t('paie.empty')}</TableCell></TableRow>
                            )}
                            {paieRows.map(paie => (
                                <TableRow key={paie.id}>
                                    <TableCell className="font-medium">{paie.employe_nom}</TableCell>
                                    <TableCell>{paie.mois.slice(0, 7)}</TableCell>
                                    <TableCell className="text-right tabular-nums">{money(paie.brut)}</TableCell>
                                    <TableCell className="text-right tabular-nums">{money(paie.net_a_payer)}</TableCell>
                                    <TableCell>{t(`paie.statuts.${paie.statut}`)}</TableCell>
                                    <TableCell>
                                        <div className="flex gap-2">
                                            {paie.statut === 'brouillon' && (
                                                <>
                                                    <Button type="button" variant="outline" size="sm"
                                                        onClick={() => comptabiliser.mutate(paie.id)} disabled={comptabiliser.isPending}>
                                                        <CheckCircle2 className="size-4" /> {t('paie.post')}
                                                    </Button>
                                                    <Button type="button" variant="outline" size="sm"
                                                        onClick={() => removePaie.mutate(paie.id)} disabled={removePaie.isPending}>
                                                        <Trash2 className="size-4" />
                                                    </Button>
                                                </>
                                            )}
                                        </div>
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
