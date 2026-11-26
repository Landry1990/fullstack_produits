import { useRef, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { ArrowLeftRight, X } from 'lucide-react';
import { gooeyToast } from 'goey-toast';
import api from '../../services/api';
import { generateUUID } from '../../utils/uuid';
import { Button } from '../shadcn/button';
import { Input } from '../shadcn/input';
import { Select } from '../shadcn/select';

interface Props {
    open: boolean;
    onClose: () => void;
}

export default function VirementTresorerieDialog({ open, onClose }: Props) {
    const { t } = useTranslation('accounting');
    const queryClient = useQueryClient();
    const [sens, setSens] = useState<'caisse_banque' | 'banque_caisse'>('caisse_banque');
    const [montant, setMontant] = useState('');
    const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
    const [libelle, setLibelle] = useState('');
    const [error, setError] = useState('');
    // Une clé par contenu soumis : un retry/double-clic renvoie la même
    // Idempotency-Key (pas de doublon d'OD), mais un virement réellement
    // différent (montant/date modifiés) repart avec une nouvelle clé.
    const idempotencyKey = useRef('');
    const lastSignature = useRef('');

    const mutation = useMutation({
        mutationFn: async () => (await api.post('compta/ecritures/virement-tresorerie/', {
            sens, montant, date, libelle,
        }, {
            headers: { 'Idempotency-Key': idempotencyKey.current },
        })).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['accounting'] });
            gooeyToast.success(t('virement.saved'));
            setMontant('');
            setLibelle('');
            setError('');
            onClose();
        },
        onError: (e: unknown) => {
            const data = (e as { response?: { data?: Record<string, unknown> | string } })?.response?.data;
            const msg = typeof data === 'string' ? data
                : Object.values(data || {}).flat().filter((v): v is string => typeof v === 'string').join(' ');
            setError(msg || t('virement.error'));
        },
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        if (!montant || Number(montant) <= 0 || !date) {
            setError(t('regs.required'));
            return;
        }
        const signature = `${sens}|${montant}|${date}|${libelle}`;
        if (signature !== lastSignature.current) {
            lastSignature.current = signature;
            idempotencyKey.current = generateUUID();
        }
        mutation.mutate();
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true">
            <form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <ArrowLeftRight className="size-5 text-sky-600" />
                        {t('virement.title')}
                    </h3>
                    <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label={t('common:cancel', 'Annuler')}>
                        <X className="size-5" />
                    </button>
                </div>
                <p className="text-sm text-slate-500">{t('virement.hint')}</p>

                <div className="space-y-1.5">
                    <label htmlFor="vir-sens" className="text-sm font-medium text-slate-700">{t('virement.direction')}</label>
                    <Select id="vir-sens" value={sens} onChange={e => setSens(e.target.value as typeof sens)}>
                        <option value="caisse_banque">{t('virement.to_bank')}</option>
                        <option value="banque_caisse">{t('virement.to_cash')}</option>
                    </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label htmlFor="vir-montant" className="text-sm font-medium text-slate-700">{t('virement.amount')}</label>
                        <Input id="vir-montant" type="number" min="0.01" step="0.01" required
                            value={montant} onChange={e => setMontant(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                        <label htmlFor="vir-date" className="text-sm font-medium text-slate-700">{t('virement.date')}</label>
                        <Input id="vir-date" type="date" required value={date} onChange={e => setDate(e.target.value)} />
                    </div>
                </div>
                <div className="space-y-1.5">
                    <label htmlFor="vir-libelle" className="text-sm font-medium text-slate-700">{t('virement.label')}</label>
                    <Input id="vir-libelle" value={libelle} onChange={e => setLibelle(e.target.value)}
                        placeholder={t('virement.label_placeholder')} />
                </div>

                {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

                <div className="flex justify-end gap-3 pt-2">
                    <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
                        {t('common:cancel', 'Annuler')}
                    </Button>
                    <Button type="submit" disabled={mutation.isPending}>
                        {t('virement.submit')}
                    </Button>
                </div>
            </form>
        </div>
    );
}
