import { useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Archive, Pencil, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { gooeyToast } from 'goey-toast';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import type { Compte } from '../../hooks/useAccounting';
import { formatCurrency } from '../../utils/formatters';
import { Button } from '../shadcn/button';
import { Input } from '../shadcn/input';
import { Select } from '../shadcn/select';
import { Card, CardContent, CardHeader, CardTitle } from '../shadcn/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../shadcn/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../shadcn/dialog';

interface Immobilisation {
    id: number;
    nom: string;
    compte_immo: number;
    compte_immo_numero: string;
    compte_amortissement: number;
    date_acquisition: string;
    valeur_acquisition: string | number;
    duree_annees: number;
    valeur_residuelle: string | number;
    mode_paiement: string;
    is_active: boolean;
    comptabilisee: boolean;
    dotation_annuelle: string | number;
    cumul_amortissements: string | number;
    valeur_nette_comptable: string | number;
    dotations: { id: number; annee: number; montant: string | number }[];
}

interface AssetPage {
    results: Immobilisation[];
    count: number;
    next: string | null;
    previous: string | null;
    can_write?: boolean;
}

type Operation = { kind: 'save' | 'archive' | 'depreciate' | 'batch'; id?: number; payload?: Record<string, unknown> };

function errorMessage(error: unknown, fallback: string) {
    const data = (error as { response?: { data?: Record<string, unknown> | string } })?.response?.data;
    if (typeof data === 'string') return fallback;
    return Object.values(data || {}).flat().filter((value): value is string => typeof value === 'string').join(' ') || fallback;
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
    return <div className="space-y-1.5"><label htmlFor={id} className="text-sm font-medium text-slate-700">{label}</label>{children}</div>;
}

function AssetForm({ asset, comptes, pending, error, onSubmit, onCancel }: {
    asset: Immobilisation | null;
    comptes: Compte[];
    pending: boolean;
    error: string;
    onSubmit: (data: Record<string, unknown>) => void;
    onCancel: () => void;
}) {
    const { t } = useTranslation('accounting');
    const [form, setForm] = useState({
        nom: asset?.nom || '', compte_immo: String(asset?.compte_immo || ''),
        compte_amortissement: String(asset?.compte_amortissement || ''),
        date_acquisition: asset?.date_acquisition || format(new Date(), 'yyyy-MM-dd'),
        valeur_acquisition: String(asset?.valeur_acquisition ?? ''), duree_annees: String(asset?.duree_annees ?? 5),
        valeur_residuelle: String(asset?.valeur_residuelle ?? 0), mode_paiement: asset?.mode_paiement || 'banque',
    });
    const locked = !!asset?.comptabilisee;
    const actifAccounts = comptes.filter(c => c.is_active && c.type === 'ACTIF' && /^(21|23|24)/.test(c.numero));
    const assetAccount = comptes.find(c => c.id === Number(form.compte_immo));
    const amortPrefix = assetAccount ? `28${assetAccount.numero[1]}` : '';
    const amortAccounts = comptes.filter(c => c.is_active && c.type === 'PASSIF' && amortPrefix && c.numero.startsWith(amortPrefix));
    const set = (field: keyof typeof form, value: string) => setForm(old => ({ ...old, [field]: value }));
    const submit = (event: FormEvent) => {
        event.preventDefault();
        onSubmit(locked ? { nom: form.nom.trim() } : {
            ...form, nom: form.nom.trim(), compte_immo: Number(form.compte_immo),
            compte_amortissement: Number(form.compte_amortissement), duree_annees: Number(form.duree_annees),
        });
    };

    return (
        <form onSubmit={submit} className="space-y-4">
            <p role="note" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                {t(locked ? 'immos.locked_note' : 'immos.creation_note')}
            </p>
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            <Field id="immo-nom" label={t('immos.nom')}>
                <Input id="immo-nom" value={form.nom} onChange={e => set('nom', e.target.value)} required maxLength={200} disabled={pending} disableUppercase />
            </Field>
            <fieldset disabled={pending || locked} className="grid gap-4 sm:grid-cols-2">
                <Field id="immo-compte" label={t('immos.asset_account')}>
                    <Select id="immo-compte" value={form.compte_immo} required onChange={e => setForm(old => ({ ...old, compte_immo: e.target.value, compte_amortissement: '' }))}>
                        <option value="">{t('immos.select_account')}</option>
                        {locked && !actifAccounts.some(c => c.id === asset?.compte_immo) && <option value={form.compte_immo}>{asset?.compte_immo_numero}</option>}
                        {actifAccounts.map(c => <option key={c.id} value={c.id}>{c.numero} — {c.libelle}</option>)}
                    </Select>
                </Field>
                <Field id="immo-amort" label={t('immos.amort_account')}>
                    <Select id="immo-amort" value={form.compte_amortissement} required onChange={e => set('compte_amortissement', e.target.value)}>
                        <option value="">{t('immos.select_account')}</option>
                        {locked && !amortAccounts.some(c => c.id === asset?.compte_amortissement) && <option value={form.compte_amortissement}>{asset?.compte_amortissement}</option>}
                        {amortAccounts.map(c => <option key={c.id} value={c.id}>{c.numero} — {c.libelle}</option>)}
                    </Select>
                </Field>
                <Field id="immo-date" label={t('immos.acquisition')}>
                    <Input id="immo-date" type="date" value={form.date_acquisition} max={format(new Date(), 'yyyy-MM-dd')} required onChange={e => set('date_acquisition', e.target.value)} />
                </Field>
                <Field id="immo-valeur" label={t('immos.valeur')}>
                    <Input id="immo-valeur" type="number" value={form.valeur_acquisition} min="0.01" step="0.01" required onChange={e => set('valeur_acquisition', e.target.value)} />
                </Field>
                <Field id="immo-duree" label={t('immos.duration')}>
                    <Input id="immo-duree" type="number" value={form.duree_annees} min="1" step="1" required onChange={e => set('duree_annees', e.target.value)} />
                </Field>
                <Field id="immo-residuelle" label={t('immos.residual')}>
                    <Input id="immo-residuelle" type="number" value={form.valeur_residuelle} min="0" max={form.valeur_acquisition || undefined} step="0.01" required onChange={e => set('valeur_residuelle', e.target.value)} />
                </Field>
                <Field id="immo-paiement" label={t('immos.payment')}>
                    <Select id="immo-paiement" value={form.mode_paiement} onChange={e => set('mode_paiement', e.target.value)}>
                        {['banque', 'especes', 'credit'].map(mode => <option key={mode} value={mode}>{t(`immos.payment_${mode}`)}</option>)}
                    </Select>
                </Field>
            </fieldset>
            {!locked && <p className="text-sm text-slate-600">{t('immos.account_help')}</p>}
            <DialogFooter>
                <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>{t('immos.cancel')}</Button>
                <Button type="submit" disabled={pending || !form.nom.trim()}>{t(pending ? 'immos.saving' : 'immos.save')}</Button>
            </DialogFooter>
        </form>
    );
}

export default function ImmobilisationsTab({ comptes }: { comptes: Compte[] }) {
    const { t, i18n } = useTranslation('accounting');
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [year, setYear] = useState(new Date().getFullYear());
    const [status, setStatus] = useState('actives');
    const [page, setPage] = useState(1);
    const [editor, setEditor] = useState<{ asset: Immobilisation | null } | null>(null);
    const [toArchive, setToArchive] = useState<Immobilisation | null>(null);
    const [skipped, setSkipped] = useState<string[]>([]);
    const { data, isPending, isError, isFetching, refetch } = useQuery<AssetPage>({
        queryKey: ['accounting', 'immobilisations', user?.id, status, page],
        queryFn: async () => {
            const result = (await api.get('compta/immobilisations/', { params: { statut: status, page } })).data;
            return Array.isArray(result) ? { results: result, count: result.length, next: null, previous: null } : result;
        },
    });
    const role = user?.role ?? user?.profile?.role;
    const canWrite = data?.can_write ?? !!(user?.is_superuser || ['COMPTABLE', 'PHARMACIEN'].includes(role || ''));
    const mutation = useMutation({
        mutationFn: async (operation: Operation) => {
            const base = 'compta/immobilisations/';
            if (operation.kind === 'save') {
                return operation.id ? (await api.patch(`${base}${operation.id}/`, operation.payload)).data : (await api.post(base, operation.payload)).data;
            }
            if (operation.kind === 'archive') return (await api.patch(`${base}${operation.id}/`, { is_active: false })).data;
            return (await api.post(operation.kind === 'batch' ? `${base}generer_dotations_annee/` : `${base}${operation.id}/generer_dotation/`, { annee: year })).data;
        },
        onSuccess: (result, operation) => {
            queryClient.invalidateQueries({ queryKey: ['accounting'] });
            if (operation.kind === 'save') { setEditor(null); setPage(1); gooeyToast.success(t('immos.saved')); }
            else if (operation.kind === 'archive') { setToArchive(null); setPage(1); gooeyToast.success(t('immos.archived_ok')); }
            else if (operation.kind === 'batch') {
                gooeyToast.success(t('immos.batch_result', { generated: result.generees.length, skipped: result.ignorees.length }));
                setSkipped(result.ignorees.map((entry: { id: number; motif: string[] }) => `#${entry.id} : ${[entry.motif].flat().join(' ')}`));
            } else gooeyToast.success(t('immos.dotation_ok'));
        },
        onError: error => gooeyToast.error(errorMessage(error, t('immos.operation_error'))),
    });
    const money = (value: string | number) => formatCurrency(Number(value), i18n.language.startsWith('en') ? 'en-GB' : 'fr-FR');
    const openEditor = (asset: Immobilisation | null) => { mutation.reset(); setEditor({ asset }); };
    const busy = mutation.isPending;

    return (
        <Card aria-busy={isFetching || busy}>
            <CardHeader className="gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <CardTitle>{t('immos.title')}</CardTitle>
                    {canWrite && <Button onClick={() => openEditor(null)} disabled={busy}><Plus className="size-4" />{t('immos.create')}</Button>}
                </div>
                <div className="flex flex-wrap items-end gap-3">
                    <Field id="immo-status" label={t('immos.status')}>
                        <Select id="immo-status" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
                            <option value="actives">{t('immos.active')}</option><option value="archivees">{t('immos.archived')}</option><option value="toutes">{t('immos.all')}</option>
                        </Select>
                    </Field>
                    <Field id="immo-year" label={t('immos.year')}>
                        <Input id="immo-year" type="number" min="1" max={new Date().getFullYear()} step="1" value={year || ''} onChange={e => setYear(Number(e.target.value))} className="w-28" />
                    </Field>
                    {canWrite && <Button variant="outline" disabled={busy || !Number.isInteger(year) || year < 1 || year > new Date().getFullYear()} onClick={() => mutation.mutate({ kind: 'batch' })}>{t('immos.doter_tout')}</Button>}
                </div>
                <p className="text-sm text-slate-600">{t('immos.depreciation_note')}</p>
            </CardHeader>
            <CardContent className="space-y-4">
                {isPending ? <p role="status">{t('loading_msg')}</p> : isError ? <div role="alert"><p>{t('immos.load_error')}</p><Button variant="outline" onClick={() => refetch()}>{t('immos.retry')}</Button></div> : (
                    <>
                        <Table>
                            <TableHeader><TableRow>
                                <TableHead>{t('immos.nom')}</TableHead><TableHead>{t('immos.compte')}</TableHead><TableHead>{t('immos.acquisition')}</TableHead>
                                <TableHead className="text-right">{t('immos.valeur')}</TableHead><TableHead className="text-right">{t('immos.dotation')}</TableHead>
                                <TableHead className="text-right">{t('immos.cumul')}</TableHead><TableHead className="text-right">{t('immos.vnc')}</TableHead><TableHead>{t('immos.actions')}</TableHead>
                            </TableRow></TableHeader>
                            <TableBody>
                                {!data?.results.length && <TableRow><TableCell colSpan={8} className="py-8 text-center text-slate-600">{t('immos.empty')}</TableCell></TableRow>}
                                {data?.results.map(asset => <TableRow key={asset.id}>
                                    <TableCell className="font-medium">{asset.nom}<span className="block text-xs text-slate-600">{t(asset.is_active ? 'immos.active' : 'immos.archived')}</span>{!asset.comptabilisee && <span className="block text-xs text-amber-800">{t('immos.unposted')}</span>}</TableCell>
                                    <TableCell>{asset.compte_immo_numero}</TableCell><TableCell className="whitespace-nowrap">{asset.date_acquisition}</TableCell>
                                    <TableCell className="text-right whitespace-nowrap tabular-nums">{money(asset.valeur_acquisition)}</TableCell>
                                    <TableCell className="text-right whitespace-nowrap tabular-nums">{money(asset.dotation_annuelle)}</TableCell>
                                    <TableCell className="text-right whitespace-nowrap tabular-nums">{money(asset.cumul_amortissements)}</TableCell>
                                    <TableCell className="text-right whitespace-nowrap tabular-nums">{money(asset.valeur_nette_comptable)}</TableCell>
                                    <TableCell>{canWrite && <div className="flex flex-wrap gap-2">
                                        <Button size="sm" variant="outline" disabled={busy} onClick={() => openEditor(asset)} aria-label={t('immos.edit_named', { name: asset.nom })}><Pencil className="size-3.5" />{t('immos.edit')}</Button>
                                        {asset.is_active && <Button size="sm" variant="outline" disabled={busy} onClick={() => { mutation.reset(); setToArchive(asset); }} aria-label={t('immos.archive_named', { name: asset.nom })}><Archive className="size-3.5" />{t('immos.archive')}</Button>}
                                        <Button size="sm" variant="outline" disabled={busy || !asset.is_active || !asset.comptabilisee || !Number.isInteger(year) || year < 1 || year > new Date().getFullYear() || asset.dotations.some(d => d.annee === year)} onClick={() => mutation.mutate({ kind: 'depreciate', id: asset.id })}>
                                            {t(asset.dotations.some(d => d.annee === year) ? 'immos.dote' : 'immos.doter')}
                                        </Button>
                                    </div>}</TableCell>
                                </TableRow>)}
                            </TableBody>
                        </Table>
                        {(data?.next || data?.previous) && <div className="flex items-center justify-end gap-3">
                            <Button variant="outline" disabled={!data.previous || isFetching} onClick={() => setPage(old => old - 1)}>{t('immos.previous')}</Button>
                            <span>{t('immos.page', { page })}</span>
                            <Button variant="outline" disabled={!data.next || isFetching} onClick={() => setPage(old => old + 1)}>{t('immos.next')}</Button>
                        </div>}
                    </>
                )}
                {!!skipped.length && <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><p className="font-semibold">{t('immos.skipped')}</p><ul>{skipped.map((message, index) => <li key={`${index}-${message}`}>{message}</li>)}</ul></div>}
            </CardContent>
            <Dialog open={!!editor} onOpenChange={open => { if (!open && !busy) setEditor(null); }}>
                <DialogContent size="lg" hideCloseButton={busy}>
                    <DialogHeader><DialogTitle>{t(editor?.asset ? 'immos.edit' : 'immos.create')}</DialogTitle><DialogDescription>{t('immos.form_description')}</DialogDescription></DialogHeader>
                    {editor && <AssetForm key={editor.asset?.id ?? 'new'} asset={editor.asset} comptes={comptes} pending={busy} error={mutation.isError ? errorMessage(mutation.error, t('immos.operation_error')) : ''} onCancel={() => setEditor(null)} onSubmit={payload => mutation.mutate({ kind: 'save', id: editor.asset?.id, payload })} />}
                </DialogContent>
            </Dialog>
            <Dialog open={!!toArchive} onOpenChange={open => { if (!open && !busy) setToArchive(null); }}>
                <DialogContent hideCloseButton={busy}>
                    <DialogHeader><DialogTitle>{t('immos.archive_named', { name: toArchive?.nom })}</DialogTitle><DialogDescription>{t('immos.archive_warning')}</DialogDescription></DialogHeader>
                    <DialogFooter><Button variant="outline" disabled={busy} onClick={() => setToArchive(null)}>{t('immos.cancel')}</Button><Button disabled={busy} onClick={() => mutation.mutate({ kind: 'archive', id: toArchive?.id })}>{t('immos.confirm_archive')}</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
